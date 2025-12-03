import { useMemo, useState } from 'react';
import { ComponentGroup as ComponentGroupType } from '@/types';
import { useCanvasStore } from '@/store/useCanvasStore';
import { GroupContextMenu } from './GroupContextMenu';
import { GroupDeleteDialog } from '@/components/ui/alert-dialog-group';
import { GroupNameDialog } from '@/components/ui/group-name-dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ComponentGroupProps {
  group: ComponentGroupType;
  zoom: number;
}

export function ComponentGroup({ group, zoom }: ComponentGroupProps) {
  const { nodes, selectedGroupId, selectGroup, deleteGroup, updateGroup } = useCanvasStore();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  
  // Calculate group bounds from nodes
  const bounds = useMemo(() => {
    const groupNodes = nodes.filter((node) => group.nodeIds.includes(node.id));
    if (groupNodes.length === 0) {
      return null;
    }

    const padding = 20;
    const minX = Math.min(...groupNodes.map((n) => n.position.x)) - padding;
    const minY = Math.min(...groupNodes.map((n) => n.position.y)) - padding;
    const maxX = Math.max(...groupNodes.map((n) => n.position.x + 140)) + padding;
    const maxY = Math.max(...groupNodes.map((n) => n.position.y + 140)) + padding;

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }, [nodes, group.nodeIds]);

  if (!bounds) return null;

  const isSelected = selectedGroupId === group.id;
  const groupColor = group.color || 'hsl(var(--primary))';

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    selectGroup(group.id);
    if (onContextMenu) {
      onContextMenu(group.id, e.clientX, e.clientY);
    }
  };

  const handleDelete = () => {
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = () => {
    deleteGroup(group.id);
    toast.success('Group deleted');
    setShowDeleteDialog(false);
  };

  const handleRename = () => {
    setShowRenameDialog(true);
  };

  const handleRenameConfirm = (newName: string) => {
    updateGroup(group.id, { name: newName });
    toast.success('Group renamed');
    setShowRenameDialog(false);
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(group.id);
    toast.success('Group ID copied to clipboard');
  };

  return (
    <>
      <g>
        {/* Group background */}
        <rect
          x={bounds.x}
          y={bounds.y}
          width={bounds.width}
          height={bounds.height}
          fill={groupColor}
          fillOpacity={isSelected ? 0.1 : 0.05}
          stroke={groupColor}
          strokeWidth={isSelected ? 3 / zoom : 2 / zoom}
          strokeDasharray={isSelected ? '0' : '5,5'}
          rx={8 / zoom}
          ry={8 / zoom}
          style={{
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          onClick={(e) => {
            e.stopPropagation();
            selectGroup(group.id);
          }}
          onContextMenu={handleContextMenu}
        />

      {/* Group label - fixed position at top-left */}
      <g
        onClick={(e) => {
          e.stopPropagation();
          selectGroup(group.id);
        }}
        onContextMenu={handleContextMenu}
        style={{ cursor: 'pointer' }}
      >
        <rect
          x={bounds.x + 10 / zoom}
          y={bounds.y + 10 / zoom}
          width={Math.max(100, (group.name.length * 7 + 30) / zoom)}
          height={28 / zoom}
          fill={groupColor}
          fillOpacity={0.95}
          rx={4 / zoom}
          ry={4 / zoom}
        />
        <text
          x={bounds.x + 15 / zoom}
          y={bounds.y + 27 / zoom}
          fill="white"
          fontSize={12 / zoom}
          fontWeight="600"
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          {group.name}
        </text>
        <text
          x={bounds.x + 15 / zoom + (group.name.length * 7) / zoom + 5 / zoom}
          y={bounds.y + 27 / zoom}
          fill="white"
          fontSize={10 / zoom}
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          ({group.nodeIds.length})
        </text>
      </g>
    </g>

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
    </>
  );
}


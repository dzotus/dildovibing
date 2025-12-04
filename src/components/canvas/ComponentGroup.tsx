import { useEffect, useMemo, useState } from 'react';
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
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useState<{ x: number; y: number }>({ x: 0, y: 0 })[0];
  const initialPositionsRef = useState<Record<string, { x: number; y: number }>>({})[0];
  
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
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleBackgroundMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    selectGroup(group.id);

    // Start dragging entire group
    setIsDragging(true);
    dragStartRef.x = e.clientX;
    dragStartRef.y = e.clientY;

    // Capture initial positions of nodes in this group
    const groupNodes = nodes.filter((node) => group.nodeIds.includes(node.id));
    groupNodes.forEach((node) => {
      initialPositionsRef[node.id] = { ...node.position };
    });
  };

  // Global mousemove/mouseup handlers for group drag
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = (e.clientX - dragStartRef.x) / zoom;
      const dy = (e.clientY - dragStartRef.y) / zoom;

      // Move all nodes in the group
      group.nodeIds.forEach((nodeId) => {
        const initial = initialPositionsRef[nodeId];
        if (!initial) return;
        useCanvasStore.getState().updateNode(nodeId, {
          position: {
            x: initial.x + dx,
            y: initial.y + dy,
          },
        }, true);
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStartRef, initialPositionsRef, group.nodeIds, zoom]);

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
          onMouseDown={handleBackgroundMouseDown}
          onContextMenu={handleContextMenu}
        />

        {/* Group label - fixed position at top-left (only if showName is true or undefined) */}
        {(group.showName !== false) && (
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
              width={Math.max(100, (group.name.length * 7 + 20) / zoom)}
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
          </g>
        )}
      </g>

      {/* Context menu for group */}
      {contextMenu && (
        <GroupContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onDelete={handleDelete}
          onRename={handleRename}
          onCopyId={handleCopyId}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Delete confirmation dialog */}
      <GroupDeleteDialog
        open={showDeleteDialog}
        groupName={group.name}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setShowDeleteDialog(false)}
      />

      {/* Rename dialog */}
      <GroupNameDialog
        open={showRenameDialog}
        initialName={group.name}
        onConfirm={handleRenameConfirm}
        onCancel={() => setShowRenameDialog(false)}
      />
    </>
  );
}


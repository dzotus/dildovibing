import { useState, memo } from 'react';
import { ComponentGroup as ComponentGroupType } from '@/types';
import { useCanvasStore } from '@/store/useCanvasStore';
import { GroupContextMenu } from './GroupContextMenu';
import { GroupDeleteDialog } from '@/components/ui/alert-dialog-group';
import { GroupNameDialog } from '@/components/ui/group-name-dialog';
import { toast } from 'sonner';
import { useNodeDimensions } from '@/hooks/useNodeDimensions';
import { useGroupBounds } from '@/hooks/useGroupBounds';
import { useGroupDrag } from '@/hooks/useGroupDrag';

interface ComponentGroupProps {
  group: ComponentGroupType;
  zoom: number;
}

// Константы для плашки имени
const LABEL_HEIGHT = 18;
const LABEL_PADDING = 6;

function ComponentGroupComponent({ group, zoom }: ComponentGroupProps) {
  const { nodes, selectedGroupId, selectGroup, deleteGroup, updateGroup } = useCanvasStore();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  
  // Используем хуки для разделения ответственности
  const nodeDimensions = useNodeDimensions(group.nodeIds, zoom);
  const bounds = useGroupBounds(group, nodes, nodeDimensions, zoom);
  const { isDragging, handleMouseDown } = useGroupDrag(group, zoom);

  if (!bounds) {
      return null;
    }

  const isSelected = selectedGroupId === group.id;
  const groupColor = group.color || 'hsl(var(--primary))';

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    selectGroup(group.id);
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  // Логика перетаскивания вынесена в хук useGroupDrag

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
          onMouseDown={handleMouseDown}
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
              x={bounds.x + LABEL_PADDING}
              y={bounds.y + LABEL_PADDING}
              width={Math.max(80, group.name.length * 6.5 + 16)}
              height={LABEL_HEIGHT}
              fill={groupColor}
              fillOpacity={0.85}
              rx={3}
              ry={3}
              stroke={groupColor}
              strokeWidth={0.5}
            />
            <text
              x={bounds.x + LABEL_PADDING + 8}
              y={bounds.y + LABEL_PADDING + LABEL_HEIGHT / 2}
              fill="white"
              fontSize={11}
              fontWeight="600"
              dominantBaseline="middle"
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

// Memoize component to prevent unnecessary re-renders
// Only re-render if group properties or zoom changes
export const ComponentGroup = memo(ComponentGroupComponent, (prevProps, nextProps) => {
  // Compare group by id and key properties
  if (prevProps.group.id !== nextProps.group.id) return false;
  if (prevProps.group.name !== nextProps.group.name) return false;
  if (prevProps.group.color !== nextProps.group.color) return false;
  
  // Compare nodeIds array (shallow comparison is enough - array reference changes when nodes are added/removed)
  if (prevProps.group.nodeIds.length !== nextProps.group.nodeIds.length) return false;
  if (prevProps.group.nodeIds.some((id, idx) => id !== nextProps.group.nodeIds[idx])) return false;
  
  // Compare zoom (affects rendering)
  if (prevProps.zoom !== nextProps.zoom) return false;
  
  // If all checks pass, props are equal - skip re-render
  return true;
});


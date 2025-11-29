import { useState, useEffect, useRef } from 'react';
import { useCanvasStore } from '@/store/useCanvasStore';
import { useTabStore } from '@/store/useTabStore';
import { CanvasNode as CanvasNodeType } from '@/types';
import { COMPONENT_LIBRARY } from '@/data/components';
import { ContextMenu } from './ContextMenu';
import { toast } from 'sonner';
import { deepClone } from '@/lib/deepClone';

interface CanvasNodeProps {
  node: CanvasNodeType;
  onConnectionStart?: () => void;
  onConnectionEnd?: () => void;
  isConnecting?: boolean;
}

export function CanvasNode({ node, onConnectionStart, onConnectionEnd, isConnecting = false }: CanvasNodeProps) {
  const { selectNode, updateNode, deleteNode, addNode, startDragOperation, endDragOperation } = useCanvasStore();
  const { addTab } = useTabStore();
  const [isDragging, setIsDragging] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const dragStartRef = useRef({ x: 0, y: 0 });
  const isPointerDownRef = useRef(false);
  const dragInitiatedRef = useRef(false);

  const component = COMPONENT_LIBRARY.find((c) => c.type === node.type);

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isPointerDownRef.current) return;

      const deltaX = e.clientX - dragStartRef.current.x;
      const deltaY = e.clientY - dragStartRef.current.y;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      if (!dragInitiatedRef.current && distance > 3) {
        dragInitiatedRef.current = true;
        setIsDragging(true);
        startDragOperation(node.id);
      }

      if (dragInitiatedRef.current) {
        updateNode(node.id, {
          position: {
            x: e.clientX - dragOffsetRef.current.x,
            y: e.clientY - dragOffsetRef.current.y,
          },
        }, true);
      }
    };

    const handleGlobalMouseUp = () => {
      if (!isPointerDownRef.current) return;

      isPointerDownRef.current = false;

      if (dragInitiatedRef.current) {
        dragInitiatedRef.current = false;
        setIsDragging(false);
        endDragOperation();
      }
    };

    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [node.id, updateNode, startDragOperation, endDragOperation]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      selectNode(node.id);
      
      dragOffsetRef.current = {
        x: e.clientX - node.position.x,
        y: e.clientY - node.position.y,
      };
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      isPointerDownRef.current = true;
      dragInitiatedRef.current = false;
      e.stopPropagation();
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    // Cancel drag operation if already started
    if (isDragging) {
      setIsDragging(false);
      endDragOperation();
    }

    // Open component configuration tab for this specific instance
    addTab({
      title: `${node.data.label} Config`,
      type: 'component',
      componentId: node.id,
      componentType: node.type,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Delete' && node.selected) {
      deleteNode(node.id);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    selectNode(node.id);
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleDelete = () => {
    deleteNode(node.id);
    toast.success('Элемент удалён');
  };

  const handleDuplicate = () => {
    const duplicatedNode: CanvasNodeType = {
      ...deepClone(node),
      id: `${node.type}_${Date.now()}`,
      position: {
        x: node.position.x + 20,
        y: node.position.y + 20,
      },
      selected: false,
    };

    if (duplicatedNode.data?.config) {
      duplicatedNode.data.config = deepClone(duplicatedNode.data.config);
    }

    addNode(duplicatedNode);
    toast.success('Элемент дублирован');
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(node.id);
    toast.success('ID скопирован в буфер обмена');
  };

  const handleConnectionPointMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    onConnectionStart?.();
  };

  const handleConnectionPointMouseUp = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isConnecting) {
      onConnectionEnd?.();
    }
  };

  return (
    <>
      <div
        className={`
          absolute cursor-move select-none
          transition-shadow
          ${node.selected ? 'glow-primary' : ''}
          ${isDragging ? 'pointer-events-none' : ''}
        `}
        style={{
          left: `${node.position.x}px`,
          top: `${node.position.y}px`,
        }}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        <div
          className={`
            bg-card border-2 rounded-lg p-4 min-w-[140px] relative
            ${node.selected ? 'border-primary' : 'border-border'}
            hover:border-primary/50 transition-colors
          `}
        >
          <div className="flex flex-col items-center gap-2 select-none">
            <div className="text-3xl select-none pointer-events-none">{component?.icon}</div>
            <div className="text-sm font-medium text-center text-foreground select-none pointer-events-none">
              {node.data.label}
            </div>
          </div>

          {/* Connection points */}
          <div
            className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-primary border-2 border-card cursor-crosshair hover:scale-125 transition-transform"
            onMouseDown={handleConnectionPointMouseDown}
            onMouseUp={handleConnectionPointMouseUp}
            title="Создать соединение"
          />
          <div
            className="absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-primary border-2 border-card cursor-crosshair hover:scale-125 transition-transform"
            onMouseDown={handleConnectionPointMouseDown}
            onMouseUp={handleConnectionPointMouseUp}
            title="Создать соединение"
          />
        </div>
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onDelete={handleDelete}
          onDuplicate={handleDuplicate}
          onCopyId={handleCopyId}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  );
}
import { useEffect, useRef, useState } from 'react';
import { Trash2, Copy, Layers, ArrowUp, ArrowDown, ChevronUp, ChevronDown, FolderPlus } from 'lucide-react';

interface ContextMenuProps {
  x: number;
  y: number;
  onDelete: () => void;
  onDuplicate: () => void;
  onCopyId: () => void;
  onBringToFront?: () => void;
  onSendToBack?: () => void;
  onBringForward?: () => void;
  onSendBackward?: () => void;
  onAddToGroup?: () => void;
  onClose: () => void;
}

export function ContextMenu({
  x,
  y,
  onDelete,
  onDuplicate,
  onCopyId,
  onBringToFront,
  onSendToBack,
  onBringForward,
  onSendBackward,
  onAddToGroup,
  onClose,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  // Use coordinates directly - menu appears exactly where clicked
  // No state, no adjustments - just use the coordinates as-is

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscapeKey);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [onClose]);

  const handleDelete = () => {
    onDelete();
    onClose();
  };

  const handleDuplicate = () => {
    onDuplicate();
    onClose();
  };

  const handleCopyId = () => {
    onCopyId();
    onClose();
  };

  const handleBringToFront = () => {
    onBringToFront?.();
    onClose();
  };

  const handleSendToBack = () => {
    onSendToBack?.();
    onClose();
  };

  const handleBringForward = () => {
    onBringForward?.();
    onClose();
  };

  const handleSendBackward = () => {
    onSendBackward?.();
    onClose();
  };

  const handleAddToGroup = () => {
    onAddToGroup?.();
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="fixed bg-popover border border-border rounded-md shadow-lg z-50 py-0.5 min-w-[140px]"
      style={{
        left: `${x}px`,
        top: `${y}px`,
      }}
    >
      <button
        onClick={handleDuplicate}
        className="w-full px-2 py-1.5 text-xs text-foreground hover:bg-accent hover:text-accent-foreground flex items-center gap-1.5 transition-colors"
      >
        <Layers className="w-3.5 h-3.5" />
        Duplicate
      </button>
      <button
        onClick={handleCopyId}
        className="w-full px-2 py-1.5 text-xs text-foreground hover:bg-accent hover:text-accent-foreground flex items-center gap-1.5 transition-colors"
      >
        <Copy className="w-3.5 h-3.5" />
        Copy ID
      </button>
      {onAddToGroup && (
        <>
          <div className="border-t border-border my-0.5" />
          <button
            onClick={handleAddToGroup}
            className="w-full px-2 py-1.5 text-xs text-foreground hover:bg-accent hover:text-accent-foreground flex items-center gap-1.5 transition-colors"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            Add to Group
          </button>
        </>
      )}
      <div className="border-t border-border my-0.5" />
      {(onBringToFront || onSendToBack || onBringForward || onSendBackward) && (
        <>
          <button
            onClick={handleBringToFront}
            className="w-full px-2 py-1.5 text-xs text-foreground hover:bg-accent hover:text-accent-foreground flex items-center gap-1.5 transition-colors"
          >
            <ArrowUp className="w-3.5 h-3.5" />
            Bring to Front
          </button>
          <button
            onClick={handleSendToBack}
            className="w-full px-2 py-1.5 text-xs text-foreground hover:bg-accent hover:text-accent-foreground flex items-center gap-1.5 transition-colors"
          >
            <ArrowDown className="w-3.5 h-3.5" />
            Send to Back
          </button>
          <button
            onClick={handleBringForward}
            className="w-full px-2 py-1.5 text-xs text-foreground hover:bg-accent hover:text-accent-foreground flex items-center gap-1.5 transition-colors"
          >
            <ChevronUp className="w-3.5 h-3.5" />
            Bring Forward
          </button>
          <button
            onClick={handleSendBackward}
            className="w-full px-2 py-1.5 text-xs text-foreground hover:bg-accent hover:text-accent-foreground flex items-center gap-1.5 transition-colors"
          >
            <ChevronDown className="w-3.5 h-3.5" />
            Send Backward
          </button>
          <div className="border-t border-border my-0.5" />
        </>
      )}
      <button
        onClick={handleDelete}
        className="w-full px-2.5 py-1.5 text-xs text-destructive hover:bg-destructive hover:text-destructive-foreground flex items-center gap-1.5 transition-colors"
      >
        <Trash2 className="w-3.5 h-3.5" />
        Delete
      </button>
    </div>
  );
}

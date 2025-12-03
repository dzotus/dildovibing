import { useEffect, useRef, useState } from 'react';
import { Trash2, Edit, Copy, X } from 'lucide-react';

interface GroupContextMenuProps {
  x: number;
  y: number;
  onDelete: () => void;
  onRename: () => void;
  onCopyId: () => void;
  onClose: () => void;
}

export function GroupContextMenu({
  x,
  y,
  onDelete,
  onRename,
  onCopyId,
  onClose,
}: GroupContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x, y });

  useEffect(() => {
    if (menuRef.current) {
      const menuRect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let adjustedX = x;
      let adjustedY = y;

      if (x + menuRect.width > viewportWidth) {
        adjustedX = viewportWidth - menuRect.width - 10;
      }

      if (y + menuRect.height > viewportHeight) {
        adjustedY = viewportHeight - menuRect.height - 10;
      }

      adjustedX = Math.max(10, adjustedX);
      adjustedY = Math.max(10, adjustedY);

      setPosition({ x: adjustedX, y: adjustedY });
    }
  }, [x, y]);

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

  return (
    <div
      ref={menuRef}
      className="fixed bg-popover border border-border rounded-md shadow-lg z-50 py-0.5 min-w-[120px]"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      <button
        onClick={() => {
          onRename();
          onClose();
        }}
        className="w-full px-2 py-1 text-xs text-foreground hover:bg-accent hover:text-accent-foreground flex items-center gap-1.5 transition-colors"
      >
        <Edit className="w-3.5 h-3.5" />
        Rename
      </button>
      <button
        onClick={() => {
          onCopyId();
          onClose();
        }}
        className="w-full px-2 py-1 text-xs text-foreground hover:bg-accent hover:text-accent-foreground flex items-center gap-1.5 transition-colors"
      >
        <Copy className="w-3.5 h-3.5" />
        Copy ID
      </button>
      <div className="border-t border-border my-0.5" />
      <button
        onClick={() => {
          onDelete();
          onClose();
        }}
        className="w-full px-2.5 py-1.5 text-xs text-destructive hover:bg-destructive hover:text-destructive-foreground flex items-center gap-1.5 transition-colors"
      >
        <Trash2 className="w-3.5 h-3.5" />
        Delete
      </button>
    </div>
  );
}


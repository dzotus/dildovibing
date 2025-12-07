import { useState, useRef, useEffect, useCallback } from 'react';
import { ComponentGroup, CanvasNode } from '@/types';
import { useCanvasStore } from '@/store/useCanvasStore';
import { saveDiagramToStorage } from '@/utils/persistence';

/**
 * Хук для управления перетаскиванием группы узлов
 */
export function useGroupDrag(group: ComponentGroup, zoom: number) {
  const { nodes, updateNodes } = useCanvasStore();
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const initialPositionsRef = useRef<Record<string, { x: number; y: number }>>({});

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    
    // Проверяем, не был ли клик на самом компоненте (не на фоне группы)
    const target = e.target as HTMLElement;
    const clickedNode = target.closest('[data-node-id]');
    if (clickedNode) {
      return;
    }
    
    e.stopPropagation();
    const store = useCanvasStore.getState();
    store.selectGroup(group.id);

    setIsDragging(true);
    dragStartRef.current.x = e.clientX;
    dragStartRef.current.y = e.clientY;

    store.setGroupDragging(true);

    // Capture initial positions of nodes in this group
    const groupNodes = nodes.filter((node) => group.nodeIds.includes(node.id));
    initialPositionsRef.current = {};
    groupNodes.forEach((node) => {
      initialPositionsRef.current[node.id] = { ...node.position };
    });
  }, [group.id, group.nodeIds, nodes]);

  useEffect(() => {
    if (!isDragging) return;

    let rafId: number | null = null;
    let pendingUpdate: { dx: number; dy: number } | null = null;
    let isDraggingActive = true;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingActive) return;
      
      const dx = (e.clientX - dragStartRef.current.x) / zoom;
      const dy = (e.clientY - dragStartRef.current.y) / zoom;

      pendingUpdate = { dx, dy };

      if (rafId === null) {
        rafId = requestAnimationFrame(() => {
          if (!isDraggingActive || !pendingUpdate) {
            rafId = null;
            pendingUpdate = null;
            return;
          }
          
          const { dx, dy } = pendingUpdate;
          const store = useCanvasStore.getState();
          
          const updates = group.nodeIds
            .map((nodeId) => {
              const initial = initialPositionsRef.current[nodeId];
              if (initial) {
                return {
                  id: nodeId,
                  updates: {
                    position: {
                      x: initial.x + dx,
                      y: initial.y + dy,
                    },
                  },
                };
              }
              return null;
            })
            .filter((update) => update !== null) as Array<{ id: string; updates: Partial<CanvasNode> }>;
          
          if (updates.length > 0) {
            store.updateNodes(updates, true);
          }
          
          rafId = null;
          pendingUpdate = null;
        });
      }
    };

    const handleMouseUp = (e?: MouseEvent) => {
      if (e && e.button !== 0) return;
      
      isDraggingActive = false;
      
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      
      const store = useCanvasStore.getState();
      
      if (pendingUpdate) {
        const { dx, dy } = pendingUpdate;
        
        const updates = group.nodeIds
          .map((nodeId) => {
            const initial = initialPositionsRef.current[nodeId];
            if (initial) {
              return {
                id: nodeId,
                updates: {
                  position: {
                    x: initial.x + dx,
                    y: initial.y + dy,
                  },
                },
              };
            }
            return null;
          })
          .filter((update) => update !== null) as Array<{ id: string; updates: Partial<CanvasNode> }>;
        
        store.setGroupDragging(false);
        
        if (updates.length > 0) {
          store.updateNodes(updates, true);
          
          const state = useCanvasStore.getState();
          saveDiagramToStorage(state, state.diagramName);
        }
      } else {
        store.setGroupDragging(false);
      }
      
      pendingUpdate = null;
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('mouseup', handleMouseUp, { capture: true });

    return () => {
      isDraggingActive = false;
      
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp, { capture: true });
      const store = useCanvasStore.getState();
      store.setGroupDragging(false);
    };
  }, [isDragging, group.nodeIds, zoom]);

  return {
    isDragging,
    handleMouseDown,
  };
}

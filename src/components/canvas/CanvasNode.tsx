import { useState, useEffect, useRef } from 'react';
import { useCanvasStore } from '@/store/useCanvasStore';
import { useTabStore } from '@/store/useTabStore';
import { useEmulationStore } from '@/store/useEmulationStore';
import { useDependencyStore } from '@/store/useDependencyStore';
import { useComponentStateStore } from '@/store/useComponentStateStore';
import { useUIStore } from '@/store/useUIStore';
import { CanvasNode as CanvasNodeType } from '@/types';
import { COMPONENT_LIBRARY } from '@/data/components';
import { ContextMenu } from './ContextMenu';
import { toast } from 'sonner';
import { deepClone } from '@/lib/deepClone';
import { AlertCircle, CheckCircle2, AlertTriangle, XCircle, PowerOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getConnectionPoints } from '@/utils/connectionPoints';

interface CanvasNodeProps {
  node: CanvasNodeType;
  onConnectionStart?: () => void;
  onConnectionEnd?: (portIndex?: number) => void;
  isConnecting?: boolean;
  onContextMenu?: (x: number, y: number) => void;
}

export function CanvasNode({ node, onConnectionStart, onConnectionEnd, isConnecting = false, onContextMenu }: CanvasNodeProps) {
  const { selectNode, updateNode, deleteNode, addNode, startDragOperation, endDragOperation, connections, zoom, pan, bringToFront, sendToBack, bringForward, sendBackward } = useCanvasStore();
  const { addTab } = useTabStore();
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const dragStartRef = useRef({ x: 0, y: 0 });
  const dragStartWorldPosRef = useRef({ x: 0, y: 0 });
  const dragStartNodePosRef = useRef({ x: 0, y: 0 });
  const canvasElementRef = useRef<HTMLElement | null>(null);
  const canvasRectRef = useRef<DOMRect | null>(null);
  const isPointerDownRef = useRef(false);
  const dragInitiatedRef = useRef(false);

  const component = COMPONENT_LIBRARY.find((c) => c.type === node.type);
  const { isRunning, getComponentMetrics } = useEmulationStore();
  const componentStatus = useDependencyStore((state) => state.getComponentStatus(node.id));
  const componentState = useComponentStateStore((state) => state.getComponentState(node.id));
  const metrics = isRunning ? getComponentMetrics(node.id) : undefined;
  const { highlightedNodeId } = useUIStore();
  const isHighlighted = highlightedNodeId === node.id;
  
  // Check if component has connections
  const hasConnections = connections.some(
    conn => conn.source === node.id || conn.target === node.id
  );
  
  // Check if component has activity (throughput > 0 or errors)
  // Only consider it active if metrics are significantly above zero
  const hasActivity = metrics && (
    (metrics.throughput && metrics.throughput > 0.1) || 
    (metrics.errorRate && metrics.errorRate > 0.001) ||
    (metrics.utilization && metrics.utilization > 0.01)
  );
  
  // Heat map border color based on utilization - only for connected components with activity
  const getHeatMapBorderColor = () => {
    if (!isRunning || !metrics || !hasConnections || !hasActivity) return '';
    
    const utilization = metrics.utilization || 0;
    const errorRate = metrics.errorRate || 0;
    
    // Combine utilization and error rate for heat map
    const heatValue = Math.min(1, utilization * 0.7 + errorRate * 0.3);
    
    if (heatValue > 0.8) {
      return 'border-red-500';
    } else if (heatValue > 0.6) {
      return 'border-orange-500';
    } else if (heatValue > 0.4) {
      return 'border-yellow-500';
    } else if (heatValue > 0.2) {
      return 'border-green-500';
    }
    return '';
  };
  
  // Get health indicator - only show for connected components or manual state
  const getHealthIndicator = () => {
    if (!isRunning) return null;
    
    // Manual state always shows
    if (componentState) {
      switch (componentState.state) {
        case 'disabled':
        case 'failed':
          return <PowerOff className="text-red-500" size={16} />;
        case 'degraded':
          return <AlertTriangle className="text-yellow-500" size={16} />;
        case 'enabled':
          break; // Use health status
      }
    }
    
    // Only show health for connected components with activity
    if (!hasConnections || !hasActivity) return null;
    if (!componentStatus) return null;
    
    const health = componentStatus.health;
    const size = 16;
    
    switch (health) {
      case 'healthy':
        return <CheckCircle2 className="text-green-500" size={size} />;
      case 'degraded':
        return <AlertTriangle className="text-yellow-500" size={size} />;
      case 'critical':
        return <AlertCircle className="text-orange-500" size={size} />;
      case 'down':
        return <XCircle className="text-red-500" size={size} />;
      default:
        return null;
    }
  };
  
  // Get border color based on health, critical path, and manual state
  const getBorderColor = () => {
    if (!isRunning) {
      return node.selected ? 'border-primary' : 'border-border';
    }
    
    // Manual state takes priority
    if (componentState) {
      switch (componentState.state) {
        case 'disabled':
        case 'failed':
          return 'border-red-500 border-2';
        case 'degraded':
          return 'border-yellow-500 border-2';
        case 'enabled':
          break; // Use health status
      }
    }
    
    if (!componentStatus) {
      return node.selected ? 'border-primary' : 'border-border';
    }
    
    if (componentStatus.criticalPath) {
      return 'border-purple-500 border-2';
    }
    
    switch (componentStatus.health) {
      case 'down':
        return 'border-red-500 border-2';
      case 'critical':
        return 'border-orange-500';
      case 'degraded':
        return 'border-yellow-500';
      default:
        return node.selected ? 'border-primary' : 'border-border';
    }
  };
  

  // Use refs for zoom and pan to avoid recreating handlers during drag
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  
  useEffect(() => {
    zoomRef.current = zoom;
    panRef.current = pan;
  }, [zoom, pan]);

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

      if (dragInitiatedRef.current && canvasElementRef.current) {
        // Get current zoom and pan from refs (frozen at drag start)
        const currentZoom = zoomRef.current;
        const currentPan = panRef.current;
        
        // Get fresh canvasRect for accurate calculations
        const canvasRect = canvasElementRef.current.getBoundingClientRect();
        
        // Convert current mouse position to world coordinates
        const currentWorldX = (e.clientX - canvasRect.left - currentPan.x) / currentZoom;
        const currentWorldY = (e.clientY - canvasRect.top - currentPan.y) / currentZoom;
        
        // Calculate delta from start position in world coordinates
        const deltaX = currentWorldX - dragStartWorldPosRef.current.x;
        const deltaY = currentWorldY - dragStartWorldPosRef.current.y;
        
        // Calculate new position based on initial node position + delta
        const newX = dragStartNodePosRef.current.x + deltaX;
        const newY = dragStartNodePosRef.current.y + deltaY;
        
        // Update node position directly
        updateNode(node.id, {
          position: {
            x: newX,
            y: newY,
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
    if (e.button !== 0) return;

    // Multi-select with Ctrl/Cmd
    const multiSelect = e.ctrlKey || e.metaKey;
    selectNode(node.id, multiSelect);

    // Find canvas element to get its position
    const canvasElement = document.querySelector('.flex-1.overflow-hidden.relative') as HTMLElement;
    if (!canvasElement) {
      dragOffsetRef.current = { x: 0, y: 0 };
      dragStartWorldPosRef.current = { x: 0, y: 0 };
      dragStartNodePosRef.current = { x: 0, y: 0 };
      canvasElementRef.current = null;
      canvasRectRef.current = null;
      return;
    }
    
    // Store canvas element reference
    canvasElementRef.current = canvasElement;
    
    // Get current zoom and pan (will be frozen during drag)
    const currentZoom = zoomRef.current;
    const currentPan = panRef.current;
    
    const canvasRect = canvasElement.getBoundingClientRect();
    canvasRectRef.current = canvasRect;
    
    // Convert screen coordinates to world coordinates at drag start
    const startWorldX = (e.clientX - canvasRect.left - currentPan.x) / currentZoom;
    const startWorldY = (e.clientY - canvasRect.top - currentPan.y) / currentZoom;
    
    // Store start position in world coordinates
    dragStartWorldPosRef.current = {
      x: startWorldX,
      y: startWorldY,
    };
    
    // Store initial node position
    dragStartNodePosRef.current = {
      x: node.position.x,
      y: node.position.y,
    };
    
    // Calculate offset: difference between mouse position and node position in world coordinates
    dragOffsetRef.current = {
      x: startWorldX - node.position.x,
      y: startWorldY - node.position.y,
    };
    
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    isPointerDownRef.current = true;
    dragInitiatedRef.current = false;
    e.stopPropagation();
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
    // Pass coordinates to parent (Canvas) to render menu outside transform container
    onContextMenu?.(e.clientX, e.clientY);
  };

  const handleDelete = () => {
    deleteNode(node.id);
    toast.success('Element deleted');
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
    toast.success('Element duplicated');
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(node.id);
    toast.success('ID copied to clipboard');
  };

  const handleBringToFront = () => {
    bringToFront(node.id);
    toast.success('Brought to front');
  };

  const handleSendToBack = () => {
    sendToBack(node.id);
    toast.success('Sent to back');
  };

  const handleBringForward = () => {
    bringForward(node.id);
    toast.success('Brought forward');
  };

  const handleSendBackward = () => {
    sendBackward(node.id);
    toast.success('Sent backward');
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

  // Allow connection to complete when mouse is released anywhere on the node
  const handleNodeMouseUp = (e: React.MouseEvent) => {
    if (isConnecting) {
      e.stopPropagation();
      // Find nearest connection point to mouse position
      const connectionPoints = getConnectionPoints(
        node.position.x,
        node.position.y,
        140,
        100,
        16
      );
      const canvasElement = document.querySelector('.flex-1.overflow-hidden.relative') as HTMLElement;
      if (canvasElement) {
        const canvasRect = canvasElement.getBoundingClientRect();
        const worldX = (e.clientX - canvasRect.left - pan.x) / zoom;
        const worldY = (e.clientY - canvasRect.top - pan.y) / zoom;
        
        let minDistance = Infinity;
        let nearestIndex = 0;
        for (let i = 0; i < connectionPoints.length; i++) {
          const point = connectionPoints[i];
          const distance = Math.sqrt(
            Math.pow(worldX - point.x, 2) + Math.pow(worldY - point.y, 2)
          );
          if (distance < minDistance) {
            minDistance = distance;
            nearestIndex = i;
          }
        }
        onConnectionEnd?.(nearestIndex);
      } else {
        onConnectionEnd?.();
      }
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
        onMouseUp={handleNodeMouseUp}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        onKeyDown={handleKeyDown}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        tabIndex={0}
      >
        <div
          className={cn(
            "bg-card border-2 rounded-lg p-4 min-w-[140px] relative",
            getBorderColor(),
            getHeatMapBorderColor(),
            "hover:border-primary/50 transition-colors",
            componentStatus?.criticalPath && "shadow-lg shadow-purple-500/20",
            isHighlighted && "ring-4 ring-yellow-400 ring-offset-2 animate-pulse"
          )}
        >
          {/* Health indicator */}
          {isRunning && componentStatus && (
            <div className="absolute -top-2 -right-2 bg-card rounded-full p-0.5 border border-border">
              {getHealthIndicator()}
            </div>
          )}
          
          {/* Critical path indicator */}
          {isRunning && componentStatus?.criticalPath && (
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 bg-purple-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-semibold">
              CRITICAL
            </div>
          )}
          
          <div className="flex flex-col items-center gap-2 select-none">
            <div className="text-3xl select-none pointer-events-none">{component?.icon}</div>
            <div className="text-sm font-medium text-center text-foreground select-none pointer-events-none">
              {node.data.label}
            </div>
          </div>

          {/* Connection points - visible on hover or when connecting */}
          {(isHovered || isConnecting) && (() => {
            const connectionPoints = getConnectionPoints(
              node.position.x,
              node.position.y,
              140,
              100,
              16
            );
            
            return (
              <>
                {connectionPoints.map((point, index) => {
                  const pointX = point.x - node.position.x;
                  const pointY = point.y - node.position.y;
                  
                  return (
                    <div
                      key={index}
                      className="absolute w-3 h-3 rounded-full bg-primary/80 border-2 border-card cursor-crosshair hover:scale-150 hover:bg-primary transition-all z-10"
                      style={{
                        left: `${pointX - 6}px`,
                        top: `${pointY - 6}px`,
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        handleConnectionPointMouseDown(e);
                      }}
                      onMouseUp={(e) => {
                        e.stopPropagation();
                        if (isConnecting) {
                          onConnectionEnd?.(index);
                        }
                      }}
                      title="Connection point"
                    />
                  );
                })}
              </>
            );
          })()}
        </div>
      </div>

    </>
  );
}
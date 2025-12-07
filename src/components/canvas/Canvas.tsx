import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { useCanvasStore } from '@/store/useCanvasStore';
import { useEmulationStore } from '@/store/useEmulationStore';
import { useUIStore } from '@/store/useUIStore';
import { CanvasNode as CanvasNodeType, ComponentType, CanvasConnection } from '@/types';
import { CanvasNode } from './CanvasNode';
import { ConnectionLine } from './ConnectionLine';
import { MetricsOverlay } from '@/components/emulation/MetricsOverlay';
import { HeatMapLegend } from '@/components/emulation/HeatMapLegend';
import { DataPathVisualization } from './DataPathVisualization';
import { CanvasMinimap } from './CanvasMinimap';
import { ComponentGroup } from './ComponentGroup';
import { CanvasRuler } from './CanvasRuler';
import { findBestConnectionPoint } from '@/utils/connectionPoints';
import { ContextMenu } from './ContextMenu';
import { deepClone } from '@/lib/deepClone';
import { toast } from 'sonner';

// Add to Group Dialog component
function AddToGroupDialog({
  nodeId,
  x,
  y,
  onClose,
}: {
  nodeId: string;
  x: number;
  y: number;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const { groups, addNodeToGroup } = useCanvasStore();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
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
      ref={dialogRef}
      className="fixed bg-popover border border-border rounded-md shadow-lg z-50 py-1 min-w-[180px]"
      style={{
        left: `${x}px`,
        top: `${y}px`,
      }}
    >
      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-b border-border">
        Add to Group
      </div>
      <div className="max-h-60 overflow-y-auto">
        {(() => {
          const availableGroups = groups.filter(group => !group.nodeIds.includes(nodeId));
          return availableGroups.length > 0 ? (
            availableGroups.map((group) => (
              <button
                key={group.id}
                onClick={() => {
                  addNodeToGroup(group.id, nodeId);
                  toast.success(`Added to "${group.name}"`);
                  onClose();
                }}
                className="w-full px-2 py-1.5 text-xs text-left text-foreground hover:bg-accent hover:text-accent-foreground flex items-center gap-2 transition-colors"
              >
                <div
                  className="w-3 h-3 rounded border border-border flex-shrink-0"
                  style={{ backgroundColor: group.color || 'hsl(var(--primary))' }}
                />
                <span className="truncate flex-1">{group.name}</span>
              </button>
            ))
          ) : (
            <div className="px-2 py-4 text-xs text-muted-foreground text-center">
              {groups.length === 0 ? 'No groups available' : 'Already in all groups'}
            </div>
          );
        })()}
      </div>
      <div className="border-t border-border mt-1">
        <button
          onClick={onClose}
          className="w-full px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// Remove from Group Dialog component
function RemoveFromGroupDialog({
  nodeId,
  x,
  y,
  onClose,
}: {
  nodeId: string;
  x: number;
  y: number;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const { groups, removeNodeFromGroup } = useCanvasStore();

  // Filter groups that contain this node
  const nodeGroups = groups.filter(group => group.nodeIds.includes(nodeId));

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
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
      ref={dialogRef}
      className="fixed bg-popover border border-border rounded-md shadow-lg z-50 py-1 min-w-[180px]"
      style={{
        left: `${x}px`,
        top: `${y}px`,
      }}
    >
      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-b border-border">
        Remove from Group
      </div>
      <div className="max-h-60 overflow-y-auto">
        {nodeGroups.length > 0 ? (
          nodeGroups.map((group) => (
            <button
              key={group.id}
              onClick={() => {
                removeNodeFromGroup(group.id, nodeId);
                toast.success(`Removed from "${group.name}"`);
                onClose();
              }}
              className="w-full px-2 py-1.5 text-xs text-left text-destructive hover:bg-destructive/10 hover:text-destructive flex items-center gap-2 transition-colors"
            >
              <div
                className="w-3 h-3 rounded border border-border flex-shrink-0"
                style={{ backgroundColor: group.color || 'hsl(var(--primary))' }}
              />
              <span className="truncate flex-1">{group.name}</span>
            </button>
          ))
        ) : (
          <div className="px-2 py-4 text-xs text-muted-foreground text-center">
            Not in any groups
          </div>
        )}
      </div>
      <div className="border-t border-border mt-1">
        <button
          onClick={onClose}
          className="w-full px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// Compact connection context menu component
function ConnectionContextMenu({
  x,
  y,
  onDelete,
  onClose,
}: {
  x: number;
  y: number;
  onDelete: () => void;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x, y });

  useEffect(() => {
    if (menuRef.current) {
      const menuRect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let adjustedX = x;
      let adjustedY = y;

      // Adjust if menu goes off right edge
      if (x + menuRect.width > viewportWidth) {
        adjustedX = viewportWidth - menuRect.width - 8;
      }

      // Adjust if menu goes off bottom edge
      if (y + menuRect.height > viewportHeight) {
        adjustedY = viewportHeight - menuRect.height - 8;
      }

      // Ensure menu doesn't go off left or top edges
      adjustedX = Math.max(8, adjustedX);
      adjustedY = Math.max(8, adjustedY);

      setPosition({ x: adjustedX, y: adjustedY });
    }
  }, [x, y]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="fixed bg-card border border-border rounded-md shadow-lg z-50"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      <button
        className="w-full px-3 py-2 text-sm text-left hover:bg-accent transition-colors first:rounded-t-md last:rounded-b-md"
        onClick={onDelete}
      >
        Delete
      </button>
    </div>
  );
}

export function Canvas() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const {
    nodes,
    connections,
    groups = [],
    addNode,
    addConnection,
    deleteConnection,
    zoom,
    pan,
    setPan,
    setZoom,
    selectNode,
    selectConnection,
    selectGroup,
    selectNodesByIds,
    selectedConnectionId,
    selectedNodeId,
    setViewportSize,
    deleteNode,
    updateNode,
    bringToFront,
    sendToBack,
    bringForward,
    sendBackward,
    canvasBounds,
    canvasChunks,
    addNodeToGroup,
    removeNodeFromGroup,
  } = useCanvasStore();
  const { isRunning } = useEmulationStore();
  const { showMinimap, showHeatMapLegend, showRuler } = useUIStore();
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStart, setConnectionStart] = useState<string | null>(null);
  const [tempLineEnd, setTempLineEnd] = useState<{ x: number; y: number } | null>(null);
  const [contextMenuConnection, setContextMenuConnection] = useState<{
    connectionId: string;
    x: number;
    y: number;
  } | null>(null);
  const [contextMenuNode, setContextMenuNode] = useState<{
    nodeId: string;
    x: number;
    y: number;
  } | null>(null);
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null);
  const [selectionRect, setSelectionRect] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [showAddToGroupDialog, setShowAddToGroupDialog] = useState<{
    nodeId: string;
    x: number;
    y: number;
  } | null>(null);
  const [showRemoveFromGroupDialog, setShowRemoveFromGroupDialog] = useState<{
    nodeId: string;
    x: number;
    y: number;
  } | null>(null);

  // Track viewport size so other parts (e.g. toolbar) can fit all nodes correctly
  useEffect(() => {
    if (!canvasRef.current) return;

    const updateSize = () => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      setViewportSize({ width: rect.width, height: rect.height });
    };

    updateSize();

    const resizeObserver = new ResizeObserver(() => {
      updateSize();
    });
    resizeObserver.observe(canvasRef.current);

    window.addEventListener('resize', updateSize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, [setViewportSize]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    
    if (!canvasRef.current) return;
    
    const componentData = e.dataTransfer.getData('application/json');
    if (!componentData) return;

    const component: ComponentType = JSON.parse(componentData);
    const rect = canvasRef.current.getBoundingClientRect();
    
    const x = (e.clientX - rect.left - pan.x) / zoom;
    const y = (e.clientY - rect.top - pan.y) / zoom;

    const newNode: CanvasNodeType = {
      id: `node-${Date.now()}`,
      type: component.type,
      position: { x, y },
      data: {
        label: component.label,
      },
    };

    addNode(newNode);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const isPrimary = e.button === 0;
    const isMiddle = e.button === 1;

    // Pan with middle mouse or Ctrl + left mouse
    if (isMiddle || (isPrimary && e.ctrlKey)) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      e.preventDefault();
      return;
    }

    // Lasso/select with plain left-click on empty space
    if (isPrimary && !isConnecting && !e.ctrlKey && !e.metaKey) {
      if (canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const x = (e.clientX - rect.left - pan.x) / zoom;
        const y = (e.clientY - rect.top - pan.y) / zoom;
        setSelectionStart({ x, y });
        setSelectionRect({ x, y, width: 0, height: 0 });
      }
      selectNode(null);
      selectConnection(null);
      selectGroup(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    } else if (isConnecting && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      setTempLineEnd({
        x: (e.clientX - rect.left - pan.x) / zoom,
        y: (e.clientY - rect.top - pan.y) / zoom,
      });
    } else if (selectionStart && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const currentX = (e.clientX - rect.left - pan.x) / zoom;
      const currentY = (e.clientY - rect.top - pan.y) / zoom;
      const x = Math.min(selectionStart.x, currentX);
      const y = Math.min(selectionStart.y, currentY);
      const width = Math.abs(currentX - selectionStart.x);
      const height = Math.abs(currentY - selectionStart.y);
      const newRect = { x, y, width, height };
      setSelectionRect(newRect);

      // Update selected nodes based on lasso
      const selectedIds = nodes
        .filter((node) => {
          const nx1 = node.position.x;
          const ny1 = node.position.y;
          const nx2 = node.position.x + 140;
          const ny2 = node.position.y + 140;
          const intersects =
            nx2 >= newRect.x &&
            nx1 <= newRect.x + newRect.width &&
            ny2 >= newRect.y &&
            ny1 <= newRect.y + newRect.height;
          return intersects;
        })
        .map((n) => n.id);

      selectNodesByIds(selectedIds);
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    if (isConnecting) {
      setIsConnecting(false);
      setConnectionStart(null);
      setTempLineEnd(null);
    }
    if (selectionStart) {
      setSelectionStart(null);
      setSelectionRect(null);
    }
  };

  const handleNodeConnectionStart = useCallback((nodeId: string) => {
    setIsConnecting(true);
    setConnectionStart(nodeId);
  }, []);

  const handleNodeConnectionEnd = useCallback((nodeId: string, targetPort?: number) => {
    if (isConnecting && connectionStart && connectionStart !== nodeId) {
      const sourceNode = nodes.find(n => n.id === connectionStart);
      const targetNode = nodes.find(n => n.id === nodeId);
      
      if (sourceNode && targetNode) {
        // Find best connection points
        const sourcePort = findBestConnectionPoint(
          connectionStart,
          nodeId,
          targetNode.position.x + 70,
          targetNode.position.y + 50,
          connections,
          sourceNode.position.x,
          sourceNode.position.y
        );
        
        const finalTargetPort = targetPort !== undefined ? targetPort : findBestConnectionPoint(
          nodeId,
          connectionStart,
          sourceNode.position.x + 70,
          sourceNode.position.y + 50,
          connections,
          targetNode.position.x,
          targetNode.position.y
        );
        
        const newConnection: CanvasConnection = {
          id: `conn-${Date.now()}`,
          source: connectionStart,
          target: nodeId,
          type: 'async',
          sourcePort,
          targetPort: finalTargetPort,
        };
        addConnection(newConnection);
      }
    }
    setIsConnecting(false);
    setConnectionStart(null);
    setTempLineEnd(null);
  }, [isConnecting, connectionStart, nodes, connections, addConnection]);

  const handleConnectionClick = useCallback((connectionId: string) => {
    selectConnection(connectionId);
  }, [selectConnection]);

  const handleConnectionContextMenu = useCallback((connectionId: string, x: number, y: number) => {
    setContextMenuConnection({ connectionId, x, y });
  }, []);

  const handleCanvasContextMenu = useCallback((e: React.MouseEvent) => {
    // Check if click was on a node, connection, or group
    const target = e.target as HTMLElement | SVGElement;
    const clickedNode = target.closest?.('[data-node-id]');
    const clickedConnection = target.closest?.('[data-connection-id]');
    
    // Check if clicked on SVG (which could be a group)
    const isSVGElement = target instanceof SVGElement;
    const isInSVG = target.closest?.('svg') !== null;
    
    // If clicked on a node or connection, let their handlers deal with it
    if (clickedNode || clickedConnection) {
      return;
    }
    
    // If clicked on SVG element (likely a group), let group handlers deal with it
    // Groups have their own onContextMenu handlers that stop propagation
    if (isSVGElement || isInSVG) {
      return;
    }
    
    // Check if there are selected nodes
    const selectedNodes = nodes.filter(n => n.selected);
    if (selectedNodes.length > 0) {
      e.preventDefault();
      e.stopPropagation();
      // Open context menu for the first selected node (it will apply to all selected)
      setContextMenuNode({ nodeId: selectedNodes[0].id, x: e.clientX, y: e.clientY });
    }
  }, [nodes]);

  const handleDeleteConnection = useCallback(() => {
    if (contextMenuConnection) {
      deleteConnection(contextMenuConnection.connectionId);
      setContextMenuConnection(null);
    }
  }, [contextMenuConnection, deleteConnection]);

  // Memoize node callbacks to prevent recreating functions on every render
  // Use node IDs as dependency string for stable comparison
  const nodeIdsString = useMemo(() => nodes.map(n => n.id).join(','), [nodes.length, nodes.map(n => n.id).join(',')]);
  
  const nodeCallbacks = useMemo(() => {
    const callbacksMap = new Map<string, {
      onConnectionStart: () => void;
      onConnectionEnd: (portIndex?: number) => void;
      onContextMenu: (x: number, y: number) => void;
    }>();
    
    nodes.forEach(node => {
      // Create stable callbacks using closures - these will only be recreated when nodes array changes
      const nodeId = node.id; // Capture in closure
      callbacksMap.set(nodeId, {
        onConnectionStart: () => handleNodeConnectionStart(nodeId),
        onConnectionEnd: (portIndex?: number) => handleNodeConnectionEnd(nodeId, portIndex),
        onContextMenu: (x: number, y: number) => setContextMenuNode({ nodeId, x, y }),
      });
    });
    
    return callbacksMap;
  }, [nodeIdsString, handleNodeConnectionStart, handleNodeConnectionEnd]);

  // Memoize connection callbacks to prevent recreating functions on every render
  // Use connection IDs as dependency string for stable comparison
  const connectionIdsString = useMemo(() => connections.map(c => c.id).join(','), [connections.length, connections.map(c => c.id).join(',')]);
  
  const connectionCallbacks = useMemo(() => {
    const callbacksMap = new Map<string, {
      onClick: () => void;
      onContextMenu: (e: React.MouseEvent) => void;
    }>();
    
    connections.forEach(conn => {
      // Create stable callbacks using closures
      const connId = conn.id; // Capture in closure
      callbacksMap.set(connId, {
        onClick: () => handleConnectionClick(connId),
        onContextMenu: (e: React.MouseEvent) => handleConnectionContextMenu(connId, e.clientX, e.clientY),
      });
    });
    
    return callbacksMap;
  }, [connectionIdsString, handleConnectionClick, handleConnectionContextMenu]);

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey && canvasRef.current) {
      e.preventDefault();

      const { left, top, width, height } = canvasRef.current.getBoundingClientRect();

      // Mouse position relative to canvas
      const mouseX = e.clientX - left;
      const mouseY = e.clientY - top;

      // World coordinates before zoom
      const worldX = (mouseX - pan.x) / zoom;
      const worldY = (mouseY - pan.y) / zoom;

      // Determine zoom delta (smooth, clamped)
      const zoomFactor = 1 + Math.min(Math.max(-e.deltaY / 500, -0.5), 0.5); // between ~0.5x and 1.5x per tick
      let newZoom = zoom * zoomFactor;
      newZoom = Math.min(Math.max(newZoom, 0.3), 2.5); // clamp between 0.3 and 2.5

      // Recompute pan so that the point under cursor stays under cursor
      const newPanX = mouseX - worldX * newZoom;
      const newPanY = mouseY - worldY * newZoom;

      setZoom(newZoom);
      setPan({ x: newPanX, y: newPanY });
    }
  };

  const gridSize = 20; // Base grid size
  const scaledGridSize = gridSize * zoom;
  const rulerSize = showRuler ? 24 : 0;

  const CHUNK_SIZE = 2000; // Must match store constant
  
  // Show canvas boundaries when zoomed out (zoom < 0.5)
  const showCanvasBoundaries = zoom < 0.5;

  // Get viewport size from store (already tracked by existing useEffect)
  const viewportWidth = useCanvasStore(state => state.viewportWidth);
  const viewportHeight = useCanvasStore(state => state.viewportHeight);

  // Viewport culling: calculate visible area to render only visible nodes
  // This significantly improves performance with many nodes
  const visibleNodes = useMemo(() => {
    // Fallback: render all if viewport not ready (initial render)
    if (viewportWidth === 0 || viewportHeight === 0) return nodes;
    
    // Calculate visible world coordinates (accounting for zoom and pan)
    // World coordinates = (screen - pan) / zoom
    const visibleMinX = -pan.x / zoom;
    const visibleMinY = -pan.y / zoom;
    const visibleMaxX = (viewportWidth - pan.x) / zoom;
    const visibleMaxY = (viewportHeight - pan.y) / zoom;
    
    // Add padding to render nodes slightly outside viewport (for smooth scrolling)
    const padding = 200; // pixels in world coordinates
    const paddedMinX = visibleMinX - padding;
    const paddedMinY = visibleMinY - padding;
    const paddedMaxX = visibleMaxX + padding;
    const paddedMaxY = visibleMaxY + padding;
    
    // Filter nodes that are visible (or partially visible) in viewport
    return nodes.filter(node => {
      const nodeX = node.position.x;
      const nodeY = node.position.y;
      const nodeWidth = 140; // Approximate node width
      const nodeHeight = 100; // Approximate node height
      
      // Check if node intersects with visible area
      return (
        nodeX + nodeWidth >= paddedMinX &&
        nodeX <= paddedMaxX &&
        nodeY + nodeHeight >= paddedMinY &&
        nodeY <= paddedMaxY
      );
    });
  }, [nodes, zoom, pan, viewportWidth, viewportHeight]);

  // Filter connections to only those connected to visible nodes
  const visibleNodeIds = useMemo(
    () => new Set(visibleNodes.map(n => n.id)),
    [visibleNodes]
  );
  
  const visibleConnections = useMemo(
    () => connections.filter(conn => 
      visibleNodeIds.has(conn.source) && visibleNodeIds.has(conn.target)
    ),
    [connections, visibleNodeIds]
  );

  return (
    <div className="flex-1 overflow-hidden relative">
      {/* Ruler - positioned outside canvas with border */}
      <CanvasRuler isVisible={showRuler} canvasRef={canvasRef} />
      
      {/* Canvas area - offset to make room for rulers */}
      <div
        ref={canvasRef}
        className="absolute overflow-hidden"
        style={{
          top: `${rulerSize}px`,
          left: `${rulerSize}px`,
          right: 0,
          bottom: 0,
          cursor: isPanning ? 'grabbing' : isConnecting ? 'crosshair' : 'default',
          backgroundColor: 'hsl(var(--muted) / 0.1)', // Background outside canvas chunks
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onContextMenu={handleCanvasContextMenu}
      >
      <div
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
          width: '100%',
          height: '100%',
          position: 'relative',
        }}
      >
        {/* Canvas chunks - render each chunk separately with grid and dividers */}
        {canvasChunks.map((chunk) => {
          const chunkX = chunk.x * CHUNK_SIZE;
          const chunkY = chunk.y * CHUNK_SIZE;
          
          // Check if this chunk has neighbors to determine which dividers to show
          const hasRightNeighbor = canvasChunks.some(
            c => c.x === chunk.x + 1 && c.y === chunk.y
          );
          const hasBottomNeighbor = canvasChunks.some(
            c => c.x === chunk.x && c.y === chunk.y + 1
          );
          
          return (
            <div
              key={`chunk-${chunk.x}-${chunk.y}`}
              className="absolute pointer-events-none"
              style={{
                left: `${chunkX}px`,
                top: `${chunkY}px`,
                width: `${CHUNK_SIZE}px`,
                height: `${CHUNK_SIZE}px`,
                backgroundColor: 'hsl(var(--canvas-bg))',
                backgroundImage: `
                  linear-gradient(hsl(var(--canvas-grid)) 1px, transparent 1px),
                  linear-gradient(90deg, hsl(var(--canvas-grid)) 1px, transparent 1px)
                `,
                backgroundSize: `${scaledGridSize}px ${scaledGridSize}px`,
                backgroundPosition: `${(pan.x % scaledGridSize) + (chunkX % scaledGridSize)}px ${(pan.y % scaledGridSize) + (chunkY % scaledGridSize)}px`,
                border: showCanvasBoundaries 
                  ? '2px dashed hsl(var(--border) / 0.6)' 
                  : 'none',
                boxShadow: showCanvasBoundaries 
                  ? 'inset 0 0 0 1px hsl(var(--border) / 0.3)' 
                  : 'none',
              }}
            >
              {/* Divider lines - always show between chunks */}
              {/* Right divider - show if there's a neighbor to the right */}
              {hasRightNeighbor && (
                <div
                  className="absolute top-0 bottom-0 pointer-events-none z-10"
                  style={{
                    right: 0,
                    width: '1px',
                    backgroundColor: 'hsl(var(--border) / 0.5)',
                  }}
                />
              )}
              {/* Bottom divider - show if there's a neighbor below */}
              {hasBottomNeighbor && (
                <div
                  className="absolute left-0 right-0 pointer-events-none z-10"
                  style={{
                    bottom: 0,
                    height: '1px',
                    backgroundColor: 'hsl(var(--border) / 0.5)',
                  }}
                />
              )}
            </div>
          );
        })}
        
        {/* Lasso selection rectangle */}
        {selectionRect && (
          <div
            className="absolute border-2 border-primary/60 bg-primary/10 pointer-events-none"
            style={{
              left: selectionRect.x,
              top: selectionRect.y,
              width: selectionRect.width,
              height: selectionRect.height,
            }}
          />
        )}
        {/* SVG layer for connections */}
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            overflow: 'visible',
          }}
        >
          <defs>
            {/* Fixed size arrow markers - не зависят от strokeWidth */}
            <marker
              id="arrowhead-default"
              markerWidth="8"
              markerHeight="8"
              refX="7"
              refY="4"
              orient="auto"
              markerUnits="userSpaceOnUse"
            >
              <path d="M0,0 L0,8 L8,4 z" fill="hsl(var(--border))" stroke="none" />
            </marker>
            <marker
              id="arrowhead-selected"
              markerWidth="10"
              markerHeight="10"
              refX="8"
              refY="5"
              orient="auto"
              markerUnits="userSpaceOnUse"
            >
              <path d="M0,0 L0,10 L10,5 z" fill="hsl(var(--primary))" stroke="none" />
            </marker>
            <marker
              id="arrowhead-bottleneck"
              markerWidth="12"
              markerHeight="12"
              refX="10"
              refY="6"
              orient="auto"
              markerUnits="userSpaceOnUse"
            >
              <path d="M0,0 L0,12 L12,6 z" fill="hsl(0 84% 60%)" stroke="none" />
            </marker>
          </defs>

          {/* Groups layer - behind connections */}
          {groups && groups.length > 0 && (
            <g style={{ pointerEvents: 'auto' }}>
              {groups.map((group) => (
                <ComponentGroup key={group.id} group={group} zoom={zoom} />
              ))}
            </g>
          )}

          <g style={{ pointerEvents: 'auto' }}>
            {/* Render connections - only visible ones for performance */}
            {visibleConnections.map((conn) => {
              const sourceNode = nodes.find((n) => n.id === conn.source);
              const targetNode = nodes.find((n) => n.id === conn.target);
              if (!sourceNode || !targetNode) return null;

              const callbacks = connectionCallbacks.get(conn.id);
              if (!callbacks) return null;

              return (
                <ConnectionLine
                  key={conn.id}
                  connection={conn}
                  sourceNode={sourceNode}
                  targetNode={targetNode}
                  zoom={zoom}
                  pan={pan}
                  isSelected={selectedConnectionId === conn.id}
                  onClick={callbacks.onClick}
                  onContextMenu={callbacks.onContextMenu}
                />
              );
            })}

            {/* Temporary connection line while dragging */}
            {isConnecting && connectionStart && tempLineEnd && (() => {
              const sourceNode = nodes.find((n) => n.id === connectionStart);
              if (!sourceNode) return null;
              const sourceX = sourceNode.position.x + 70;
              const sourceY = sourceNode.position.y + 70;
              return (
                <line
                  x1={sourceX}
                  y1={sourceY}
                  x2={tempLineEnd.x}
                  y2={tempLineEnd.y}
                  stroke="hsl(var(--primary))"
                  strokeWidth={2 / zoom}
                  strokeDasharray="5,5"
                  style={{ pointerEvents: 'none' }}
                />
              );
            })()}
          </g>
        </svg>

        {/* Nodes layer - only render visible nodes for performance */}
        {visibleNodes.map((node) => {
          const callbacks = nodeCallbacks.get(node.id);
          if (!callbacks) return null;
          
          return (
          <CanvasNode
            key={node.id}
            node={node}
              onConnectionStart={callbacks.onConnectionStart}
              onConnectionEnd={callbacks.onConnectionEnd}
            isConnecting={isConnecting}
              onContextMenu={callbacks.onContextMenu}
          />
          );
        })}
        
        {/* Show metrics overlays when emulation is running - only for visible nodes */}
        {isRunning && visibleNodes.map((node) => (
          <MetricsOverlay
            key={`metrics-${node.id}`}
            nodeId={node.id}
            position={node.position}
          />
        ))}
      </div>
      </div>

      {/* Heat Map Legend */}
      <HeatMapLegend isVisible={showHeatMapLegend} />

      {/* Minimap - bottom left, non-interactive */}
      <CanvasMinimap isVisible={showMinimap} />

      {/* Data Path Visualization */}
      <DataPathVisualization selectedNodeId={selectedNodeId} highlightPath={true} />

      {/* Connection context menu */}
      {contextMenuConnection && (
        <ConnectionContextMenu
          x={contextMenuConnection.x}
          y={contextMenuConnection.y}
          onDelete={handleDeleteConnection}
          onClose={() => setContextMenuConnection(null)}
        />
      )}

      {/* Node context menu - rendered outside transform container */}
      {contextMenuNode && (() => {
        const node = nodes.find(n => n.id === contextMenuNode.nodeId);
        if (!node) return null;

        // Get all selected nodes (including the one that was right-clicked)
        const selectedNodes = nodes.filter(n => n.selected);
        const isMultiSelect = selectedNodes.length > 1;

        const handleDelete = () => {
          if (isMultiSelect) {
            selectedNodes.forEach(selectedNode => {
              deleteNode(selectedNode.id);
            });
            toast.success(`${selectedNodes.length} elements deleted`);
          } else {
            deleteNode(node.id);
            toast.success('Element deleted');
          }
          setContextMenuNode(null);
        };

        const handleDuplicate = () => {
          if (isMultiSelect) {
            // For multiple selection, duplicate all selected nodes
            selectedNodes.forEach((selectedNode, index) => {
              const duplicatedNode: CanvasNodeType = {
                ...deepClone(selectedNode),
                id: `${selectedNode.type}_${Date.now()}_${index}`,
                position: {
                  x: selectedNode.position.x + 20 + (index * 10),
                  y: selectedNode.position.y + 20 + (index * 10),
                },
                selected: false,
              };
              if (duplicatedNode.data?.config) {
                duplicatedNode.data.config = deepClone(duplicatedNode.data.config);
              }
              addNode(duplicatedNode);
            });
            toast.success(`${selectedNodes.length} elements duplicated`);
          } else {
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
          }
          setContextMenuNode(null);
        };

        const handleCopyId = () => {
          if (isMultiSelect) {
            const ids = selectedNodes.map(n => n.id).join(', ');
            navigator.clipboard.writeText(ids);
            toast.success(`${selectedNodes.length} IDs copied to clipboard`);
          } else {
            navigator.clipboard.writeText(node.id);
            toast.success('ID copied to clipboard');
          }
          setContextMenuNode(null);
        };

        const handleBringToFront = () => {
          if (isMultiSelect) {
            selectedNodes.forEach(selectedNode => {
              bringToFront(selectedNode.id);
            });
            toast.success(`${selectedNodes.length} elements brought to front`);
          } else {
            bringToFront(node.id);
            toast.success('Brought to front');
          }
          setContextMenuNode(null);
        };

        const handleSendToBack = () => {
          if (isMultiSelect) {
            selectedNodes.forEach(selectedNode => {
              sendToBack(selectedNode.id);
            });
            toast.success(`${selectedNodes.length} elements sent to back`);
          } else {
            sendToBack(node.id);
            toast.success('Sent to back');
          }
          setContextMenuNode(null);
        };

        const handleBringForward = () => {
          if (isMultiSelect) {
            selectedNodes.forEach(selectedNode => {
              bringForward(selectedNode.id);
            });
            toast.success(`${selectedNodes.length} elements brought forward`);
          } else {
            bringForward(node.id);
            toast.success('Brought forward');
          }
          setContextMenuNode(null);
        };

        const handleSendBackward = () => {
          if (isMultiSelect) {
            selectedNodes.forEach(selectedNode => {
              sendBackward(selectedNode.id);
            });
            toast.success(`${selectedNodes.length} elements sent backward`);
          } else {
            sendBackward(node.id);
            toast.success('Sent backward');
          }
          setContextMenuNode(null);
        };

        const handleAddToGroup = () => {
          // For multi-select, we'll add all selected nodes to the group
          // But for now, we'll show dialog for the first selected node
          // In the future, this could be enhanced to show a dialog for all nodes
          if (isMultiSelect) {
            // For now, show dialog for the first selected node
            // The dialog could be enhanced to handle multiple nodes
            setShowAddToGroupDialog({ nodeId: selectedNodes[0].id, x: contextMenuNode.x, y: contextMenuNode.y });
          } else {
            setShowAddToGroupDialog({ nodeId: node.id, x: contextMenuNode.x, y: contextMenuNode.y });
          }
          setContextMenuNode(null);
        };

        // Find all groups that any selected node belongs to
        const nodeGroups = isMultiSelect 
          ? groups.filter(g => selectedNodes.some(n => g.nodeIds.includes(n.id)))
          : groups.filter(g => g.nodeIds.includes(node.id));
        const hasGroups = nodeGroups.length >= 1;
        const hasMultipleGroups = nodeGroups.length >= 2;
        
        const handleRemoveFromGroup = () => {
          if (isMultiSelect) {
            // For multi-select, remove all selected nodes from groups
            // For simplicity, remove from all groups they belong to
            let removedCount = 0;
            selectedNodes.forEach(selectedNode => {
              const nodeGroupsForNode = groups.filter(g => g.nodeIds.includes(selectedNode.id));
              nodeGroupsForNode.forEach(group => {
                removeNodeFromGroup(group.id, selectedNode.id);
                removedCount++;
              });
            });
            if (removedCount > 0) {
              toast.success(`Removed ${selectedNodes.length} elements from groups`);
            }
            setContextMenuNode(null);
          } else {
            if (hasMultipleGroups) {
              // If in multiple groups, show dialog to choose which one
              setShowRemoveFromGroupDialog({ nodeId: node.id, x: contextMenuNode.x, y: contextMenuNode.y });
              setContextMenuNode(null);
            } else if (nodeGroups.length === 1) {
              // If in only one group, remove immediately
              removeNodeFromGroup(nodeGroups[0].id, node.id);
              toast.success(`Removed from "${nodeGroups[0].name}"`);
              setContextMenuNode(null);
            }
          }
        };

        return (
          <ContextMenu
            x={contextMenuNode.x}
            y={contextMenuNode.y}
            onDelete={handleDelete}
            onDuplicate={handleDuplicate}
            onCopyId={handleCopyId}
            onBringToFront={handleBringToFront}
            onSendToBack={handleSendToBack}
            onBringForward={handleBringForward}
            onSendBackward={handleSendBackward}
            onAddToGroup={handleAddToGroup}
            onRemoveFromGroup={hasGroups ? handleRemoveFromGroup : undefined}
            onClose={() => setContextMenuNode(null)}
          />
        );
      })()}

      {/* Add to Group Dialog */}
      {showAddToGroupDialog && (
        <AddToGroupDialog
          nodeId={showAddToGroupDialog.nodeId}
          x={showAddToGroupDialog.x}
          y={showAddToGroupDialog.y}
          onClose={() => setShowAddToGroupDialog(null)}
        />
      )}

      {/* Remove from Group Dialog */}
      {showRemoveFromGroupDialog && (
        <RemoveFromGroupDialog
          nodeId={showRemoveFromGroupDialog.nodeId}
          x={showRemoveFromGroupDialog.x}
          y={showRemoveFromGroupDialog.y}
          onClose={() => setShowRemoveFromGroupDialog(null)}
        />
      )}

    </div>
  );
}
import { useRef, useState, useEffect } from 'react';
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
      className="fixed bg-card border border-border rounded-md shadow-lg py-0.5 z-50 min-w-[120px]"
      style={{
        left: `${x}px`,
        top: `${y}px`,
      }}
    >
      <button
        className="w-full px-2 py-1 text-xs text-left hover:bg-accent transition-colors"
        onClick={onDelete}
      >
        Delete Connection
      </button>
      <button
        className="w-full px-2 py-1 text-xs text-left hover:bg-accent transition-colors"
        onClick={onClose}
      >
        Cancel
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
  } = useCanvasStore();
  const { isRunning } = useEmulationStore();
  const { showMinimap, showHeatMapLegend } = useUIStore();
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
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null);
  const [selectionRect, setSelectionRect] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
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

  const handleNodeConnectionStart = (nodeId: string) => {
    setIsConnecting(true);
    setConnectionStart(nodeId);
  };

  const handleNodeConnectionEnd = (nodeId: string) => {
    if (isConnecting && connectionStart && connectionStart !== nodeId) {
      const newConnection: CanvasConnection = {
        id: `conn-${Date.now()}`,
        source: connectionStart,
        target: nodeId,
        type: 'async',
      };
      addConnection(newConnection);
    }
    setIsConnecting(false);
    setConnectionStart(null);
    setTempLineEnd(null);
  };

  const handleConnectionClick = (connectionId: string) => {
    selectConnection(connectionId);
  };

  const handleConnectionContextMenu = (connectionId: string, x: number, y: number) => {
    setContextMenuConnection({ connectionId, x, y });
  };

  const handleDeleteConnection = () => {
    if (contextMenuConnection) {
      deleteConnection(contextMenuConnection.connectionId);
      setContextMenuConnection(null);
    }
  };

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

  return (
    <div
      ref={canvasRef}
      className="flex-1 canvas-grid overflow-hidden relative"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      style={{
        cursor: isPanning ? 'grabbing' : isConnecting ? 'crosshair' : 'default',
      }}
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
            {/* Render connections */}
            {connections.map((conn) => {
              const sourceNode = nodes.find((n) => n.id === conn.source);
              const targetNode = nodes.find((n) => n.id === conn.target);
              if (!sourceNode || !targetNode) return null;

              return (
                <ConnectionLine
                  key={conn.id}
                  connection={conn}
                  sourceNode={sourceNode}
                  targetNode={targetNode}
                  zoom={zoom}
                  pan={pan}
                  isSelected={selectedConnectionId === conn.id}
                  onClick={() => handleConnectionClick(conn.id)}
                  onContextMenu={(e) => handleConnectionContextMenu(conn.id, e.clientX, e.clientY)}
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

        {/* Nodes layer */}
        {nodes.map((node) => (
          <CanvasNode
            key={node.id}
            node={node}
            onConnectionStart={() => handleNodeConnectionStart(node.id)}
            onConnectionEnd={() => handleNodeConnectionEnd(node.id)}
            isConnecting={isConnecting}
          />
        ))}
        
        {/* Show metrics overlays when emulation is running */}
        {isRunning && nodes.map((node) => (
          <MetricsOverlay
            key={`metrics-${node.id}`}
            nodeId={node.id}
            position={node.position}
          />
        ))}
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

    </div>
  );
}
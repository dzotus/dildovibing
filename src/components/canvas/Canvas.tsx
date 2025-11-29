import { useRef, useState } from 'react';
import { useCanvasStore } from '@/store/useCanvasStore';
import { useEmulationStore } from '@/store/useEmulationStore';
import { CanvasNode as CanvasNodeType, ComponentType, CanvasConnection } from '@/types';
import { CanvasNode } from './CanvasNode';
import { ConnectionLine } from './ConnectionLine';
import { MetricsOverlay } from '@/components/emulation/MetricsOverlay';

export function Canvas() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const { nodes, connections, addNode, addConnection, deleteConnection, zoom, pan, setPan, selectNode, selectConnection, selectedConnectionId } = useCanvasStore();
  const { isRunning } = useEmulationStore();
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
    if (e.button === 1 || (e.button === 0 && e.ctrlKey)) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      e.preventDefault();
    } else if (e.button === 0 && !isConnecting) {
      // Deselect nodes and connections when clicking on canvas
      selectNode(null);
      selectConnection(null);
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
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    if (isConnecting) {
      setIsConnecting(false);
      setConnectionStart(null);
      setTempLineEnd(null);
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
    if (e.ctrlKey) {
      e.preventDefault();
      // Zoom will be handled by toolbar for now
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
      style={{ cursor: isPanning ? 'grabbing' : isConnecting ? 'crosshair' : 'default' }}
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
            <marker
              id="arrowhead-default"
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="3"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M0,0 L0,6 L9,3 z" fill="hsl(var(--border))" />
            </marker>
            <marker
              id="arrowhead-selected"
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="3"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M0,0 L0,6 L9,3 z" fill="hsl(var(--primary))" />
            </marker>
            <marker
              id="arrowhead-bottleneck"
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="3"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M0,0 L0,6 L9,3 z" fill="hsl(0 84% 60%)" />
            </marker>
          </defs>

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

      {/* Mini info */}
      <div className="absolute bottom-4 left-4 bg-card/90 backdrop-blur-sm rounded-md px-3 py-2 text-xs text-muted-foreground border border-border">
        <div>Zoom: {Math.round(zoom * 100)}%</div>
        <div>Pan: ({Math.round(pan.x)}, {Math.round(pan.y)})</div>
        <div>Nodes: {nodes.length}</div>
        <div>Connections: {connections.length}</div>
      </div>

      {/* Connection context menu */}
      {contextMenuConnection && (
        <div
          className="fixed bg-card border border-border rounded-md shadow-lg py-1 z-50"
          style={{
            left: `${contextMenuConnection.x}px`,
            top: `${contextMenuConnection.y}px`,
          }}
        >
          <button
            className="w-full px-4 py-2 text-sm text-left hover:bg-accent transition-colors"
            onClick={handleDeleteConnection}
          >
            Удалить соединение
          </button>
          <button
            className="w-full px-4 py-2 text-sm text-left hover:bg-accent transition-colors"
            onClick={() => setContextMenuConnection(null)}
          >
            Отмена
          </button>
        </div>
      )}
    </div>
  );
}
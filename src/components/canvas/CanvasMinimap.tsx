import React from 'react';
import { useCanvasStore } from '@/store/useCanvasStore';
import { useEmulationStore } from '@/store/useEmulationStore';
import { useDependencyStore } from '@/store/useDependencyStore';
import { useComponentStateStore } from '@/store/useComponentStateStore';

interface CanvasMinimapProps {
  isVisible?: boolean;
}

export function CanvasMinimap({ isVisible = true }: CanvasMinimapProps) {
  const { nodes, connections, zoom, pan } = useCanvasStore();
  const { isRunning } = useEmulationStore();

  // Calculate canvas bounds from nodes
  const canvasBounds = React.useMemo(() => {
    if (nodes.length === 0) {
      return { minX: 0, minY: 0, maxX: 2000, maxY: 2000 };
    }
    
    const xs = nodes.map(n => n.position.x);
    const ys = nodes.map(n => n.position.y);
    const minX = Math.min(...xs) - 200;
    const minY = Math.min(...ys) - 200;
    const maxX = Math.max(...xs) + 200;
    const maxY = Math.max(...ys) + 200;
    
    return { minX, minY, maxX, maxY };
  }, [nodes]);
  
  const canvasWidth = canvasBounds.maxX - canvasBounds.minX;
  const canvasHeight = canvasBounds.maxY - canvasBounds.minY;
  
  // Calculate minimap scale (show entire canvas in small viewport) - compact size
  const minimapWidth = 120;
  const minimapHeight = 80;
  const scaleX = minimapWidth / Math.max(canvasWidth, 1000);
  const scaleY = minimapHeight / Math.max(canvasHeight, 1000);
  const scale = Math.min(scaleX, scaleY);

  // Calculate viewport rectangle (what's currently visible)
  const viewportWidth = (window.innerWidth / zoom) * scale;
  const viewportHeight = (window.innerHeight / zoom) * scale;
  const viewportX = ((-pan.x / zoom) - canvasBounds.minX) * scale;
  const viewportY = ((-pan.y / zoom) - canvasBounds.minY) * scale;

  if (!isVisible) {
    return null;
  }

  return (
    <div className="absolute bottom-4 left-4 bg-card/95 backdrop-blur-sm border border-border rounded-md p-2 z-10 pointer-events-none">
      <svg
        width={minimapWidth}
        height={minimapHeight}
        className="border border-border/50 rounded"
        style={{ background: 'hsl(var(--background))' }}
      >
        {/* Draw connections - simplified */}
        {connections.map(conn => {
          const sourceNode = nodes.find(n => n.id === conn.source);
          const targetNode = nodes.find(n => n.id === conn.target);
          if (!sourceNode || !targetNode) return null;

          const x1 = (sourceNode.position.x - canvasBounds.minX) * scale;
          const y1 = (sourceNode.position.y - canvasBounds.minY) * scale;
          const x2 = (targetNode.position.x - canvasBounds.minX) * scale;
          const y2 = (targetNode.position.y - canvasBounds.minY) * scale;

          return (
            <line
              key={conn.id}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="hsl(var(--border))"
              strokeWidth={0.3}
              opacity={0.2}
            />
          );
        })}

        {/* Draw nodes - simplified */}
        {nodes.map(node => {
          return (
            <circle
              key={node.id}
              cx={(node.position.x - canvasBounds.minX) * scale}
              cy={(node.position.y - canvasBounds.minY) * scale}
              r={1.5}
              fill="hsl(var(--muted-foreground))"
              opacity={0.5}
            />
          );
        })}

        {/* Viewport rectangle - shows current view */}
        <rect
          x={viewportX}
          y={viewportY}
          width={viewportWidth}
          height={viewportHeight}
          fill="hsl(var(--primary))"
          fillOpacity={0.2}
          stroke="hsl(var(--primary))"
          strokeWidth={1.5}
          strokeDasharray="2 2"
        />
      </svg>
    </div>
  );
}


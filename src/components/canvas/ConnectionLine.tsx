import { CanvasConnection, CanvasNode } from '@/types';
import { useState, useEffect } from 'react';
import { useEmulationStore } from '@/store/useEmulationStore';

interface ConnectionLineProps {
  connection: CanvasConnection;
  sourceNode: CanvasNode;
  targetNode: CanvasNode;
  zoom: number;
  pan: { x: number; y: number };
  isSelected?: boolean;
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

export function ConnectionLine({
  connection,
  sourceNode,
  targetNode,
  zoom,
  isSelected = false,
  onClick,
  onContextMenu,
}: ConnectionLineProps) {
  const [isHovered, setIsHovered] = useState(false);
  const { isRunning, getConnectionMetrics } = useEmulationStore();
  const [metrics, setMetrics] = useState<ReturnType<typeof getConnectionMetrics>>();

  // Update metrics when emulation is running
  useEffect(() => {
    if (!isRunning) {
      setMetrics(undefined);
      return;
    }

    const interval = setInterval(() => {
      const connMetrics = getConnectionMetrics(connection.id);
      setMetrics(connMetrics);
    }, 100);

    return () => clearInterval(interval);
  }, [isRunning, connection.id, getConnectionMetrics]);

  // Calculate center points of nodes (accounting for node size ~140px)
  const sourceX = sourceNode.position.x + 70;
  const sourceY = sourceNode.position.y + 70;
  const targetX = targetNode.position.x + 70;
  const targetY = targetNode.position.y + 70;

  // Create bezier curve for smoother connections
  const deltaX = targetX - sourceX;
  const deltaY = targetY - sourceY;
  const controlPointOffset = Math.abs(deltaX) * 0.3;

  const path = `
    M ${sourceX},${sourceY}
    C ${sourceX + controlPointOffset},${sourceY}
      ${targetX - controlPointOffset},${targetY}
      ${targetX},${targetY}
  `;

  // Dynamic stroke color based on interaction metrics
  let strokeColor = 'hsl(var(--border))';
  let strokeWidth = 2;

  if (isSelected) {
    strokeColor = 'hsl(var(--primary))';
    strokeWidth = 3;
  } else if (isHovered) {
    strokeColor = 'hsl(var(--accent))';
  } else if (metrics) {
    // Visualize backpressure and congestion with color
    if (metrics.bottleneck) {
      strokeColor = 'hsl(0 84% 60%)'; // Red for bottlenecks
      strokeWidth = 4;
    } else if (metrics.backpressure > 0.7) {
      strokeColor = 'hsl(25 95% 53%)'; // Orange for high backpressure
      strokeWidth = 3.5;
    } else if (metrics.congestion > 0.6) {
      strokeColor = 'hsl(45 93% 47%)'; // Yellow for congestion
      strokeWidth = 3;
    } else if (metrics.throughputDependency > 0.5) {
      strokeColor = 'hsl(142 76% 36%)'; // Green for high dependency
      strokeWidth = 2.5;
    }
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick?.();
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu?.(e);
  };

  // Animation for traffic flow
  const dashOffset = isRunning && metrics ? metrics.effectiveThroughput % 20 : 0;

  return (
    <g>
      {/* Invisible wider path for easier clicking */}
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={20 / zoom}
        style={{ cursor: 'pointer' }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      />
      
      {/* Traffic flow animation (dashed line moving along connection) */}
      {isRunning && metrics && metrics.effectiveThroughput > 0 && (
        <path
          d={path}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth / zoom}
          strokeLinecap="round"
          strokeDasharray="8 4"
          strokeDashoffset={-dashOffset}
          style={{
            opacity: 0.4,
            pointerEvents: 'none',
            animation: 'flow 2s linear infinite',
          }}
        />
      )}
      
      {/* Visible connection line */}
      <path
        d={path}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth / zoom}
        strokeLinecap="round"
        markerEnd={`url(#arrowhead-${isSelected ? 'selected' : metrics?.bottleneck ? 'bottleneck' : 'default'})`}
        style={{
          transition: 'stroke 0.3s, stroke-width 0.3s',
          pointerEvents: 'none',
        }}
      />
      
      {/* Connection metadata label */}
      {(connection.label || connection.data?.latencyMs || connection.data?.bandwidthMbps || metrics) && (
        <g>
          <text
            x={(sourceX + targetX) / 2}
            y={(sourceY + targetY) / 2 - 10 / zoom}
            fill="hsl(var(--primary))"
            fontSize={11 / zoom}
            textAnchor="middle"
            fontWeight="500"
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          >
            {connection.label || (metrics ? `${metrics.latency.toFixed(1)}ms` : `${connection.data?.latencyMs ?? 0}ms`)}
          </text>
          {connection.data?.bandwidthMbps && (
            <text
              x={(sourceX + targetX) / 2}
              y={(sourceY + targetY) / 2 + 8 / zoom}
              fill="hsl(var(--muted-foreground))"
              fontSize={9 / zoom}
              textAnchor="middle"
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              {connection.data.bandwidthMbps}Mbps
            </text>
          )}
          
          {/* Interaction metrics overlay */}
          {metrics && isRunning && (
            <g>
              {/* Throughput */}
              <text
                x={(sourceX + targetX) / 2}
                y={(sourceY + targetY) / 2 + 24 / zoom}
                fill="hsl(var(--accent))"
                fontSize={9 / zoom}
                textAnchor="middle"
                fontWeight="500"
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {metrics.effectiveThroughput.toFixed(0)} msg/s
              </text>
              
              {/* Backpressure indicator */}
              {metrics.backpressure > 0.5 && (
                <text
                  x={(sourceX + targetX) / 2}
                  y={(sourceY + targetY) / 2 + 38 / zoom}
                  fill="hsl(25 95% 53%)"
                  fontSize={8 / zoom}
                  textAnchor="middle"
                  fontWeight="600"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  ⚠ Backpressure {(metrics.backpressure * 100).toFixed(0)}%
                </text>
              )}
              
              {/* Bottleneck indicator */}
              {metrics.bottleneck && (
                <text
                  x={(sourceX + targetX) / 2}
                  y={(sourceY + targetY) / 2 + (metrics.backpressure > 0.5 ? 52 : 38) / zoom}
                  fill="hsl(0 84% 60%)"
                  fontSize={8 / zoom}
                  textAnchor="middle"
                  fontWeight="700"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  🚨 BOTTLENECK
                </text>
              )}
              
              {/* Dependency indicator */}
              {metrics.throughputDependency > 0.7 && !metrics.bottleneck && (
                <text
                  x={(sourceX + targetX) / 2}
                  y={(sourceY + targetY) / 2 + 38 / zoom}
                  fill="hsl(142 76% 36%)"
                  fontSize={8 / zoom}
                  textAnchor="middle"
                  fontWeight="500"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  High Dependency {(metrics.throughputDependency * 100).toFixed(0)}%
                </text>
              )}
            </g>
          )}
        </g>
      )}
    </g>
  );
}

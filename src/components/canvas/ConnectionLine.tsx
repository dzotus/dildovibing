import { CanvasConnection, CanvasNode } from '@/types';
import { useState, useEffect } from 'react';
import { useEmulationStore } from '@/store/useEmulationStore';
import { useDataFlowStore } from '@/store/useDataFlowStore';
import { useCanvasStore } from '@/store/useCanvasStore';
import { useIsPathHighlighted } from './DataPathVisualization';

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
  const { getConnectionMessages } = useDataFlowStore();
  const { selectedNodeId } = useCanvasStore();
  const [metrics, setMetrics] = useState<ReturnType<typeof getConnectionMetrics>>();
  const [dataMessages, setDataMessages] = useState<any[]>([]);
  const isPathHighlighted = useIsPathHighlighted(connection.id);

  // Update metrics when emulation is running
  useEffect(() => {
    if (!isRunning) {
      setMetrics(undefined);
      setDataMessages([]);
      return;
    }

    const interval = setInterval(() => {
      const connMetrics = getConnectionMetrics(connection.id);
      setMetrics(connMetrics);
      
      // Get data messages in transit
      const messages = getConnectionMessages(connection.id);
      const inTransit = messages.filter(m => m.status === 'in-transit' || m.status === 'pending');
      setDataMessages(inTransit);
    }, 100);

    return () => clearInterval(interval);
  }, [isRunning, connection.id, getConnectionMetrics, getConnectionMessages]);

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

  // Path highlighting takes priority
  if (isPathHighlighted && selectedNodeId) {
    strokeColor = 'hsl(280 100% 70%)'; // Purple for path highlighting
    strokeWidth = 3;
  } else if (isSelected) {
    strokeColor = 'hsl(var(--primary))';
    strokeWidth = 2.5;
  } else if (isHovered) {
    strokeColor = 'hsl(var(--accent))';
    strokeWidth = 2.5;
  } else if (metrics && isRunning) {
    // Only show metrics-based styling when emulation is running and has activity
    const hasActivity = metrics.effectiveThroughput > 0 || metrics.traffic > 0;
    
    if (hasActivity) {
      // Visualize backpressure and congestion with color
      if (metrics.bottleneck) {
        strokeColor = 'hsl(0 84% 60%)'; // Red for bottlenecks
        strokeWidth = 3;
      } else if (metrics.backpressure > 0.7) {
        strokeColor = 'hsl(25 95% 53%)'; // Orange for high backpressure
        strokeWidth = 2.5;
      } else if (metrics.congestion > 0.6) {
        strokeColor = 'hsl(45 93% 47%)'; // Yellow for congestion
        strokeWidth = 2.5;
      } else if (metrics.throughputDependency > 0.5) {
        strokeColor = 'hsl(142 76% 36%)'; // Green for high dependency
        strokeWidth = 2;
      } else if (metrics.effectiveThroughput > 0) {
        // Active connection with normal metrics
        strokeColor = 'hsl(var(--primary))';
        strokeWidth = 2;
      }
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
      
      {/* Traffic flow animation (dashed line moving along connection) - only for active connections */}
      {isRunning && metrics && metrics.effectiveThroughput > 0 && metrics.traffic > 0 && (
        <path
          d={path}
          fill="none"
          stroke={strokeColor}
          strokeWidth={Math.max(1, strokeWidth / zoom)}
          strokeLinecap="round"
          strokeDasharray={`${Math.max(4, 8 / zoom)} ${Math.max(2, 4 / zoom)}`}
          strokeDashoffset={-dashOffset}
          style={{
            opacity: 0.4,
            pointerEvents: 'none',
            animation: 'flow 2s linear infinite',
          }}
        />
      )}
      
      {/* Animated data packets */}
      {isRunning && dataMessages.map((message, index) => {
        // Calculate progress based on latency
        const elapsed = Date.now() - message.timestamp;
        const progress = message.latency ? Math.min(1, elapsed / message.latency) : 0;
        
        // Calculate position along the path
        const t = progress;
        const x = sourceX + (targetX - sourceX) * t;
        const y = sourceY + (targetY - sourceY) * t;
        
        // Get color based on format
        const formatColors: Record<string, string> = {
          json: 'hsl(142 76% 36%)',
          xml: 'hsl(25 95% 53%)',
          binary: 'hsl(221 83% 53%)',
          protobuf: 'hsl(280 100% 70%)',
          text: 'hsl(210 40% 50%)',
        };
        const packetColor = formatColors[message.format] || 'hsl(var(--primary))';
        
        return (
          <g key={message.id || index}>
            <circle
              cx={x}
              cy={y}
              r={4 / zoom}
              fill={packetColor}
              stroke="hsl(var(--background))"
              strokeWidth={1 / zoom}
              style={{
                pointerEvents: 'none',
                filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.3))',
              }}
            >
              <animate
                attributeName="opacity"
                values="0.5;1;0.5"
                dur="1s"
                repeatCount="indefinite"
              />
            </circle>
            {/* Format label for large packets */}
            {message.size > 1000 && (
              <text
                x={x}
                y={y - 8 / zoom}
                fill={packetColor}
                fontSize={8 / zoom}
                textAnchor="middle"
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {message.format}
              </text>
            )}
          </g>
        );
      })}
      
      {/* Visible connection line */}
      <path
        d={path}
        fill="none"
        stroke={strokeColor}
        strokeWidth={Math.max(1, strokeWidth / zoom)}
        strokeLinecap="round"
        markerEnd={
          isRunning && metrics && (metrics.effectiveThroughput > 0 || metrics.traffic > 0)
            ? `url(#arrowhead-${isSelected ? 'selected' : metrics?.bottleneck ? 'bottleneck' : 'default'})`
            : isSelected
            ? `url(#arrowhead-selected)`
            : `url(#arrowhead-default)`
        }
        style={{
          transition: 'stroke 0.3s, stroke-width 0.3s',
          pointerEvents: 'none',
        }}
      />
      
      {/* Connection metadata label - show real metrics when running, config when not */}
      {isRunning && metrics ? (
        <g>
          {/* Real latency from metrics (includes network latency from config) - always show */}
          <text
            x={(sourceX + targetX) / 2}
            y={(sourceY + targetY) / 2 - 10 / zoom}
            fill="hsl(var(--primary))"
            fontSize={Math.max(8, 11 / zoom)}
            textAnchor="middle"
            fontWeight="500"
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          >
            {connection.label || `${metrics.latency.toFixed(1)}ms`}
          </text>
          
          {/* Real traffic/throughput (affected by bandwidth) - only show if active */}
          {(metrics.effectiveThroughput > 0 || metrics.traffic > 0) && (
            <>
              <text
                x={(sourceX + targetX) / 2}
                y={(sourceY + targetY) / 2 + 8 / zoom}
                fill="hsl(var(--muted-foreground))"
                fontSize={Math.max(7, 9 / zoom)}
                textAnchor="middle"
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {metrics.traffic > 0 ? `${metrics.traffic.toFixed(1)} KB/s` : `${metrics.effectiveThroughput.toFixed(0)} msg/s`}
              </text>
              
              {/* Show bandwidth limit if it's constraining throughput */}
              {connection.data?.bandwidthMbps && metrics.traffic > 0 && (
                <text
                  x={(sourceX + targetX) / 2}
                  y={(sourceY + targetY) / 2 + 20 / zoom}
                  fill="hsl(var(--muted-foreground))"
                  fontSize={Math.max(6, 8 / zoom)}
                  textAnchor="middle"
                  style={{ pointerEvents: 'none', userSelect: 'none', opacity: 0.7 }}
                >
                  Limit: {connection.data.bandwidthMbps}Mbps
                </text>
              )}
            </>
          )}
          
          {/* Interaction metrics overlay - only show for active connections */}
          {(metrics.effectiveThroughput > 0 || metrics.traffic > 0) && (
            <g>
              {/* Backpressure indicator */}
              {metrics.backpressure > 0.5 && (
                <text
                  x={(sourceX + targetX) / 2}
                  y={(sourceY + targetY) / 2 + (metrics.traffic > 0 ? 32 : 20) / zoom}
                  fill="hsl(25 95% 53%)"
                  fontSize={Math.max(7, 8 / zoom)}
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
                  y={(sourceY + targetY) / 2 + (metrics.backpressure > 0.5 ? 50 : (metrics.traffic > 0 ? 32 : 20)) / zoom}
                  fill="hsl(0 84% 60%)"
                  fontSize={Math.max(7, 8 / zoom)}
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
                  y={(sourceY + targetY) / 2 + (metrics.traffic > 0 ? 32 : 20) / zoom}
                  fill="hsl(142 76% 36%)"
                  fontSize={Math.max(7, 8 / zoom)}
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
      ) : connection.label ? (
        <g>
          {/* Show only label when not running */}
          <text
            x={(sourceX + targetX) / 2}
            y={(sourceY + targetY) / 2 - 10 / zoom}
            fill="hsl(var(--primary))"
            fontSize={Math.max(8, 11 / zoom)}
            textAnchor="middle"
            fontWeight="500"
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          >
            {connection.label}
          </text>
        </g>
      ) : null}
    </g>
  );
}

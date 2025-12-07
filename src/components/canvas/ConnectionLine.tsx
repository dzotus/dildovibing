import { CanvasConnection, CanvasNode } from '@/types';
import { useState, memo, useMemo } from 'react';
import { useEmulationStore } from '@/store/useEmulationStore';
import { useDataFlowStore } from '@/store/useDataFlowStore';
import { useCanvasStore } from '@/store/useCanvasStore';
import { useShallow } from 'zustand/react/shallow';
import { useIsPathHighlighted } from './DataPathVisualization';
import { getConnectionPoints } from '@/utils/connectionPoints';

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

function ConnectionLineComponent({
  connection,
  sourceNode,
  targetNode,
  zoom,
  pan,
  isSelected = false,
  onClick,
  onContextMenu,
}: ConnectionLineProps) {
  const [isHovered, setIsHovered] = useState(false);
  
  // Subscribe to store to trigger re-renders when metrics update
  // Subscribe to both isRunning and connectionMetrics to ensure re-renders
  const { isRunning, connectionMetrics } = useEmulationStore(
    useShallow(state => ({
      isRunning: state.isRunning,
      connectionMetrics: state.connectionMetrics,
    }))
  );
  
  // Get metrics for this connection - will update when connectionMetrics Map changes
  const metrics = isRunning ? connectionMetrics.get(connection.id) : undefined;
  
  const { getConnectionMessages } = useDataFlowStore();
  
  // Optimize store subscriptions: only subscribe to specific values
  const selectedNodeId = useCanvasStore(state => state.selectedNodeId);
  const connections = useCanvasStore(state => state.connections);
  
  // Get data messages directly from store and filter in-transit ones
  const allMessages = isRunning ? getConnectionMessages(connection.id) : [];
  const dataMessages = useMemo(
    () => allMessages.filter(m => m.status === 'in-transit' || m.status === 'pending'),
    [allMessages]
  );
  
  const isPathHighlighted = useIsPathHighlighted(connection.id);
  
  // Memoize hasReverseConnection check - only recalculate when connections or connection changes
  const hasReverseConnection = useMemo(
    () => connections.some(
      conn => conn.source === connection.target && conn.target === connection.source
    ),
    [connections, connection.target, connection.source]
  );

  // Node dimensions
  const nodeWidth = 140;
  const nodeHeight = 100; // approximate height with padding
  const nodeHalfWidth = nodeWidth / 2;
  const nodeHalfHeight = nodeHeight / 2;

  // Use connection points if available, otherwise fall back to edge intersection
  let sourceX: number, sourceY: number, targetX: number, targetY: number;
  
  if (connection.sourcePort !== undefined && connection.targetPort !== undefined) {
    // Use saved connection points
    const sourcePoints = getConnectionPoints(
      sourceNode.position.x,
      sourceNode.position.y,
      nodeWidth,
      nodeHeight,
      16
    );
    const targetPoints = getConnectionPoints(
      targetNode.position.x,
      targetNode.position.y,
      nodeWidth,
      nodeHeight,
      16
    );
    
    const sourcePoint = sourcePoints[connection.sourcePort];
    const targetPoint = targetPoints[connection.targetPort];
    
    sourceX = sourcePoint.x;
    sourceY = sourcePoint.y;
    targetX = targetPoint.x;
    targetY = targetPoint.y;
  } else {
    // Fallback to old edge intersection logic for backward compatibility
    const sourceCenterX = sourceNode.position.x + nodeHalfWidth;
    const sourceCenterY = sourceNode.position.y + nodeHalfHeight;
    const targetCenterX = targetNode.position.x + nodeHalfWidth;
    const targetCenterY = targetNode.position.y + nodeHalfHeight;

    // Calculate angle between centers
    const angle = Math.atan2(targetCenterY - sourceCenterY, targetCenterX - sourceCenterX);

    // Calculate intersection points with node edges
    const getEdgePoint = (centerX: number, centerY: number, angle: number, isSource: boolean) => {
      const absAngle = Math.abs(angle);
      const edgeAngle = Math.atan2(nodeHalfHeight, nodeHalfWidth);
      
      let x, y;
      
      // Determine which edge the line intersects
      if (absAngle < edgeAngle || absAngle > Math.PI - edgeAngle) {
        // Intersects left or right edge
        const sign = isSource ? 1 : -1;
        x = centerX + sign * nodeHalfWidth * Math.sign(Math.cos(angle));
        y = centerY + sign * nodeHalfWidth * Math.tan(angle) * Math.sign(Math.cos(angle));
      } else {
        // Intersects top or bottom edge
        const sign = isSource ? 1 : -1;
        x = centerX + sign * nodeHalfHeight / Math.tan(angle) * Math.sign(Math.sin(angle));
        y = centerY + sign * nodeHalfHeight * Math.sign(Math.sin(angle));
      }
      
      return { x, y };
    };

    const sourceEdge = getEdgePoint(sourceCenterX, sourceCenterY, angle, true);
    const targetEdge = getEdgePoint(targetCenterX, targetCenterY, angle, false);

    sourceX = sourceEdge.x;
    sourceY = sourceEdge.y;
    targetX = targetEdge.x;
    targetY = targetEdge.y;
  }

  // Create bezier curve for smoother connections
  const deltaX = targetX - sourceX;
  const deltaY = targetY - sourceY;
  const controlPointOffset = Math.min(Math.abs(deltaX), Math.abs(deltaY)) * 0.3 + 30;

  // No need for offset with connection points - they are already separated
  const path = `
    M ${sourceX},${sourceY}
    C ${sourceX + controlPointOffset * Math.sign(deltaX)},${sourceY}
      ${targetX - controlPointOffset * Math.sign(deltaX)},${targetY}
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

  // Animation for traffic flow (speed based on throughput, clamped)
  const dashOffset =
    isRunning && metrics && metrics.effectiveThroughput > 0
      ? (metrics.effectiveThroughput % 40) / 2
      : 0;

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
      
      {/* Traffic flow animation (subtle dashed overlay) - only for active connections */}
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
      
      {/* Connection metadata label - minimal, only when useful */}
      {isRunning && metrics && (metrics.effectiveThroughput > 0 || metrics.traffic > 0) ? (
        <g>
          {/* Latency or label */}
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

          {/* Throughput or traffic */}
          <text
            x={(sourceX + targetX) / 2}
            y={(sourceY + targetY) / 2 + 8 / zoom}
            fill="hsl(var(--muted-foreground))"
            fontSize={Math.max(7, 9 / zoom)}
            textAnchor="middle"
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          >
            {metrics.traffic > 0
              ? `${metrics.traffic.toFixed(1)} KB/s`
              : `${metrics.effectiveThroughput.toFixed(0)} msg/s`}
          </text>

          {/* Optional bandwidth limit if it's constraining */}
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
        </g>
      ) : connection.label ? (
        <g>
          {/* Show only label when not running or no activity */}
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

// Memoize component to prevent unnecessary re-renders
// Only re-render if connection, nodes, zoom, pan, or selection state changes
export const ConnectionLine = memo(ConnectionLineComponent, (prevProps, nextProps) => {
  // Compare connection by id and key properties
  if (prevProps.connection.id !== nextProps.connection.id) return false;
  if (prevProps.connection.sourcePort !== nextProps.connection.sourcePort) return false;
  if (prevProps.connection.targetPort !== nextProps.connection.targetPort) return false;
  if (prevProps.connection.label !== nextProps.connection.label) return false;
  
  // Compare source node position
  if (prevProps.sourceNode.id !== nextProps.sourceNode.id) return false;
  if (prevProps.sourceNode.position.x !== nextProps.sourceNode.position.x) return false;
  if (prevProps.sourceNode.position.y !== nextProps.sourceNode.position.y) return false;
  
  // Compare target node position
  if (prevProps.targetNode.id !== nextProps.targetNode.id) return false;
  if (prevProps.targetNode.position.x !== nextProps.targetNode.position.x) return false;
  if (prevProps.targetNode.position.y !== nextProps.targetNode.position.y) return false;
  
  // Compare zoom and pan (affect rendering)
  if (prevProps.zoom !== nextProps.zoom) return false;
  if (prevProps.pan.x !== nextProps.pan.x) return false;
  if (prevProps.pan.y !== nextProps.pan.y) return false;
  
  // Compare selection state
  if (prevProps.isSelected !== nextProps.isSelected) return false;
  
  // Callbacks are compared by reference (should be stable with useCallback)
  if (prevProps.onClick !== nextProps.onClick) return false;
  if (prevProps.onContextMenu !== nextProps.onContextMenu) return false;
  
  // If all checks pass, props are equal - skip re-render
  return true;
});

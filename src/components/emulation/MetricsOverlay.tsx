import React, { useMemo } from 'react';
import { useEmulationStore } from '@/store/useEmulationStore';
import { useCanvasStore } from '@/store/useCanvasStore';
import { ComponentMetrics } from '@/core/EmulationEngine';

const NODE_WIDTH = 140;
const NODE_HEIGHT = 140;
const OVERLAY_OFFSET = 16;

interface MetricsOverlayProps {
  nodeId: string;
  position: { x: number; y: number };
}

export function MetricsOverlay({ nodeId, position }: MetricsOverlayProps) {
  const metrics = useEmulationStore((state) => state.componentMetrics.get(nodeId));
  const { connections } = useCanvasStore();
  const { isRunning } = useEmulationStore();

  // Check if component has activity (connections and non-zero metrics)
  const hasConnections = connections.some(
    conn => conn.source === nodeId || conn.target === nodeId
  );
  
  const hasActivity = metrics && (
    (metrics.throughput && metrics.throughput > 0.1) ||
    (metrics.errorRate && metrics.errorRate > 0.001) ||
    (metrics.utilization && metrics.utilization > 0.01)
  );

  // Metrics display - must be called before early return to follow Rules of Hooks
  const metricsDisplay = useMemo(() => {
    if (!metrics) return [];
    
    const baseMetrics = [
      {
        label: 'Throughput',
        value: `${Math.round(metrics.throughput)}`,
        unit: 'ops/s',
        color: 'text-blue-400',
      },
      {
        label: 'Latency (avg)',
        value: `${Math.round(metrics.latency)}`,
        unit: 'ms',
        color: 'text-yellow-400',
      },
    ];
    
    // Add p50/p99 if available
    if (metrics.latencyP50 !== undefined) {
      baseMetrics.push({
        label: 'Latency (p50)',
        value: `${Math.round(metrics.latencyP50)}`,
        unit: 'ms',
        color: 'text-green-400',
      });
    }
    
    if (metrics.latencyP99 !== undefined) {
      baseMetrics.push({
        label: 'Latency (p99)',
        value: `${Math.round(metrics.latencyP99)}`,
        unit: 'ms',
        color: 'text-red-400',
      });
    }
    
    baseMetrics.push(
      {
        label: 'Error Rate',
        value: `${(metrics.errorRate * 100).toFixed(2)}`,
        unit: '%',
        color: 'text-orange-400',
      },
      {
        label: 'Utilization',
        value: `${Math.round(metrics.utilization * 100)}`,
        unit: '%',
        color: 'text-purple-400',
      }
    );
    
    return baseMetrics;
  }, [metrics]);

  // Only show overlay for connected components with activity
  if (!isRunning || !metrics || !hasConnections || !hasActivity || metricsDisplay.length === 0) {
    return null;
  }

  const screenX = position.x + NODE_WIDTH / 2;
  const screenY = position.y + NODE_HEIGHT + OVERLAY_OFFSET;

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: `${screenX}px`,
        top: `${screenY}px`,
        transform: 'translateX(-50%)',
        zIndex: 10,
      }}
    >
      <div className="bg-slate-900 border border-slate-700 rounded-lg p-2 shadow-lg min-w-max">
        <div className="text-xs space-y-1">
          {metricsDisplay.map((metric) => (
            <div key={metric.label} className="flex items-center justify-between gap-3">
              <span className="text-slate-400">{metric.label}:</span>
              <span className={`font-mono font-semibold ${metric.color}`}>
                {metric.value} {metric.unit}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

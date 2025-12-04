import { Badge } from '@/components/ui/badge';
import { useCanvasStore } from '@/store/useCanvasStore';
import { useEmulationStore } from '@/store/useEmulationStore';
import { useDependencyStore } from '@/store/useDependencyStore';
import { useAlertStore } from '@/store/useAlertStore';
import { 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle,
  CheckCircle2,
  Zap,
  Network,
  Database
} from 'lucide-react';
import { useMemo } from 'react';

export function SystemStatsPanel() {
  const { nodes, connections } = useCanvasStore();
  const { isRunning, componentMetrics, connectionMetrics } = useEmulationStore();
  const { getSystemAnalysis } = useDependencyStore();
  const { getCriticalAlerts, getWarningAlerts } = useAlertStore();

  const stats = useMemo(() => {
    if (!isRunning) {
      return {
        totalThroughput: 0,
        averageLatency: 0,
        totalErrorRate: 0,
        activeComponents: 0,
        activeConnections: 0,
        bottlenecks: 0,
        healthyComponents: 0,
        degradedComponents: 0,
        criticalComponents: 0,
      };
    }

    let totalThroughput = 0;
    let totalLatency = 0;
    let totalErrorRate = 0;
    let activeComponents = 0;
    let activeConnections = 0;
    let bottlenecks = 0;
    let healthyComponents = 0;
    let degradedComponents = 0;
    let criticalComponents = 0;

    // Calculate component stats
    componentMetrics.forEach(metrics => {
      if (metrics.throughput > 0.1 || metrics.errorRate > 0.001) {
        activeComponents++;
        totalThroughput += metrics.throughput || 0;
        totalLatency += metrics.latency || 0;
        totalErrorRate += metrics.errorRate || 0;
      }
    });

    // Calculate connection stats
    connectionMetrics.forEach(metrics => {
      if (metrics.effectiveThroughput > 0 || metrics.traffic > 0) {
        activeConnections++;
        if (metrics.bottleneck) bottlenecks++;
      }
    });

    // Get health stats
    const dependencyStore = useDependencyStore.getState();
    nodes.forEach(node => {
      const status = dependencyStore.getComponentStatus(node.id);
      if (status) {
        switch (status.health) {
          case 'healthy':
            healthyComponents++;
            break;
          case 'degraded':
            degradedComponents++;
            break;
          case 'critical':
          case 'down':
            criticalComponents++;
            break;
        }
      }
    });

    const avgLatency = activeComponents > 0 ? totalLatency / activeComponents : 0;
    const avgErrorRate = activeComponents > 0 ? totalErrorRate / activeComponents : 0;

    return {
      totalThroughput,
      averageLatency: avgLatency,
      totalErrorRate: avgErrorRate,
      activeComponents,
      activeConnections,
      bottlenecks,
      healthyComponents,
      degradedComponents,
      criticalComponents,
    };
  }, [isRunning, componentMetrics, connectionMetrics, nodes]);

  const criticalAlerts = getCriticalAlerts();
  const warningAlerts = getWarningAlerts();

  if (!isRunning) {
    return (
      <div className="text-center text-sm text-muted-foreground py-8">
        <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>Start emulation to see system statistics</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
        {/* Overall metrics */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase">Performance</h4>
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 bg-card border border-border rounded">
              <div className="text-xs text-muted-foreground mb-1">Total Throughput</div>
              <div className="text-lg font-bold text-green-500">
                {stats.totalThroughput.toFixed(0)}
                <span className="text-xs font-normal text-muted-foreground ml-1">ops/s</span>
              </div>
            </div>
            <div className="p-2 bg-card border border-border rounded">
              <div className="text-xs text-muted-foreground mb-1">Avg Latency</div>
              <div className="text-lg font-bold text-yellow-500">
                {stats.averageLatency.toFixed(0)}
                <span className="text-xs font-normal text-muted-foreground ml-1">ms</span>
              </div>
            </div>
            <div className="p-2 bg-card border border-border rounded">
              <div className="text-xs text-muted-foreground mb-1">Error Rate</div>
              <div className="text-lg font-bold text-red-500">
                {(stats.totalErrorRate * 100).toFixed(2)}
                <span className="text-xs font-normal text-muted-foreground ml-1">%</span>
              </div>
            </div>
            <div className="p-2 bg-card border border-border rounded">
              <div className="text-xs text-muted-foreground mb-1">Bottlenecks</div>
              <div className="text-lg font-bold text-orange-500">
                {stats.bottlenecks}
                <span className="text-xs font-normal text-muted-foreground ml-1">conn</span>
              </div>
            </div>
          </div>
        </div>

        {/* Component health */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase">Component Health</h4>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3 h-3 text-green-500" />
                <span>Healthy</span>
              </div>
              <Badge variant="outline" className="bg-green-500/20 border-green-500/50 text-green-500">
                {stats.healthyComponents}
              </Badge>
            </div>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-3 h-3 text-yellow-500" />
                <span>Degraded</span>
              </div>
              <Badge variant="outline" className="bg-yellow-500/20 border-yellow-500/50 text-yellow-500">
                {stats.degradedComponents}
              </Badge>
            </div>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-3 h-3 text-red-500" />
                <span>Critical/Down</span>
              </div>
              <Badge variant="outline" className="bg-red-500/20 border-red-500/50 text-red-500">
                {stats.criticalComponents}
              </Badge>
            </div>
          </div>
        </div>

        {/* Activity */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase">Activity</h4>
          <div className="space-y-1 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Network className="w-3 h-3 text-muted-foreground" />
                <span>Active Components</span>
              </div>
              <span className="font-mono">{stats.activeComponents} / {nodes.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-3 h-3 text-muted-foreground" />
                <span>Active Connections</span>
              </div>
              <span className="font-mono">{stats.activeConnections} / {connections.length}</span>
            </div>
          </div>
        </div>

        {/* Alerts summary */}
        {(criticalAlerts.length > 0 || warningAlerts.length > 0) && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase">Alerts</h4>
            <div className="space-y-1">
              {criticalAlerts.length > 0 && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-red-500">Critical</span>
                  <Badge variant="destructive">{criticalAlerts.length}</Badge>
                </div>
              )}
              {warningAlerts.length > 0 && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-yellow-500">Warnings</span>
                  <Badge variant="outline" className="border-yellow-500 text-yellow-500">
                    {warningAlerts.length}
                  </Badge>
                </div>
              )}
            </div>
          </div>
        )}
    </div>
  );
}


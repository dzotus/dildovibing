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
import { StatusText, Heading, Text } from '@/components/ui/typography';

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
    <div className="space-y-2.5">
        {/* Overall metrics */}
        <div className="space-y-1.5">
          <Heading level={5}>Performance</Heading>
          <div className="grid grid-cols-2 gap-1.5">
            <div className="p-1.5 bg-card border border-border rounded">
              <Text size="micro" muted className="mb-0.5">Total Throughput</Text>
              <StatusText status="success" size="base" weight="bold">
                {stats.totalThroughput.toFixed(0)}
                <Text size="micro" muted className="ml-0.5">ops/s</Text>
              </StatusText>
            </div>
            <div className="p-1.5 bg-card border border-border rounded">
              <Text size="micro" muted className="mb-0.5">Avg Latency</Text>
              <StatusText status="warning" size="base" weight="bold">
                {stats.averageLatency.toFixed(0)}
                <Text size="micro" muted className="ml-0.5">ms</Text>
              </StatusText>
            </div>
            <div className="p-1.5 bg-card border border-border rounded">
              <Text size="micro" muted className="mb-0.5">Error Rate</Text>
              <StatusText status="error" size="base" weight="bold">
                {(stats.totalErrorRate * 100).toFixed(2)}
                <Text size="micro" muted className="ml-0.5">%</Text>
              </StatusText>
            </div>
            <div className="p-1.5 bg-card border border-border rounded">
              <Text size="micro" muted className="mb-0.5">Bottlenecks</Text>
              <StatusText status="warning" size="base" weight="bold">
                {stats.bottlenecks}
                <Text size="micro" muted className="ml-0.5">conn</Text>
              </StatusText>
            </div>
          </div>
        </div>

        {/* Component health */}
        <div className="space-y-1.5">
          <Heading level={5}>Component Health</Heading>
          <div className="space-y-0.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-success" />
                <Text size="micro">Healthy</Text>
              </div>
              <Badge variant="outline" className="bg-success/20 border-success/50 text-success text-xs px-1 py-0">
                {stats.healthyComponents}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-warning" />
                <Text size="micro">Degraded</Text>
              </div>
              <Badge variant="outline" className="bg-warning/20 border-warning/50 text-warning text-xs px-1 py-0">
                {stats.degradedComponents}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-destructive" />
                <Text size="micro">Critical/Down</Text>
              </div>
              <Badge variant="outline" className="bg-destructive/20 border-destructive/50 text-destructive text-xs px-1 py-0">
                {stats.criticalComponents}
              </Badge>
            </div>
          </div>
        </div>

        {/* Activity */}
        <div className="space-y-1.5">
          <Heading level={5}>Activity</Heading>
          <div className="space-y-0.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Network className="w-4 h-4 text-muted-foreground" />
                <Text size="micro">Active Components</Text>
              </div>
              <Text mono size="micro">{stats.activeComponents} / {nodes.length}</Text>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-muted-foreground" />
                <Text size="micro">Active Connections</Text>
              </div>
              <Text mono size="micro">{stats.activeConnections} / {connections.length}</Text>
            </div>
          </div>
        </div>

        {/* Alerts summary */}
        {(criticalAlerts.length > 0 || warningAlerts.length > 0) && (
          <div className="space-y-1.5">
            <Heading level={5}>Alerts</Heading>
            <div className="space-y-0.5">
              {criticalAlerts.length > 0 && (
                <div className="flex items-center justify-between">
                  <StatusText status="error" size="micro">Critical</StatusText>
                  <Badge variant="destructive" className="text-xs px-1 py-0">{criticalAlerts.length}</Badge>
                </div>
              )}
              {warningAlerts.length > 0 && (
                <div className="flex items-center justify-between">
                  <StatusText status="warning" size="micro">Warnings</StatusText>
                  <Badge variant="outline" className="border-warning text-warning text-xs px-1 py-0">
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


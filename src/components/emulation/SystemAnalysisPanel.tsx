import { useDependencyStore } from '@/store/useDependencyStore';
import { useEmulationStore } from '@/store/useEmulationStore';
import { useCanvasStore } from '@/store/useCanvasStore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, AlertTriangle, XCircle, TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

export function SystemAnalysisPanel() {
  const { isRunning } = useEmulationStore();
  const { nodes } = useCanvasStore();
  const systemAnalysis = useDependencyStore((state) => state.getSystemAnalysis());
  const componentStatuses = useDependencyStore((state) => state.getAllComponentStatuses());

  if (!isRunning || !systemAnalysis) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>System Analysis</CardTitle>
          <CardDescription>Start emulation to see system analysis</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const getHealthIcon = (health: string) => {
    switch (health) {
      case 'healthy':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'degraded':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'critical':
        return <AlertCircle className="w-4 h-4 text-orange-500" />;
      case 'down':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Activity className="w-4 h-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'bg-red-500/20 text-red-500 border-red-500/50';
      case 'high':
        return 'bg-orange-500/20 text-orange-500 border-orange-500/50';
      case 'medium':
        return 'bg-yellow-500/20 text-yellow-500 border-yellow-500/50';
      case 'low':
        return 'bg-blue-500/20 text-blue-500 border-blue-500/50';
      default:
        return 'bg-gray-500/20 text-gray-500 border-gray-500/50';
    }
  };

  const getNodeLabel = (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    return node?.data.label || nodeId;
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        {/* Overall Health */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {getHealthIcon(systemAnalysis.overallHealth)}
              Overall System Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-lg px-3 py-1">
                {systemAnalysis.overallHealth.toUpperCase()}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {componentStatuses.filter(s => s.health === 'healthy').length} / {componentStatuses.length} components healthy
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Critical Paths */}
        {systemAnalysis.criticalPaths.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-purple-500" />
                Critical Paths ({systemAnalysis.criticalPaths.length})
              </CardTitle>
              <CardDescription>
                Components on critical paths that affect system performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {systemAnalysis.criticalPaths.slice(0, 5).map((path, idx) => (
                  <div key={idx} className="flex items-center gap-2 flex-wrap p-2 bg-purple-500/10 rounded border border-purple-500/20">
                    {path.map((nodeId, i) => (
                      <div key={nodeId} className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-purple-500/20 text-purple-500 border-purple-500/50">
                          {getNodeLabel(nodeId)}
                        </Badge>
                        {i < path.length - 1 && <span className="text-muted-foreground">→</span>}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Bottlenecks */}
        {systemAnalysis.bottlenecks.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-red-500" />
                Bottlenecks ({systemAnalysis.bottlenecks.length})
              </CardTitle>
              <CardDescription>
                Components limiting system throughput
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {systemAnalysis.bottlenecks.map((nodeId) => {
                  const status = componentStatuses.find(s => s.nodeId === nodeId);
                  return (
                    <div key={nodeId} className="flex items-center justify-between p-2 bg-red-500/10 rounded border border-red-500/20">
                      <span className="font-medium">{getNodeLabel(nodeId)}</span>
                      {status && (
                        <Badge variant="outline" className={getPriorityColor('critical')}>
                          {status.health}
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Risk Components */}
        {systemAnalysis.riskComponents.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-500" />
                At Risk Components ({systemAnalysis.riskComponents.length})
              </CardTitle>
              <CardDescription>
                Components with high failure risk
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {systemAnalysis.riskComponents.map((nodeId) => {
                  const status = componentStatuses.find(s => s.nodeId === nodeId);
                  return (
                    <div key={nodeId} className="flex items-center justify-between p-2 bg-orange-500/10 rounded border border-orange-500/20">
                      <span className="font-medium">{getNodeLabel(nodeId)}</span>
                      {status && (
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={getPriorityColor('high')}>
                            Risk: {(status.failureRisk * 100).toFixed(0)}%
                          </Badge>
                          {getHealthIcon(status.health)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recommendations */}
        {systemAnalysis.recommendations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Recommendations ({systemAnalysis.recommendations.length})
              </CardTitle>
              <CardDescription>
                Suggestions to improve system performance and reliability
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {systemAnalysis.recommendations.slice(0, 10).map((rec, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded border ${getPriorityColor(rec.priority)}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <Badge variant="outline" className={getPriorityColor(rec.priority)}>
                        {rec.priority.toUpperCase()}
                      </Badge>
                      <Badge variant="outline">
                        {rec.type}
                      </Badge>
                    </div>
                    <p className="font-semibold text-sm mb-1">{rec.message}</p>
                    <p className="text-xs text-muted-foreground mb-2">{rec.impact}</p>
                    <p className="text-xs font-medium">{rec.suggestion}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Component Health Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Component Health Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              {componentStatuses.map((status) => (
                <div
                  key={status.nodeId}
                  className="flex items-center justify-between p-2 rounded border"
                >
                  <div className="flex items-center gap-2">
                    {getHealthIcon(status.health)}
                    <span className="text-sm">{getNodeLabel(status.nodeId)}</span>
                  </div>
                  {status.criticalPath && (
                    <Badge variant="outline" className="bg-purple-500/20 text-purple-500 border-purple-500/50 text-xs">
                      Critical
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}


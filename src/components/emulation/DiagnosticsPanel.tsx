import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useCanvasStore } from '@/store/useCanvasStore';
import { useEmulationStore } from '@/store/useEmulationStore';
import { useDependencyStore } from '@/store/useDependencyStore';
import { 
  AlertTriangle, 
  XCircle, 
  AlertCircle, 
  TrendingUp, 
  TrendingDown,
  Activity,
  Zap,
  ArrowRight,
  Search,
  Filter
} from 'lucide-react';
import { Input } from '@/components/ui/input';

interface ProblemTrace {
  nodeId: string;
  nodeLabel: string;
  problem: string;
  severity: 'critical' | 'warning' | 'info';
  metrics: {
    throughput?: number;
    latency?: number;
    errorRate?: number;
    utilization?: number;
  };
  affectedConnections: string[];
  rootCause?: string;
  recommendations: string[];
}

export function DiagnosticsPanel() {
  const { nodes, connections } = useCanvasStore();
  const { isRunning, getComponentMetrics, getConnectionMetrics } = useEmulationStore();
  const { getAllComponentStatuses, getSystemAnalysis } = useDependencyStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState<'all' | 'critical' | 'warning' | 'info'>('all');

  if (!isRunning) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>Diagnostics</CardTitle>
          <CardDescription>Start emulation to see diagnostics</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Analyze problems
  const problems: ProblemTrace[] = [];
  const componentStatuses = getAllComponentStatuses();
  const systemAnalysis = getSystemAnalysis();

  nodes.forEach(node => {
    const metrics = getComponentMetrics(node.id);
    const status = componentStatuses.find(s => s.nodeId === node.id);
    
    if (!metrics || !status) return;

    const nodeProblems: ProblemTrace = {
      nodeId: node.id,
      nodeLabel: node.data.label,
      problem: '',
      severity: 'info',
      metrics: {
        throughput: metrics.throughput,
        latency: metrics.latency,
        errorRate: metrics.errorRate,
        utilization: metrics.utilization,
      },
      affectedConnections: [],
      recommendations: [],
    };

    // Check for bottlenecks
    const bottleneckConnections = connections.filter(conn => {
      if (conn.source === node.id || conn.target === node.id) {
        const connMetrics = getConnectionMetrics(conn.id);
        return connMetrics?.bottleneck;
      }
      return false;
    });

    if (bottleneckConnections.length > 0) {
      nodeProblems.problem = `Bottleneck detected in ${bottleneckConnections.length} connection(s)`;
      nodeProblems.severity = 'critical';
      nodeProblems.affectedConnections = bottleneckConnections.map(c => c.id);
      nodeProblems.rootCause = 'High throughput dependency or backpressure';
      nodeProblems.recommendations = [
        'Consider scaling this component horizontally',
        'Optimize data processing logic',
        'Check for connection bandwidth limits',
      ];
      problems.push(nodeProblems);
      return;
    }

    // Check for high error rate
    if (metrics.errorRate > 0.05) {
      nodeProblems.problem = `High error rate: ${(metrics.errorRate * 100).toFixed(1)}%`;
      nodeProblems.severity = metrics.errorRate > 0.1 ? 'critical' : 'warning';
      nodeProblems.rootCause = 'Component is experiencing failures';
      nodeProblems.recommendations = [
        'Check component logs for error details',
        'Verify input data format and validation',
        'Review retry and error handling logic',
      ];
      problems.push(nodeProblems);
      return;
    }

    // Check for high latency
    if (metrics.latency > 1000) {
      nodeProblems.problem = `High latency: ${metrics.latency.toFixed(0)}ms`;
      nodeProblems.severity = metrics.latency > 2000 ? 'critical' : 'warning';
      nodeProblems.rootCause = 'Component processing is slow';
      nodeProblems.recommendations = [
        'Optimize database queries or data processing',
        'Consider caching frequently accessed data',
        'Review component configuration for performance',
      ];
      problems.push(nodeProblems);
      return;
    }

    // Check for high utilization
    if (metrics.utilization > 0.9) {
      nodeProblems.problem = `High utilization: ${(metrics.utilization * 100).toFixed(0)}%`;
      nodeProblems.severity = 'warning';
      nodeProblems.rootCause = 'Component is near capacity';
      nodeProblems.recommendations = [
        'Consider scaling this component',
        'Optimize resource usage',
        'Monitor for potential failures',
      ];
      problems.push(nodeProblems);
      return;
    }

    // Check health status
    if (status.health === 'critical' || status.health === 'down') {
      nodeProblems.problem = `Component health: ${status.health}`;
      nodeProblems.severity = 'critical';
      nodeProblems.rootCause = 'Component is in critical state or down';
      nodeProblems.recommendations = [
        'Immediately check component status',
        'Review error logs and metrics',
        'Consider failover or restart',
      ];
      problems.push(nodeProblems);
    }
  });

  // Filter problems
  const filteredProblems = problems.filter(p => {
    if (selectedSeverity !== 'all' && p.severity !== selectedSeverity) {
      return false;
    }
    if (searchQuery && !p.nodeLabel.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-blue-500" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <Badge variant="destructive">Critical</Badge>;
      case 'warning':
        return <Badge variant="outline" className="border-yellow-500 text-yellow-600">Warning</Badge>;
      default:
        return <Badge variant="outline">Info</Badge>;
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Diagnostics</CardTitle>
        <CardDescription className="text-xs">
          {filteredProblems.length} problem{filteredProblems.length !== 1 ? 's' : ''} detected
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col overflow-hidden p-0">
        <div className="p-4 border-b border-border space-y-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search components..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant={selectedSeverity === 'all' ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setSelectedSeverity('all')}
            >
              All
            </Button>
            <Button
              variant={selectedSeverity === 'critical' ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setSelectedSeverity('critical')}
            >
              Critical
            </Button>
            <Button
              variant={selectedSeverity === 'warning' ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setSelectedSeverity('warning')}
            >
              Warning
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-3">
            {filteredProblems.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-8">
                <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No problems detected</p>
              </div>
            ) : (
              filteredProblems.map((problem, index) => (
                <Card key={index} className="border-l-4 border-l-red-500">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {getSeverityIcon(problem.severity)}
                        <CardTitle className="text-sm">{problem.nodeLabel}</CardTitle>
                        {getSeverityBadge(problem.severity)}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => {
                          const node = nodes.find(n => n.id === problem.nodeId);
                          if (node) {
                            useCanvasStore.getState().selectNode(problem.nodeId);
                          }
                        }}
                      >
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </div>
                    <CardDescription className="text-xs mt-1">{problem.problem}</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    {/* Metrics */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {problem.metrics.throughput !== undefined && (
                        <div>
                          <span className="text-muted-foreground">Throughput: </span>
                          <span className="font-mono">{problem.metrics.throughput.toFixed(0)} ops/s</span>
                        </div>
                      )}
                      {problem.metrics.latency !== undefined && (
                        <div>
                          <span className="text-muted-foreground">Latency: </span>
                          <span className="font-mono">{problem.metrics.latency.toFixed(0)}ms</span>
                        </div>
                      )}
                      {problem.metrics.errorRate !== undefined && (
                        <div>
                          <span className="text-muted-foreground">Error Rate: </span>
                          <span className="font-mono">{(problem.metrics.errorRate * 100).toFixed(1)}%</span>
                        </div>
                      )}
                      {problem.metrics.utilization !== undefined && (
                        <div>
                          <span className="text-muted-foreground">Utilization: </span>
                          <span className="font-mono">{(problem.metrics.utilization * 100).toFixed(0)}%</span>
                        </div>
                      )}
                    </div>

                    {/* Root Cause */}
                    {problem.rootCause && (
                      <div>
                        <div className="text-xs font-semibold text-muted-foreground mb-1">Root Cause:</div>
                        <div className="text-xs">{problem.rootCause}</div>
                      </div>
                    )}

                    {/* Recommendations */}
                    {problem.recommendations.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold text-muted-foreground mb-1">Recommendations:</div>
                        <ul className="text-xs space-y-1 list-disc list-inside">
                          {problem.recommendations.map((rec, i) => (
                            <li key={i} className="text-muted-foreground">{rec}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}


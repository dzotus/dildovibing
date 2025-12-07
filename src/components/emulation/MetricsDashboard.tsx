import { useEmulationStore } from '@/store/useEmulationStore';
import { useCanvasStore } from '@/store/useCanvasStore';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Activity, TrendingUp, AlertTriangle, Database, Network, Zap } from 'lucide-react';
import { useState, useEffect } from 'react';

interface MetricsHistory {
  timestamp: number;
  nodeMetrics: Map<string, any>;
  connectionMetrics: Map<string, any>;
  systemMetrics: {
    totalThroughput: number;
    averageLatency: number;
    latencyP50: number;
    latencyP99: number;
    totalErrors: number;
    bottleneckCount: number;
    highBackpressureCount: number;
  };
}

export function MetricsDashboard() {
  const { isRunning, getComponentMetrics, getConnectionMetrics } = useEmulationStore();
  const { nodes, connections } = useCanvasStore();
  const [history, setHistory] = useState<MetricsHistory[]>([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedConnection, setSelectedConnection] = useState<string | null>(null);

  // Collect metrics history
  useEffect(() => {
    if (!isRunning) {
      setHistory([]);
      return;
    }

    const interval = setInterval(() => {
      const nodeMetrics = new Map();
      const connectionMetrics = new Map();
      let totalThroughput = 0;
      let totalLatency = 0;
      let totalErrors = 0;
      let bottleneckCount = 0;
      let highBackpressureCount = 0;
      const latencies: number[] = [];
      const p50Values: number[] = [];
      const p99Values: number[] = [];

      // Collect node metrics
      nodes.forEach(node => {
        const metrics = getComponentMetrics(node.id);
        if (metrics) {
          nodeMetrics.set(node.id, { ...metrics, label: node.data.label });
          totalThroughput += metrics.throughput || 0;
          totalLatency += metrics.latency || 0;
          totalErrors += metrics.errorRate || 0;
          
          // Collect latencies for system-wide percentiles
          latencies.push(metrics.latency || 0);
          if (metrics.latencyP50) p50Values.push(metrics.latencyP50);
          if (metrics.latencyP99) p99Values.push(metrics.latencyP99);
        }
      });

      // Collect connection metrics
      connections.forEach(conn => {
        const metrics = getConnectionMetrics(conn.id);
        if (metrics) {
          connectionMetrics.set(conn.id, metrics);
          if (metrics.bottleneck) bottleneckCount++;
          if (metrics.backpressure > 0.7) highBackpressureCount++;
        }
      });

      const avgLatency = nodes.length > 0 ? totalLatency / nodes.length : 0;
      
      // Calculate system-wide p50/p99 (average of all component p50/p99)
      const systemP50 = p50Values.length > 0 
        ? p50Values.reduce((sum, val) => sum + val, 0) / p50Values.length 
        : avgLatency;
      const systemP99 = p99Values.length > 0 
        ? p99Values.reduce((sum, val) => sum + val, 0) / p99Values.length 
        : avgLatency;

      setHistory(prev => {
        const newEntry: MetricsHistory = {
          timestamp: Date.now(),
          nodeMetrics,
          connectionMetrics,
          systemMetrics: {
            totalThroughput,
            averageLatency: avgLatency,
            latencyP50: systemP50,
            latencyP99: systemP99,
            totalErrors,
            bottleneckCount,
            highBackpressureCount,
          },
        };
        
        // Keep last 600 data points (60 seconds of data at 100ms intervals) - extended history
        const updated = [...prev, newEntry].slice(-600);
        return updated;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isRunning, nodes, connections, getComponentMetrics, getConnectionMetrics]);

  // Prepare chart data
  const systemChartData = history.map((h, idx) => ({
    time: idx,
    throughput: h.systemMetrics.totalThroughput,
    latency: h.systemMetrics.averageLatency,
    latencyP50: h.systemMetrics.latencyP50,
    latencyP99: h.systemMetrics.latencyP99,
    errors: h.systemMetrics.totalErrors,
    bottlenecks: h.systemMetrics.bottleneckCount,
  }));

  const nodeChartData = selectedNode 
    ? history.map((h, idx) => {
        const metrics = h.nodeMetrics.get(selectedNode);
        return {
          time: idx,
          throughput: metrics?.throughput || 0,
          latency: metrics?.latency || 0,
          latencyP50: metrics?.latencyP50 || 0,
          latencyP99: metrics?.latencyP99 || 0,
          utilization: (metrics?.utilization || 0) * 100,
          errorRate: (metrics?.errorRate || 0) * 100,
        };
      })
    : [];

  const connectionChartData = selectedConnection
    ? history.map((h, idx) => {
        const metrics = h.connectionMetrics.get(selectedConnection);
        return {
          time: idx,
          throughput: metrics?.effectiveThroughput || 0,
          latency: metrics?.latency || 0,
          latencyP50: metrics?.latencyP50 || 0,
          latencyP99: metrics?.latencyP99 || 0,
          backpressure: (metrics?.backpressure || 0) * 100,
          congestion: (metrics?.congestion || 0) * 100,
        };
      })
    : [];

  // Get current metrics for summary cards
  const currentMetrics = history[history.length - 1]?.systemMetrics;

  if (!isRunning && history.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="text-sm">Start emulation to view metrics dashboard</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header with summary cards */}
      <div className="p-4 border-b border-border">
        <div className="grid grid-cols-4 gap-3">
          <Card className="p-3 bg-card/50 border-border">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Throughput</span>
            </div>
            <p className="text-lg font-semibold text-foreground">
              {currentMetrics?.totalThroughput.toFixed(0) || 0}
              <span className="text-xs text-muted-foreground ml-1">msg/s</span>
            </p>
          </Card>

          <Card className="p-3 bg-card/50 border-border">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="w-4 h-4 text-accent" />
              <span className="text-xs text-muted-foreground">Avg Latency</span>
            </div>
            <p className="text-lg font-semibold text-foreground">
              {currentMetrics?.averageLatency.toFixed(1) || 0}
              <span className="text-xs text-muted-foreground ml-1">ms</span>
            </p>
          </Card>

          <Card className="p-3 bg-card/50 border-border">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              <span className="text-xs text-muted-foreground">Bottlenecks</span>
            </div>
            <p className="text-lg font-semibold text-foreground">
              {currentMetrics?.bottleneckCount || 0}
              {currentMetrics && currentMetrics.bottleneckCount > 0 && (
                <Badge variant="destructive" className="ml-2 text-xs">Alert</Badge>
              )}
            </p>
          </Card>

          <Card className="p-3 bg-card/50 border-border">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-orange-500" />
              <span className="text-xs text-muted-foreground">Backpressure</span>
            </div>
            <p className="text-lg font-semibold text-foreground">
              {currentMetrics?.highBackpressureCount || 0}
              {currentMetrics && currentMetrics.highBackpressureCount > 0 && (
                <Badge variant="outline" className="ml-2 text-xs border-orange-500 text-orange-500">High</Badge>
              )}
            </p>
          </Card>
        </div>
      </div>

      {/* Main content with tabs */}
      <ScrollArea className="flex-1">
        <Tabs defaultValue="system" className="w-full p-4">
          <TabsList className="w-full justify-start border-b border-border bg-transparent rounded-none h-auto p-0 space-x-4">
            <TabsTrigger 
              value="system" 
              className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none bg-transparent"
            >
              System Overview
            </TabsTrigger>
            <TabsTrigger 
              value="nodes" 
              className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none bg-transparent"
            >
              Node Metrics
            </TabsTrigger>
            <TabsTrigger 
              value="connections" 
              className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none bg-transparent"
            >
              Connection Metrics
            </TabsTrigger>
          </TabsList>

          {/* System Overview Tab */}
          <TabsContent value="system" className="space-y-4 mt-4">
            <Card className="p-4 bg-card/50 border-border">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Database className="w-4 h-4" />
                Total System Throughput
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={systemChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="time" 
                    stroke="hsl(var(--muted-foreground))"
                    tick={{ fontSize: 10 }}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    tick={{ fontSize: 10 }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '4px'
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="throughput" 
                    stroke="hsl(var(--primary))" 
                    fill="hsl(var(--primary))"
                    fillOpacity={0.3}
                    name="Throughput (msg/s)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Card>

            <Card className="p-4 bg-card/50 border-border">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Latency (Avg, p50, p99)
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={systemChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="time" 
                    stroke="hsl(var(--muted-foreground))"
                    tick={{ fontSize: 10 }}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    tick={{ fontSize: 10 }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '4px'
                    }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="latency" 
                    stroke="hsl(var(--accent))" 
                    strokeWidth={2}
                    dot={false}
                    name="Avg Latency (ms)"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="latencyP50" 
                    stroke="hsl(142 76% 36%)" 
                    strokeWidth={1.5}
                    strokeDasharray="5 5"
                    dot={false}
                    name="p50 (ms)"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="latencyP99" 
                    stroke="hsl(0 84% 60%)" 
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                    dot={false}
                    name="p99 (ms)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </Card>

            <div className="grid grid-cols-2 gap-4">
              <Card className="p-4 bg-card/50 border-border">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                  Bottlenecks Over Time
                </h3>
                <ResponsiveContainer width="100%" height={150}>
                  <BarChart data={systemChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="time" 
                      stroke="hsl(var(--muted-foreground))"
                      tick={{ fontSize: 10 }}
                    />
                    <YAxis 
                      stroke="hsl(var(--muted-foreground))"
                      tick={{ fontSize: 10 }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '4px'
                      }}
                    />
                    <Bar 
                      dataKey="bottlenecks" 
                      fill="hsl(0 84% 60%)"
                      name="Bottlenecks"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              <Card className="p-4 bg-card/50 border-border">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Network className="w-4 h-4 text-orange-500" />
                  Error Rate
                </h3>
                <ResponsiveContainer width="100%" height={150}>
                  <AreaChart data={systemChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="time" 
                      stroke="hsl(var(--muted-foreground))"
                      tick={{ fontSize: 10 }}
                    />
                    <YAxis 
                      stroke="hsl(var(--muted-foreground))"
                      tick={{ fontSize: 10 }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '4px'
                      }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="errors" 
                      stroke="hsl(25 95% 53%)" 
                      fill="hsl(25 95% 53%)"
                      fillOpacity={0.3}
                      name="Errors"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>
            </div>
          </TabsContent>

          {/* Node Metrics Tab */}
          <TabsContent value="nodes" className="space-y-4 mt-4">
            <div className="flex flex-wrap gap-2 mb-4">
              {nodes.map(node => (
                <button
                  key={node.id}
                  onClick={() => setSelectedNode(node.id)}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                    selectedNode === node.id 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-card border border-border hover:bg-accent'
                  }`}
                >
                  {node.data.label}
                </button>
              ))}
            </div>

            {selectedNode && nodeChartData.length > 0 ? (
              <>
                <Card className="p-4 bg-card/50 border-border">
                  <h3 className="text-sm font-semibold mb-3">Node Latency (Avg, p50, p99)</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={nodeChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="time" 
                        stroke="hsl(var(--muted-foreground))"
                        tick={{ fontSize: 10 }}
                      />
                      <YAxis 
                        stroke="hsl(var(--muted-foreground))"
                        tick={{ fontSize: 10 }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '4px'
                        }}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="latency" 
                        stroke="hsl(var(--accent))" 
                        strokeWidth={2}
                        dot={false}
                        name="Avg Latency (ms)"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="latencyP50" 
                        stroke="hsl(142 76% 36%)" 
                        strokeWidth={1.5}
                        strokeDasharray="5 5"
                        dot={false}
                        name="p50 (ms)"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="latencyP99" 
                        stroke="hsl(0 84% 60%)" 
                        strokeWidth={1.5}
                        strokeDasharray="3 3"
                        dot={false}
                        name="p99 (ms)"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Card>
                
                <Card className="p-4 bg-card/50 border-border">
                  <h3 className="text-sm font-semibold mb-3">Node Throughput</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={nodeChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="time" 
                        stroke="hsl(var(--muted-foreground))"
                        tick={{ fontSize: 10 }}
                      />
                      <YAxis 
                        stroke="hsl(var(--muted-foreground))"
                        tick={{ fontSize: 10 }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '4px'
                        }}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="throughput" 
                        stroke="hsl(var(--primary))" 
                        strokeWidth={2}
                        dot={false}
                        name="Throughput (msg/s)"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Card>

                <div className="grid grid-cols-2 gap-4">
                  <Card className="p-4 bg-card/50 border-border">
                    <h3 className="text-sm font-semibold mb-3">Utilization %</h3>
                    <ResponsiveContainer width="100%" height={150}>
                      <AreaChart data={nodeChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis 
                          dataKey="time" 
                          stroke="hsl(var(--muted-foreground))"
                          tick={{ fontSize: 10 }}
                        />
                        <YAxis 
                          stroke="hsl(var(--muted-foreground))"
                          tick={{ fontSize: 10 }}
                          domain={[0, 100]}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '4px'
                          }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="utilization" 
                          stroke="hsl(142 76% 36%)" 
                          fill="hsl(142 76% 36%)"
                          fillOpacity={0.3}
                          name="Utilization %"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </Card>

                  <Card className="p-4 bg-card/50 border-border">
                    <h3 className="text-sm font-semibold mb-3">Error Rate %</h3>
                    <ResponsiveContainer width="100%" height={150}>
                      <AreaChart data={nodeChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis 
                          dataKey="time" 
                          stroke="hsl(var(--muted-foreground))"
                          tick={{ fontSize: 10 }}
                        />
                        <YAxis 
                          stroke="hsl(var(--muted-foreground))"
                          tick={{ fontSize: 10 }}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '4px'
                          }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="errorRate" 
                          stroke="hsl(0 84% 60%)" 
                          fill="hsl(0 84% 60%)"
                          fillOpacity={0.3}
                          name="Error Rate %"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </Card>
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <p className="text-sm">Select a node to view detailed metrics</p>
              </div>
            )}
          </TabsContent>

          {/* Connection Metrics Tab */}
          <TabsContent value="connections" className="space-y-4 mt-4">
            <div className="flex flex-wrap gap-2 mb-4">
              {connections.map(conn => {
                const sourceNode = nodes.find(n => n.id === conn.source);
                const targetNode = nodes.find(n => n.id === conn.target);
                const label = `${sourceNode?.data.label || 'Node'} → ${targetNode?.data.label || 'Node'}`;
                
                return (
                  <button
                    key={conn.id}
                    onClick={() => setSelectedConnection(conn.id)}
                    className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                      selectedConnection === conn.id 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-card border border-border hover:bg-accent'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {selectedConnection && connectionChartData.length > 0 ? (
              <>
                <Card className="p-4 bg-card/50 border-border">
                  <h3 className="text-sm font-semibold mb-3">Connection Latency (Avg, p50, p99)</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={connectionChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="time" 
                        stroke="hsl(var(--muted-foreground))"
                        tick={{ fontSize: 10 }}
                      />
                      <YAxis 
                        stroke="hsl(var(--muted-foreground))"
                        tick={{ fontSize: 10 }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '4px'
                        }}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="latency" 
                        stroke="hsl(var(--accent))" 
                        strokeWidth={2}
                        dot={false}
                        name="Avg Latency (ms)"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="latencyP50" 
                        stroke="hsl(142 76% 36%)" 
                        strokeWidth={1.5}
                        strokeDasharray="5 5"
                        dot={false}
                        name="p50 (ms)"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="latencyP99" 
                        stroke="hsl(0 84% 60%)" 
                        strokeWidth={1.5}
                        strokeDasharray="3 3"
                        dot={false}
                        name="p99 (ms)"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Card>
                
                <Card className="p-4 bg-card/50 border-border">
                  <h3 className="text-sm font-semibold mb-3">Connection Throughput</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={connectionChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="time" 
                        stroke="hsl(var(--muted-foreground))"
                        tick={{ fontSize: 10 }}
                      />
                      <YAxis 
                        stroke="hsl(var(--muted-foreground))"
                        tick={{ fontSize: 10 }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '4px'
                        }}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="throughput" 
                        stroke="hsl(var(--primary))" 
                        strokeWidth={2}
                        dot={false}
                        name="Throughput (msg/s)"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Card>

                <div className="grid grid-cols-2 gap-4">
                  <Card className="p-4 bg-card/50 border-border">
                    <h3 className="text-sm font-semibold mb-3">Backpressure %</h3>
                    <ResponsiveContainer width="100%" height={150}>
                      <AreaChart data={connectionChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis 
                          dataKey="time" 
                          stroke="hsl(var(--muted-foreground))"
                          tick={{ fontSize: 10 }}
                        />
                        <YAxis 
                          stroke="hsl(var(--muted-foreground))"
                          tick={{ fontSize: 10 }}
                          domain={[0, 100]}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '4px'
                          }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="backpressure" 
                          stroke="hsl(25 95% 53%)" 
                          fill="hsl(25 95% 53%)"
                          fillOpacity={0.3}
                          name="Backpressure %"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </Card>

                  <Card className="p-4 bg-card/50 border-border">
                    <h3 className="text-sm font-semibold mb-3">Congestion %</h3>
                    <ResponsiveContainer width="100%" height={150}>
                      <AreaChart data={connectionChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis 
                          dataKey="time" 
                          stroke="hsl(var(--muted-foreground))"
                          tick={{ fontSize: 10 }}
                        />
                        <YAxis 
                          stroke="hsl(var(--muted-foreground))"
                          tick={{ fontSize: 10 }}
                          domain={[0, 100]}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '4px'
                          }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="congestion" 
                          stroke="hsl(45 93% 47%)" 
                          fill="hsl(45 93% 47%)"
                          fillOpacity={0.3}
                          name="Congestion %"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </Card>
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <p className="text-sm">Select a connection to view detailed metrics</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </ScrollArea>
    </div>
  );
}

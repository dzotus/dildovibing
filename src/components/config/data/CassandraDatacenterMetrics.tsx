/**
 * Datacenter Metrics Component
 * Displays metrics grouped by datacenter and rack
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Server, Database, Activity, HardDrive } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface DatacenterMetrics {
  nodes: number;
  healthyNodes: number;
  totalSize: number;
  readLatency: number;
  writeLatency: number;
  readOpsPerSecond: number;
  writeOpsPerSecond: number;
  racks: Map<string, {
    nodes: number;
    healthyNodes: number;
  }>;
}

interface CassandraDatacenterMetricsProps {
  datacenterMetrics: Map<string, DatacenterMetrics>;
}

export function CassandraDatacenterMetrics({
  datacenterMetrics,
}: CassandraDatacenterMetricsProps) {
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes.toFixed(2)} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const formatLatency = (ms: number): string => {
    if (ms < 1) return `${(ms * 1000).toFixed(0)}μs`;
    return `${ms.toFixed(2)}ms`;
  };

  if (datacenterMetrics.size === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Datacenter Metrics</CardTitle>
          <CardDescription>No datacenters configured</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Datacenter Metrics
          </CardTitle>
          <CardDescription>
            Performance metrics grouped by datacenter and rack
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue={Array.from(datacenterMetrics.keys())[0] || 'default'}>
            <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${datacenterMetrics.size}, 1fr)` }}>
              {Array.from(datacenterMetrics.entries()).map(([dc]) => (
                <TabsTrigger key={dc} value={dc}>
                  {dc}
                </TabsTrigger>
              ))}
            </TabsList>

            {Array.from(datacenterMetrics.entries()).map(([datacenter, metrics]) => (
              <TabsContent key={datacenter} value={datacenter} className="space-y-4 mt-4">
                {/* Datacenter Overview */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <Server className="h-4 w-4" />
                        Nodes
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{metrics.nodes}</div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {metrics.healthyNodes} healthy
                      </p>
                      <Progress
                        value={(metrics.healthyNodes / metrics.nodes) * 100}
                        className="h-2 mt-2"
                      />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <HardDrive className="h-4 w-4" />
                        Data Size
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{formatSize(metrics.totalSize)}</div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Total storage
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <Activity className="h-4 w-4" />
                        Read Latency
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{formatLatency(metrics.readLatency)}</div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Average latency
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <Activity className="h-4 w-4" />
                        Write Latency
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{formatLatency(metrics.writeLatency)}</div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Average latency
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Throughput Metrics */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Throughput</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-muted-foreground">Read Ops/sec</span>
                          <span className="text-sm font-semibold">{metrics.readOpsPerSecond.toFixed(2)}</span>
                        </div>
                        <Progress value={Math.min((metrics.readOpsPerSecond / 1000) * 100, 100)} className="h-2" />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-muted-foreground">Write Ops/sec</span>
                          <span className="text-sm font-semibold">{metrics.writeOpsPerSecond.toFixed(2)}</span>
                        </div>
                        <Progress value={Math.min((metrics.writeOpsPerSecond / 1000) * 100, 100)} className="h-2" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Rack Breakdown */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Rack Breakdown</CardTitle>
                    <CardDescription>Node distribution across racks in {datacenter}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {metrics.racks.size === 0 ? (
                      <p className="text-sm text-muted-foreground">No racks configured</p>
                    ) : (
                      <div className="space-y-3">
                        {Array.from(metrics.racks.entries()).map(([rack, rackMetrics]) => (
                          <div key={rack} className="p-3 rounded-lg border">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Server className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">{rack}</span>
                              </div>
                              <Badge variant="outline">
                                {rackMetrics.nodes} nodes
                              </Badge>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">Health</span>
                              <span className="text-sm font-semibold">
                                {rackMetrics.healthyNodes} / {rackMetrics.nodes}
                              </span>
                            </div>
                            <Progress
                              value={(rackMetrics.healthyNodes / rackMetrics.nodes) * 100}
                              className="h-2 mt-2"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

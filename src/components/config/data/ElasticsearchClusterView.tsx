import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useMemo } from 'react';
import { Database, Server, HardDrive, Activity } from 'lucide-react';
import type { ElasticsearchMetrics, ElasticsearchNode, Shard, NodeMetrics } from '@/core/elasticsearch/types';

interface ElasticsearchClusterViewProps {
  nodes: ElasticsearchNode[];
  shards: Shard[];
  metrics?: ElasticsearchMetrics;
  clusterHealth: 'green' | 'yellow' | 'red';
}

export function ElasticsearchClusterView({
  nodes,
  shards,
  metrics,
  clusterHealth,
}: ElasticsearchClusterViewProps) {
  const getHealthColor = (health: string) => {
    switch (health) {
      case 'green':
        return 'bg-green-500';
      case 'yellow':
        return 'bg-yellow-500';
      case 'red':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  // Group shards by node
  const shardsByNode = useMemo(() => {
    const grouped = new Map<string, Shard[]>();
    shards.forEach(shard => {
      const nodeShards = grouped.get(shard.node) || [];
      nodeShards.push(shard);
      grouped.set(shard.node, nodeShards);
    });
    return grouped;
  }, [shards]);

  // Get node metrics
  const nodeMetricsMap = useMemo(() => {
    const map = new Map<string, NodeMetrics>();
    metrics?.nodeMetrics.forEach(nodeMetric => {
      map.set(nodeMetric.address, nodeMetric);
    });
    return map;
  }, [metrics]);

  return (
    <div className="space-y-4">
      {/* Cluster Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Database className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Cluster Overview</CardTitle>
                <CardDescription>Elasticsearch cluster topology and health</CardDescription>
              </div>
            </div>
            <Badge variant={
              clusterHealth === 'green' ? 'default' :
              clusterHealth === 'yellow' ? 'secondary' : 'destructive'
            } className="gap-2">
              <div className={`h-2 w-2 rounded-full ${getHealthColor(clusterHealth)}`} />
              {clusterHealth === 'green' ? 'Healthy' : clusterHealth === 'yellow' ? 'Degraded' : 'Unhealthy'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{nodes.length}</div>
              <div className="text-sm text-muted-foreground">Nodes</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{shards.length}</div>
              <div className="text-sm text-muted-foreground">Shards</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {shards.filter(s => s.primary).length}
              </div>
              <div className="text-sm text-muted-foreground">Primary</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {shards.filter(s => !s.primary).length}
              </div>
              <div className="text-sm text-muted-foreground">Replicas</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Nodes Visualization */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Cluster Nodes
          </CardTitle>
          <CardDescription>Node status, load, and shard distribution</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {nodes.map((node) => {
              const nodeShards = shardsByNode.get(node.address) || [];
              const nodeMetrics = nodeMetricsMap.get(node.address);
              const primaryShards = nodeShards.filter(s => s.primary).length;
              const replicaShards = nodeShards.filter(s => !s.primary).length;

              return (
                <Card key={node.address} className="border-border">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`h-3 w-3 rounded-full ${
                          node.status === 'up' ? 'bg-green-500' : 'bg-red-500'
                        }`} />
                        <div>
                          <CardTitle className="text-base">{node.address}</CardTitle>
                          <CardDescription className="text-xs mt-1">
                            {primaryShards} primary, {replicaShards} replica shards
                          </CardDescription>
                        </div>
                      </div>
                      <Badge variant={node.status === 'up' ? 'default' : 'destructive'}>
                        {node.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Load */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Load</span>
                        <span className="font-semibold">{(node.load * 100).toFixed(1)}%</span>
                      </div>
                      <Progress value={node.load * 100} className="h-2" />
                    </div>

                    {/* Node Metrics */}
                    {nodeMetrics && (
                      <div className="grid grid-cols-2 gap-4 text-sm pt-2 border-t">
                        <div>
                          <span className="text-muted-foreground">Ops/s:</span>
                          <div className="font-semibold">{nodeMetrics.operationsPerSecond.toFixed(1)}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Avg Latency:</span>
                          <div className="font-semibold">{nodeMetrics.averageLatency.toFixed(1)}ms</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Memory:</span>
                          <div className="font-semibold">{(nodeMetrics.memoryUsage * 100).toFixed(1)}%</div>
                          <Progress value={nodeMetrics.memoryUsage * 100} className="h-1.5 mt-1" />
                        </div>
                        <div>
                          <span className="text-muted-foreground">CPU:</span>
                          <div className="font-semibold">{(nodeMetrics.cpuUsage * 100).toFixed(1)}%</div>
                          <Progress value={nodeMetrics.cpuUsage * 100} className="h-1.5 mt-1" />
                        </div>
                      </div>
                    )}

                    {/* Shards on Node */}
                    {nodeShards.length > 0 && (
                      <div className="pt-2 border-t">
                        <div className="flex items-center gap-2 mb-2">
                          <HardDrive className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">Shards ({nodeShards.length})</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {nodeShards.slice(0, 20).map((shard, idx) => (
                            <Badge
                              key={idx}
                              variant={shard.primary ? 'default' : 'outline'}
                              className="text-xs"
                            >
                              {shard.index}:{shard.shard}
                              {shard.primary ? ' (P)' : ' (R)'}
                            </Badge>
                          ))}
                          {nodeShards.length > 20 && (
                            <Badge variant="outline" className="text-xs">
                              +{nodeShards.length - 20} more
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Shard Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            Shard Distribution
          </CardTitle>
          <CardDescription>Distribution of shards across cluster nodes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Array.from(shardsByNode.entries()).map(([nodeAddress, nodeShards]) => {
              const node = nodes.find(n => n.address === nodeAddress);
              return (
                <div key={nodeAddress} className="flex items-center gap-4 p-2 border rounded">
                  <div className="flex items-center gap-2 min-w-[150px]">
                    <div className={`h-2 w-2 rounded-full ${
                      node?.status === 'up' ? 'bg-green-500' : 'bg-red-500'
                    }`} />
                    <span className="text-sm font-medium">{nodeAddress}</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-muted rounded-full h-4 relative overflow-hidden">
                        <div
                          className="bg-primary h-full"
                          style={{
                            width: `${(nodeShards.length / shards.length) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="text-sm text-muted-foreground min-w-[60px] text-right">
                        {nodeShards.length} shards
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

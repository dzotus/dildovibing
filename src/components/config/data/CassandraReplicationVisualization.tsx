/**
 * Replication Visualization Component
 * Visualizes how data is replicated across nodes
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Server, Database, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { useState } from 'react';

interface ReplicaInfo {
  primaryReplica: string | null;
  replicaNodes: string[];
  token: number;
  tokenRanges: Array<{ start: number; end: number; nodeAddress: string }>;
}

interface CassandraReplicationVisualizationProps {
  replicaInfo: ReplicaInfo | null;
  nodes: Array<{ address: string; status: 'up' | 'down'; load: number; tokens: number; datacenter?: string; rack?: string }>;
  keyspaces: Array<{ name: string; replication: number; replicationStrategy?: string }>;
  onPartitionKeyChange: (partitionKey: string) => void;
}

export function CassandraReplicationVisualization({
  replicaInfo,
  nodes,
  keyspaces,
  onPartitionKeyChange,
}: CassandraReplicationVisualizationProps) {
  const [partitionKey, setPartitionKey] = useState('');
  const [selectedKeyspace, setSelectedKeyspace] = useState(keyspaces[0]?.name || '');

  const handlePartitionKeySubmit = () => {
    if (partitionKey.trim() && selectedKeyspace) {
      onPartitionKeyChange(`${selectedKeyspace}:${partitionKey.trim()}`);
    }
  };

  if (!replicaInfo) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Replication Visualization
          </CardTitle>
          <CardDescription>
            Enter a partition key to visualize replica placement
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Keyspace</Label>
            <Select
              value={selectedKeyspace}
              onValueChange={setSelectedKeyspace}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select keyspace" />
              </SelectTrigger>
              <SelectContent>
                {keyspaces.map(ks => (
                  <SelectItem key={ks.name} value={ks.name}>{ks.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Partition Key</Label>
            <div className="flex gap-2">
              <Input
                value={partitionKey}
                onChange={(e) => setPartitionKey(e.target.value)}
                placeholder="Enter partition key value"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handlePartitionKeySubmit();
                  }
                }}
              />
              <Button onClick={handlePartitionKeySubmit} disabled={!partitionKey.trim()}>
                Visualize
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const primaryNode = nodes.find(n => n.address === replicaInfo.primaryReplica);
  const replicaNodeList = replicaInfo.replicaNodes
    .map(addr => nodes.find(n => n.address === addr))
    .filter(Boolean) as typeof nodes;

  const keyspace = keyspaces.find(ks => ks.name === selectedKeyspace);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Replication Visualization
          </CardTitle>
          <CardDescription>
            Replica placement for partition key: <code className="text-xs bg-muted px-1 py-0.5 rounded">{partitionKey}</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Partition Key Input */}
          <div className="space-y-2">
            <Label>Partition Key</Label>
            <div className="flex gap-2">
              <Input
                value={partitionKey}
                onChange={(e) => setPartitionKey(e.target.value)}
                placeholder="Enter partition key value"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handlePartitionKeySubmit();
                  }
                }}
              />
              <Button onClick={handlePartitionKeySubmit} disabled={!partitionKey.trim()}>
                Update
              </Button>
            </div>
          </div>

          {/* Token Information */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Token Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Token Value</span>
                  <code className="text-sm font-mono">{replicaInfo.token.toLocaleString()}</code>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Replication Factor</span>
                  <Badge variant="outline">{keyspace?.replication || 3}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Replication Strategy</span>
                  <Badge variant="outline">{keyspace?.replicationStrategy || 'NetworkTopologyStrategy'}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Primary Replica */}
          {primaryNode && (
            <Card className="border-primary">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  Primary Replica
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Server className="h-4 w-4" />
                      <span className="font-medium">{primaryNode.address}</span>
                    </div>
                    <Badge variant={primaryNode.status === 'up' ? 'default' : 'destructive'}>
                      {primaryNode.status.toUpperCase()}
                    </Badge>
                  </div>
                  {primaryNode.datacenter && (
                    <p className="text-xs text-muted-foreground">
                      {primaryNode.datacenter} / {primaryNode.rack || 'default'}
                    </p>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Load</span>
                    <span className="font-semibold">{(primaryNode.load * 100).toFixed(1)}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Replica Nodes */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Database className="h-4 w-4" />
                Replica Nodes ({replicaNodeList.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {replicaNodeList.length === 0 ? (
                <p className="text-sm text-muted-foreground">No replica nodes found</p>
              ) : (
                <div className="space-y-3">
                  {replicaNodeList.map((node) => {
                    const isPrimary = node.address === replicaInfo.primaryReplica;
                    const isHealthy = node.status === 'up';
                    
                    return (
                      <div
                        key={node.address}
                        className={`p-3 rounded-lg border ${
                          isPrimary ? 'border-primary bg-primary/5' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {isPrimary ? (
                              <CheckCircle2 className="h-4 w-4 text-primary" />
                            ) : isHealthy ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-500" />
                            )}
                            <span className="font-medium">{node.address}</span>
                            {isPrimary && (
                              <Badge variant="outline" className="text-xs">Primary</Badge>
                            )}
                          </div>
                          <Badge variant={isHealthy ? 'default' : 'destructive'}>
                            {node.status.toUpperCase()}
                          </Badge>
                        </div>
                        {node.datacenter && (
                          <p className="text-xs text-muted-foreground mb-2">
                            {node.datacenter} / {node.rack || 'default'}
                          </p>
                        )}
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Load</span>
                          <span className="font-semibold">{(node.load * 100).toFixed(1)}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Consistency Level Requirements */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Consistency Requirements
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">ONE</span>
                  <Badge variant={replicaNodeList.filter(n => n.status === 'up').length >= 1 ? 'default' : 'destructive'}>
                    {replicaNodeList.filter(n => n.status === 'up').length >= 1 ? 'Satisfied' : 'Not Satisfied'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">QUORUM</span>
                  <Badge variant={replicaNodeList.filter(n => n.status === 'up').length >= Math.ceil(replicaNodeList.length / 2) ? 'default' : 'destructive'}>
                    {replicaNodeList.filter(n => n.status === 'up').length >= Math.ceil(replicaNodeList.length / 2) ? 'Satisfied' : 'Not Satisfied'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">ALL</span>
                  <Badge variant={replicaNodeList.filter(n => n.status === 'up').length === replicaNodeList.length ? 'default' : 'destructive'}>
                    {replicaNodeList.filter(n => n.status === 'up').length === replicaNodeList.length ? 'Satisfied' : 'Not Satisfied'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Token Ring Visualization Component
 * Visualizes Cassandra token ring topology
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useEffect, useRef, useState } from 'react';
import { Server, Circle } from 'lucide-react';

interface TokenRingVisualizationProps {
  tokenRanges: Array<{ start: number; end: number; nodeAddress: string }>;
  sortedTokens: Array<{ token: number; nodeAddress: string }>;
  nodeTokens: Array<{ address: string; tokens: number[]; datacenter?: string; rack?: string }>;
  nodes: Array<{ address: string; status: 'up' | 'down'; load: number; tokens: number; datacenter?: string; rack?: string }>;
  selectedPartitionKey?: string;
  onPartitionKeySelect?: (partitionKey: string) => void;
}

const MAX_TOKEN = 9223372036854775807; // 2^63 - 1

export function CassandraTokenRingVisualization({
  tokenRanges,
  sortedTokens,
  nodeTokens,
  nodes,
  selectedPartitionKey,
  onPartitionKeySelect,
}: TokenRingVisualizationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedToken, setSelectedToken] = useState<number | null>(null);

  // Calculate token position for a given token value
  const getTokenAngle = (token: number): number => {
    // Normalize token to 0-1 range
    const normalized = token / MAX_TOKEN;
    // Convert to angle (0 to 2π)
    return normalized * 2 * Math.PI;
  };

  // Draw token ring
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2 - 40;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw token ring circle
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.stroke();

    // Draw token ranges
    const nodeColorMap = new Map<string, string>();
    const colors = [
      '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
      '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
    ];
    let colorIndex = 0;

    for (const range of tokenRanges) {
      if (!nodeColorMap.has(range.nodeAddress)) {
        nodeColorMap.set(range.nodeAddress, colors[colorIndex % colors.length]);
        colorIndex++;
      }
      const color = nodeColorMap.get(range.nodeAddress)!;

      const startAngle = getTokenAngle(range.start);
      const endAngle = getTokenAngle(range.end);

      // Draw arc for token range
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, startAngle - Math.PI / 2, endAngle - Math.PI / 2);
      ctx.stroke();

      // Draw range label at midpoint
      const midAngle = (startAngle + endAngle) / 2;
      const labelX = centerX + Math.cos(midAngle - Math.PI / 2) * (radius + 15);
      const labelY = centerY + Math.sin(midAngle - Math.PI / 2) * (radius + 15);
      
      ctx.fillStyle = color;
      ctx.font = '10px monospace';
      ctx.fillText(
        `${(range.end - range.start).toLocaleString()}`,
        labelX,
        labelY
      );
    }

    // Draw nodes on the ring
    const nodePositions = new Map<string, { x: number; y: number; angle: number }>();
    
    for (const nodeInfo of nodeTokens) {
      if (nodeInfo.tokens.length === 0) continue;
      
      // Use first token for node position
      const token = nodeInfo.tokens[0];
      const angle = getTokenAngle(token);
      const x = centerX + Math.cos(angle - Math.PI / 2) * radius;
      const y = centerY + Math.sin(angle - Math.PI / 2) * radius;
      
      nodePositions.set(nodeInfo.address, { x, y, angle });

      const node = nodes.find(n => n.address === nodeInfo.address);
      const isHealthy = node?.status === 'up';
      const isHovered = hoveredNode === nodeInfo.address;

      // Draw node circle
      ctx.fillStyle = isHealthy ? (isHovered ? '#10b981' : '#3b82f6') : '#ef4444';
      ctx.beginPath();
      ctx.arc(x, y, isHovered ? 12 : 8, 0, 2 * Math.PI);
      ctx.fill();

      // Draw node label
      ctx.fillStyle = '#1f2937';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        nodeInfo.address.split(':')[0],
        x,
        y - 20
      );
    }

    // Draw selected partition key token if provided
    if (selectedPartitionKey && onPartitionKeySelect) {
      // Calculate token for partition key (simplified hash)
      let hash = 0;
      for (let i = 0; i < selectedPartitionKey.length; i++) {
        const char = selectedPartitionKey.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      const token = Math.abs(hash % MAX_TOKEN);
      const angle = getTokenAngle(token);
      const x = centerX + Math.cos(angle - Math.PI / 2) * radius;
      const y = centerY + Math.sin(angle - Math.PI / 2) * radius;

      // Draw marker
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, 15, 0, 2 * Math.PI);
      ctx.stroke();

      setSelectedToken(token);
    }

    // Handle mouse hover
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      let foundNode: string | null = null;
      for (const [address, pos] of nodePositions.entries()) {
        const distance = Math.sqrt((x - pos.x) ** 2 + (y - pos.y) ** 2);
        if (distance < 15) {
          foundNode = address;
          break;
        }
      }
      setHoveredNode(foundNode);
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    return () => canvas.removeEventListener('mousemove', handleMouseMove);
  }, [tokenRanges, sortedTokens, nodeTokens, nodes, hoveredNode, selectedPartitionKey, onPartitionKeySelect]);

  // Group nodes by datacenter
  const nodesByDatacenter = new Map<string, typeof nodes>();
  for (const node of nodes) {
    const dc = node.datacenter || 'default';
    if (!nodesByDatacenter.has(dc)) {
      nodesByDatacenter.set(dc, []);
    }
    nodesByDatacenter.get(dc)!.push(node);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Circle className="h-5 w-5" />
            Token Ring Topology
          </CardTitle>
          <CardDescription>
            Visual representation of token distribution across cluster nodes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-4 bg-muted rounded-lg">
            <canvas
              ref={canvasRef}
              width={600}
              height={600}
              className="max-w-full h-auto border rounded"
            />
          </div>
          
          {selectedToken !== null && (
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Selected Partition Key Token: {selectedToken.toLocaleString()}
              </p>
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-semibold mb-2">Node Tokens</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {nodeTokens.map((nodeInfo) => {
                  const node = nodes.find(n => n.address === nodeInfo.address);
                  return (
                    <div
                      key={nodeInfo.address}
                      className={`p-2 rounded border ${
                        hoveredNode === nodeInfo.address ? 'border-primary bg-primary/5' : ''
                      }`}
                      onMouseEnter={() => setHoveredNode(nodeInfo.address)}
                      onMouseLeave={() => setHoveredNode(null)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Server className="h-4 w-4" />
                          <span className="text-sm font-medium">{nodeInfo.address}</span>
                          <Badge variant={node?.status === 'up' ? 'default' : 'destructive'}>
                            {node?.status.toUpperCase()}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {nodeInfo.tokens.length} tokens
                        </span>
                      </div>
                      {nodeInfo.datacenter && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {nodeInfo.datacenter} / {nodeInfo.rack || 'default'}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-2">Datacenter Summary</h4>
              <div className="space-y-2">
                {Array.from(nodesByDatacenter.entries()).map(([dc, dcNodes]) => (
                  <div key={dc} className="p-2 rounded border">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{dc}</span>
                      <Badge variant="outline">
                        {dcNodes.length} nodes
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {dcNodes.filter(n => n.status === 'up').length} healthy
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

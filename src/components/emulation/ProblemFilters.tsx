import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCanvasStore } from '@/store/useCanvasStore';
import { useEmulationStore } from '@/store/useEmulationStore';
import { useDependencyStore } from '@/store/useDependencyStore';
import { 
  Search, 
  Filter, 
  AlertTriangle, 
  TrendingDown, 
  XCircle,
  Activity,
  Zap,
  Eye,
  EyeOff
} from 'lucide-react';

interface ProblemFiltersProps {
  onFilterChange?: (filteredNodeIds: string[]) => void;
}

export function ProblemFilters({ onFilterChange }: ProblemFiltersProps) {
  const { nodes, connections, selectNode } = useCanvasStore();
  const { isRunning, getComponentMetrics } = useEmulationStore();
  const { getAllComponentStatuses } = useDependencyStore();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnlyProblems, setShowOnlyProblems] = useState(false);
  const [showBottlenecks, setShowBottlenecks] = useState(true);
  const [showHighErrorRate, setShowHighErrorRate] = useState(true);
  const [showCriticalPaths, setShowCriticalPaths] = useState(true);
  const [showHighLatency, setShowHighLatency] = useState(true);
  const [minLatency, setMinLatency] = useState(100);
  const [minErrorRate, setMinErrorRate] = useState(5);
  const [highlightedNodes, setHighlightedNodes] = useState<Set<string>>(new Set());

  // Filter nodes based on criteria
  const filteredNodes = React.useMemo(() => {
    if (!isRunning) return nodes;
    
    return nodes.filter(node => {
      // Search filter
      if (searchQuery && !node.data.label.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      
      if (!showOnlyProblems) return true;
      
      const metrics = getComponentMetrics(node.id);
      const componentStatuses = getAllComponentStatuses();
      const status = componentStatuses.find(s => s.nodeId === node.id);
      
      // Check bottlenecks
      if (showBottlenecks) {
        const isBottleneck = connections.some(conn => {
          if (conn.source === node.id || conn.target === node.id) {
            const connMetrics = useEmulationStore.getState().getConnectionMetrics(conn.id);
            return connMetrics?.bottleneck;
          }
          return false;
        });
        if (isBottleneck) return true;
      }
      
      // Check high error rate
      if (showHighErrorRate && metrics && metrics.errorRate * 100 >= minErrorRate) {
        return true;
      }
      
      // Check high latency
      if (showHighLatency && metrics && metrics.latency >= minLatency) {
        return true;
      }
      
      // Check critical paths
      if (showCriticalPaths && status?.criticalPath) {
        return true;
      }
      
      // Check health status
      if (status && (status.health === 'critical' || status.health === 'down')) {
        return true;
      }
      
      return false;
    });
  }, [searchQuery, showOnlyProblems, showBottlenecks, showHighErrorRate, showHighLatency, showCriticalPaths, minLatency, minErrorRate, isRunning, nodes, connections]);

  // Update highlighted nodes
  React.useEffect(() => {
    if (showOnlyProblems) {
      const highlighted = new Set(filteredNodes.map(n => n.id));
      setHighlightedNodes(highlighted);
      onFilterChange?.(Array.from(highlighted));
    } else {
      setHighlightedNodes(new Set());
      onFilterChange?.(nodes.map(n => n.id));
    }
  }, [showOnlyProblems, filteredNodes, nodes, onFilterChange]);

  const handleNodeClick = (nodeId: string) => {
    selectNode(nodeId);
    // Scroll to node (would need canvas ref)
  };

  const problemCount = filteredNodes.length;
  const totalProblems = nodes.filter(node => {
    if (!isRunning) return false;
    const metrics = getComponentMetrics(node.id);
    const componentStatuses = getAllComponentStatuses();
    const status = componentStatuses.find(s => s.nodeId === node.id);
    
    return (
      (metrics && (metrics.errorRate * 100 >= minErrorRate || metrics.latency >= minLatency)) ||
      status?.criticalPath ||
      (status && (status.health === 'critical' || status.health === 'down')) ||
      connections.some(conn => {
        if (conn.source === node.id || conn.target === node.id) {
          const connMetrics = useEmulationStore.getState().getConnectionMetrics(conn.id);
          return connMetrics?.bottleneck;
        }
        return false;
      })
    );
  }).length;

  return (
    <Card className="h-full border-2">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Filter className="w-4 h-4" />
          Problem Filters
          {problemCount > 0 && (
            <Badge variant="destructive" className="ml-auto">
              {problemCount}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search */}
        <div className="space-y-2">
          <Label className="text-xs">Search Components</Label>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
        </div>

        {/* Quick filters */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Show Only Problems
            </Label>
            <Switch
              checked={showOnlyProblems}
              onCheckedChange={setShowOnlyProblems}
            />
          </div>
          
          {showOnlyProblems && (
            <div className="pl-6 space-y-2 border-l-2 border-border">
              <div className="flex items-center justify-between">
                <Label className="text-xs flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-red-500" />
                  Bottlenecks
                </Label>
                <Switch
                  checked={showBottlenecks}
                  onCheckedChange={setShowBottlenecks}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label className="text-xs flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-orange-500" />
                  High Error Rate (&gt;{minErrorRate}%)
                </Label>
                <Switch
                  checked={showHighErrorRate}
                  onCheckedChange={setShowHighErrorRate}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label className="text-xs flex items-center gap-2">
                  <Zap className="w-4 h-4 text-yellow-500" />
                  High Latency (&gt;{minLatency}ms)
                </Label>
                <Switch
                  checked={showHighLatency}
                  onCheckedChange={setShowHighLatency}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label className="text-xs flex items-center gap-2">
                  <Activity className="w-4 h-4 text-purple-500" />
                  Critical Paths
                </Label>
                <Switch
                  checked={showCriticalPaths}
                  onCheckedChange={setShowCriticalPaths}
                />
              </div>
            </div>
          )}
        </div>

        {/* Thresholds */}
        {showOnlyProblems && (
          <div className="space-y-2 pt-2 border-t border-border">
            <div>
              <Label className="text-xs">Min Latency (ms)</Label>
              <Input
                type="number"
                value={minLatency}
                onChange={(e) => setMinLatency(Number(e.target.value))}
                className="h-8 text-xs mt-1"
                min={0}
              />
            </div>
            <div>
              <Label className="text-xs">Min Error Rate (%)</Label>
              <Input
                type="number"
                value={minErrorRate}
                onChange={(e) => setMinErrorRate(Number(e.target.value))}
                className="h-8 text-xs mt-1"
                min={0}
                max={100}
              />
            </div>
          </div>
        )}

        {/* Problem summary */}
        {isRunning && (
          <div className="pt-2 border-t border-border">
            <div className="text-xs text-muted-foreground">
              Total problems detected: <span className="font-semibold text-foreground">{totalProblems}</span>
            </div>
          </div>
        )}

        {/* Filtered nodes list */}
        {showOnlyProblems && filteredNodes.length > 0 && (
          <ScrollArea className="h-48 border border-border rounded p-2">
            <div className="space-y-1">
              {filteredNodes.map(node => {
                const metrics = getComponentMetrics(node.id);
                const componentStatuses = getAllComponentStatuses();
                const status = componentStatuses.find(s => s.nodeId === node.id);
                
                return (
                  <Button
                    key={node.id}
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-xs h-auto py-1.5"
                    onClick={() => handleNodeClick(node.id)}
                  >
                    <div className="flex items-center gap-2 w-full">
                      {status?.criticalPath && (
                        <Badge variant="outline" className="bg-purple-500/20 text-purple-500 border-purple-500/50 text-[10px] px-1">
                          Critical
                        </Badge>
                      )}
                      <span className="flex-1 text-left truncate">{node.data.label}</span>
                      {metrics && metrics.errorRate * 100 >= minErrorRate && (
                        <Badge variant="destructive" className="text-[10px] px-1">
                          {(metrics.errorRate * 100).toFixed(0)}%
                        </Badge>
                      )}
                    </div>
                  </Button>
                );
              })}
            </div>
          </ScrollArea>
        )}

        {!isRunning && (
          <div className="text-xs text-muted-foreground text-center py-4">
            Start emulation to see problems
          </div>
        )}
      </CardContent>
    </Card>
  );
}


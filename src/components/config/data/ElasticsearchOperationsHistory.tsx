import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState, useEffect, useMemo } from 'react';
import { History, Filter, RefreshCw, X } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface OperationHistoryItem {
  timestamp: number;
  operation: 'index' | 'get' | 'search' | 'delete' | 'bulk' | 'update';
  index?: string;
  id?: string;
  latency: number;
  success: boolean;
  hits?: number;
  items?: number;
  errors?: number;
}

interface ElasticsearchOperationsHistoryProps {
  operationHistory: OperationHistoryItem[];
  onRefresh?: () => void;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export function ElasticsearchOperationsHistory({
  operationHistory,
  onRefresh,
  autoRefresh = true,
  refreshInterval = 1000,
}: ElasticsearchOperationsHistoryProps) {
  const [filterOperation, setFilterOperation] = useState<string>('all');
  const [filterIndex, setFilterIndex] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh || !onRefresh) return;

    const interval = setInterval(() => {
      onRefresh();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, onRefresh, refreshInterval]);

  // Get unique indices from history
  const uniqueIndices = useMemo(() => {
    const indices = new Set<string>();
    operationHistory.forEach(op => {
      if (op.index) indices.add(op.index);
    });
    return Array.from(indices).sort();
  }, [operationHistory]);

  // Filter operations
  const filteredOperations = useMemo(() => {
    let filtered = [...operationHistory];

    // Filter by operation type
    if (filterOperation !== 'all') {
      filtered = filtered.filter(op => op.operation === filterOperation);
    }

    // Filter by index
    if (filterIndex !== 'all') {
      filtered = filtered.filter(op => op.index === filterIndex);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(op => {
        return (
          op.operation.toLowerCase().includes(query) ||
          op.index?.toLowerCase().includes(query) ||
          op.id?.toLowerCase().includes(query) ||
          op.latency.toString().includes(query)
        );
      });
    }

    return filtered;
  }, [operationHistory, filterOperation, filterIndex, searchQuery]);

  const getOperationColor = (operation: string) => {
    switch (operation) {
      case 'index':
        return 'bg-blue-500';
      case 'search':
        return 'bg-green-500';
      case 'get':
        return 'bg-purple-500';
      case 'delete':
        return 'bg-red-500';
      case 'bulk':
        return 'bg-orange-500';
      case 'update':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-500';
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <History className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Operations History</CardTitle>
              <CardDescription>
                Real-time operation history ({filteredOperations.length} operations)
              </CardDescription>
            </div>
          </div>
          {onRefresh && (
            <Button size="sm" variant="outline" onClick={onRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={filterOperation} onValueChange={setFilterOperation}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Operation" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Operations</SelectItem>
                <SelectItem value="index">Index</SelectItem>
                <SelectItem value="search">Search</SelectItem>
                <SelectItem value="get">Get</SelectItem>
                <SelectItem value="delete">Delete</SelectItem>
                <SelectItem value="bulk">Bulk</SelectItem>
                <SelectItem value="update">Update</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Select value={filterIndex} onValueChange={setFilterIndex}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Index" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Indices</SelectItem>
              {uniqueIndices.map(idx => (
                <SelectItem key={idx} value={idx}>
                  {idx}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <Input
              placeholder="Search operations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
            />
            {searchQuery && (
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setSearchQuery('')}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Operations List */}
        <ScrollArea className="h-[500px]">
          {filteredOperations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No operations found</p>
              <p className="text-sm mt-2">
                {operationHistory.length === 0
                  ? 'Operations will appear here when emulation is running'
                  : 'Try adjusting your filters'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredOperations.map((op, idx) => (
                <Card key={idx} className="border-l-4" style={{
                  borderLeftColor: op.success ? '#22c55e' : '#ef4444',
                }}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className={`h-2 w-2 rounded-full ${getOperationColor(op.operation)}`} />
                          <Badge variant="outline" className="capitalize">
                            {op.operation}
                          </Badge>
                          {op.index && (
                            <Badge variant="secondary">{op.index}</Badge>
                          )}
                          {op.id && (
                            <Badge variant="outline" className="font-mono text-xs">
                              ID: {op.id}
                            </Badge>
                          )}
                          <Badge variant={op.success ? 'default' : 'destructive'}>
                            {op.success ? 'Success' : 'Error'}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatTimestamp(op.timestamp)}
                          </span>
                        </div>

                        <div className="flex items-center gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Latency: </span>
                            <span className="font-semibold">{op.latency.toFixed(2)}ms</span>
                          </div>
                          {op.hits !== undefined && (
                            <div>
                              <span className="text-muted-foreground">Hits: </span>
                              <span className="font-semibold">{op.hits}</span>
                            </div>
                          )}
                          {op.items !== undefined && (
                            <div>
                              <span className="text-muted-foreground">Items: </span>
                              <span className="font-semibold">{op.items}</span>
                            </div>
                          )}
                          {op.errors !== undefined && op.errors > 0 && (
                            <div>
                              <span className="text-muted-foreground">Errors: </span>
                              <span className="font-semibold text-destructive">{op.errors}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useSimulationErrorStore } from '@/store/useSimulationErrorStore';
import { SimulationError, ErrorSeverity, ErrorSource } from '@/core/ErrorCollector';
import { AlertTriangle, X, Search, Trash2, Filter, Info, AlertCircle, Ban } from 'lucide-react';
import { useCanvasStore } from '@/store/useCanvasStore';
import { formatDistanceToNow } from 'date-fns';

export function SimulationErrorsPanel() {
  const { errors, updateErrors, clearErrors, removeError, getErrorCount, getStats } = useSimulationErrorStore();
  const { nodes } = useCanvasStore();
  
  const [severityFilter, setSeverityFilter] = useState<ErrorSeverity | 'all'>('all');
  const [sourceFilter, setSourceFilter] = useState<ErrorSource | 'all'>('all');
  const [componentFilter, setComponentFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Обновляем ошибки при монтировании и периодически
  useEffect(() => {
    updateErrors();
    const interval = setInterval(() => {
      updateErrors();
    }, 1000); // Обновляем каждую секунду

    return () => clearInterval(interval);
  }, [updateErrors]);

  const stats = getStats();

  // Фильтрация ошибок
  const filteredErrors = useMemo(() => {
    let filtered = errors;

    // Фильтр по серьезности
    if (severityFilter !== 'all') {
      filtered = filtered.filter(e => e.severity === severityFilter);
    }

    // Фильтр по источнику
    if (sourceFilter !== 'all') {
      filtered = filtered.filter(e => e.source === sourceFilter);
    }

    // Фильтр по компоненту
    if (componentFilter !== 'all') {
      filtered = filtered.filter(e => e.componentId === componentFilter);
    }

    // Поиск
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(e =>
        e.message.toLowerCase().includes(query) ||
        e.componentLabel?.toLowerCase().includes(query) ||
        e.componentType?.toLowerCase().includes(query) ||
        e.errorType?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [errors, severityFilter, sourceFilter, componentFilter, searchQuery]);

  // Уникальные компоненты для фильтра
  const uniqueComponents = useMemo(() => {
    const componentMap = new Map<string, { id: string; label: string; type: string }>();
    errors.forEach(error => {
      if (error.componentId && error.componentLabel) {
        componentMap.set(error.componentId, {
          id: error.componentId,
          label: error.componentLabel,
          type: error.componentType || 'unknown',
        });
      }
    });
    return Array.from(componentMap.values());
  }, [errors]);

  const getSeverityIcon = (severity: ErrorSeverity) => {
    switch (severity) {
      case 'critical':
        return <Ban className="h-3 w-3 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-3 w-3 text-yellow-500" />;
      case 'info':
        return <Info className="h-3 w-3 text-blue-500" />;
    }
  };

  const getSeverityBadge = (severity: ErrorSeverity) => {
    switch (severity) {
      case 'critical':
        return <Badge variant="destructive" className="text-[9px] px-1 py-0 h-4">Critical</Badge>;
      case 'warning':
        return <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-yellow-500/10 text-yellow-600 border-yellow-500">Warning</Badge>;
      case 'info':
        return <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-blue-500/10 text-blue-600 border-blue-500">Info</Badge>;
    }
  };

  const getSourceBadge = (source: ErrorSource) => {
    const colors: Record<ErrorSource, string> = {
      'emulation-engine': 'bg-purple-500/10 text-purple-600 border-purple-500',
      'component-engine': 'bg-green-500/10 text-green-600 border-green-500',
      'alert-system': 'bg-orange-500/10 text-orange-600 border-orange-500',
      'data-flow': 'bg-cyan-500/10 text-cyan-600 border-cyan-500',
      'routing-engine': 'bg-pink-500/10 text-pink-600 border-pink-500',
      'initialization': 'bg-indigo-500/10 text-indigo-600 border-indigo-500',
      'configuration': 'bg-gray-500/10 text-gray-600 border-gray-500',
      'unknown': 'bg-gray-500/10 text-gray-600 border-gray-500',
    };
    const shortLabels: Record<ErrorSource, string> = {
      'emulation-engine': 'Engine',
      'component-engine': 'Component',
      'alert-system': 'Alert',
      'data-flow': 'DataFlow',
      'routing-engine': 'Routing',
      'initialization': 'Init',
      'configuration': 'Config',
      'unknown': 'Unknown',
    };
    return (
      <Badge variant="outline" className={`text-[9px] px-1 py-0 h-4 ${colors[source] || colors.unknown}`}>
        {shortLabels[source] || shortLabels.unknown}
      </Badge>
    );
  };

  const formatTimestamp = (timestamp: number) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch {
      return 'unknown time';
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header with stats */}
      <div className="p-2 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Simulation Errors</h3>
          </div>
          {errors.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearErrors}
              className="h-6 text-xs"
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Clear All
            </Button>
          )}
        </div>

        {/* Stats */}
        <div className="flex gap-2 text-xs">
          <Badge variant="outline" className="text-xs">
            Total: {stats.total}
          </Badge>
          {stats.critical > 0 && (
            <Badge variant="destructive" className="text-xs">
              Critical: {stats.critical}
            </Badge>
          )}
          {stats.warning > 0 && (
            <Badge variant="outline" className="text-xs bg-yellow-500/10 text-yellow-600 border-yellow-500">
              Warning: {stats.warning}
            </Badge>
          )}
          {stats.info > 0 && (
            <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-600 border-blue-500">
              Info: {stats.info}
            </Badge>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="p-2 border-b border-border space-y-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <Input
            placeholder="Search errors..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-7 pl-7 text-xs"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Select value={severityFilter} onValueChange={(value: any) => setSeverityFilter(value)}>
            <SelectTrigger className="h-7 text-xs">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Severities</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="info">Info</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sourceFilter} onValueChange={(value: any) => setSourceFilter(value)}>
            <SelectTrigger className="h-7 text-xs">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              <SelectItem value="emulation-engine">Emulation Engine</SelectItem>
              <SelectItem value="component-engine">Component Engine</SelectItem>
              <SelectItem value="alert-system">Alert System</SelectItem>
              <SelectItem value="data-flow">Data Flow</SelectItem>
              <SelectItem value="routing-engine">Routing Engine</SelectItem>
              <SelectItem value="initialization">Initialization</SelectItem>
              <SelectItem value="configuration">Configuration</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {uniqueComponents.length > 0 && (
          <Select value={componentFilter} onValueChange={setComponentFilter}>
            <SelectTrigger className="h-7 text-xs">
              <SelectValue placeholder="Component" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Components</SelectItem>
              {uniqueComponents.map(comp => (
                <SelectItem key={comp.id} value={comp.id}>
                  {comp.label} ({comp.type})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Errors list */}
      <ScrollArea className="flex-1">
        <div className="p-1.5 space-y-1.5">
          {filteredErrors.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8">
              {errors.length === 0 ? (
                <div className="flex flex-col items-center gap-2">
                  <AlertCircle className="h-8 w-8 opacity-50" />
                  <p>No errors detected</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Filter className="h-8 w-8 opacity-50" />
                  <p>No errors match the filters</p>
                </div>
              )}
            </div>
          ) : (
            filteredErrors.map((error) => (
              <Card
                key={error.id}
                className={`border-l-2 ${
                  error.severity === 'critical'
                    ? 'border-l-red-500'
                    : error.severity === 'warning'
                    ? 'border-l-yellow-500'
                    : 'border-l-blue-500'
                }`}
              >
                <CardHeader className="pb-1 p-1.5">
                  <div className="flex items-start justify-between gap-1">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 mb-0.5 flex-wrap">
                        <span className="flex-shrink-0">{getSeverityIcon(error.severity)}</span>
                        <CardTitle className="text-[11px] font-semibold truncate">
                          {error.componentLabel || 'System'}
                        </CardTitle>
                        <span className="flex-shrink-0">{getSeverityBadge(error.severity)}</span>
                        <span className="flex-shrink-0">{getSourceBadge(error.source)}</span>
                        {error.count && error.count > 1 && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                            {error.count}x
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="text-[10px] mt-0.5 break-words line-clamp-2">
                        {error.message}
                      </CardDescription>
                      <div className="flex items-center gap-2 mt-0.5 text-[9px] text-muted-foreground">
                        <span>{formatTimestamp(error.timestamp)}</span>
                        {error.componentType && (
                          <span className="truncate">• {error.componentType}</span>
                        )}
                        {error.errorType && (
                          <span className="truncate">• {error.errorType}</span>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 flex-shrink-0"
                      onClick={() => removeError(error.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </CardHeader>
                {(error.context && Object.keys(error.context).length > 0) || error.stack ? (
                  <CardContent className="pt-0 p-1.5 space-y-1">
                    {error.context && Object.keys(error.context).length > 0 && (
                      <details className="text-[9px]">
                        <summary className="cursor-pointer text-muted-foreground hover:text-foreground py-0.5">
                          Context
                        </summary>
                        <pre className="mt-0.5 p-1 bg-muted rounded text-[8px] overflow-x-auto max-h-20">
                          {JSON.stringify(error.context, null, 2)}
                        </pre>
                      </details>
                    )}

                    {error.stack && (
                      <details className="text-[9px]">
                        <summary className="cursor-pointer text-muted-foreground hover:text-foreground py-0.5">
                          Stack
                        </summary>
                        <pre className="mt-0.5 p-1 bg-muted rounded text-[8px] overflow-x-auto max-h-20">
                          {error.stack}
                        </pre>
                      </details>
                    )}
                  </CardContent>
                ) : null}
              </Card>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}



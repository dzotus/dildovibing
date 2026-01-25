import { JaegerTrace, JaegerSpan } from '@/core/JaegerEmulationEngine';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { ChevronRight, ChevronDown, AlertCircle, Clock, Server, GitBranch } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface TraceTreeViewerProps {
  trace: JaegerTrace;
  onSpanClick?: (span: JaegerSpan) => void;
}

interface SpanNode {
  span: JaegerSpan;
  children: SpanNode[];
  depth: number;
}

export function TraceTreeViewer({ trace, onSpanClick }: TraceTreeViewerProps) {
  const [expandedSpans, setExpandedSpans] = useState<Set<string>>(new Set());
  const [selectedSpan, setSelectedSpan] = useState<JaegerSpan | null>(null);

  // Строим дерево spans из parent-child отношений
  const buildSpanTree = (): SpanNode[] => {
    const spanMap = new Map<string, SpanNode>();
    const rootSpans: SpanNode[] = [];

    // Создаем узлы для всех spans
    for (const span of trace.spans) {
      spanMap.set(span.spanId, {
        span,
        children: [],
        depth: 0,
      });
    }

    // Строим дерево
    for (const span of trace.spans) {
      const node = spanMap.get(span.spanId)!;
      
      if (!span.parentSpanId || !spanMap.has(span.parentSpanId)) {
        // Root span
        rootSpans.push(node);
      } else {
        // Child span
        const parentNode = spanMap.get(span.parentSpanId);
        if (parentNode) {
          parentNode.children.push(node);
          node.depth = parentNode.depth + 1;
        }
      }
    }

    // Сортируем children по startTime
    const sortChildren = (node: SpanNode) => {
      node.children.sort((a, b) => a.span.startTime - b.span.startTime);
      node.children.forEach(sortChildren);
    };
    rootSpans.forEach(sortChildren);

    return rootSpans;
  };

  const spanTree = buildSpanTree();
  const traceStartTime = trace.startTime / 1000; // convert to ms
  const traceDuration = trace.duration / 1000; // convert to ms

  const toggleExpand = (spanId: string) => {
    const newExpanded = new Set(expandedSpans);
    if (newExpanded.has(spanId)) {
      newExpanded.delete(spanId);
    } else {
      newExpanded.add(spanId);
    }
    setExpandedSpans(newExpanded);
  };

  const handleSpanClick = (span: JaegerSpan) => {
    setSelectedSpan(span);
    if (onSpanClick) {
      onSpanClick(span);
    }
  };

  const renderSpanNode = (node: SpanNode): JSX.Element => {
    const { span } = node;
    const isExpanded = expandedSpans.has(span.spanId);
    const hasChildren = node.children.length > 0;
    const spanStartMs = span.startTime / 1000;
    const spanDurationMs = span.duration / 1000;
    const offsetPercent = ((spanStartMs - traceStartTime) / traceDuration) * 100;
    const widthPercent = (spanDurationMs / traceDuration) * 100;

    const hasError = span.tags.some(tag => tag.key === 'error' && tag.value === true) ||
                    span.logs.some(log => log.fields.some(f => f.key === 'error'));

    return (
      <div key={span.spanId} className="space-y-1">
        <div
          className={cn(
            "flex items-center gap-2 p-2 rounded hover:bg-muted/50 cursor-pointer transition-colors",
            selectedSpan?.spanId === span.spanId && "bg-primary/10"
          )}
          onClick={() => handleSpanClick(span)}
          style={{ paddingLeft: `${node.depth * 20 + 8}px` }}
        >
          <div className="flex items-center gap-1 min-w-[24px]">
            {hasChildren ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpand(span.spanId);
                }}
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            ) : (
              <div className="w-6" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                <Server className="h-3 w-3 mr-1" />
                {span.serviceName}
              </Badge>
              <span className="font-medium text-sm">{span.operationName}</span>
              {hasError && (
                <AlertCircle className="h-4 w-4 text-destructive" />
              )}
            </div>
            <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {spanDurationMs.toFixed(2)}ms
              </span>
              <span>{span.tags.length} tags</span>
              {span.logs.length > 0 && <span>{span.logs.length} logs</span>}
            </div>
          </div>

          {/* Timeline bar */}
          <div className="w-32 h-6 bg-muted rounded relative overflow-hidden">
            <div
              className={cn(
                "absolute h-full rounded",
                hasError ? "bg-destructive" : "bg-primary"
              )}
              style={{
                left: `${offsetPercent}%`,
                width: `${widthPercent}%`,
              }}
            />
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div className="ml-4">
            {node.children.map(child => renderSpanNode(child))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Trace Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="h-5 w-5" />
                Trace: {trace.traceId.substring(0, 16)}...
              </CardTitle>
              <CardDescription className="mt-2">
                {trace.spanCount} spans • {trace.serviceCount} services • {traceDuration.toFixed(2)}ms
                {trace.hasErrors && (
                  <Badge variant="destructive" className="ml-2">Has Errors</Badge>
                )}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Timeline overview */}
          <div className="w-full h-8 bg-muted rounded relative overflow-hidden mb-4">
            {trace.spans.map(span => {
              const spanStartMs = span.startTime / 1000;
              const spanDurationMs = span.duration / 1000;
              const offsetPercent = ((spanStartMs - traceStartTime) / traceDuration) * 100;
              const widthPercent = (spanDurationMs / traceDuration) * 100;
              const hasError = span.tags.some(tag => tag.key === 'error' && tag.value === true);
              
              return (
                <div
                  key={span.spanId}
                  className={cn(
                    "absolute h-full",
                    hasError ? "bg-destructive/50" : "bg-primary/30"
                  )}
                  style={{
                    left: `${offsetPercent}%`,
                    width: `${widthPercent}%`,
                  }}
                  title={`${span.serviceName}: ${span.operationName}`}
                />
              );
            })}
          </div>

          {/* Span Tree */}
          <div className="space-y-1 max-h-96 overflow-y-auto">
            {spanTree.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">No spans in trace</p>
              </div>
            ) : (
              spanTree.map(root => renderSpanNode(root))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Selected Span Details */}
      {selectedSpan && (
        <Card>
          <CardHeader>
            <CardTitle>Span Details</CardTitle>
            <CardDescription>
              {selectedSpan.serviceName} • {selectedSpan.operationName}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Span ID:</span>
                <span className="ml-2 font-mono">{selectedSpan.spanId}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Trace ID:</span>
                <span className="ml-2 font-mono">{selectedSpan.traceId.substring(0, 16)}...</span>
              </div>
              <div>
                <span className="text-muted-foreground">Duration:</span>
                <span className="ml-2 font-semibold">{(selectedSpan.duration / 1000).toFixed(2)}ms</span>
              </div>
              <div>
                <span className="text-muted-foreground">Start Time:</span>
                <span className="ml-2">
                  {new Date(selectedSpan.startTime / 1000).toLocaleString()}
                </span>
              </div>
              {selectedSpan.parentSpanId && (
                <div>
                  <span className="text-muted-foreground">Parent Span ID:</span>
                  <span className="ml-2 font-mono">{selectedSpan.parentSpanId}</span>
                </div>
              )}
            </div>

            <Separator />

            {/* Tags */}
            {selectedSpan.tags.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2 text-sm">Tags ({selectedSpan.tags.length})</h4>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {selectedSpan.tags.map((tag, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm p-2 bg-muted/50 rounded">
                      <Badge variant="outline" className="text-xs">
                        {tag.key}
                      </Badge>
                      <span className="text-muted-foreground">:</span>
                      <span className="font-mono text-xs">
                        {String(tag.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Logs */}
            {selectedSpan.logs.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2 text-sm">Logs ({selectedSpan.logs.length})</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {selectedSpan.logs.map((log, idx) => (
                    <div key={idx} className="p-2 bg-muted/50 rounded text-sm">
                      <div className="text-xs text-muted-foreground mb-1">
                        {new Date(log.timestamp / 1000).toLocaleString()}
                      </div>
                      <div className="space-y-1">
                        {log.fields.map((field, fieldIdx) => (
                          <div key={fieldIdx} className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {field.key}
                            </Badge>
                            <span className="text-muted-foreground">:</span>
                            <span className="font-mono text-xs">
                              {String(field.value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

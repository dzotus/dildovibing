import { useState, useEffect, useMemo } from 'react';
import { useCanvasStore } from '@/store/useCanvasStore';
import { useEmulationStore } from '@/store/useEmulationStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  LineChart, Line, BarChart, Bar, AreaChart, Area, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, Gauge
} from 'recharts';
import { X, RefreshCw, BarChart3, TrendingUp, Activity, AlertTriangle } from 'lucide-react';
import { CanvasNode } from '@/types';

interface Panel {
  id: string;
  title: string;
  type: 'graph' | 'table' | 'stat' | 'gauge' | 'piechart' | 'bargraph';
  datasource: string;
  queries: Array<{
    refId: string;
    expr: string;
    legendFormat?: string;
    step?: string;
  }>;
  gridPos: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
}

interface Dashboard {
  id: string;
  name: string;
  panels: Panel[];
  tags: string[];
  refresh?: string;
}

interface GrafanaDashboardViewerProps {
  componentId: string;
  dashboardId?: string;
  onClose?: () => void;
}

/**
 * Простой PromQL query executor для базовых запросов
 */
class SimplePromQLExecutor {
  private nodes: CanvasNode[];
  private getComponentMetrics: (nodeId: string) => any;

  constructor(nodes: CanvasNode[], getComponentMetrics: (nodeId: string) => any) {
    this.nodes = nodes;
    this.getComponentMetrics = getComponentMetrics;
  }

  /**
   * Выполняет PromQL query и возвращает данные
   */
  executeQuery(query: string, timeRange: { from: number; to: number }): any[] {
    // Простой парсер для базовых PromQL запросов
    const data: any[] = [];
    const now = Date.now();
    
    // Парсим базовые метрики
    if (query.includes('component_throughput_total') || query.includes('throughput')) {
      this.nodes.forEach(node => {
        const metrics = this.getComponentMetrics(node.id);
        if (metrics) {
          data.push({
            timestamp: now,
            value: metrics.throughput || 0,
            labels: {
              component: node.data.label || node.type,
              component_id: node.id,
              component_type: node.type,
            }
          });
        }
      });
    } else if (query.includes('component_latency_ms') || query.includes('latency')) {
      this.nodes.forEach(node => {
        const metrics = this.getComponentMetrics(node.id);
        if (metrics) {
          data.push({
            timestamp: now,
            value: metrics.latency || 0,
            labels: {
              component: node.data.label || node.type,
              component_id: node.id,
              component_type: node.type,
            }
          });
        }
      });
    } else if (query.includes('component_error_rate') || query.includes('error_rate')) {
      this.nodes.forEach(node => {
        const metrics = this.getComponentMetrics(node.id);
        if (metrics) {
          data.push({
            timestamp: now,
            value: (metrics.errorRate || 0) * 100, // Convert to percentage
            labels: {
              component: node.data.label || node.type,
              component_id: node.id,
              component_type: node.type,
            }
          });
        }
      });
    } else if (query.includes('component_utilization') || query.includes('utilization')) {
      this.nodes.forEach(node => {
        const metrics = this.getComponentMetrics(node.id);
        if (metrics) {
          data.push({
            timestamp: now,
            value: (metrics.utilization || 0) * 100, // Convert to percentage
            labels: {
              component: node.data.label || node.type,
              component_id: node.id,
              component_type: node.type,
            }
          });
        }
      });
    } else if (query.includes('up')) {
      // Простой up query - проверяем доступность компонентов
      this.nodes.forEach(node => {
        const metrics = this.getComponentMetrics(node.id);
        data.push({
          timestamp: now,
          value: metrics ? 1 : 0,
          labels: {
            component: node.data.label || node.type,
            component_id: node.id,
            component_type: node.type,
          }
        });
      });
    } else {
      // Для неизвестных queries возвращаем пустые данные
      return [];
    }

    return data;
  }
}

/**
 * Компонент для отображения панели Grafana
 */
function GrafanaPanel({ panel, executor, timeRange }: { 
  panel: Panel; 
  executor: SimplePromQLExecutor;
  timeRange: { from: number; to: number };
}) {
  const [data, setData] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    // Выполняем queries для панели
    const panelData: any[] = [];
    
    panel.queries.forEach((query, idx) => {
      const queryData = executor.executeQuery(query.expr, timeRange);
      queryData.forEach(point => {
        panelData.push({
          ...point,
          series: query.legendFormat 
            ? query.legendFormat.replace('{{component}}', point.labels.component || 'unknown')
            : `Series ${idx + 1}`,
          refId: query.refId,
        });
      });
    });

    setData(panelData);
    
    // Добавляем в историю для временных графиков
    setHistory(prev => {
      const newHistory = [...prev, { timestamp: Date.now(), data: panelData }];
      // Храним последние 50 точек
      return newHistory.slice(-50);
    });
  }, [panel.queries, executor, timeRange]);

  // Формируем данные для графика (для временных рядов)
  const chartData = useMemo(() => {
    if (panel.type === 'graph' || panel.type === 'bargraph') {
      // Группируем по series
      const seriesMap = new Map<string, any[]>();
      
      history.forEach((entry, idx) => {
        entry.data.forEach((point: any) => {
          const seriesName = point.series || 'default';
          if (!seriesMap.has(seriesName)) {
            seriesMap.set(seriesName, []);
          }
          seriesMap.get(seriesName)!.push({
            time: idx,
            value: point.value,
            timestamp: entry.timestamp,
          });
        });
      });

      // Преобразуем в формат для recharts
      const maxLength = Math.max(...Array.from(seriesMap.values()).map(arr => arr.length));
      const result: any[] = [];
      
      for (let i = 0; i < maxLength; i++) {
        const point: any = { time: i };
        seriesMap.forEach((values, seriesName) => {
          if (values[i]) {
            point[seriesName] = values[i].value;
          }
        });
        result.push(point);
      }
      
      return result;
    }
    return data;
  }, [history, data, panel.type]);

  // Рендерим панель в зависимости от типа
  const renderPanel = () => {
    switch (panel.type) {
      case 'graph':
      case 'bargraph':
        const ChartComponent = panel.type === 'bargraph' ? BarChart : LineChart;
        const DataComponent = panel.type === 'bargraph' ? Bar : Line;
        
        if (chartData.length === 0) {
          return (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
              No data available
            </div>
          );
        }

        const seriesNames = Array.from(new Set(data.map(d => d.series)));
        const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff00', '#ff00ff'];

        return (
          <ResponsiveContainer width="100%" height="100%">
            <ChartComponent data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Legend />
              {seriesNames.map((series, idx) => (
                <DataComponent
                  key={series}
                  type="monotone"
                  dataKey={series}
                  stroke={colors[idx % colors.length]}
                  fill={colors[idx % colors.length]}
                />
              ))}
            </ChartComponent>
          </ResponsiveContainer>
        );

      case 'stat':
        const avgValue = data.length > 0
          ? data.reduce((sum, d) => sum + d.value, 0) / data.length
          : 0;
        return (
          <div className="h-full flex flex-col items-center justify-center">
            <div className="text-4xl font-bold">{avgValue.toFixed(2)}</div>
            <div className="text-sm text-muted-foreground mt-2">{panel.title}</div>
          </div>
        );

      case 'gauge':
        const gaugeValue = data.length > 0
          ? data.reduce((sum, d) => sum + d.value, 0) / data.length
          : 0;
        const percentage = Math.min(100, Math.max(0, gaugeValue));
        return (
          <div className="h-full flex flex-col items-center justify-center">
            <div className="relative w-32 h-32">
              <svg className="transform -rotate-90 w-32 h-32">
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  className="text-muted"
                />
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={`${2 * Math.PI * 56}`}
                  strokeDashoffset={`${2 * Math.PI * 56 * (1 - percentage / 100)}`}
                  className="text-primary transition-all"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-2xl font-bold">{percentage.toFixed(0)}%</div>
              </div>
            </div>
            <div className="text-sm text-muted-foreground mt-2">{panel.title}</div>
          </div>
        );

      case 'table':
        return (
          <div className="h-full overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Component</th>
                  <th className="text-right p-2">Value</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row, idx) => (
                  <tr key={idx} className="border-b">
                    <td className="p-2">{row.labels?.component || 'Unknown'}</td>
                    <td className="text-right p-2">{row.value.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );

      case 'piechart':
        const pieData = data.map(d => ({
          name: d.labels?.component || 'Unknown',
          value: d.value,
        }));
        const pieColors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff00', '#ff00ff'];
        
        return (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        );

      default:
        return (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            Panel type "{panel.type}" not supported
          </div>
        );
    }
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{panel.title}</CardTitle>
      </CardHeader>
      <CardContent className="h-[calc(100%-60px)]">
        {renderPanel()}
      </CardContent>
    </Card>
  );
}

export function GrafanaDashboardViewer({ componentId, dashboardId, onClose }: GrafanaDashboardViewerProps) {
  const { nodes } = useCanvasStore();
  const { getComponentMetrics, isRunning } = useEmulationStore();
  const grafanaNode = nodes.find(n => n.id === componentId);
  
  const config = (grafanaNode?.data.config as any) || {};
  const dashboards = config.dashboards || [];
  
  // Нормализуем dashboards (поддержка старого формата)
  const normalizedDashboards: Dashboard[] = dashboards.map((d: any) => {
    if (typeof d.panels === 'number') {
      return {
        id: d.id || String(Date.now()),
        name: d.name || 'Dashboard',
        panels: [],
        tags: Array.isArray(d.tags) ? d.tags : [],
        refresh: d.refresh || '30s',
      };
    }
    return d;
  }).filter((d: any) => d && typeof d === 'object' && d.id) as Dashboard[];

  // Выбираем dashboard
  const selectedDashboard = dashboardId
    ? normalizedDashboards.find(d => d.id === dashboardId)
    : normalizedDashboards[0];

  const [timeRange, setTimeRange] = useState({ from: Date.now() - 300000, to: Date.now() });
  const [refreshKey, setRefreshKey] = useState(0);

  // Создаем executor для queries
  const executor = useMemo(
    () => new SimplePromQLExecutor(nodes, getComponentMetrics),
    [nodes, getComponentMetrics]
  );

  // Автообновление при изменении refresh interval
  useEffect(() => {
    if (!isRunning || !selectedDashboard) return;

    const refreshInterval = parseDuration(selectedDashboard.refresh || '30s');
    const interval = setInterval(() => {
      setTimeRange({ from: Date.now() - 300000, to: Date.now() });
      setRefreshKey(prev => prev + 1);
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [isRunning, selectedDashboard]);

  function parseDuration(duration: string): number {
    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) return 30000;
    const value = parseInt(match[1]);
    const unit = match[2];
    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return 30000;
    }
  }

  if (!grafanaNode) {
    return (
      <div className="p-4 text-muted-foreground">
        Grafana component not found
      </div>
    );
  }

  if (normalizedDashboards.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No dashboards configured</p>
        <p className="text-sm mt-2">Configure dashboards in Grafana settings</p>
      </div>
    );
  }

  if (!selectedDashboard) {
    return (
      <div className="p-4 text-muted-foreground">
        Dashboard not found
      </div>
    );
  }

  // Сортируем панели по gridPos для правильного отображения
  const sortedPanels = [...selectedDashboard.panels].sort((a, b) => {
    if (a.gridPos.y !== b.gridPos.y) return a.gridPos.y - b.gridPos.y;
    return a.gridPos.x - b.gridPos.x;
  });

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-5 w-5 text-orange-500" />
          <div>
            <h2 className="text-lg font-semibold">{selectedDashboard.name}</h2>
            <div className="flex items-center gap-2 mt-1">
              {selectedDashboard.tags.map((tag, idx) => (
                <Badge key={idx} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setTimeRange({ from: Date.now() - 300000, to: Date.now() });
              setRefreshKey(prev => prev + 1);
            }}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          {onClose && (
            <Button size="sm" variant="ghost" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Dashboard Content */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          {sortedPanels.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No panels in this dashboard</p>
            </div>
          ) : (
            <div className="grid grid-cols-12 gap-4">
              {sortedPanels.map((panel) => (
                <div
                  key={panel.id}
                  className="col-span-12"
                  style={{
                    gridColumn: `span ${Math.min(12, panel.gridPos.w || 12)}`,
                    minHeight: `${(panel.gridPos.h || 8) * 40}px`,
                  }}
                >
                  <GrafanaPanel
                    key={`${panel.id}-${refreshKey}`}
                    panel={panel}
                    executor={executor}
                    timeRange={timeRange}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {!isRunning && (
        <div className="p-2 bg-yellow-500/10 border-t border-yellow-500/20">
          <div className="flex items-center gap-2 text-sm text-yellow-600">
            <AlertTriangle className="h-4 w-4" />
            <span>Simulation is not running. Start emulation to see live data.</span>
          </div>
        </div>
      )}
    </div>
  );
}


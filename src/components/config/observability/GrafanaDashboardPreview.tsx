import { useEffect, useState, useMemo } from 'react';
import { useCanvasStore } from '@/store/useCanvasStore';
import { useEmulationStore } from '@/store/useEmulationStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  LineChart, Line, BarChart, Bar, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
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
  }>;
  gridPos: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
}

interface GrafanaDashboardPreviewProps {
  componentId: string;
  dashboardId: string;
}

/**
 * Простой PromQL executor для превью
 */
class SimplePromQLExecutor {
  private nodes: CanvasNode[];
  private getComponentMetrics: (nodeId: string) => any;

  constructor(nodes: CanvasNode[], getComponentMetrics: (nodeId: string) => any) {
    this.nodes = nodes;
    this.getComponentMetrics = getComponentMetrics;
  }

  executeQuery(query: string): any[] {
    const data: any[] = [];
    const now = Date.now();
    
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
            value: (metrics.errorRate || 0) * 100,
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
            value: (metrics.utilization || 0) * 100,
            labels: {
              component: node.data.label || node.type,
              component_id: node.id,
              component_type: node.type,
            }
          });
        }
      });
    } else if (query.includes('up')) {
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
    }

    return data;
  }
}

/**
 * Компонент для отображения панели в превью
 */
function PreviewPanel({ panel, executor }: { panel: Panel; executor: SimplePromQLExecutor }) {
  const [data, setData] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);

  const { isRunning } = useEmulationStore();
  const [updateKey, setUpdateKey] = useState(0);

  useEffect(() => {
    const panelData: any[] = [];
    
    panel.queries.forEach((query, idx) => {
      const queryData = executor.executeQuery(query.expr);
      queryData.forEach(point => {
        panelData.push({
          ...point,
          series: query.legendFormat 
            ? query.legendFormat.replace('{{component}}', point.labels.component || 'unknown')
            : `Series ${idx + 1}`,
        });
      });
    });

    setData(panelData);
    
    // Добавляем в историю
    setHistory(prev => {
      const newHistory = [...prev, { timestamp: Date.now(), data: panelData }];
      return newHistory.slice(-20); // Храним последние 20 точек для превью
    });
  }, [panel.queries, executor, updateKey]);

  // Автообновление при запущенной симуляции
  useEffect(() => {
    if (!isRunning) return;
    
    const interval = setInterval(() => {
      setUpdateKey(prev => prev + 1);
    }, 1000); // Обновляем каждую секунду

    return () => clearInterval(interval);
  }, [isRunning]);

  // Формируем данные для графика
  const chartData = useMemo(() => {
    if (panel.type === 'graph' || panel.type === 'bargraph') {
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
          });
        });
      });

      const maxLength = Math.max(...Array.from(seriesMap.values()).map(arr => arr.length), 0);
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

  const renderPanel = () => {
    switch (panel.type) {
      case 'graph':
      case 'bargraph':
        const ChartComponent = panel.type === 'bargraph' ? BarChart : LineChart;
        const DataComponent = panel.type === 'bargraph' ? Bar : Line;
        
        if (chartData.length === 0) {
          return (
            <div className="h-full flex items-center justify-center text-muted-foreground text-xs">
              No data
            </div>
          );
        }

        const seriesNames = Array.from(new Set(data.map(d => d.series)));
        const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300'];

        return (
          <ResponsiveContainer width="100%" height="100%">
            <ChartComponent data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="time" stroke="rgba(255,255,255,0.5)" />
              <YAxis stroke="rgba(255,255,255,0.5)" />
              <Tooltip contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.1)' }} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              {seriesNames.map((series, idx) => (
                <DataComponent
                  key={series}
                  type="monotone"
                  dataKey={series}
                  stroke={colors[idx % colors.length]}
                  fill={colors[idx % colors.length]}
                  strokeWidth={2}
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
            <div className="text-3xl font-bold">{avgValue.toFixed(1)}</div>
            <div className="text-xs text-muted-foreground mt-1">{panel.title}</div>
          </div>
        );

      case 'gauge':
        const gaugeValue = data.length > 0
          ? data.reduce((sum, d) => sum + d.value, 0) / data.length
          : 0;
        const percentage = Math.min(100, Math.max(0, gaugeValue));
        return (
          <div className="h-full flex flex-col items-center justify-center">
            <div className="relative w-24 h-24">
              <svg className="transform -rotate-90 w-24 h-24">
                <circle
                  cx="48"
                  cy="48"
                  r="42"
                  stroke="currentColor"
                  strokeWidth="6"
                  fill="none"
                  className="text-muted opacity-30"
                />
                <circle
                  cx="48"
                  cy="48"
                  r="42"
                  stroke="currentColor"
                  strokeWidth="6"
                  fill="none"
                  strokeDasharray={`${2 * Math.PI * 42}`}
                  strokeDashoffset={`${2 * Math.PI * 42 * (1 - percentage / 100)}`}
                  className="text-orange-500 transition-all"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-xl font-bold">{percentage.toFixed(0)}%</div>
              </div>
            </div>
            <div className="text-xs text-muted-foreground mt-1">{panel.title}</div>
          </div>
        );

      case 'table':
        return (
          <div className="h-full overflow-auto text-xs">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-1">Component</th>
                  <th className="text-right p-1">Value</th>
                </tr>
              </thead>
              <tbody>
                {data.slice(0, 5).map((row, idx) => (
                  <tr key={idx} className="border-b">
                    <td className="p-1">{row.labels?.component || 'Unknown'}</td>
                    <td className="text-right p-1">{row.value.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );

      case 'piechart':
        const pieData = data.slice(0, 5).map(d => ({
          name: d.labels?.component || 'Unknown',
          value: d.value,
        }));
        const pieColors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff00'];
        
        return (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                outerRadius={60}
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
          <div className="h-full flex items-center justify-center text-muted-foreground text-xs">
            {panel.type}
          </div>
        );
    }
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{panel.title}</CardTitle>
      </CardHeader>
      <CardContent className="h-[calc(100%-50px)]">
        {renderPanel()}
      </CardContent>
    </Card>
  );
}

export function GrafanaDashboardPreview({ componentId, dashboardId }: GrafanaDashboardPreviewProps) {
  const { nodes } = useCanvasStore();
  const { getComponentMetrics, isRunning } = useEmulationStore();
  const grafanaNode = nodes.find(n => n.id === componentId);
  
  const config = (grafanaNode?.data.config as any) || {};
  const dashboards = config.dashboards || [];
  
  const normalizedDashboards = dashboards.map((d: any) => {
    if (typeof d.panels === 'number') {
      return { id: d.id, name: d.name, panels: [], tags: [] };
    }
    return d;
  }).filter((d: any) => d && typeof d === 'object' && d.id) as Array<{ id: string; name: string; panels: Panel[]; tags: string[] }>;

  const selectedDashboard = normalizedDashboards.find(d => d.id === dashboardId);

  const executor = useMemo(
    () => new SimplePromQLExecutor(nodes, getComponentMetrics),
    [nodes, getComponentMetrics]
  );

  // Автообновление при запущенной симуляции
  useEffect(() => {
    if (!isRunning) return;
    
    const interval = setInterval(() => {
      // Force re-render by updating a state
      // This will trigger useEffect in PreviewPanel components
    }, 1000); // Обновляем каждую секунду

    return () => clearInterval(interval);
  }, [isRunning]);

  if (!selectedDashboard || selectedDashboard.panels.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p className="text-sm">No panels in this dashboard</p>
      </div>
    );
  }

  // Показываем первые 4 панели в превью (2x2 grid)
  const previewPanels = selectedDashboard.panels.slice(0, 4);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {previewPanels.map((panel) => (
          <div key={panel.id} className="h-48">
            <PreviewPanel panel={panel} executor={executor} />
          </div>
        ))}
      </div>
      {selectedDashboard.panels.length > 4 && (
        <div className="text-center text-sm text-muted-foreground">
          +{selectedDashboard.panels.length - 4} more panels. Click "Open Dashboard" to view all.
        </div>
      )}
      {!isRunning && (
        <div className="text-center text-xs text-yellow-600 bg-yellow-500/10 p-2 rounded">
          Start emulation to see live data
        </div>
      )}
    </div>
  );
}


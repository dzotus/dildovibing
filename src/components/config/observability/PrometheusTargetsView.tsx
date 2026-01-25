import { useState, useEffect, useMemo } from 'react';
import { useEmulationStore } from '@/store/useEmulationStore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, RefreshCw, CheckCircle2, XCircle, Clock, AlertTriangle, Activity } from 'lucide-react';
import { emulationEngine } from '@/core/EmulationEngine';
import type { ScrapeTargetStatus } from '@/core/PrometheusEmulationEngine';

interface PrometheusTargetsViewProps {
  componentId: string;
}

/**
 * Компонент для просмотра статусов всех Prometheus targets
 */
export function PrometheusTargetsView({ componentId }: PrometheusTargetsViewProps) {
  const { isRunning } = useEmulationStore();
  const [targets, setTargets] = useState<ScrapeTargetStatus[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'up' | 'down'>('all');
  const [jobFilter, setJobFilter] = useState<string>('all');
  const [updateKey, setUpdateKey] = useState(0);

  // Получаем Prometheus engine
  const prometheusEngine = useMemo(() => {
    if (!isRunning) return null;
    return emulationEngine.getPrometheusEmulationEngine(componentId);
  }, [componentId, isRunning]);

  // Обновляем targets
  useEffect(() => {
    const updateTargets = () => {
      if (prometheusEngine) {
        const targetStatuses = prometheusEngine.getTargetStatuses();
        setTargets(targetStatuses);
      } else {
        setTargets([]);
      }
    };

    updateTargets();

    // Автообновление при запущенной симуляции
    if (isRunning) {
      const interval = setInterval(() => {
        updateTargets();
        setUpdateKey(prev => prev + 1);
      }, 1000); // Обновляем каждую секунду

      return () => clearInterval(interval);
    }
  }, [prometheusEngine, isRunning, updateKey]);

  // Получаем уникальные job names для фильтра
  const uniqueJobs = useMemo(() => {
    const jobs = new Set<string>();
    targets.forEach(target => jobs.add(target.job));
    return Array.from(jobs).sort();
  }, [targets]);

  // Фильтруем targets
  const filteredTargets = useMemo(() => {
    return targets.filter(target => {
      // Фильтр по статусу
      if (statusFilter !== 'all' && target.up !== (statusFilter === 'up')) {
        return false;
      }

      // Фильтр по job
      if (jobFilter !== 'all' && target.job !== jobFilter) {
        return false;
      }

      // Поиск по endpoint, job или labels
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesEndpoint = target.endpoint.toLowerCase().includes(query);
        const matchesJob = target.job.toLowerCase().includes(query);
        const matchesLabels = target.labels 
          ? Object.entries(target.labels).some(([key, value]) => 
              key.toLowerCase().includes(query) || value.toLowerCase().includes(query)
            )
          : false;
        
        if (!matchesEndpoint && !matchesJob && !matchesLabels) {
          return false;
        }
      }

      return true;
    });
  }, [targets, statusFilter, jobFilter, searchQuery]);

  // Форматируем время
  const formatTime = (timestamp: number | null): string => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 1000) return 'Just now';
    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleString();
  };

  // Форматируем duration
  const formatDuration = (ms: number | null): string => {
    if (ms === null) return '-';
    if (ms < 1) return `${(ms * 1000).toFixed(0)}μs`;
    if (ms < 1000) return `${ms.toFixed(2)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const upCount = filteredTargets.filter(t => t.up).length;
  const downCount = filteredTargets.filter(t => !t.up).length;

  return (
    <div className="space-y-4">
      {/* Статистика */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Targets</p>
                <p className="text-2xl font-bold">{filteredTargets.length}</p>
              </div>
              <Activity className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Up</p>
                <p className="text-2xl font-bold text-green-600">{upCount}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Down</p>
                <p className="text-2xl font-bold text-red-600">{downCount}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Фильтры и поиск */}
      <Card>
        <CardHeader>
          <CardTitle>Targets Status</CardTitle>
          <CardDescription>
            Real-time status of all Prometheus scrape targets
            {!isRunning && (
              <span className="ml-2 text-yellow-600">(Start emulation to see live data)</span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by endpoint, job, labels..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={(value: 'all' | 'up' | 'down') => setStatusFilter(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="up">Up</SelectItem>
                  <SelectItem value="down">Down</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Job</Label>
              <Select value={jobFilter} onValueChange={setJobFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Jobs</SelectItem>
                  {uniqueJobs.map(job => (
                    <SelectItem key={job} value={job}>{job}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Таблица targets */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Job</TableHead>
                  <TableHead>Endpoint</TableHead>
                  <TableHead>Last Scrape</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Samples</TableHead>
                  <TableHead>Retries</TableHead>
                  <TableHead>Error</TableHead>
                  <TableHead>Labels</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTargets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      {targets.length === 0 
                        ? (isRunning 
                          ? 'No targets configured. Add scrape configs to see targets here.'
                          : 'Start emulation to see targets status')
                        : 'No targets match the current filters'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTargets.map((target, index) => (
                    <TableRow key={`${target.job}-${target.endpoint}-${index}`}>
                      <TableCell>
                        <Badge variant={target.up ? 'default' : 'destructive'} className="gap-1">
                          {target.up ? (
                            <>
                              <CheckCircle2 className="h-3 w-3" />
                              Up
                            </>
                          ) : (
                            <>
                              <XCircle className="h-3 w-3" />
                              Down
                            </>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{target.job}</TableCell>
                      <TableCell className="font-mono text-sm">{target.endpoint}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          {formatTime(target.lastScrape)}
                        </div>
                        {target.lastSuccess && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Last success: {formatTime(target.lastSuccess)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {target.scrapeDuration !== null ? formatDuration(target.scrapeDuration) : '-'}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{target.samplesScraped}</TableCell>
                      <TableCell>
                        {target.retryCount > 0 ? (
                          <Badge variant="outline" className="text-orange-600">
                            {target.retryCount}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {target.lastError ? (
                          <div className="flex items-center gap-1 text-red-600 text-sm max-w-xs">
                            <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate" title={target.lastError}>
                              {target.lastError}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {target.labels && Object.keys(target.labels).length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(target.labels).slice(0, 3).map(([key, value]) => (
                              <Badge key={key} variant="outline" className="text-xs">
                                {key}={value}
                              </Badge>
                            ))}
                            {Object.keys(target.labels).length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{Object.keys(target.labels).length - 3}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

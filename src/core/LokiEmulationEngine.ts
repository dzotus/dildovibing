import { CanvasNode } from '@/types';

/**
 * Log Entry (соответствует формату Loki push API)
 */
export interface LogEntry {
  timestamp: string; // nanoseconds since epoch
  line: string;
}

/**
 * Log Stream (labels + entries)
 */
export interface LogStream {
  labels: Record<string, string>;
  entries: LogEntry[];
  size: number; // bytes
  lastEntryTime: number; // timestamp in ms
}

/**
 * LogQL Query Result
 */
export interface LogQLQueryResult {
  stream: Record<string, string>;
  values: Array<[string, string]>; // [timestamp, line]
}

/**
 * Query Status
 */
export interface QueryStatus {
  id: string;
  query: string;
  lastExecution: number;
  lastSuccess: number | null;
  lastError: string | null;
  executionDuration: number | null;
  resultsCount: number;
  success: boolean;
}

/**
 * Loki Configuration
 */
export interface LokiEmulationConfig {
  serverUrl?: string;
  retentionPeriod?: string; // e.g., "168h"
  maxStreams?: number;
  maxLineSize?: number; // bytes
  enableCompression?: boolean;
  compressionType?: 'gzip' | 'snappy' | 'lz4';
  enableAuth?: boolean;
  enableMultiTenancy?: boolean;
  tenants?: string[];
  ingestionRateLimit?: number; // lines per second
  queryRateLimit?: number; // queries per second
}

/**
 * Loki Metrics
 */
export interface LokiMetrics {
  ingestionRequestsTotal: number;
  ingestionErrorsTotal: number;
  ingestionLinesTotal: number;
  ingestionBytesTotal: number;
  queryRequestsTotal: number;
  queryErrorsTotal: number;
  queryDurationTotal: number;
  activeStreams: number;
  totalStorageSize: number; // bytes
  retentionDeletions: number;
}

/**
 * Loki Emulation Engine
 * Симулирует работу Loki: ingestion логов, хранение streams, выполнение LogQL queries, расчет нагрузки
 */
export class LokiEmulationEngine {
  private config: LokiEmulationConfig | null = null;
  private streams: Map<string, LogStream> = new Map(); // stream key (labels hash) -> stream
  private queryStatuses: Map<string, QueryStatus> = new Map();
  
  // Rate limiting для ingestion
  private ingestionRateLimiter: Map<string, { count: number; windowStart: number }> = new Map();
  private readonly RATE_LIMIT_WINDOW_MS = 1000; // 1 second window
  
  // Rate limiting для queries
  private queryRateLimiter: { count: number; windowStart: number } = { count: 0, windowStart: Date.now() };
  
  // История ingestion и query latencies
  private ingestionLatencyHistory: number[] = [];
  private queryLatencyHistory: number[] = [];
  private readonly MAX_LATENCY_HISTORY = 100;
  
  // История для расчета per second метрик
  private ingestionHistory: Array<{ timestamp: number; lines: number; bytes: number }> = [];
  private queryHistory: Array<{ timestamp: number; latency: number }> = [];
  private readonly METRICS_WINDOW_MS = 60000; // 1 minute window
  
  // Retention tracking
  private lastRetentionRun: number = 0;
  private readonly RETENTION_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
  
  // Метрики самого Loki
  private lokiMetrics: LokiMetrics = {
    ingestionRequestsTotal: 0,
    ingestionErrorsTotal: 0,
    ingestionLinesTotal: 0,
    ingestionBytesTotal: 0,
    queryRequestsTotal: 0,
    queryErrorsTotal: 0,
    queryDurationTotal: 0,
    activeStreams: 0,
    totalStorageSize: 0,
    retentionDeletions: 0,
  };

  /**
   * Инициализирует конфигурацию Loki из конфига компонента
   */
  initializeConfig(node: CanvasNode): void {
    const config = (node.data.config || {}) as any;
    
    this.config = {
      serverUrl: config.serverUrl || 'http://loki:3100',
      retentionPeriod: config.retentionPeriod || '168h',
      maxStreams: config.maxStreams || 10000,
      maxLineSize: config.maxLineSize || 256000,
      enableCompression: config.enableCompression ?? true,
      compressionType: config.compressionType || 'gzip',
      enableAuth: config.enableAuth ?? false,
      enableMultiTenancy: config.enableMultiTenancy ?? false,
      tenants: config.tenants || [],
      ingestionRateLimit: config.ingestionRateLimit,
      queryRateLimit: config.queryRateLimit,
    };

    // Инициализируем streams из конфига (если есть)
    this.initializeStreamsFromConfig(config);
    
    // Инициализируем query statuses из конфига (если есть)
    this.initializeQueriesFromConfig(config);
  }

  /**
   * Инициализирует streams из конфига
   */
  private initializeStreamsFromConfig(config: any): void {
    if (config.streams && Array.isArray(config.streams)) {
      for (const streamConfig of config.streams) {
        const streamKey = this.getStreamKey(streamConfig.labels || {});
        const entries: LogEntry[] = [];
        
        // Если есть entries в конфиге, конвертируем их
        if (streamConfig.entries && Array.isArray(streamConfig.entries)) {
          for (const entry of streamConfig.entries) {
            entries.push({
              timestamp: entry.timestamp || Date.now().toString() + '000000', // nanoseconds
              line: entry.line || '',
            });
          }
        }
        
        const size = streamConfig.size ? streamConfig.size * 1024 * 1024 * 1024 : 0; // GB to bytes
        
        this.streams.set(streamKey, {
          labels: streamConfig.labels || {},
          entries,
          size,
          lastEntryTime: Date.now(),
        });
      }
    }
  }

  /**
   * Инициализирует queries из конфига
   */
  private initializeQueriesFromConfig(config: any): void {
    if (config.queries && Array.isArray(config.queries)) {
      for (const queryConfig of config.queries) {
        const queryId = queryConfig.id || `query-${Date.now()}-${Math.random()}`;
        this.queryStatuses.set(queryId, {
          id: queryId,
          query: queryConfig.query || '',
          lastExecution: 0,
          lastSuccess: null,
          lastError: null,
          executionDuration: null,
          resultsCount: queryConfig.results || 0,
          success: true,
        });
      }
    }
  }

  /**
   * Обрабатывает ingestion логов (push API)
   */
  processIngestion(
    logs: Array<{ stream: Record<string, string>; values: Array<[string, string]> }>,
    sourceId?: string
  ): { success: boolean; error?: string; ingestedLines: number; ingestedBytes: number } {
    if (!this.config) {
      return { success: false, error: 'Loki not configured', ingestedLines: 0, ingestedBytes: 0 };
    }

    const startTime = performance.now();
    this.lokiMetrics.ingestionRequestsTotal++;

    try {
      // Проверка rate limit с временным окном
      if (this.config.ingestionRateLimit) {
        if (!this.checkIngestionRateLimit(sourceId || 'default', logs.reduce((sum, l) => sum + l.values.length, 0))) {
          this.lokiMetrics.ingestionErrorsTotal++;
          return {
            success: false,
            error: '429 Too Many Requests: ingestion rate limit exceeded',
            ingestedLines: 0,
            ingestedBytes: 0,
          };
        }
      }

      let totalLines = 0;
      let totalBytes = 0;

      for (const logBatch of logs) {
        const streamKey = this.getStreamKey(logBatch.stream);
        
        // Проверка max streams
        if (!this.streams.has(streamKey) && this.streams.size >= (this.config.maxStreams || 10000)) {
          this.lokiMetrics.ingestionErrorsTotal++;
          continue; // Пропускаем, если достигнут лимит streams
        }

        // Получаем или создаем stream
        let stream = this.streams.get(streamKey);
        if (!stream) {
          stream = {
            labels: logBatch.stream,
            entries: [],
            size: 0,
            lastEntryTime: Date.now(),
          };
          this.streams.set(streamKey, stream);
        }

        // Добавляем entries
        for (const [timestamp, line] of logBatch.values) {
          // Проверка max line size
          const lineSize = new Blob([line]).size;
          if (lineSize > (this.config.maxLineSize || 256000)) {
            this.lokiMetrics.ingestionErrorsTotal++;
            continue; // Пропускаем слишком большие строки
          }

          stream.entries.push({
            timestamp,
            line,
          });
          
          stream.size += lineSize;
          stream.lastEntryTime = Math.max(stream.lastEntryTime, this.parseTimestamp(timestamp));
          totalLines++;
          totalBytes += lineSize;
        }

        // Применяем compression (симуляция)
        if (this.config.enableCompression) {
          const compressionRatio = this.getCompressionRatio(this.config.compressionType || 'gzip');
          stream.size = Math.floor(stream.size * compressionRatio);
        }
      }

      // Обновляем метрики
      this.lokiMetrics.ingestionLinesTotal += totalLines;
      this.lokiMetrics.ingestionBytesTotal += totalBytes;
      this.lokiMetrics.totalStorageSize += totalBytes;
      this.lokiMetrics.activeStreams = this.streams.size;

      const duration = performance.now() - startTime;
      this.ingestionLatencyHistory.push(duration);
      if (this.ingestionLatencyHistory.length > this.MAX_LATENCY_HISTORY) {
        this.ingestionLatencyHistory.shift();
      }
      
      // Добавляем в историю для расчета per second метрик
      const now = Date.now();
      this.ingestionHistory.push({
        timestamp: now,
        lines: totalLines,
        bytes: totalBytes,
      });
      
      // Очищаем старую историю (старше окна)
      const cutoff = now - this.METRICS_WINDOW_MS;
      this.ingestionHistory = this.ingestionHistory.filter(h => h.timestamp > cutoff);

      return {
        success: true,
        ingestedLines: totalLines,
        ingestedBytes: totalBytes,
      };

    } catch (error) {
      const duration = performance.now() - startTime;
      this.lokiMetrics.ingestionErrorsTotal++;
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        ingestedLines: 0,
        ingestedBytes: 0,
      };
    }
  }

  /**
   * Выполняет LogQL query
   */
  executeQuery(
    query: string,
    startTime?: number,
    endTime?: number,
    limit?: number
  ): { success: boolean; result?: LogQLQueryResult[]; error?: string; latency: number; resultsCount: number } {
    if (!this.config) {
      return { success: false, error: 'Loki not configured', latency: 0, resultsCount: 0 };
    }

    const queryStartTime = performance.now();
    this.lokiMetrics.queryRequestsTotal++;

    try {
      // Проверка rate limit для queries
      if (this.config.queryRateLimit) {
        if (!this.checkQueryRateLimit()) {
          this.lokiMetrics.queryErrorsTotal++;
          return {
            success: false,
            error: '429 Too Many Requests: query rate limit exceeded',
            latency: 0,
            resultsCount: 0,
          };
        }
      }

      // Парсим LogQL query
      const parsedQuery = this.parseLogQL(query);
      
      // Выполняем query
      const results = this.executeLogQLQuery(parsedQuery, startTime, endTime, limit);
      
      const latency = performance.now() - queryStartTime;
      this.lokiMetrics.queryDurationTotal += latency;
      this.queryLatencyHistory.push(latency);
      if (this.queryLatencyHistory.length > this.MAX_LATENCY_HISTORY) {
        this.queryLatencyHistory.shift();
      }
      
      // Добавляем в историю для расчета per second метрик
      const now = Date.now();
      this.queryHistory.push({
        timestamp: now,
        latency,
      });
      
      // Очищаем старую историю (старше окна)
      const cutoff = now - this.METRICS_WINDOW_MS;
      this.queryHistory = this.queryHistory.filter(h => h.timestamp > cutoff);

      return {
        success: true,
        result: results,
        latency,
        resultsCount: results.reduce((sum, r) => sum + r.values.length, 0),
      };

    } catch (error) {
      const latency = performance.now() - queryStartTime;
      this.lokiMetrics.queryErrorsTotal++;
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        latency,
        resultsCount: 0,
      };
    }
  }

  /**
   * Парсит LogQL query (базовый парсер)
   */
  private parseLogQL(query: string): {
    streamSelector: Record<string, string>;
    lineFilters: Array<{ type: 'contains' | 'not_contains' | 'regex'; pattern: string }>;
    labelFilters: Array<{ label: string; operator: '=' | '!=' | '=~' | '!~'; value: string }>;
    aggregation?: { function: string; params?: string[] };
  } {
    // Упрощенный парсер LogQL
    // Реальный LogQL намного сложнее, но для эмуляции достаточно базового парсинга
    
    const streamSelector: Record<string, string> = {};
    const lineFilters: Array<{ type: 'contains' | 'not_contains' | 'regex'; pattern: string }> = [];
    const labelFilters: Array<{ label: string; operator: '=' | '!=' | '=~' | '!~'; value: string }> = [];

    // Парсим stream selector: {label="value",label2="value2"}
    const streamSelectorMatch = query.match(/^\{([^}]+)\}/);
    if (streamSelectorMatch) {
      const selectorStr = streamSelectorMatch[1];
      const labelMatches = selectorStr.matchAll(/(\w+)=["']([^"']+)["']/g);
      for (const match of labelMatches) {
        streamSelector[match[1]] = match[2];
      }
    }

    // Парсим line filters: |= "text", != "text", |~ "regex"
    const containsMatch = query.match(/\|\s*=\s*["']([^"']+)["']/);
    if (containsMatch) {
      lineFilters.push({ type: 'contains', pattern: containsMatch[1] });
    }

    const notContainsMatch = query.match(/!\s*=\s*["']([^"']+)["']/);
    if (notContainsMatch) {
      lineFilters.push({ type: 'not_contains', pattern: notContainsMatch[1] });
    }

    const regexMatch = query.match(/\|\s*~\s*["']([^"']+)["']/);
    if (regexMatch) {
      lineFilters.push({ type: 'regex', pattern: regexMatch[1] });
    }

    // Парсим label filters: | label = "value"
    const labelFilterMatches = query.matchAll(/\|\s*(\w+)\s*(=|=~|!=|!~)\s*["']([^"']+)["']/g);
    for (const match of labelFilterMatches) {
      labelFilters.push({
        label: match[1],
        operator: match[2] as '=' | '!=' | '=~' | '!~',
        value: match[3],
      });
    }

    // Парсим aggregation: | rate(), | count_over_time(), etc.
    let aggregation: { function: string; params?: string[] } | undefined;
    const aggregationMatch = query.match(/\|\s*(\w+)\(([^)]*)\)/);
    if (aggregationMatch) {
      aggregation = {
        function: aggregationMatch[1],
        params: aggregationMatch[2] ? aggregationMatch[2].split(',').map(p => p.trim()) : [],
      };
    }

    return {
      streamSelector,
      lineFilters,
      labelFilters,
      aggregation,
    };
  }

  /**
   * Выполняет парсированный LogQL query
   */
  private executeLogQLQuery(
    parsed: ReturnType<typeof this.parseLogQL>,
    startTime?: number,
    endTime?: number,
    limit?: number
  ): LogQLQueryResult[] {
    const results: LogQLQueryResult[] = [];
    const now = Date.now();
    const start = startTime || now - 3600000; // Default: last hour
    const end = endTime || now;

    // Фильтруем streams по stream selector
    for (const [streamKey, stream] of this.streams.entries()) {
      // Проверяем соответствие labels
      let matches = true;
      for (const [label, value] of Object.entries(parsed.streamSelector)) {
        if (stream.labels[label] !== value) {
          matches = false;
          break;
        }
      }

      if (!matches) continue;

      // Фильтруем entries по времени
      const filteredEntries = stream.entries.filter(entry => {
        const entryTime = this.parseTimestamp(entry.timestamp);
        return entryTime >= start && entryTime <= end;
      });

      // Применяем line filters
      let filteredByLine = filteredEntries;
      for (const filter of parsed.lineFilters) {
        filteredByLine = filteredByLine.filter(entry => {
          switch (filter.type) {
            case 'contains':
              return entry.line.includes(filter.pattern);
            case 'not_contains':
              return !entry.line.includes(filter.pattern);
            case 'regex':
              try {
                const regex = new RegExp(filter.pattern);
                return regex.test(entry.line);
              } catch {
                return false;
              }
          }
        });
      }

      // Применяем label filters (уже применены через stream selector, но могут быть дополнительные)
      for (const filter of parsed.labelFilters) {
        const labelValue = stream.labels[filter.label];
        if (labelValue === undefined) {
          filteredByLine = [];
          break;
        }
        
        switch (filter.operator) {
          case '=':
            if (labelValue !== filter.value) filteredByLine = [];
            break;
          case '!=':
            if (labelValue === filter.value) filteredByLine = [];
            break;
          case '=~':
            try {
              const regex = new RegExp(filter.value);
              if (!regex.test(labelValue)) filteredByLine = [];
            } catch {
              filteredByLine = [];
            }
            break;
          case '!~':
            try {
              const regex = new RegExp(filter.value);
              if (regex.test(labelValue)) filteredByLine = [];
            } catch {
              // Keep entries if regex invalid
            }
            break;
        }
      }

      // Применяем limit
      if (limit && filteredByLine.length > limit) {
        filteredByLine = filteredByLine.slice(0, limit);
      }

      // Применяем aggregation (упрощенная версия)
      if (parsed.aggregation) {
        // Для агрегаций возвращаем упрощенный результат
        const aggregatedValue = this.applyAggregation(parsed.aggregation, filteredByLine);
        results.push({
          stream: stream.labels,
          values: [[Date.now().toString() + '000000', aggregatedValue.toString()]],
        });
      } else {
        // Обычный query - возвращаем все entries
        if (filteredByLine.length > 0) {
          results.push({
            stream: stream.labels,
            values: filteredByLine.map(e => [e.timestamp, e.line]),
          });
        }
      }
    }

    return results;
  }

  /**
   * Применяет aggregation функцию
   */
  private applyAggregation(
    aggregation: { function: string; params?: string[] },
    entries: LogEntry[]
  ): number {
    switch (aggregation.function.toLowerCase()) {
      case 'rate':
        // rate() - количество entries в секунду
        if (entries.length < 2) return 0;
        const firstTime = this.parseTimestamp(entries[0].timestamp);
        const lastTime = this.parseTimestamp(entries[entries.length - 1].timestamp);
        const duration = (lastTime - firstTime) / 1000; // seconds
        return duration > 0 ? entries.length / duration : 0;

      case 'count_over_time':
        // count_over_time() - количество entries
        return entries.length;

      case 'sum':
        // sum() - сумма (для числовых значений в логах)
        return entries.reduce((sum, e) => {
          const num = parseFloat(e.line);
          return sum + (isNaN(num) ? 0 : num);
        }, 0);

      case 'avg':
      case 'average':
        // avg() - среднее
        const numbers = entries.map(e => parseFloat(e.line)).filter(n => !isNaN(n));
        return numbers.length > 0 ? numbers.reduce((sum, n) => sum + n, 0) / numbers.length : 0;

      default:
        return entries.length;
    }
  }

  /**
   * Проверяет и выполняет retention если нужно (периодически)
   */
  checkAndPerformRetention(currentTime: number): void {
    if (currentTime - this.lastRetentionRun >= this.RETENTION_INTERVAL_MS) {
      this.performRetention(currentTime);
      this.lastRetentionRun = currentTime;
    }
  }

  /**
   * Применяет retention policy
   */
  private performRetention(currentTime: number): void {
    if (!this.config) return;

    const retentionMs = this.parseDuration(this.config.retentionPeriod || '168h');
    const cutoffTime = currentTime - retentionMs;

    let deletedEntries = 0;
    let deletedBytes = 0;

    for (const [streamKey, stream] of this.streams.entries()) {
      const oldLength = stream.entries.length;
      stream.entries = stream.entries.filter(entry => {
        const entryTime = this.parseTimestamp(entry.timestamp);
        return entryTime > cutoffTime;
      });

      if (stream.entries.length < oldLength) {
        deletedEntries += oldLength - stream.entries.length;
        // Пересчитываем size
        stream.size = stream.entries.reduce((sum, e) => sum + new Blob([e.line]).size, 0);
        deletedBytes += stream.size;
      }

      // Удаляем пустые streams
      if (stream.entries.length === 0) {
        this.streams.delete(streamKey);
      }
    }

    this.lokiMetrics.retentionDeletions += deletedEntries;
    this.lokiMetrics.totalStorageSize = Math.max(0, this.lokiMetrics.totalStorageSize - deletedBytes);
    this.lokiMetrics.activeStreams = this.streams.size;
  }

  /**
   * Получает все streams
   */
  getStreams(): LogStream[] {
    return Array.from(this.streams.values());
  }

  /**
   * Получает метрики Loki
   */
  getLokiMetrics(): LokiMetrics {
    return { ...this.lokiMetrics };
  }

  /**
   * Рассчитывает нагрузку на Loki
   */
  calculateLoad(): {
    ingestionLinesPerSecond: number;
    ingestionBytesPerSecond: number;
    averageIngestionLatency: number;
    ingestionErrorRate: number;
    queriesPerSecond: number;
    averageQueryLatency: number;
    queryErrorRate: number;
    storageUtilization: number;
    streamCount: number;
  } {
    const totalIngestionRequests = this.lokiMetrics.ingestionRequestsTotal;
    const totalIngestionErrors = this.lokiMetrics.ingestionErrorsTotal;
    const totalIngestionLines = this.lokiMetrics.ingestionLinesTotal;
    const totalIngestionBytes = this.lokiMetrics.ingestionBytesTotal;
    const totalQueryRequests = this.lokiMetrics.queryRequestsTotal;
    const totalQueryErrors = this.lokiMetrics.queryErrorsTotal;
    const totalQueryDuration = this.lokiMetrics.queryDurationTotal;

    // Упрощенный расчет per second (в реальности нужен временной интервал)
    const avgIngestionLatency = this.ingestionLatencyHistory.length > 0
      ? this.ingestionLatencyHistory.reduce((sum, l) => sum + l, 0) / this.ingestionLatencyHistory.length
      : 0;

    const avgQueryLatency = this.queryLatencyHistory.length > 0
      ? this.queryLatencyHistory.reduce((sum, l) => sum + l, 0) / this.queryLatencyHistory.length
      : totalQueryRequests > 0 ? totalQueryDuration / totalQueryRequests : 0;

    const ingestionErrorRate = totalIngestionRequests > 0
      ? totalIngestionErrors / totalIngestionRequests
      : 0;

    const queryErrorRate = totalQueryRequests > 0
      ? totalQueryErrors / totalQueryRequests
      : 0;

    // Расчет per second на основе временного окна
    const ingestionRates = this.calculateIngestionRate();
    const queryRates = this.calculateQueryRate();

    // Storage utilization (0-1)
    const maxStorage = (this.config?.maxStreams || 10000) * 100 * 1024 * 1024; // Примерная оценка
    const storageUtilization = Math.min(1, this.lokiMetrics.totalStorageSize / maxStorage);

    return {
      ingestionLinesPerSecond: ingestionRates.linesPerSecond,
      ingestionBytesPerSecond: ingestionRates.bytesPerSecond,
      averageIngestionLatency: avgIngestionLatency,
      ingestionErrorRate,
      queriesPerSecond: queryRates.queriesPerSecond,
      averageQueryLatency: avgQueryLatency,
      queryErrorRate,
      storageUtilization,
      streamCount: this.streams.size,
    };
  }

  /**
   * Рассчитывает ingestion rate на основе временного окна
   */
  private calculateIngestionRate(): { linesPerSecond: number; bytesPerSecond: number } {
    const now = Date.now();
    const cutoff = now - this.METRICS_WINDOW_MS;
    
    const recent = this.ingestionHistory.filter(h => h.timestamp > cutoff);
    const totalLines = recent.reduce((sum, h) => sum + h.lines, 0);
    const totalBytes = recent.reduce((sum, h) => sum + h.bytes, 0);
    
    const seconds = this.METRICS_WINDOW_MS / 1000;
    return {
      linesPerSecond: totalLines / seconds,
      bytesPerSecond: totalBytes / seconds,
    };
  }

  /**
   * Рассчитывает query rate на основе временного окна
   */
  private calculateQueryRate(): { queriesPerSecond: number } {
    const now = Date.now();
    const cutoff = now - this.METRICS_WINDOW_MS;
    
    const recent = this.queryHistory.filter(h => h.timestamp > cutoff);
    const totalQueries = recent.length;
    
    const seconds = this.METRICS_WINDOW_MS / 1000;
    return {
      queriesPerSecond: totalQueries / seconds,
    };
  }

  /**
   * Проверяет ingestion rate limit с временным окном
   */
  private checkIngestionRateLimit(sourceId: string, linesCount: number): boolean {
    if (!this.config?.ingestionRateLimit) return true;
    
    const now = Date.now();
    const key = sourceId || 'default';
    
    let limiter = this.ingestionRateLimiter.get(key);
    if (!limiter || now - limiter.windowStart >= this.RATE_LIMIT_WINDOW_MS) {
      limiter = { count: 0, windowStart: now };
      this.ingestionRateLimiter.set(key, limiter);
    }
    
    limiter.count += linesCount;
    return limiter.count <= this.config.ingestionRateLimit;
  }

  /**
   * Проверяет query rate limit с временным окном
   */
  private checkQueryRateLimit(): boolean {
    if (!this.config?.queryRateLimit) return true;
    
    const now = Date.now();
    
    if (now - this.queryRateLimiter.windowStart >= this.RATE_LIMIT_WINDOW_MS) {
      this.queryRateLimiter = { count: 0, windowStart: now };
    }
    
    this.queryRateLimiter.count++;
    return this.queryRateLimiter.count <= this.config.queryRateLimit;
  }

  /**
   * Вспомогательные методы
   */
  private getStreamKey(labels: Record<string, string>): string {
    // Создаем уникальный ключ из labels
    const sortedLabels = Object.keys(labels).sort().map(key => `${key}=${labels[key]}`).join(',');
    return sortedLabels;
  }

  private parseTimestamp(timestamp: string): number {
    // Парсит timestamp (nanoseconds) в миллисекунды
    const nanos = BigInt(timestamp);
    return Number(nanos / BigInt(1000000));
  }

  private parseDuration(duration: string): number {
    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) return 7 * 24 * 60 * 60 * 1000; // Default: 7 days

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return 7 * 24 * 60 * 60 * 1000;
    }
  }

  private getCompressionRatio(type: string): number {
    // Примерные коэффициенты сжатия
    switch (type) {
      case 'gzip': return 0.3; // 70% сжатие
      case 'snappy': return 0.5; // 50% сжатие
      case 'lz4': return 0.4; // 60% сжатие
      default: return 0.3;
    }
  }
}


/**
 * ClickHouse Latency Calculator
 * 
 * Динамический расчет latency на основе реальных операций, размера данных,
 * сложности запроса, количества parts, использования индексов и кластера.
 * Избегает хардкода и скриптованности.
 */

export interface LatencyCalculationParams {
  operationType: 'SELECT' | 'INSERT' | 'ALTER' | 'CREATE' | 'DROP' | 'OTHER';
  rowsScanned?: number; // количество строк для чтения
  rowsWritten?: number; // количество строк для записи
  columnsRead?: number; // количество колонок для чтения (column pruning)
  queryComplexity?: {
    hasJoin?: boolean;
    hasGroupBy?: boolean;
    hasOrderBy?: boolean;
    hasAggregation?: boolean;
    hasFilter?: boolean;
  };
  partsCount?: number; // количество parts в таблице (влияет на latency)
  hasIndexes?: boolean; // использование индексов (primary key, secondary indexes)
  compressionEnabled?: boolean; // требуется ли декомпрессия
  clusterNodes?: number; // количество узлов в кластере
  networkLatency?: number; // network latency между узлами (ms)
  tableSize?: number; // размер таблицы в bytes
}

/**
 * Calculates latency for ClickHouse operations based on real conditions
 */
export class ClickHouseLatencyCalculator {
  // Базовые значения latency (конфигурируемые)
  private readonly BASE_SELECT_LATENCY_MS: number;
  private readonly BASE_INSERT_LATENCY_MS: number;
  private readonly BASE_ALTER_LATENCY_MS: number;
  private readonly BASE_CREATE_LATENCY_MS: number;
  private readonly BASE_DROP_LATENCY_MS: number;
  
  constructor(config?: {
    baseSelectLatency?: number;
    baseInsertLatency?: number;
    baseAlterLatency?: number;
    baseCreateLatency?: number;
    baseDropLatency?: number;
    compressionDecompressionMsPerMB?: number;
    networkLatencyPerNodeMs?: number;
    columnarReadFactor?: number;
    indexSpeedupFactor?: number;
    partsOverheadMsPerPart?: number;
    defaultColumnsCount?: number;
    writeTimeMsPer10KRows?: number;
    compressionTimeMsPer100KRows?: number;
  }) {
    this.BASE_SELECT_LATENCY_MS = config?.baseSelectLatency ?? 5;
    this.BASE_INSERT_LATENCY_MS = config?.baseInsertLatency ?? 10;
    this.BASE_ALTER_LATENCY_MS = config?.baseAlterLatency ?? 50;
    this.BASE_CREATE_LATENCY_MS = config?.baseCreateLatency ?? 20;
    this.BASE_DROP_LATENCY_MS = config?.baseDropLatency ?? 15;
    
    // Конфигурируемые факторы производительности
    this.COLUMNAR_READ_FACTOR = config?.columnarReadFactor ?? 0.3;
    this.INDEX_SPEEDUP_FACTOR = config?.indexSpeedupFactor ?? 0.5;
    this.COMPRESSION_DECOMPRESSION_MS_PER_MB = config?.compressionDecompressionMsPerMB ?? 2;
    this.PARTS_OVERHEAD_MS_PER_PART = config?.partsOverheadMsPerPart ?? 0.1;
    this.NETWORK_LATENCY_PER_NODE_MS = config?.networkLatencyPerNodeMs ?? 5;
    this.DEFAULT_COLUMNS_COUNT = config?.defaultColumnsCount ?? 10;
    this.WRITE_TIME_MS_PER_10K_ROWS = config?.writeTimeMsPer10KRows ?? 2;
    this.COMPRESSION_TIME_MS_PER_100K_ROWS = config?.compressionTimeMsPer100KRows ?? 1;
  }

  // Факторы производительности (конфигурируемые)
  private readonly COLUMNAR_READ_FACTOR: number; // колоночное хранение - читаем только нужные колонки
  private readonly INDEX_SPEEDUP_FACTOR: number; // индексы ускоряют запросы
  private readonly COMPRESSION_DECOMPRESSION_MS_PER_MB: number; // время декомпрессии на MB
  private readonly PARTS_OVERHEAD_MS_PER_PART: number; // overhead на каждый part
  private readonly NETWORK_LATENCY_PER_NODE_MS: number; // network latency на узел кластера
  private readonly DEFAULT_COLUMNS_COUNT: number; // количество колонок по умолчанию для SELECT *
  private readonly WRITE_TIME_MS_PER_10K_ROWS: number; // время записи на 10K строк
  private readonly COMPRESSION_TIME_MS_PER_100K_ROWS: number; // время сжатия на 100K строк

  /**
   * Calculate latency for a query operation
   */
  public calculateLatency(params: LatencyCalculationParams): number {
    const {
      operationType,
      rowsScanned = 0,
      rowsWritten = 0,
      columnsRead = 0,
      queryComplexity = {},
      partsCount = 0,
      hasIndexes = false,
      compressionEnabled = true,
      clusterNodes = 1,
      networkLatency = 0,
      tableSize = 0,
    } = params;

    let latency = 0;

    // Базовая latency в зависимости от типа операции
    switch (operationType) {
      case 'SELECT':
        latency = this.calculateSelectLatency({
          rowsScanned,
          columnsRead,
          queryComplexity,
          partsCount,
          hasIndexes,
          compressionEnabled,
          clusterNodes,
          networkLatency,
          tableSize,
        });
        break;
      case 'INSERT':
        latency = this.calculateInsertLatency({
          rowsWritten,
          partsCount,
          compressionEnabled,
          clusterNodes,
          networkLatency,
        });
        break;
      case 'ALTER':
        latency = this.BASE_ALTER_LATENCY_MS;
        break;
      case 'CREATE':
        latency = this.BASE_CREATE_LATENCY_MS;
        break;
      case 'DROP':
        latency = this.BASE_DROP_LATENCY_MS;
        break;
      default:
        latency = 20; // default для других операций
    }

    // Добавляем network latency для кластера
    if (clusterNodes > 1) {
      const clusterLatency = networkLatency || (clusterNodes * this.NETWORK_LATENCY_PER_NODE_MS);
      latency += clusterLatency;
    }

    // Случайная вариация (jitter) для реалистичности
    const jitter = Math.random() * 2 - 1; // -1ms to +1ms
    latency += jitter;

    return Math.max(1, Math.round(latency * 10) / 10); // минимум 1ms, округляем до 0.1ms
  }

  /**
   * Calculate latency for SELECT queries
   */
  private calculateSelectLatency(params: {
    rowsScanned: number;
    columnsRead: number;
    queryComplexity: LatencyCalculationParams['queryComplexity'];
    partsCount: number;
    hasIndexes: boolean;
    compressionEnabled: boolean;
    clusterNodes: number;
    networkLatency: number;
    tableSize: number;
  }): number {
    const {
      rowsScanned,
      columnsRead,
      queryComplexity,
      partsCount,
      hasIndexes,
      compressionEnabled,
      tableSize,
    } = params;

    let latency = this.BASE_SELECT_LATENCY_MS;

    // Фактор от размера данных (колоночное хранение - читаем только нужные колонки)
    // Если columnsRead = 0, читаем все колонки (SELECT *)
    const effectiveColumns = columnsRead > 0 ? columnsRead : this.DEFAULT_COLUMNS_COUNT;
    const columnarFactor = this.COLUMNAR_READ_FACTOR + (effectiveColumns / 20) * 0.7; // 0.3 - 1.0
    
    // Время чтения данных зависит от количества строк и колонок
    // ClickHouse оптимизирован для колоночного чтения
    const dataReadTime = (rowsScanned / 1000000) * 5 * columnarFactor; // 5ms per million rows (с учетом column pruning)

    // Фактор сложности запроса
    let complexityFactor = 1.0;
    if (queryComplexity.hasJoin) {
      complexityFactor *= 2.0; // JOIN значительно увеличивает latency
    }
    if (queryComplexity.hasGroupBy) {
      complexityFactor *= 1.5; // GROUP BY требует сортировки
    }
    if (queryComplexity.hasOrderBy) {
      complexityFactor *= 1.3; // ORDER BY требует сортировки
    }
    if (queryComplexity.hasAggregation) {
      // Агрегатные функции оптимизированы в колоночном хранилище
      complexityFactor *= 0.9;
    }
    if (queryComplexity.hasFilter) {
      // Фильтрация может использовать индексы
      if (hasIndexes) {
        complexityFactor *= 0.8; // индексы ускоряют фильтрацию
      } else {
        complexityFactor *= 1.1; // без индексов фильтрация медленнее
      }
    }

    // Фактор от количества parts (больше parts = выше latency)
    // Каждый part требует отдельного чтения
    const partsFactor = 1 + (partsCount * this.PARTS_OVERHEAD_MS_PER_PART);
    const partsOverhead = Math.min(partsFactor, 2.0); // максимум 2x overhead

    // Фактор от использования индексов
    const indexFactor = hasIndexes ? this.INDEX_SPEEDUP_FACTOR : 1.0;

    // Время декомпрессии (если включено сжатие)
    let decompressionTime = 0;
    if (compressionEnabled && tableSize > 0) {
      const compressedSize = tableSize / 3; // предполагаем compression ratio 3x
      const sizeMB = compressedSize / (1024 * 1024);
      decompressionTime = sizeMB * this.COMPRESSION_DECOMPRESSION_MS_PER_MB;
    }

    // Итоговая latency
    latency = latency + (dataReadTime * complexityFactor * partsOverhead * indexFactor) + decompressionTime;

    return latency;
  }

  /**
   * Calculate latency for INSERT operations
   */
  private calculateInsertLatency(params: {
    rowsWritten: number;
    partsCount: number;
    compressionEnabled: boolean;
    clusterNodes: number;
    networkLatency: number;
  }): number {
    const {
      rowsWritten,
      partsCount,
      compressionEnabled,
    } = params;

    let latency = this.BASE_INSERT_LATENCY_MS;

    // Время записи данных (зависит от количества строк)
    const writeTime = (rowsWritten / 10000) * this.WRITE_TIME_MS_PER_10K_ROWS;

    // Время сжатия (если включено)
    let compressionTime = 0;
    if (compressionEnabled && rowsWritten > 0) {
      // Сжатие занимает время, но меньше чем декомпрессия
      compressionTime = (rowsWritten / 100000) * this.COMPRESSION_TIME_MS_PER_100K_ROWS;
    }

    // Фактор от количества parts (создание нового part)
    // Больше parts = больше overhead при создании нового part
    const partsOverhead = 1 + (partsCount / 100) * 0.1; // небольшой overhead

    // Итоговая latency
    latency = latency + writeTime + compressionTime * partsOverhead;

    return latency;
  }

  /**
   * Estimate query complexity from SQL query string
   */
  public estimateQueryComplexity(query: string): LatencyCalculationParams['queryComplexity'] {
    const upperQuery = query.toUpperCase();
    
    return {
      hasJoin: upperQuery.includes('JOIN'),
      hasGroupBy: upperQuery.includes('GROUP BY'),
      hasOrderBy: upperQuery.includes('ORDER BY'),
      hasAggregation: /(COUNT|SUM|AVG|MIN|MAX|QUANTILE)/.test(upperQuery),
      hasFilter: upperQuery.includes('WHERE'),
    };
  }

  /**
   * Count columns in SELECT query
   */
  public countColumnsInSelect(query: string): number {
    const selectMatch = query.match(/SELECT\s+(.+?)\s+FROM/i);
    if (!selectMatch) {
      return 0; // SELECT * - все колонки
    }

    const columnsStr = selectMatch[1].trim();
    if (columnsStr === '*') {
      return 0; // 0 означает все колонки
    }

    // Подсчитываем количество колонок (разделитель - запятая)
    const columns = columnsStr.split(',').map(c => c.trim()).filter(c => c.length > 0);
    return columns.length;
  }
}

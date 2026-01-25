/**
 * ClickHouse Data Size Calculator
 * 
 * Динамический расчет размера данных на основе реальных типов данных ClickHouse,
 * учета сжатия колонок и индексов. Избегает хардкода размера строки (512 bytes).
 */

import { ClickHouseCompressionCalculator, CompressionType } from './CompressionCalculator';

export interface DataSizeCalculationParams {
  columns?: Array<{ name: string; type: string }>;
  rows: number;
  compressionType?: CompressionType;
  compressionRatio?: number; // если уже рассчитан
  hasIndexes?: boolean; // наличие индексов (primary key, secondary indexes)
}

/**
 * Calculates data size for ClickHouse operations based on actual column types
 */
export class ClickHouseDataSizeCalculator {
  private compressionCalculator: ClickHouseCompressionCalculator;
  private averageArrayLength: number; // Средний размер массива для оценки размера данных

  constructor(config?: { averageArrayLength?: number }) {
    this.compressionCalculator = new ClickHouseCompressionCalculator();
    this.averageArrayLength = config?.averageArrayLength ?? 10;
  }

  /**
   * Calculate size of a single row based on column types
   * 
   * ClickHouse хранит данные в колоночном формате, поэтому размер рассчитывается
   * как сумма размеров всех колонок.
   */
  public calculateRowSize(params: DataSizeCalculationParams): number {
    const { columns = [], compressionType, compressionRatio } = params;

    let totalSize = 0;

    // Base overhead per row (metadata, row number, etc.)
    const rowOverhead = 8; // bytes (меньше чем в row-oriented, т.к. колоночное хранение)
    totalSize += rowOverhead;

    // Calculate size for each column
    for (const column of columns) {
      const columnType = column.type || 'String';
      
      // Column name overhead (stored once per column, not per row)
      // Но для расчета размера таблицы учитываем
      const columnNameSize = Buffer.byteLength(column.name, 'utf8');
      totalSize += columnNameSize / 1000; // Амортизированная стоимость на строку (колонка хранится один раз)

      // Value size based on ClickHouse type
      const valueSize = this.calculateColumnTypeSize(columnType);
      totalSize += valueSize;
    }

    // Apply compression if enabled
    if (compressionType && compressionType !== 'None') {
      const ratio = compressionRatio || this.compressionCalculator.calculateCompressionRatio({
        compressionType,
        dataSize: totalSize,
        dataType: this.compressionCalculator.determineDataType(columns),
      });
      totalSize = Math.round(totalSize / ratio);
    }

    return totalSize;
  }

  /**
   * Calculate total table size based on rows and columns
   */
  public calculateTableSize(params: DataSizeCalculationParams): number {
    const { rows, columns = [], compressionType, hasIndexes } = params;

    if (rows === 0) {
      return 0;
    }

    // Calculate size per row
    const rowSize = this.calculateRowSize({
      columns,
      rows: 1,
      compressionType,
    });

    // Total data size (columnar storage)
    let totalSize = rowSize * rows;

    // Index overhead (primary key, secondary indexes)
    if (hasIndexes) {
      // Индексы занимают ~5-10% от размера данных
      const indexOverhead = totalSize * 0.07; // 7% среднее
      totalSize += indexOverhead;
    }

    // Column metadata overhead (stored once per column)
    const columnMetadataOverhead = columns.length * 256; // ~256 bytes per column metadata
    totalSize += columnMetadataOverhead;

    return Math.round(totalSize);
  }

  /**
   * Calculate size of a column type in ClickHouse
   */
  private calculateColumnTypeSize(type: string): number {
    const upperType = type.toUpperCase();

    // Integer types
    if (upperType.includes('UINT8') || upperType.includes('INT8')) {
      return 1; // 1 byte
    }
    if (upperType.includes('UINT16') || upperType.includes('INT16')) {
      return 2; // 2 bytes
    }
    if (upperType.includes('UINT32') || upperType.includes('INT32')) {
      return 4; // 4 bytes
    }
    if (upperType.includes('UINT64') || upperType.includes('INT64')) {
      return 8; // 8 bytes
    }

    // Float types
    if (upperType.includes('FLOAT32')) {
      return 4; // 4 bytes
    }
    if (upperType.includes('FLOAT64')) {
      return 8; // 8 bytes
    }

    // Decimal types
    if (upperType.includes('DECIMAL')) {
      // Decimal precision affects size
      const precisionMatch = upperType.match(/DECIMAL\((\d+),(\d+)\)/);
      if (precisionMatch) {
        const precision = parseInt(precisionMatch[1], 10);
        // Decimal size: precision / 9 * 4 bytes (rounded up)
        return Math.ceil(precision / 9) * 4;
      }
      return 16; // Default decimal size
    }

    // String types
    if (upperType.includes('STRING')) {
      // String is variable length, estimate average 64 bytes per string
      return 64 + 4; // +4 for length prefix
    }
    if (upperType.includes('FIXEDSTRING')) {
      // FixedString(N) - N bytes
      const sizeMatch = upperType.match(/FIXEDSTRING\((\d+)\)/);
      if (sizeMatch) {
        return parseInt(sizeMatch[1], 10);
      }
      return 64; // Default
    }

    // Date/DateTime types
    if (upperType.includes('DATE')) {
      return 2; // Date is stored as UInt16 (days since 1970-01-01)
    }
    if (upperType.includes('DATETIME')) {
      return 4; // DateTime is stored as UInt32 (seconds since 1970-01-01)
    }
    if (upperType.includes('DATETIME64')) {
      return 8; // DateTime64 is stored as Int64
    }

    // UUID
    if (upperType.includes('UUID')) {
      return 16; // 16 bytes
    }

    // Array types
    if (upperType.includes('ARRAY')) {
      // Array overhead: 4 bytes for length + element size * average length
      const elementTypeMatch = upperType.match(/ARRAY\((.+)\)/);
      if (elementTypeMatch) {
        const elementType = elementTypeMatch[1];
        const elementSize = this.calculateColumnTypeSize(elementType);
        // Используем конфигурируемый средний размер массива
        return 4 + elementSize * this.averageArrayLength;
      }
      return 64; // Default array size
    }

    // Tuple types
    if (upperType.includes('TUPLE')) {
      // Tuple: sum of element sizes
      const tupleMatch = upperType.match(/TUPLE\((.+)\)/);
      if (tupleMatch) {
        const elements = tupleMatch[1].split(',').map(e => e.trim());
        return elements.reduce((sum, elem) => sum + this.calculateColumnTypeSize(elem), 0);
      }
      return 32; // Default tuple size
    }

    // Map types
    if (upperType.includes('MAP')) {
      // Map: key size + value size, estimate 5 key-value pairs
      const mapMatch = upperType.match(/MAP\((.+),(.+)\)/);
      if (mapMatch) {
        const keySize = this.calculateColumnTypeSize(mapMatch[1].trim());
        const valueSize = this.calculateColumnTypeSize(mapMatch[2].trim());
        return 4 + (keySize + valueSize) * 5; // +4 for length
      }
      return 128; // Default map size
    }

    // Nullable types
    if (upperType.includes('NULLABLE')) {
      const innerTypeMatch = upperType.match(/NULLABLE\((.+)\)/);
      if (innerTypeMatch) {
        // Nullable adds 1 byte for null marker
        return this.calculateColumnTypeSize(innerTypeMatch[1]) + 1;
      }
    }

    // LowCardinality types
    if (upperType.includes('LOWCARDINALITY')) {
      const innerTypeMatch = upperType.match(/LOWCARDINALITY\((.+)\)/);
      if (innerTypeMatch) {
        // LowCardinality uses dictionary encoding, typically 1-2 bytes per value
        return 2;
      }
    }

    // Default: assume String
    return 64 + 4; // String with length prefix
  }

  /**
   * Calculate size of a single column based on type and row count
   * Used for columnar storage where each column is stored separately
   */
  public calculateColumnSize(params: {
    columnType: string;
    rowCount: number;
    compressionType?: CompressionType;
    compressionRatio?: number;
  }): number {
    const { columnType, rowCount, compressionType, compressionRatio } = params;

    if (rowCount === 0) {
      return 0;
    }

    // Calculate size per value
    const valueSize = this.calculateColumnTypeSize(columnType);
    
    // Column metadata overhead (stored once per column)
    const columnMetadataOverhead = 256; // ~256 bytes per column metadata
    
    // Total uncompressed size
    let totalSize = (valueSize * rowCount) + columnMetadataOverhead;

    // Apply compression if enabled
    if (compressionType && compressionType !== 'None') {
      const ratio = compressionRatio || this.compressionCalculator.calculateCompressionRatio({
        compressionType,
        dataSize: totalSize,
        dataType: this.detectDataTypeFromColumnType(columnType),
      });
      totalSize = Math.round(totalSize / ratio);
    }

    return totalSize;
  }

  /**
   * Detect data type from column type string
   */
  private detectDataTypeFromColumnType(columnType: string): 'text' | 'numeric' | 'mixed' {
    const upperType = columnType.toUpperCase();
    
    if (upperType.includes('INT') || upperType.includes('FLOAT') || upperType.includes('DECIMAL')) {
      return 'numeric';
    }
    
    if (upperType.includes('STRING') || upperType.includes('CHAR')) {
      return 'text';
    }
    
    return 'mixed';
  }

  /**
   * Calculate size of data read/written for a query
   */
  public calculateQueryDataSize(
    columns: Array<{ name: string; type: string }>,
    rows: number,
    columnsRead?: string[] // если указаны, читаем только эти колонки (column pruning)
  ): number {
    const relevantColumns = columnsRead
      ? columns.filter(c => columnsRead.includes(c.name))
      : columns;

    return this.calculateTableSize({
      columns: relevantColumns,
      rows,
    });
  }
}

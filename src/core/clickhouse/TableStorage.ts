/**
 * ClickHouse Table Storage
 * 
 * Управляет колоночным хранением данных для таблицы ClickHouse.
 * Интегрирует ColumnStorage с метаданными таблицы и операциями.
 */

import { ClickHouseColumnStorage, ColumnData } from './ColumnStorage';
import { ClickHouseDataSizeCalculator } from './DataSizeCalculator';
import { ClickHouseCompressionCalculator, CompressionType } from './CompressionCalculator';

export interface TableStorageConfig {
  columns: Array<{ name: string; type: string }>;
  compressionType?: CompressionType;
  hasIndexes?: boolean;
  sampleSize?: number; // Размер выборки для анализа данных (по умолчанию 100)
}

/**
 * ClickHouse Table Storage
 * 
 * Управляет колоночным хранением данных таблицы:
 * - Инициализация колонок
 * - INSERT операций с расчетом размера
 * - SELECT операций с column pruning
 * - Фильтрация и сортировка
 */
export class ClickHouseTableStorage {
  private columnStorage: ClickHouseColumnStorage;
  private config: TableStorageConfig;
  private dataSizeCalculator: ClickHouseDataSizeCalculator;
  private compressionCalculator: ClickHouseCompressionCalculator;
  private sampleSize: number; // Размер выборки для анализа данных

  constructor(config: TableStorageConfig) {
    this.config = config;
    this.sampleSize = config.sampleSize ?? 100;
    this.columnStorage = new ClickHouseColumnStorage();
    this.dataSizeCalculator = new ClickHouseDataSizeCalculator();
    this.compressionCalculator = new ClickHouseCompressionCalculator();
    
    // Initialize column storage
    this.columnStorage.initialize(config.columns);
  }

  /**
   * Insert a single row
   */
  public insertRow(row: Record<string, any>): void {
    this.columnStorage.insertRow(row);
    this.updateColumnSizes();
  }

  /**
   * Insert multiple rows
   */
  public insertRows(rows: Record<string, any>[]): void {
    this.columnStorage.insertRows(rows);
    this.updateColumnSizes();
  }

  /**
   * Select rows with column pruning
   * 
   * @param columnNames - колонки для чтения (column pruning)
   * @param filter - функция фильтрации (WHERE clause)
   * @param orderBy - колонка для сортировки
   * @param orderDirection - направление сортировки
   * @param limit - максимальное количество строк
   */
  public selectRows(options: {
    columnNames?: string[];
    filter?: (row: Record<string, any>) => boolean;
    orderBy?: string;
    orderDirection?: 'ASC' | 'DESC';
    limit?: number;
  }): Record<string, any>[] {
    const { columnNames, filter, orderBy, orderDirection, limit } = options;

    // Get all rows or filtered rows
    let rows: Record<string, any>[];
    
    if (filter) {
      // Use column pruning for filtering - read only columns needed for filter
      // For simplicity, read all columns for filtering (can be optimized later)
      const matchingIndices = this.columnStorage.filterRows(filter);
      rows = this.columnStorage.getRowsByIndices(matchingIndices, columnNames);
    } else {
      // Read only requested columns (column pruning)
      rows = this.columnStorage.getRows(columnNames);
    }

    // Sort if needed
    if (orderBy) {
      const direction = orderDirection || 'ASC';
      rows.sort((a, b) => {
        const aVal = a[orderBy];
        const bVal = b[orderBy];
        
        if (aVal === null || aVal === undefined) return direction === 'ASC' ? -1 : 1;
        if (bVal === null || bVal === undefined) return direction === 'ASC' ? 1 : -1;
        
        if (direction === 'DESC') {
          return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
        }
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      });
    }

    // Apply limit
    if (limit !== undefined && limit > 0) {
      rows = rows.slice(0, limit);
    }

    return rows;
  }

  /**
   * Get row count
   */
  public getRowCount(): number {
    return this.columnStorage.getRowCount();
  }

  /**
   * Get total size (compressed)
   */
  public getTotalSize(): number {
    return this.columnStorage.getTotalSize();
  }

  /**
   * Get total uncompressed size
   */
  public getTotalUncompressedSize(): number {
    return this.columnStorage.getTotalUncompressedSize();
  }

  /**
   * Get size for specific columns (for column pruning optimization)
   */
  public getSizeForColumns(columnNames: string[]): number {
    return this.columnStorage.getSizeForColumns(columnNames);
  }

  /**
   * Get column names
   */
  public getColumnNames(): string[] {
    return this.columnStorage.getColumnNames();
  }

  /**
   * Get column metadata
   */
  public getColumn(columnName: string): ColumnData | undefined {
    return this.columnStorage.getColumn(columnName);
  }

  /**
   * Get all columns metadata
   */
  public getAllColumns(): ColumnData[] {
    return this.columnStorage.getAllColumns();
  }

  /**
   * Clear all data
   */
  public clear(): void {
    this.columnStorage.clear();
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<TableStorageConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Reinitialize if columns changed
    if (config.columns) {
      this.columnStorage.initialize(config.columns);
    }
  }

  /**
   * Update column sizes based on current data and compression
   */
  private updateColumnSizes(): void {
    const columns = this.config.columns;
    const rowCount = this.columnStorage.getRowCount();
    const compressionType = this.config.compressionType || 'LZ4';

    if (rowCount === 0 || columns.length === 0) {
      return;
    }

    // Calculate size for each column
    for (const column of columns) {
      const columnValues = this.columnStorage.getColumnValues(column.name);
      
      // Calculate uncompressed size
      const uncompressedSize = this.dataSizeCalculator.calculateColumnSize({
        columnType: column.type,
        rowCount: columnValues.length,
      });

      // Calculate compression ratio for this column
      const compressionRatio = this.compressionCalculator.calculateCompressionRatio({
        compressionType,
        dataSize: uncompressedSize,
        dataType: this.detectDataType(column.type, columnValues),
      });

      // Calculate compressed size
      const compressedSize = uncompressedSize / compressionRatio;

      // Update column size
      this.columnStorage.updateColumnSize(column.name, compressedSize, uncompressedSize);
    }
  }

  /**
   * Detect data type from column type and values
   */
  private detectDataType(columnType: string, values: any[]): 'text' | 'numeric' | 'mixed' {
    const upperType = columnType.toUpperCase();
    
    // Check if numeric type
    if (upperType.includes('INT') || upperType.includes('FLOAT') || upperType.includes('DECIMAL')) {
      return 'numeric';
    }
    
    // Check if text type
    if (upperType.includes('STRING') || upperType.includes('CHAR')) {
      return 'text';
    }
    
    // Check actual values
    if (values.length > 0) {
      const sampleSize = Math.min(this.sampleSize, values.length);
      let textCount = 0;
      let numericCount = 0;
      
      for (let i = 0; i < sampleSize; i++) {
        const val = values[i];
        if (val === null || val === undefined) continue;
        
        if (typeof val === 'string') {
          textCount++;
        } else if (typeof val === 'number') {
          numericCount++;
        }
      }
      
      if (textCount > numericCount * 2) return 'text';
      if (numericCount > textCount * 2) return 'numeric';
    }
    
    return 'mixed';
  }
}

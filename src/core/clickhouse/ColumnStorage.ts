/**
 * ClickHouse Column Storage
 * 
 * Реализует колоночное хранение данных - каждая колонка хранится отдельно.
 * Это позволяет эффективно читать только нужные колонки (column pruning),
 * что критично для аналитических запросов ClickHouse.
 */

export interface ColumnData {
  name: string;
  type: string;
  values: any[]; // массив значений колонки (колоночное хранение)
  size: number; // размер данных колонки в байтах (с учетом сжатия)
  uncompressedSize: number; // размер без сжатия
}

/**
 * ClickHouse Column Storage
 * 
 * Хранит данные таблицы в колоночном формате:
 * - Каждая колонка хранится как отдельный массив значений
 * - Это позволяет читать только нужные колонки при SELECT запросах
 * - Сжатие применяется на уровне колонок
 */
export class ClickHouseColumnStorage {
  private columns: Map<string, ColumnData> = new Map(); // key: column name
  private rowCount: number = 0;

  /**
   * Initialize storage with column definitions
   */
  public initialize(columnDefinitions: Array<{ name: string; type: string }>): void {
    this.columns.clear();
    this.rowCount = 0;

    for (const colDef of columnDefinitions) {
      this.columns.set(colDef.name, {
        name: colDef.name,
        type: colDef.type,
        values: [],
        size: 0,
        uncompressedSize: 0,
      });
    }
  }

  /**
   * Insert a row (values for all columns)
   */
  public insertRow(values: Record<string, any>): void {
    // Ensure all columns exist
    for (const [colName, colData] of this.columns.entries()) {
      if (!values.hasOwnProperty(colName)) {
        // Add null/undefined for missing columns
        colData.values.push(null);
      } else {
        colData.values.push(values[colName]);
      }
    }
    this.rowCount++;
  }

  /**
   * Insert multiple rows
   */
  public insertRows(rows: Record<string, any>[]): void {
    for (const row of rows) {
      this.insertRow(row);
    }
  }

  /**
   * Get values for specific columns (column pruning)
   * Returns array of objects with only requested columns
   */
  public getRows(columnNames?: string[]): Record<string, any>[] {
    if (this.rowCount === 0) {
      return [];
    }

    // If no columns specified, return all columns
    const columnsToRead = columnNames && columnNames.length > 0
      ? columnNames.filter(name => this.columns.has(name))
      : Array.from(this.columns.keys());

    if (columnsToRead.length === 0) {
      return [];
    }

    // Build result rows by reading only requested columns
    const result: Record<string, any>[] = [];
    
    for (let i = 0; i < this.rowCount; i++) {
      const row: Record<string, any> = {};
      for (const colName of columnsToRead) {
        const colData = this.columns.get(colName);
        if (colData && colData.values[i] !== undefined) {
          row[colName] = colData.values[i];
        }
      }
      result.push(row);
    }

    return result;
  }

  /**
   * Get values for a single column
   */
  public getColumnValues(columnName: string): any[] {
    const colData = this.columns.get(columnName);
    return colData ? [...colData.values] : [];
  }

  /**
   * Filter rows based on WHERE condition
   * Returns indices of matching rows
   */
  public filterRows(condition: (row: Record<string, any>) => boolean, columnNames?: string[]): number[] {
    const matchingIndices: number[] = [];
    const columnsToRead = columnNames && columnNames.length > 0
      ? columnNames.filter(name => this.columns.has(name))
      : Array.from(this.columns.keys());

    for (let i = 0; i < this.rowCount; i++) {
      const row: Record<string, any> = {};
      for (const colName of columnsToRead) {
        const colData = this.columns.get(colName);
        if (colData && colData.values[i] !== undefined) {
          row[colName] = colData.values[i];
        }
      }
      
      if (condition(row)) {
        matchingIndices.push(i);
      }
    }

    return matchingIndices;
  }

  /**
   * Get rows by indices
   */
  public getRowsByIndices(indices: number[], columnNames?: string[]): Record<string, any>[] {
    const columnsToRead = columnNames && columnNames.length > 0
      ? columnNames.filter(name => this.columns.has(name))
      : Array.from(this.columns.keys());

    const result: Record<string, any>[] = [];
    
    for (const idx of indices) {
      if (idx >= 0 && idx < this.rowCount) {
        const row: Record<string, any> = {};
        for (const colName of columnsToRead) {
          const colData = this.columns.get(colName);
          if (colData && colData.values[idx] !== undefined) {
            row[colName] = colData.values[idx];
          }
        }
        result.push(row);
      }
    }

    return result;
  }

  /**
   * Get all column names
   */
  public getColumnNames(): string[] {
    return Array.from(this.columns.keys());
  }

  /**
   * Get column metadata
   */
  public getColumn(columnName: string): ColumnData | undefined {
    return this.columns.get(columnName);
  }

  /**
   * Get all columns metadata
   */
  public getAllColumns(): ColumnData[] {
    return Array.from(this.columns.values());
  }

  /**
   * Get row count
   */
  public getRowCount(): number {
    return this.rowCount;
  }

  /**
   * Clear all data
   */
  public clear(): void {
    for (const colData of this.columns.values()) {
      colData.values = [];
      colData.size = 0;
      colData.uncompressedSize = 0;
    }
    this.rowCount = 0;
  }

  /**
   * Update column size (called after compression calculation)
   */
  public updateColumnSize(columnName: string, size: number, uncompressedSize: number): void {
    const colData = this.columns.get(columnName);
    if (colData) {
      colData.size = size;
      colData.uncompressedSize = uncompressedSize;
    }
  }

  /**
   * Get total size (sum of all column sizes)
   */
  public getTotalSize(): number {
    let total = 0;
    for (const colData of this.columns.values()) {
      total += colData.size;
    }
    return total;
  }

  /**
   * Get total uncompressed size
   */
  public getTotalUncompressedSize(): number {
    let total = 0;
    for (const colData of this.columns.values()) {
      total += colData.uncompressedSize;
    }
    return total;
  }

  /**
   * Get size for specific columns (for column pruning optimization)
   */
  public getSizeForColumns(columnNames: string[]): number {
    let total = 0;
    for (const colName of columnNames) {
      const colData = this.columns.get(colName);
      if (colData) {
        total += colData.size;
      }
    }
    return total;
  }
}

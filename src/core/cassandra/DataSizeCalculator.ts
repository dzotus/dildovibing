/**
 * Cassandra Data Size Calculator
 * 
 * Динамический расчет размера данных на основе реальных типов данных,
 * учета overhead, compression и replication. Избегает хардкода размера строки.
 */

import { TableColumn, TableRow } from '../CassandraRoutingEngine';
import { ESTIMATED_ROW_SIZE_BYTES } from './constants';

export interface DataSizeCalculationParams {
  row: TableRow;
  columns?: TableColumn[];
  compressionEnabled?: boolean;
  compressionRatio?: number; // 0.0 - 1.0 (0.5 = 50% compression)
  replicationFactor?: number;
}

/**
 * Calculates data size for Cassandra operations based on actual data types
 */
export class CassandraDataSizeCalculator {
  /**
   * Calculate size of a single row based on column types and values
   */
  public calculateRowSize(params: DataSizeCalculationParams): number {
    const { row, columns, compressionEnabled, compressionRatio } = params;

    let totalSize = 0;

    // Base overhead per row (metadata, timestamps, etc.)
    const rowOverhead = 32; // bytes
    totalSize += rowOverhead;

    // Calculate size for each column
    for (const [columnName, value] of Object.entries(row)) {
      const column = columns?.find(c => c.name === columnName);
      const columnType = column?.type || 'TEXT';

      // Column name overhead
      const columnNameSize = Buffer.byteLength(columnName, 'utf8');
      totalSize += columnNameSize + 4; // +4 for metadata

      // Value size based on type
      const valueSize = this.calculateValueSize(value, columnType);
      totalSize += valueSize;
    }

    // Apply compression if enabled
    if (compressionEnabled && compressionRatio !== undefined) {
      totalSize = Math.round(totalSize * compressionRatio);
    }

    return totalSize;
  }

  /**
   * Calculate size of a value based on its type
   */
  private calculateValueSize(value: any, type: string): number {
    if (value === null || value === undefined) {
      return 4; // Null marker
    }

    const upperType = type.toUpperCase();

    switch (upperType) {
      case 'TEXT':
      case 'VARCHAR':
      case 'ASCII':
        return Buffer.byteLength(String(value), 'utf8') + 4; // +4 for length prefix

      case 'INT':
      case 'INTEGER':
        return 4; // 32-bit integer

      case 'BIGINT':
        return 8; // 64-bit integer

      case 'SMALLINT':
        return 2; // 16-bit integer

      case 'TINYINT':
        return 1; // 8-bit integer

      case 'FLOAT':
        return 4; // 32-bit float

      case 'DOUBLE':
        return 8; // 64-bit double

      case 'DECIMAL':
        // Decimal is variable, estimate based on value
        return 16; // Typical decimal size

      case 'BOOLEAN':
        return 1; // 1 byte

      case 'UUID':
      case 'TIMEUUID':
        return 16; // 128-bit UUID

      case 'TIMESTAMP':
        return 8; // 64-bit timestamp

      case 'DATE':
        return 4; // 32-bit date

      case 'TIME':
        return 8; // 64-bit time

      case 'BLOB':
        // BLOB size is the actual byte length
        if (typeof value === 'string') {
          // Assume base64 encoded
          return Math.ceil(Buffer.byteLength(value, 'base64') * 0.75) + 4;
        }
        return Buffer.byteLength(String(value), 'utf8') + 4;

      case 'INET':
        // IP address: IPv4 = 4 bytes, IPv6 = 16 bytes
        const ipStr = String(value);
        return ipStr.includes(':') ? 16 : 4; // IPv6 has colons

      case 'COUNTER':
        return 8; // 64-bit counter

      case 'VARINT':
        // Variable-length integer, estimate based on value
        const num = Number(value);
        if (num >= -128 && num <= 127) return 1;
        if (num >= -32768 && num <= 32767) return 2;
        if (num >= -2147483648 && num <= 2147483647) return 4;
        return 8;

      case 'LIST':
      case 'SET':
      case 'MAP':
        // Collections: estimate based on JSON size
        try {
          const jsonStr = JSON.stringify(value);
          return Buffer.byteLength(jsonStr, 'utf8') + 8; // +8 for collection metadata
        } catch {
          return 64; // Fallback estimate
        }

      case 'TUPLE':
        // Tuple: estimate based on JSON size
        try {
          const jsonStr = JSON.stringify(value);
          return Buffer.byteLength(jsonStr, 'utf8') + 4;
        } catch {
          return 32; // Fallback estimate
        }

      default:
        // Unknown type: estimate based on string representation
        return Buffer.byteLength(String(value), 'utf8') + 4;
    }
  }

  /**
   * Calculate total size of a table including replication
   */
  public calculateTableSize(
    rows: TableRow[],
    columns?: TableColumn[],
    replicationFactor: number = 1,
    compressionEnabled: boolean = false,
    compressionRatio: number = 0.5
  ): number {
    let totalSize = 0;

    // Calculate size for each row
    for (const row of rows) {
      const rowSize = this.calculateRowSize({
        row,
        columns,
        compressionEnabled,
        compressionRatio,
      });
      totalSize += rowSize;
    }

    // Apply replication factor
    totalSize *= replicationFactor;

    // Table metadata overhead
    const tableOverhead = 1024; // 1KB for table metadata
    totalSize += tableOverhead;

    return totalSize;
  }

  /**
   * Calculate size of a keyspace (sum of all tables)
   */
  public calculateKeyspaceSize(
    tableSizes: Map<string, number> // tableKey -> size
  ): number {
    let totalSize = 0;

    for (const size of tableSizes.values()) {
      totalSize += size;
    }

    // Keyspace metadata overhead
    const keyspaceOverhead = 512; // 512 bytes
    totalSize += keyspaceOverhead;

    return totalSize;
  }

  /**
   * Estimate row size when columns are not available (fallback)
   */
  public estimateRowSize(row: TableRow): number {
    // Fallback to estimated size if we don't have column types
    // This is less accurate but still better than hardcoded 1KB
    let estimatedSize = ESTIMATED_ROW_SIZE_BYTES;

    // Adjust based on number of columns
    const columnCount = Object.keys(row).length;
    estimatedSize = Math.max(estimatedSize, columnCount * 64); // At least 64 bytes per column

    // Adjust based on actual values (rough estimate)
    for (const value of Object.values(row)) {
      if (typeof value === 'string') {
        estimatedSize += Buffer.byteLength(value, 'utf8');
      } else if (typeof value === 'number') {
        estimatedSize += 8; // Assume 8 bytes for numbers
      } else {
        estimatedSize += 32; // Estimate for other types
      }
    }

    return estimatedSize;
  }
}

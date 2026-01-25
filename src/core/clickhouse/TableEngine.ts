/**
 * ClickHouse Table Engine Interface and Base Implementation
 * 
 * Движки таблиц ClickHouse определяют логику хранения и обработки данных.
 * Каждый движок имеет свою специфику (MergeTree, ReplacingMergeTree, etc.)
 */

import { ClickHouseTableStorage } from './TableStorage';
import { ClickHouseTablePart } from '../ClickHouseRoutingEngine';
import { ClickHouseLatencyCalculator } from './LatencyCalculator';
import { ClickHouseDataSizeCalculator } from './DataSizeCalculator';
import { ClickHouseMergePolicy, MergePolicyConfig } from './MergePolicy';

export interface TableEngineConfig {
  engine: string;
  orderBy?: string[]; // ORDER BY columns (primary key)
  partitionBy?: string; // PARTITION BY expression
  primaryKey?: string[]; // PRIMARY KEY columns
  sampleBy?: string; // SAMPLE BY column
  settings?: Record<string, any>; // Engine-specific settings
  mergePolicy?: MergePolicyConfig; // Merge policy configuration
}

export interface InsertOptions {
  rows: Record<string, any>[];
  storage: ClickHouseTableStorage;
  compressionType: 'LZ4' | 'ZSTD' | 'LZ4HC' | 'None';
}

export interface SelectOptions {
  columnNames?: string[];
  filter?: (row: Record<string, any>) => boolean;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
  limit?: number;
  sample?: number; // Sample ratio (0.0 - 1.0)
  final?: boolean; // FINAL modifier - read merged data only
  storage: ClickHouseTableStorage;
}

export interface MergeOptions {
  parts: ClickHouseTablePart[];
  storage: ClickHouseTableStorage;
  freeSpacePercent?: number; // процент свободного места на диске (0-100)
}

export interface TableEngineMetrics {
  partsCount: number;
  pendingMerges: number;
  totalRows: number;
  totalSize: number;
  lastMergeTime?: number;
}

/**
 * Интерфейс движка таблицы ClickHouse
 */
export interface ClickHouseTableEngine {
  /**
   * Инициализация движка
   */
  initialize(config: TableEngineConfig): void;

  /**
   * Вставка данных
   * Возвращает созданные parts
   */
  insert(options: InsertOptions): ClickHouseTablePart[];

  /**
   * Выборка данных
   */
  select(options: SelectOptions): Record<string, any>[];

  /**
   * Объединение parts (merge)
   * Возвращает объединенные parts
   */
  merge(options: MergeOptions): ClickHouseTablePart[];

  /**
   * Получить текущие parts
   */
  getParts(): ClickHouseTablePart[];

  /**
   * Получить метрики движка
   */
  getMetrics(): TableEngineMetrics;

  /**
   * Получить конфигурацию движка
   */
  getConfig(): TableEngineConfig;
}

/**
 * Базовый класс для движков таблиц
 * Реализует общую логику для всех движков
 */
export abstract class BaseTableEngine implements ClickHouseTableEngine {
  protected config: TableEngineConfig;
  protected parts: ClickHouseTablePart[] = [];
  protected latencyCalculator: ClickHouseLatencyCalculator;
  protected dataSizeCalculator: ClickHouseDataSizeCalculator;
  protected mergePolicy: ClickHouseMergePolicy;
  protected pendingMerges: number = 0;
  protected lastMergeTime?: number;

  constructor() {
    this.latencyCalculator = new ClickHouseLatencyCalculator();
    this.dataSizeCalculator = new ClickHouseDataSizeCalculator();
    this.mergePolicy = new ClickHouseMergePolicy();
  }

  public initialize(config: TableEngineConfig): void {
    this.config = config;
    this.parts = [];
    this.pendingMerges = 0;
    this.lastMergeTime = undefined;
    
    // Инициализируем merge policy из конфигурации
    if (config.mergePolicy) {
      this.mergePolicy.updateConfig(config.mergePolicy);
    }
  }

  public abstract insert(options: InsertOptions): ClickHouseTablePart[];

  public abstract select(options: SelectOptions): Record<string, any>[];

  public abstract merge(options: MergeOptions): ClickHouseTablePart[];

  public getParts(): ClickHouseTablePart[] {
    return [...this.parts];
  }

  public getMetrics(): TableEngineMetrics {
    const totalRows = this.parts.reduce((sum, part) => sum + part.rows, 0);
    const totalSize = this.parts.reduce((sum, part) => sum + part.size, 0);

    return {
      partsCount: this.parts.length,
      pendingMerges: this.pendingMerges,
      totalRows,
      totalSize,
      lastMergeTime: this.lastMergeTime,
    };
  }

  public getConfig(): TableEngineConfig {
    return { ...this.config };
  }

  /**
   * Создать новый part из данных
   * Базовая реализация, может быть переопределена в наследниках
   */
  protected createPart(
    storage: ClickHouseTableStorage,
    startRowIndex: number,
    endRowIndex: number,
    compressionType: 'LZ4' | 'ZSTD' | 'LZ4HC' | 'None'
  ): ClickHouseTablePart {
    const rowCount = endRowIndex - startRowIndex;
    const totalSize = storage.getTotalSize();
    const rowCountTotal = storage.getRowCount();
    
    // Рассчитываем размер part пропорционально количеству строк
    const partSize = rowCountTotal > 0 
      ? Math.floor((totalSize * rowCount) / rowCountTotal)
      : 0;

    // Генерируем имя part (формат: part-YYYYMMDD-HHMMSS-XXXX)
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
    const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
    const partName = `part-${dateStr}-${timeStr}-${randomStr}`;

    // Определяем min/max даты (используем текущую дату, если нет date колонки)
    const minDate = now.toISOString().split('T')[0];
    const maxDate = minDate;

    // Определяем level (0 для новых parts)
    const level = 0;

    return {
      name: partName,
      minDate,
      maxDate,
      rows: rowCount,
      size: partSize,
      level,
    };
  }

  /**
   * Определить, нужно ли создавать новый part
   * По умолчанию создаем part каждые 10MB или 10K строк (как в ClickHouse)
   */
  protected shouldCreatePart(
    storage: ClickHouseTableStorage,
    rowsInserted: number,
    config?: { maxPartSize?: number; maxPartRows?: number }
  ): boolean {
    const maxPartSize = config?.maxPartSize || 10 * 1024 * 1024; // 10MB
    const maxPartRows = config?.maxPartRows || 10000; // 10K rows

    // Проверяем последний part
    if (this.parts.length === 0) {
      return true; // Первый part
    }

    const lastPart = this.parts[this.parts.length - 1];
    
    // Создаем новый part если превышен размер или количество строк
    return lastPart.size >= maxPartSize || lastPart.rows >= maxPartRows;
  }

  /**
   * Определить, какие parts нужно объединить
   * Использует MergePolicy для выбора parts
   * 
   * @param freeSpacePercent - процент свободного места на диске (0-100)
   */
  protected getPartsToMerge(freeSpacePercent: number = 100): ClickHouseTablePart[][] {
    // Используем MergePolicy для выбора parts
    const mergeGroups = this.mergePolicy.selectPartsForMerge(this.parts, freeSpacePercent);
    
    // Преобразуем MergeGroup[] в ClickHouseTablePart[][]
    return mergeGroups.map(group => group.parts);
  }

  /**
   * Объединить несколько parts в один
   */
  protected mergeParts(parts: ClickHouseTablePart[]): ClickHouseTablePart {
    if (parts.length === 0) {
      throw new Error('Cannot merge empty parts array');
    }

    if (parts.length === 1) {
      return { ...parts[0] };
    }

    // Объединяем parts: суммируем строки и размеры
    const totalRows = parts.reduce((sum, part) => sum + part.rows, 0);
    const totalSize = parts.reduce((sum, part) => sum + part.size, 0);
    
    // Определяем min/max даты
    const dates = parts.map(p => p.minDate).sort();
    const minDate = dates[0];
    const maxDate = dates[dates.length - 1];

    // Генерируем имя объединенного part
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
    const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
    const partName = `part-${dateStr}-${timeStr}-${randomStr}`;

    // Увеличиваем level (merged parts имеют level + 1)
    const maxLevel = Math.max(...parts.map(p => p.level || 0));
    const newLevel = maxLevel + 1;

    return {
      name: partName,
      minDate,
      maxDate,
      rows: totalRows,
      size: totalSize,
      level: newLevel,
    };
  }
}

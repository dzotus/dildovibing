/**
 * SummingMergeTree Engine Implementation
 * 
 * Движок ClickHouse, который автоматически суммирует значения при merge.
 * Поддерживает:
 * - ORDER BY (primary key) для группировки
 * - Автоматическое суммирование числовых колонок при merge
 * - Поддержка указания колонок для суммирования
 * - Все возможности MergeTree (PARTITION BY, индексы, SAMPLE, FINAL)
 */

import { MergeTreeEngine, MergeTreeConfig } from './MergeTreeEngine';
import { TableEngineConfig, InsertOptions, SelectOptions, MergeOptions } from '../TableEngine';
import { ClickHouseTablePart } from '../../ClickHouseRoutingEngine';
import { ClickHouseTableStorage } from '../TableStorage';

export interface SummingMergeTreeConfig extends MergeTreeConfig {
  columns?: string[]; // Колонки для суммирования (опционально, если не указаны - суммируются все числовые колонки кроме ORDER BY)
}

/**
 * SummingMergeTree Engine
 * 
 * Реализует логику SummingMergeTree движка ClickHouse:
 * - Наследует все возможности MergeTree
 * - При merge автоматически суммирует значения числовых колонок
 * - Группирует строки по ORDER BY колонкам
 * - Если указаны columns, суммируются только эти колонки
 * - Если columns не указаны, суммируются все числовые колонки кроме ORDER BY
 */
export class SummingMergeTreeEngine extends MergeTreeEngine {
  private summingConfig: SummingMergeTreeConfig;
  private summingColumns?: string[];

  constructor() {
    super();
    this.summingConfig = {
      engine: 'SummingMergeTree',
      maxPartSize: 10 * 1024 * 1024, // 10MB
      maxPartRows: 10000, // 10K rows
      mergePolicy: {
        maxBytesToMergeAtMaxSpace: 150 * 1024 * 1024 * 1024, // 150GB
        maxBytesToMergeAtMinSpace: 50 * 1024 * 1024 * 1024, // 50GB
      },
    };
  }

  public initialize(config: TableEngineConfig): void {
    super.initialize(config);
    
    // Извлекаем columns для суммирования из settings
    const summingColumns = (config.settings as any)?.columns || 
                          (config as any).columns;
    
    this.summingConfig = {
      ...this.summingConfig,
      ...config,
      engine: 'SummingMergeTree',
      columns: summingColumns,
    };
    
    this.summingColumns = summingColumns;
  }

  /**
   * Объединение parts с суммированием значений
   * Переопределяет метод merge из MergeTreeEngine
   */
  public merge(options: MergeOptions): ClickHouseTablePart[] {
    const { parts: externalParts, storage, freeSpacePercent = 100 } = options;
    
    // Используем внешние parts или внутренние
    const partsToMerge = externalParts.length > 0 ? externalParts : this.parts;
    
    if (partsToMerge.length < 2) {
      return []; // Нужно минимум 2 parts для merge
    }

    // Определяем группы parts для merge с использованием MergePolicy
    const mergeGroups = this.getPartsToMerge(freeSpacePercent);
    
    if (mergeGroups.length === 0) {
      return []; // Нет групп для merge
    }

    const mergedParts: ClickHouseTablePart[] = [];
    this.pendingMerges = mergeGroups.length;

    // Объединяем каждую группу с суммированием
    for (const group of mergeGroups) {
      const mergedPart = this.mergePartsWithSumming(group, storage);
      mergedParts.push(mergedPart);

      // Удаляем старые parts и добавляем объединенный
      for (const oldPart of group) {
        const index = this.parts.findIndex(p => p.name === oldPart.name);
        if (index >= 0) {
          this.parts.splice(index, 1);
        }
      }

      this.parts.push(mergedPart);
    }

    this.pendingMerges = 0;
    this.lastMergeTime = Date.now();

    return mergedParts;
  }

  /**
   * Объединить parts с суммированием значений
   * 
   * Логика:
   * 1. Читаем все строки из всех parts в группе
   * 2. Группируем строки по ORDER BY колонкам (primary key)
   * 3. Суммируем значения числовых колонок в каждой группе
   * 4. Создаем новый part с агрегированными данными
   */
  private mergePartsWithSumming(
    parts: ClickHouseTablePart[],
    storage: ClickHouseTableStorage
  ): ClickHouseTablePart {
    if (parts.length === 0) {
      throw new Error('Cannot merge empty parts array');
    }

    if (parts.length === 1) {
      // Если только один part, суммирование не требуется
      return { ...parts[0] };
    }

    // Получаем ORDER BY колонки для группировки
    const orderByColumns = this.getOrderByColumns();
    if (orderByColumns.length === 0) {
      // Если нет ORDER BY, используем базовую логику merge
      return this.mergeParts(parts);
    }

    // Читаем все строки из всех parts
    const allRows: Record<string, any>[] = [];
    
    for (const part of parts) {
      const partRows = this.getPartRows(part, storage);
      allRows.push(...partRows);
    }

    // Определяем колонки для суммирования
    const columnsToSum = this.getColumnsToSum(allRows, orderByColumns);

    // Группируем и суммируем строки
    const summedRows = this.sumRowsByKey(allRows, orderByColumns, columnsToSum);

    // Создаем новый part с агрегированными данными
    const totalRows = summedRows.length;
    const totalSize = parts.reduce((sum, part) => sum + part.size, 0);
    
    // Размер может уменьшиться из-за агрегации
    const aggregatedSize = Math.floor(totalSize * (summedRows.length / allRows.length));

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

    // В реальном ClickHouse данные перезаписываются в storage
    // Здесь мы только создаем метаданные part
    // Фактическое суммирование данных в storage должно выполняться отдельно
    // Для симуляции мы просто создаем part с обновленными метаданными

    return {
      name: partName,
      minDate,
      maxDate,
      rows: totalRows,
      size: aggregatedSize,
      level: newLevel,
    };
  }

  /**
   * Определить колонки для суммирования
   * 
   * Логика:
   * - Если указаны summingColumns, используем их
   * - Если не указаны, суммируем все числовые колонки кроме ORDER BY
   */
  private getColumnsToSum(
    rows: Record<string, any>[],
    orderByColumns: string[]
  ): string[] {
    if (this.summingColumns && this.summingColumns.length > 0) {
      return this.summingColumns;
    }

    // Если columns не указаны, определяем числовые колонки автоматически
    if (rows.length === 0) {
      return [];
    }

    const numericColumns: string[] = [];
    const firstRow = rows[0];
    const orderBySet = new Set(orderByColumns);

    for (const columnName in firstRow) {
      // Пропускаем ORDER BY колонки
      if (orderBySet.has(columnName)) {
        continue;
      }

      const value = firstRow[columnName];
      // Проверяем, является ли значение числом
      if (typeof value === 'number' && !isNaN(value)) {
        numericColumns.push(columnName);
      }
    }

    return numericColumns;
  }

  /**
   * Суммировать строки по ключу (ORDER BY колонки)
   * 
   * @param rows - строки для суммирования
   * @param orderByColumns - колонки для группировки
   * @param columnsToSum - колонки для суммирования
   * @returns агрегированные строки
   */
  private sumRowsByKey(
    rows: Record<string, any>[],
    orderByColumns: string[],
    columnsToSum: string[]
  ): Record<string, any>[] {
    // Создаем Map для хранения агрегированных строк по ключу
    const aggregatedRowsMap = new Map<string, Record<string, any>>();

    for (const row of rows) {
      // Создаем ключ из ORDER BY колонок
      const key = this.createGroupingKey(row, orderByColumns);
      
      if (!aggregatedRowsMap.has(key)) {
        // Первая строка с таким ключом - копируем все значения
        aggregatedRowsMap.set(key, { ...row });
      } else {
        // Дубликат - суммируем значения
        const aggregatedRow = aggregatedRowsMap.get(key)!;
        
        // Суммируем указанные колонки
        for (const columnName of columnsToSum) {
          const currentValue = aggregatedRow[columnName];
          const newValue = row[columnName];
          
          // Суммируем только если оба значения - числа
          if (typeof currentValue === 'number' && typeof newValue === 'number') {
            aggregatedRow[columnName] = currentValue + newValue;
          } else if (currentValue === null || currentValue === undefined) {
            // Если текущее значение null/undefined, используем новое
            aggregatedRow[columnName] = newValue;
          } else if (newValue === null || newValue === undefined) {
            // Если новое значение null/undefined, оставляем текущее
            // aggregatedRow[columnName] остается без изменений
          } else {
            // Если оба значения не числа, пытаемся преобразовать
            const currentNum = Number(currentValue);
            const newNum = Number(newValue);
            if (!isNaN(currentNum) && !isNaN(newNum)) {
              aggregatedRow[columnName] = currentNum + newNum;
            }
          }
        }
      }
    }

    return Array.from(aggregatedRowsMap.values());
  }

  /**
   * Создать ключ группировки из ORDER BY колонок
   */
  private createGroupingKey(
    row: Record<string, any>,
    orderByColumns: string[]
  ): string {
    const keyParts = orderByColumns.map(col => {
      const value = row[col];
      // Преобразуем значение в строку для ключа
      if (value === null || value === undefined) {
        return 'NULL';
      }
      if (typeof value === 'object') {
        return JSON.stringify(value);
      }
      return String(value);
    });
    
    return keyParts.join('|');
  }

  /**
   * Получить строки из part
   * Упрощенная реализация для симуляции
   */
  private getPartRows(
    part: ClickHouseTablePart,
    storage: ClickHouseTableStorage
  ): Record<string, any>[] {
    // Для симуляции суммирования читаем все строки из storage
    // В реальной реализации нужно использовать startRowIndex/endRowIndex из part
    const allRows = storage.selectRows({});
    return allRows;
  }

  /**
   * Получить конфигурацию SummingMergeTree
   */
  public getConfig(): SummingMergeTreeConfig {
    return { ...this.summingConfig };
  }

  /**
   * Получить колонки для суммирования
   */
  public getSummingColumns(): string[] | undefined {
    return this.summingColumns;
  }
}

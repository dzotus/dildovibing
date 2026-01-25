/**
 * ReplacingMergeTree Engine Implementation
 * 
 * Движок ClickHouse, который автоматически удаляет дубликаты при merge.
 * Поддерживает:
 * - ORDER BY (primary key) для определения дубликатов
 * - Version column для выбора последней версии
 * - Автоматическое удаление дубликатов при merge
 * - Все возможности MergeTree (PARTITION BY, индексы, SAMPLE, FINAL)
 */

import { MergeTreeEngine, MergeTreeConfig } from './MergeTreeEngine';
import { TableEngineConfig, InsertOptions, SelectOptions, MergeOptions } from '../TableEngine';
import { ClickHouseTablePart } from '../../ClickHouseRoutingEngine';
import { ClickHouseTableStorage } from '../TableStorage';

export interface ReplacingMergeTreeConfig extends MergeTreeConfig {
  versionColumn?: string; // Колонка для версионирования (опционально)
}

/**
 * ReplacingMergeTree Engine
 * 
 * Реализует логику ReplacingMergeTree движка ClickHouse:
 * - Наследует все возможности MergeTree
 * - При merge автоматически удаляет дубликаты
 * - Использует ORDER BY колонки для определения дубликатов
 * - Если указана version column, выбирает строку с максимальной версией
 * - Если version column не указана, выбирает последнюю вставленную строку
 */
export class ReplacingMergeTreeEngine extends MergeTreeEngine {
  private replacingConfig: ReplacingMergeTreeConfig;
  private versionColumn?: string;

  constructor() {
    super();
    this.replacingConfig = {
      engine: 'ReplacingMergeTree',
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
    
    // Извлекаем version column из settings, если указана
    const versionColumn = (config.settings as any)?.versionColumn || 
                         (config as any).versionColumn;
    
    this.replacingConfig = {
      ...this.replacingConfig,
      ...config,
      engine: 'ReplacingMergeTree',
      versionColumn,
    };
    
    this.versionColumn = versionColumn;
  }

  /**
   * Объединение parts с удалением дубликатов
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

    // Объединяем каждую группу с удалением дубликатов
    for (const group of mergeGroups) {
      const mergedPart = this.mergePartsWithDeduplication(group, storage);
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
   * Объединить parts с удалением дубликатов
   * 
   * Логика:
   * 1. Читаем все строки из всех parts в группе
   * 2. Определяем дубликаты на основе ORDER BY колонок (primary key)
   * 3. Если указана version column, выбираем строку с максимальной версией
   * 4. Если version column не указана, выбираем последнюю строку (по порядку вставки)
   * 5. Создаем новый part с дедуплицированными данными
   */
  private mergePartsWithDeduplication(
    parts: ClickHouseTablePart[],
    storage: ClickHouseTableStorage
  ): ClickHouseTablePart {
    if (parts.length === 0) {
      throw new Error('Cannot merge empty parts array');
    }

    if (parts.length === 1) {
      // Если только один part, все равно нужно проверить дубликаты внутри него
      return this.deduplicatePart(parts[0], storage);
    }

    // Получаем ORDER BY колонки для определения дубликатов
    const orderByColumns = this.getOrderByColumns();
    if (orderByColumns.length === 0) {
      // Если нет ORDER BY, используем базовую логику merge
      return this.mergeParts(parts);
    }

    // Читаем все строки из всех parts
    const allRows: Record<string, any>[] = [];
    const rowIndices: number[] = [];
    
    for (const part of parts) {
      // Получаем диапазон строк для part
      // В реальном ClickHouse part хранит ссылки на строки, здесь используем упрощенную логику
      const partRows = this.getPartRows(part, storage);
      allRows.push(...partRows);
      
      // Сохраняем индексы строк для каждого part
      for (let i = 0; i < partRows.length; i++) {
        rowIndices.push(allRows.length - partRows.length + i);
      }
    }

    // Дедуплицируем строки
    const deduplicatedRows = this.deduplicateRows(allRows, orderByColumns);

    // Создаем новый part с дедуплицированными данными
    // В реальном ClickHouse это делается через перезапись данных в storage
    // Здесь мы создаем новый part с метаданными
    const totalRows = deduplicatedRows.length;
    const totalSize = parts.reduce((sum, part) => sum + part.size, 0);
    
    // Пересчитываем размер с учетом дедупликации
    const deduplicatedSize = Math.floor(totalSize * (deduplicatedRows.length / allRows.length));
    
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
    // Фактическая дедупликация данных в storage должна выполняться отдельно
    // Для симуляции мы просто создаем part с обновленными метаданными

    return {
      name: partName,
      minDate,
      maxDate,
      rows: totalRows,
      size: deduplicatedSize,
      level: newLevel,
    };
  }

  /**
   * Дедуплицировать строки на основе ORDER BY колонок
   * 
   * @param rows - строки для дедупликации
   * @param orderByColumns - колонки для определения дубликатов
   * @returns дедуплицированные строки
   */
  private deduplicateRows(
    rows: Record<string, any>[],
    orderByColumns: string[]
  ): Record<string, any>[] {
    // Создаем Map для хранения уникальных строк по ключу
    const uniqueRowsMap = new Map<string, Record<string, any>>();

    for (const row of rows) {
      // Создаем ключ из ORDER BY колонок
      const key = this.createDeduplicationKey(row, orderByColumns);
      
      if (!uniqueRowsMap.has(key)) {
        // Первая строка с таким ключом
        uniqueRowsMap.set(key, row);
      } else {
        // Дубликат - выбираем строку на основе version column или порядка вставки
        const existingRow = uniqueRowsMap.get(key)!;
        const selectedRow = this.selectRowVersion(existingRow, row);
        uniqueRowsMap.set(key, selectedRow);
      }
    }

    return Array.from(uniqueRowsMap.values());
  }

  /**
   * Создать ключ дедупликации из ORDER BY колонок
   */
  private createDeduplicationKey(
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
   * Выбрать строку между двумя дубликатами
   * 
   * Логика:
   * - Если указана version column, выбираем строку с максимальной версией
   * - Если version column не указана, выбираем последнюю строку (вторую)
   */
  private selectRowVersion(
    existingRow: Record<string, any>,
    newRow: Record<string, any>
  ): Record<string, any> {
    if (this.versionColumn) {
      // Используем version column для выбора
      const existingVersion = this.getVersionValue(existingRow[this.versionColumn]);
      const newVersion = this.getVersionValue(newRow[this.versionColumn]);
      
      // Выбираем строку с максимальной версией
      if (newVersion > existingVersion) {
        return newRow;
      }
      return existingRow;
    }
    
    // Если version column не указана, выбираем последнюю строку (новую)
    // В реальном ClickHouse это зависит от порядка вставки
    return newRow;
  }

  /**
   * Получить числовое значение версии
   */
  private getVersionValue(version: any): number {
    if (version === null || version === undefined) {
      return 0;
    }
    if (typeof version === 'number') {
      return version;
    }
    if (typeof version === 'string') {
      const parsed = parseInt(version, 10);
      return isNaN(parsed) ? 0 : parsed;
    }
    if (version instanceof Date) {
      return version.getTime();
    }
    return 0;
  }

  /**
   * Дедуплицировать один part (для случая когда merge не требуется, но нужно дедуплицировать)
   */
  private deduplicatePart(
    part: ClickHouseTablePart,
    storage: ClickHouseTableStorage
  ): ClickHouseTablePart {
    // В реальном ClickHouse дедупликация происходит только при merge
    // Здесь возвращаем part как есть
    return { ...part };
  }

  /**
   * Получить строки из part
   * Упрощенная реализация для симуляции
   * 
   * В реальном ClickHouse part хранит ссылки на данные в storage.
   * Для симуляции мы читаем все строки из storage и используем их для расчета дедупликации.
   * Фактическая дедупликация данных в storage происходит на уровне метаданных parts.
   */
  private getPartRows(
    part: ClickHouseTablePart,
    storage: ClickHouseTableStorage
  ): Record<string, any>[] {
    // В реальном ClickHouse part хранит диапазон строк (startRowIndex/endRowIndex)
    // Для симуляции читаем все строки из storage
    // В реальной реализации нужно использовать startRowIndex/endRowIndex из part
    
    // Для симуляции дедупликации читаем все строки
    // Фактическая дедупликация отражается в метаданных part (rows уменьшается)
    const allRows = storage.selectRows({});
    
    // В реальном ClickHouse part хранит только свои строки
    // Для симуляции используем все строки, но дедупликация отражается в метаданных
    return allRows;
  }

  /**
   * Получить конфигурацию ReplacingMergeTree
   */
  public getConfig(): ReplacingMergeTreeConfig {
    return { ...this.replacingConfig };
  }

  /**
   * Получить version column
   */
  public getVersionColumn(): string | undefined {
    return this.versionColumn;
  }
}

/**
 * AggregatingMergeTree Engine Implementation
 * 
 * Движок ClickHouse, который хранит агрегированные состояния.
 * Поддерживает:
 * - ORDER BY (primary key) для группировки
 * - Хранение агрегированных состояний (State функции)
 * - Объединение состояний при merge
 * - Все возможности MergeTree (PARTITION BY, индексы, SAMPLE, FINAL)
 */

import { MergeTreeEngine, MergeTreeConfig } from './MergeTreeEngine';
import { TableEngineConfig, InsertOptions, SelectOptions, MergeOptions } from '../TableEngine';
import { ClickHouseTablePart } from '../../ClickHouseRoutingEngine';
import { ClickHouseTableStorage } from '../TableStorage';

export interface AggregatingMergeTreeConfig extends MergeTreeConfig {
  // Колонки с агрегированными состояниями определяются автоматически по типу State(...)
  // Например: sumState, countState, avgState и т.д.
}

/**
 * Тип агрегированного состояния
 */
export type AggregateState = {
  type: 'sum' | 'count' | 'avg' | 'min' | 'max' | 'any';
  value: number | null;
  count?: number; // Для avg
};

/**
 * AggregatingMergeTree Engine
 * 
 * Реализует логику AggregatingMergeTree движка ClickHouse:
 * - Наследует все возможности MergeTree
 * - Хранит агрегированные состояния в колонках типа State(...)
 * - При merge объединяет состояния
 * - При чтении можно использовать функции merge(...) для получения финальных значений
 */
export class AggregatingMergeTreeEngine extends MergeTreeEngine {
  private aggregatingConfig: AggregatingMergeTreeConfig;

  constructor() {
    super();
    this.aggregatingConfig = {
      engine: 'AggregatingMergeTree',
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
    
    this.aggregatingConfig = {
      ...this.aggregatingConfig,
      ...config,
      engine: 'AggregatingMergeTree',
    };
  }

  /**
   * Объединение parts с объединением агрегированных состояний
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

    // Объединяем каждую группу с объединением состояний
    for (const group of mergeGroups) {
      const mergedPart = this.mergePartsWithAggregation(group, storage);
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
   * Объединить parts с объединением агрегированных состояний
   * 
   * Логика:
   * 1. Читаем все строки из всех parts в группе
   * 2. Группируем строки по ORDER BY колонкам (primary key)
   * 3. Объединяем агрегированные состояния в каждой группе
   * 4. Создаем новый part с объединенными состояниями
   */
  private mergePartsWithAggregation(
    parts: ClickHouseTablePart[],
    storage: ClickHouseTableStorage
  ): ClickHouseTablePart {
    if (parts.length === 0) {
      throw new Error('Cannot merge empty parts array');
    }

    if (parts.length === 1) {
      // Если только один part, объединение состояний не требуется
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

    // Определяем колонки с состояниями
    const stateColumns = this.getStateColumns(allRows);

    // Группируем и объединяем состояния
    const aggregatedRows = this.mergeStatesByKey(allRows, orderByColumns, stateColumns);

    // Создаем новый part с агрегированными данными
    const totalRows = aggregatedRows.length;
    const totalSize = parts.reduce((sum, part) => sum + part.size, 0);
    
    // Размер может уменьшиться из-за агрегации
    const aggregatedSize = Math.floor(totalSize * (aggregatedRows.length / allRows.length));

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
    // Фактическое объединение состояний в storage должно выполняться отдельно
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
   * Определить колонки с агрегированными состояниями
   * 
   * В реальном ClickHouse колонки имеют тип State(...), например:
   * - sumState State(sum)
   * - countState State(count)
   * - avgState State(avg)
   * 
   * Для симуляции определяем колонки, которые содержат объекты AggregateState
   * или имеют имена, заканчивающиеся на "State"
   */
  private getStateColumns(rows: Record<string, any>[]): string[] {
    if (rows.length === 0) {
      return [];
    }

    const stateColumns: string[] = [];
    const firstRow = rows[0];

    for (const columnName in firstRow) {
      const value = firstRow[columnName];
      
      // Проверяем, является ли значение состоянием
      if (this.isAggregateState(value)) {
        stateColumns.push(columnName);
      } else if (columnName.toLowerCase().endsWith('state')) {
        // Колонка с именем, заканчивающимся на "State"
        stateColumns.push(columnName);
      }
    }

    return stateColumns;
  }

  /**
   * Проверить, является ли значение агрегированным состоянием
   */
  private isAggregateState(value: any): boolean {
    if (typeof value === 'object' && value !== null) {
      // Проверяем структуру AggregateState
      return 'type' in value && 'value' in value;
    }
    return false;
  }

  /**
   * Объединить состояния по ключу (ORDER BY колонки)
   * 
   * @param rows - строки для объединения
   * @param orderByColumns - колонки для группировки
   * @param stateColumns - колонки с состояниями
   * @returns строки с объединенными состояниями
   */
  private mergeStatesByKey(
    rows: Record<string, any>[],
    orderByColumns: string[],
    stateColumns: string[]
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
        // Дубликат - объединяем состояния
        const aggregatedRow = aggregatedRowsMap.get(key)!;
        
        // Объединяем состояния в указанных колонках
        for (const columnName of stateColumns) {
          const currentState = aggregatedRow[columnName];
          const newState = row[columnName];
          
          // Объединяем состояния
          const mergedState = this.mergeStates(currentState, newState);
          if (mergedState !== null) {
            aggregatedRow[columnName] = mergedState;
          }
        }
      }
    }

    return Array.from(aggregatedRowsMap.values());
  }

  /**
   * Объединить два агрегированных состояния
   */
  private mergeStates(state1: any, state2: any): AggregateState | null {
    // Преобразуем значения в AggregateState если нужно
    const s1 = this.normalizeState(state1);
    const s2 = this.normalizeState(state2);

    if (!s1 || !s2) {
      return s1 || s2 || null;
    }

    // Объединяем состояния в зависимости от типа
    switch (s1.type) {
      case 'sum':
        if (s2.type === 'sum') {
          return {
            type: 'sum',
            value: (s1.value || 0) + (s2.value || 0),
          };
        }
        break;

      case 'count':
        if (s2.type === 'count') {
          return {
            type: 'count',
            value: (s1.value || 0) + (s2.value || 0),
          };
        }
        break;

      case 'avg':
        if (s2.type === 'avg') {
          const count1 = s1.count || 1;
          const count2 = s2.count || 1;
          const totalCount = count1 + count2;
          const sum1 = (s1.value || 0) * count1;
          const sum2 = (s2.value || 0) * count2;
          const avg = totalCount > 0 ? (sum1 + sum2) / totalCount : 0;
          
          return {
            type: 'avg',
            value: avg,
            count: totalCount,
          };
        }
        break;

      case 'min':
        if (s2.type === 'min') {
          const v1 = s1.value;
          const v2 = s2.value;
          if (v1 === null || v1 === undefined) return s2;
          if (v2 === null || v2 === undefined) return s1;
          return {
            type: 'min',
            value: Math.min(v1, v2),
          };
        }
        break;

      case 'max':
        if (s2.type === 'max') {
          const v1 = s1.value;
          const v2 = s2.value;
          if (v1 === null || v1 === undefined) return s2;
          if (v2 === null || v2 === undefined) return s1;
          return {
            type: 'max',
            value: Math.max(v1, v2),
          };
        }
        break;

      case 'any':
        // any возвращает первое не-null значение
        if (s2.type === 'any') {
          return s1.value !== null && s1.value !== undefined ? s1 : s2;
        }
        break;
    }

    // Если типы не совпадают, возвращаем первое состояние
    return s1;
  }

  /**
   * Нормализовать значение в AggregateState
   */
  private normalizeState(value: any): AggregateState | null {
    if (value === null || value === undefined) {
      return null;
    }

    // Если уже AggregateState
    if (this.isAggregateState(value)) {
      return value as AggregateState;
    }

    // Если число, создаем состояние sum
    if (typeof value === 'number') {
      return {
        type: 'sum',
        value,
      };
    }

    // Если строка, пытаемся определить тип из имени колонки
    // Для симуляции создаем состояние sum
    return {
      type: 'sum',
      value: Number(value) || 0,
    };
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
    // Для симуляции объединения состояний читаем все строки из storage
    // В реальной реализации нужно использовать startRowIndex/endRowIndex из part
    const allRows = storage.selectRows({});
    return allRows;
  }

  /**
   * Получить конфигурацию AggregatingMergeTree
   */
  public getConfig(): AggregatingMergeTreeConfig {
    return { ...this.aggregatingConfig };
  }
}

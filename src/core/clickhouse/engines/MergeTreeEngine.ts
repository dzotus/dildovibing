/**
 * MergeTree Engine Implementation
 * 
 * Основной движок ClickHouse для аналитических данных.
 * Поддерживает:
 * - ORDER BY (primary key) для сортировки данных
 * - PARTITION BY для партиционирования
 * - Индексы (primary key, secondary indexes)
 * - Parts и merges
 * - SAMPLE для выборки данных
 * - FINAL для получения финальных данных после merge
 */

import { BaseTableEngine, TableEngineConfig, InsertOptions, SelectOptions, MergeOptions } from '../TableEngine';
import { ClickHouseTablePart } from '../../ClickHouseRoutingEngine';
import { ClickHouseTableStorage } from '../TableStorage';

export interface MergeTreeConfig extends TableEngineConfig {
  orderBy?: string[]; // ORDER BY columns (primary key)
  partitionBy?: string; // PARTITION BY expression
  primaryKey?: string[]; // PRIMARY KEY columns (обычно совпадает с ORDER BY)
  sampleBy?: string; // SAMPLE BY column
  maxPartSize?: number; // Максимальный размер part в байтах (по умолчанию 10MB)
  maxPartRows?: number; // Максимальное количество строк в part (по умолчанию 10K)
  mergePolicy?: {
    maxBytesToMergeAtMaxSpace?: number; // Максимальный размер для merge при большом свободном месте
    maxBytesToMergeAtMinSpace?: number; // Максимальный размер для merge при малом свободном месте
  };
}

/**
 * MergeTree Engine
 * 
 * Реализует логику MergeTree движка ClickHouse:
 * - Создание parts при INSERT
 * - Объединение parts в фоне (merge)
 * - Поддержка ORDER BY для сортировки
 * - Поддержка PARTITION BY для партиционирования
 * - Поддержка SAMPLE для выборки данных
 * - Поддержка FINAL для чтения только merged данных
 */
export class MergeTreeEngine extends BaseTableEngine {
  private mergeTreeConfig: MergeTreeConfig;
  private currentPartStartIndex: number = 0;
  private lastPartRowCount: number = 0;

  constructor() {
    super();
    this.mergeTreeConfig = {
      engine: 'MergeTree',
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
    this.mergeTreeConfig = {
      ...this.mergeTreeConfig,
      ...config,
      engine: 'MergeTree',
    };
    this.currentPartStartIndex = 0;
    this.lastPartRowCount = 0;
  }

  /**
   * Вставка данных в MergeTree
   * Создает parts при достижении лимитов размера или количества строк
   */
  public insert(options: InsertOptions): ClickHouseTablePart[] {
    const { rows, storage, compressionType } = options;
    const newParts: ClickHouseTablePart[] = [];

    // Вставляем данные в storage
    storage.insertRows(rows);

    // Проверяем, нужно ли создавать новый part
    const rowCountBefore = this.lastPartRowCount;
    const rowCountAfter = storage.getRowCount();
    const rowsInserted = rowCountAfter - rowCountBefore;

    // Обновляем счетчик строк текущего part
    this.lastPartRowCount = rowCountAfter;

    // Проверяем, нужно ли создать новый part
    if (this.shouldCreatePart(storage, rowsInserted, {
      maxPartSize: this.mergeTreeConfig.maxPartSize,
      maxPartRows: this.mergeTreeConfig.maxPartRows,
    })) {
      // Создаем новый part
      const partStartIndex = this.currentPartStartIndex;
      const partEndIndex = rowCountAfter;
      
      const newPart = this.createPart(
        storage,
        partStartIndex,
        partEndIndex,
        compressionType
      );

      this.parts.push(newPart);
      newParts.push(newPart);

      // Обновляем индексы для следующего part
      this.currentPartStartIndex = partEndIndex;
      this.lastPartRowCount = 0;
    }

    return newParts;
  }

  /**
   * Выборка данных из MergeTree
   * Поддерживает SAMPLE и FINAL модификаторы
   */
  public select(options: SelectOptions): Record<string, any>[] {
    const {
      columnNames,
      filter,
      orderBy,
      orderDirection,
      limit,
      sample,
      final,
      storage,
    } = options;

    // Если указан FINAL, читаем только из merged parts (level > 0)
    // В реальном ClickHouse FINAL читает данные после всех merges
    let partsToRead = this.parts;
    if (final) {
      // Читаем только parts с level > 0 (merged parts)
      partsToRead = this.parts.filter(p => (p.level || 0) > 0);
      
      // Если нет merged parts, используем все parts
      if (partsToRead.length === 0) {
        partsToRead = this.parts;
      }
    }

    // Если указан SAMPLE, применяем выборку
    // В реальном ClickHouse SAMPLE работает на уровне parts
    let sampleRatio = sample;
    if (sampleRatio !== undefined && sampleRatio > 0 && sampleRatio <= 1) {
      // Применяем sample к parts (упрощенная реализация)
      // В реальности ClickHouse использует SAMPLE BY колонку
      const sampledPartsCount = Math.max(1, Math.floor(partsToRead.length * sampleRatio));
      partsToRead = partsToRead.slice(0, sampledPartsCount);
    }

    // Если указан ORDER BY из конфигурации, используем его
    // В реальном ClickHouse данные уже отсортированы по ORDER BY
    const effectiveOrderBy = orderBy || (this.mergeTreeConfig.orderBy?.[0]);
    const effectiveOrderDirection = orderDirection || 'ASC';

    // Читаем данные из storage
    // В реальном ClickHouse данные читаются из parts, но для упрощения
    // используем storage напрямую (parts влияют на latency через метрики)
    let resultRows = storage.selectRows({
      columnNames,
      filter,
      orderBy: effectiveOrderBy,
      orderDirection: effectiveOrderDirection,
      limit,
    });

    // Если указан SAMPLE, применяем дополнительную выборку к результатам
    if (sampleRatio !== undefined && sampleRatio > 0 && sampleRatio < 1 && !final) {
      const sampleCount = Math.floor(resultRows.length * sampleRatio);
      resultRows = resultRows.slice(0, sampleCount);
    }

    return resultRows;
  }

  /**
   * Объединение parts (merge)
   * Объединяет parts одного уровня в один part следующего уровня
   * Использует MergePolicy для выбора parts
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

    // Объединяем каждую группу
    for (const group of mergeGroups) {
      const mergedPart = this.mergeParts(group);
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
   * Переопределяем метод определения parts для merge
   * В MergeTree используем MergePolicy с учетом конфигурации
   */
  protected getPartsToMerge(freeSpacePercent: number = 100): ClickHouseTablePart[][] {
    // Используем MergePolicy из базового класса
    // MergePolicy учитывает конфигурацию mergeTreeConfig.mergePolicy
    return super.getPartsToMerge(freeSpacePercent);
  }

  /**
   * Получить конфигурацию MergeTree
   */
  public getConfig(): MergeTreeConfig {
    return { ...this.mergeTreeConfig };
  }

  /**
   * Получить ORDER BY колонки
   */
  public getOrderByColumns(): string[] {
    return this.mergeTreeConfig.orderBy || [];
  }

  /**
   * Получить PARTITION BY выражение
   */
  public getPartitionBy(): string | undefined {
    return this.mergeTreeConfig.partitionBy;
  }

  /**
   * Получить PRIMARY KEY колонки
   */
  public getPrimaryKeyColumns(): string[] {
    return this.mergeTreeConfig.primaryKey || this.mergeTreeConfig.orderBy || [];
  }
}

/**
 * ClickHouse Part
 * 
 * Представляет часть данных таблицы ClickHouse (part).
 * Parts создаются при INSERT и объединяются в фоне (merge).
 * 
 * В реальном ClickHouse:
 * - Parts хранят данные в колоночном формате
 * - Parts имеют уровни (level 0 для новых, level + 1 для merged)
 * - Parts объединяются в фоне для оптимизации
 * - Parts влияют на производительность запросов
 */

import { ClickHouseTablePart } from '../ClickHouseRoutingEngine';
import { ClickHouseTableStorage } from './TableStorage';
import { ClickHouseDataSizeCalculator } from './DataSizeCalculator';

export interface PartColumnData {
  columnName: string;
  data: any[];
  size: number;
}

/**
 * ClickHouse Part Class
 * 
 * Инкапсулирует логику работы с part:
 * - Хранение метаданных part
 * - Получение данных колонок из storage
 * - Объединение с другими parts
 * - Расчет размера
 */
export class ClickHousePart {
  private part: ClickHouseTablePart;
  private storage: ClickHouseTableStorage;
  private dataSizeCalculator: ClickHouseDataSizeCalculator;
  private startRowIndex: number;
  private endRowIndex: number;

  constructor(
    part: ClickHouseTablePart,
    storage: ClickHouseTableStorage,
    startRowIndex: number,
    endRowIndex: number
  ) {
    this.part = { ...part };
    this.storage = storage;
    this.dataSizeCalculator = new ClickHouseDataSizeCalculator();
    this.startRowIndex = startRowIndex;
    this.endRowIndex = endRowIndex;
  }

  /**
   * Получить метаданные part
   */
  public getMetadata(): ClickHouseTablePart {
    return { ...this.part };
  }

  /**
   * Получить имя part
   */
  public getName(): string {
    return this.part.name;
  }

  /**
   * Получить уровень part
   */
  public getLevel(): number {
    return this.part.level || 0;
  }

  /**
   * Получить количество строк
   */
  public getRows(): number {
    return this.part.rows;
  }

  /**
   * Получить размер part в байтах
   */
  public getSize(): number {
    return this.part.size;
  }

  /**
   * Получить данные колонки из part
   * 
   * @param columnName - имя колонки
   * @returns массив значений колонки для строк part
   */
  public getColumnData(columnName: string): any[] {
    // Получаем данные колонки из storage для диапазона строк part
    const allRows = this.storage.selectRows({
      columnNames: [columnName],
      limit: undefined,
    });

    // Возвращаем только строки, относящиеся к этому part
    return allRows.slice(this.startRowIndex, this.endRowIndex).map(row => row[columnName]);
  }

  /**
   * Получить данные всех колонок из part
   * 
   * @param columnNames - имена колонок (если не указано, все колонки)
   * @returns объект с данными колонок
   */
  public getColumnsData(columnNames?: string[]): Record<string, any[]> {
    const allRows = this.storage.selectRows({
      columnNames,
      limit: undefined,
    });

    // Получаем только строки, относящиеся к этому part
    const partRows = allRows.slice(this.startRowIndex, this.endRowIndex);

    // Преобразуем в формат колонок
    const columnsData: Record<string, any[]> = {};
    const cols = columnNames || this.storage.getColumnNames();
    
    for (const colName of cols) {
      columnsData[colName] = partRows.map(row => row[colName]);
    }

    return columnsData;
  }

  /**
   * Получить все строки part
   */
  public getRows(): Record<string, any>[] {
    const allRows = this.storage.selectRows({
      limit: undefined,
    });

    return allRows.slice(this.startRowIndex, this.endRowIndex);
  }

  /**
   * Объединить несколько parts в один
   * 
   * @param parts - массив parts для объединения
   * @param storage - storage для нового part
   * @returns новый объединенный part
   */
  public static merge(
    parts: ClickHousePart[],
    storage: ClickHouseTableStorage
  ): ClickHousePart {
    if (parts.length === 0) {
      throw new Error('Cannot merge empty parts array');
    }

    if (parts.length === 1) {
      return parts[0];
    }

    // Определяем общий диапазон строк
    const startRowIndex = Math.min(...parts.map(p => p.startRowIndex));
    const endRowIndex = Math.max(...parts.map(p => p.endRowIndex));

    // Объединяем метаданные
    const totalRows = parts.reduce((sum, part) => sum + part.getRows(), 0);
    const totalSize = parts.reduce((sum, part) => sum + part.getSize(), 0);

    // Определяем min/max даты
    const dates = parts.map(p => p.part.minDate).sort();
    const minDate = dates[0];
    const maxDate = dates[dates.length - 1];

    // Генерируем имя объединенного part
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
    const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
    const partName = `part-${dateStr}-${timeStr}-${randomStr}`;

    // Увеличиваем level (merged parts имеют level + 1)
    const maxLevel = Math.max(...parts.map(p => p.getLevel()));
    const newLevel = maxLevel + 1;

    const mergedPartMetadata: ClickHouseTablePart = {
      name: partName,
      minDate,
      maxDate,
      rows: totalRows,
      size: totalSize,
      level: newLevel,
    };

    return new ClickHousePart(mergedPartMetadata, storage, startRowIndex, endRowIndex);
  }

  /**
   * Обновить размер part на основе реальных данных
   */
  public updateSize(): void {
    // Рассчитываем размер на основе данных в storage
    const columnsData = this.getColumnsData();
    let totalSize = 0;

    for (const [columnName, data] of Object.entries(columnsData)) {
      const columnSize = this.dataSizeCalculator.calculateColumnSize(columnName, data);
      totalSize += columnSize;
    }

    this.part.size = totalSize;
  }

  /**
   * Получить диапазон строк part
   */
  public getRowRange(): { start: number; end: number } {
    return {
      start: this.startRowIndex,
      end: this.endRowIndex,
    };
  }

  /**
   * Проверить, пересекается ли part с другим part по датам
   */
  public overlapsByDate(other: ClickHousePart): boolean {
    const thisMin = new Date(this.part.minDate);
    const thisMax = new Date(this.part.maxDate);
    const otherMin = new Date(other.part.minDate);
    const otherMax = new Date(other.part.maxDate);

    return thisMin <= otherMax && thisMax >= otherMin;
  }

  /**
   * Проверить, можно ли объединить part с другим part
   * (обычно объединяются parts одного уровня)
   */
  public canMergeWith(other: ClickHousePart): boolean {
    return this.getLevel() === other.getLevel();
  }
}

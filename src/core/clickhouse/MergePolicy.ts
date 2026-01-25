/**
 * ClickHouse Merge Policy
 * 
 * Определяет политику объединения parts в ClickHouse.
 * В реальном ClickHouse merge policy зависит от:
 * - Количества свободного места на диске
 * - Размера parts
 * - Уровня parts
 * - Настроек merge (max_bytes_to_merge_at_max_space_in_pool, max_bytes_to_merge_at_min_space_in_pool)
 */

import { ClickHouseTablePart } from '../ClickHouseRoutingEngine';
import { ClickHousePart } from './Part';

export interface MergePolicyConfig {
  /**
   * Максимальный размер для merge при большом свободном месте (по умолчанию 150GB)
   */
  maxBytesToMergeAtMaxSpace?: number;
  
  /**
   * Максимальный размер для merge при малом свободном месте (по умолчанию 50GB)
   */
  maxBytesToMergeAtMinSpace?: number;
  
  /**
   * Минимальное количество parts для merge (по умолчанию 2)
   */
  minPartsToMerge?: number;
  
  /**
   * Максимальное количество parts в одной группе merge (по умолчанию 4)
   */
  maxPartsInGroup?: number;
  
  /**
   * Процент свободного места на диске (0-100)
   * Используется для определения, какой лимит использовать
   */
  freeSpacePercent?: number;
  
  /**
   * Порог свободного места для переключения между лимитами (по умолчанию 50%)
   */
  freeSpaceThreshold?: number;
}

export interface MergeGroup {
  parts: ClickHouseTablePart[];
  totalSize: number;
  priority: number;
  level: number;
}

/**
 * ClickHouse Merge Policy
 * 
 * Реализует логику выбора parts для merge:
 * - Группировка parts по уровню
 * - Определение приоритета merge
 * - Учет свободного места на диске
 * - Учет размера parts
 */
export class ClickHouseMergePolicy {
  private config: MergePolicyConfig;

  constructor(config: MergePolicyConfig = {}) {
    this.config = {
      maxBytesToMergeAtMaxSpace: 150 * 1024 * 1024 * 1024, // 150GB
      maxBytesToMergeAtMinSpace: 50 * 1024 * 1024 * 1024, // 50GB
      minPartsToMerge: 2,
      maxPartsInGroup: 4,
      freeSpaceThreshold: 50, // 50%
      ...config,
    };
  }

  /**
   * Определить, какие parts нужно объединить
   * 
   * @param parts - массив parts для анализа
   * @param freeSpacePercent - процент свободного места на диске (0-100)
   * @returns массив групп parts для merge
   */
  public selectPartsForMerge(
    parts: ClickHouseTablePart[],
    freeSpacePercent: number = 100
  ): MergeGroup[] {
    if (parts.length < this.config.minPartsToMerge!) {
      return [];
    }

    // Определяем максимальный размер для merge на основе свободного места
    const maxBytesToMerge = this.getMaxBytesToMerge(freeSpacePercent);

    // Группируем parts по уровню
    const partsByLevel = this.groupPartsByLevel(parts);

    // Создаем группы для merge
    const mergeGroups: MergeGroup[] = [];

    for (const [level, levelParts] of partsByLevel.entries()) {
      if (levelParts.length < this.config.minPartsToMerge!) {
        continue;
      }

      // Сортируем parts по размеру (большие parts имеют приоритет)
      const sortedParts = [...levelParts].sort((a, b) => b.size - a.size);

      // Создаем группы по maxPartsInGroup
      const groups = this.createMergeGroups(sortedParts, maxBytesToMerge, level);

      mergeGroups.push(...groups);
    }

    // Сортируем группы по приоритету (высокий приоритет = больше parts, больше размер)
    mergeGroups.sort((a, b) => b.priority - a.priority);

    return mergeGroups;
  }

  /**
   * Группировать parts по уровню
   */
  private groupPartsByLevel(parts: ClickHouseTablePart[]): Map<number, ClickHouseTablePart[]> {
    const partsByLevel = new Map<number, ClickHouseTablePart[]>();

    for (const part of parts) {
      const level = part.level || 0;
      if (!partsByLevel.has(level)) {
        partsByLevel.set(level, []);
      }
      partsByLevel.get(level)!.push(part);
    }

    return partsByLevel;
  }

  /**
   * Создать группы parts для merge
   */
  private createMergeGroups(
    sortedParts: ClickHouseTablePart[],
    maxBytesToMerge: number,
    level: number
  ): MergeGroup[] {
    const groups: MergeGroup[] = [];
    const maxPartsInGroup = this.config.maxPartsInGroup!;

    // Группируем parts по maxPartsInGroup
    for (let i = 0; i < sortedParts.length; i += maxPartsInGroup) {
      const groupParts = sortedParts.slice(i, i + maxPartsInGroup);
      
      // Проверяем, что группа имеет минимум minPartsToMerge parts
      if (groupParts.length < this.config.minPartsToMerge!) {
        continue;
      }

      // Проверяем, что общий размер группы не превышает maxBytesToMerge
      const totalSize = groupParts.reduce((sum, part) => sum + part.size, 0);
      
      if (totalSize > maxBytesToMerge) {
        // Если группа слишком большая, разбиваем на меньшие группы
        const smallerGroups = this.splitLargeGroup(groupParts, maxBytesToMerge);
        groups.push(...smallerGroups.map(g => this.createMergeGroup(g, level)));
      } else {
        groups.push(this.createMergeGroup(groupParts, level));
      }
    }

    return groups;
  }

  /**
   * Разбить большую группу на меньшие
   */
  private splitLargeGroup(
    parts: ClickHouseTablePart[],
    maxBytesToMerge: number
  ): ClickHouseTablePart[][] {
    const groups: ClickHouseTablePart[][] = [];
    let currentGroup: ClickHouseTablePart[] = [];
    let currentSize = 0;

    for (const part of parts) {
      if (currentSize + part.size > maxBytesToMerge && currentGroup.length >= this.config.minPartsToMerge!) {
        // Сохраняем текущую группу и начинаем новую
        groups.push(currentGroup);
        currentGroup = [part];
        currentSize = part.size;
      } else {
        currentGroup.push(part);
        currentSize += part.size;
      }
    }

    // Добавляем последнюю группу
    if (currentGroup.length >= this.config.minPartsToMerge!) {
      groups.push(currentGroup);
    }

    return groups;
  }

  /**
   * Создать группу merge с приоритетом
   */
  private createMergeGroup(parts: ClickHouseTablePart[], level: number): MergeGroup {
    const totalSize = parts.reduce((sum, part) => sum + part.size, 0);
    
    // Приоритет зависит от:
    // - Количества parts (больше parts = выше приоритет)
    // - Размера группы (больше размер = выше приоритет)
    // - Уровня (низкий уровень = выше приоритет, так как нужно объединить быстрее)
    const priority = parts.length * 1000 + totalSize / (1024 * 1024) + (100 - level * 10);

    return {
      parts,
      totalSize,
      priority,
      level,
    };
  }

  /**
   * Получить максимальный размер для merge на основе свободного места
   */
  private getMaxBytesToMerge(freeSpacePercent: number): number {
    const threshold = this.config.freeSpaceThreshold || 50;
    
    if (freeSpacePercent >= threshold) {
      // Много свободного места - используем больший лимит
      return this.config.maxBytesToMergeAtMaxSpace!;
    } else {
      // Мало свободного места - используем меньший лимит
      return this.config.maxBytesToMergeAtMinSpace!;
    }
  }

  /**
   * Обновить конфигурацию политики merge
   */
  public updateConfig(config: Partial<MergePolicyConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }

  /**
   * Получить текущую конфигурацию
   */
  public getConfig(): MergePolicyConfig {
    return { ...this.config };
  }

  /**
   * Проверить, нужно ли выполнить merge для parts
   */
  public shouldMerge(parts: ClickHouseTablePart[]): boolean {
    if (parts.length < this.config.minPartsToMerge!) {
      return false;
    }

    // Проверяем, есть ли parts одного уровня для merge
    const partsByLevel = this.groupPartsByLevel(parts);
    
    for (const [level, levelParts] of partsByLevel.entries()) {
      if (levelParts.length >= this.config.minPartsToMerge!) {
        return true;
      }
    }

    return false;
  }

  /**
   * Получить приоритет merge для группы parts
   * 
   * @param parts - группа parts
   * @returns приоритет (больше = выше приоритет)
   */
  public getMergePriority(parts: ClickHouseTablePart[]): number {
    if (parts.length < this.config.minPartsToMerge!) {
      return 0;
    }

    const totalSize = parts.reduce((sum, part) => sum + part.size, 0);
    const level = parts[0]?.level || 0;

    // Приоритет: больше parts и размер = выше приоритет
    // Низкий уровень = выше приоритет
    return parts.length * 1000 + totalSize / (1024 * 1024) + (100 - level * 10);
  }
}

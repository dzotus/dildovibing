/**
 * Cassandra Compaction Engine
 * 
 * Реалистичная симуляция compaction на основе реальных SSTables,
 * а не фиксированных формул. Поддерживает разные compaction strategies.
 */

import {
  MIN_SSTABLES_FOR_COMPACTION,
  MEMTABLE_FLUSH_THRESHOLD_BYTES,
  MIN_ROWS_FOR_FLUSH,
  COMPACTION_INTERVAL_MS,
} from './constants';

export type CompactionStrategy = 'SizeTieredCompactionStrategy' | 'LeveledCompactionStrategy' | 'TimeWindowCompactionStrategy';

export interface SSTable {
  id: string;
  tableKey: string; // "keyspace.table"
  size: number; // bytes
  rows: number;
  createdAt: number; // timestamp
  level?: number; // For LeveledCompactionStrategy (0-10)
}

export interface Memtable {
  tableKey: string;
  size: number; // bytes
  rows: number;
  createdAt: number;
}

export interface CompactionMetrics {
  pendingCompactions: number;
  totalSSTables: number;
  totalSSTableSize: number;
  lastCompactionTime: number;
  compactionCount: number;
}

/**
 * Simulates Cassandra compaction based on real SSTables
 */
export class CassandraCompactionEngine {
  private sstables: Map<string, SSTable[]> = new Map(); // tableKey -> SSTable[]
  private memtables: Map<string, Memtable> = new Map(); // tableKey -> Memtable
  private compactionStrategy: CompactionStrategy = 'SizeTieredCompactionStrategy';
  private lastCompactionCheck: number = Date.now();
  private compactionCount: number = 0;

  /**
   * Initialize compaction engine with strategy
   */
  public initialize(strategy: CompactionStrategy): void {
    this.compactionStrategy = strategy;
    this.lastCompactionCheck = Date.now();
  }

  /**
   * Add data to memtable (called on INSERT/UPDATE)
   */
  public addToMemtable(tableKey: string, rowSize: number): void {
    const memtable = this.memtables.get(tableKey) || {
      tableKey,
      size: 0,
      rows: 0,
      createdAt: Date.now(),
    };

    memtable.size += rowSize;
    memtable.rows += 1;
    this.memtables.set(tableKey, memtable);

    // Check if memtable should be flushed
    if (memtable.size >= MEMTABLE_FLUSH_THRESHOLD_BYTES || memtable.rows >= MIN_ROWS_FOR_FLUSH) {
      this.flushMemtable(tableKey);
    }
  }

  /**
   * Flush memtable to SSTable
   */
  private flushMemtable(tableKey: string): void {
    const memtable = this.memtables.get(tableKey);
    if (!memtable || memtable.rows === 0) return;

    // Create new SSTable from memtable
    const sstable: SSTable = {
      id: `sstable-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      tableKey,
      size: memtable.size,
      rows: memtable.rows,
      createdAt: Date.now(),
      level: 0, // Start at level 0
    };

    // Add to SSTables
    const sstables = this.sstables.get(tableKey) || [];
    sstables.push(sstable);
    this.sstables.set(tableKey, sstables);

    // Clear memtable
    this.memtables.delete(tableKey);

    // Check if compaction is needed
    this.checkAndTriggerCompaction(tableKey);
  }

  /**
   * Check if compaction is needed and trigger it
   */
  private checkAndTriggerCompaction(tableKey: string): void {
    const sstables = this.sstables.get(tableKey) || [];
    
    if (sstables.length < MIN_SSTABLES_FOR_COMPACTION) {
      return; // Not enough SSTables for compaction
    }

    // Check based on strategy
    let shouldCompact = false;

    switch (this.compactionStrategy) {
      case 'SizeTieredCompactionStrategy':
        shouldCompact = this.shouldCompactSizeTiered(sstables);
        break;
      case 'LeveledCompactionStrategy':
        shouldCompact = this.shouldCompactLeveled(sstables);
        break;
      case 'TimeWindowCompactionStrategy':
        shouldCompact = this.shouldCompactTimeWindow(sstables);
        break;
    }

    if (shouldCompact) {
      this.performCompaction(tableKey);
    }
  }

  /**
   * SizeTieredCompactionStrategy: compact when 4+ SSTables of similar size
   */
  private shouldCompactSizeTiered(sstables: SSTable[]): boolean {
    if (sstables.length < 4) return false;

    // Group SSTables by similar size (within 50% of each other)
    const sorted = [...sstables].sort((a, b) => a.size - b.size);
    
    for (let i = 0; i < sorted.length - 3; i++) {
      const group = sorted.slice(i, i + 4);
      const avgSize = group.reduce((sum, s) => sum + s.size, 0) / group.length;
      const allSimilar = group.every(s => {
        const ratio = s.size / avgSize;
        return ratio >= 0.5 && ratio <= 1.5;
      });

      if (allSimilar) {
        return true; // Found 4 similar-sized SSTables
      }
    }

    return false;
  }

  /**
   * LeveledCompactionStrategy: compact when level has too many SSTables
   */
  private shouldCompactLeveled(sstables: SSTable[]): boolean {
    // Level 0: compact when 4+ SSTables
    const level0 = sstables.filter(s => s.level === 0);
    if (level0.length >= 4) return true;

    // Other levels: compact when 10+ SSTables in a level
    const levelMap = new Map<number, SSTable[]>();
    for (const sstable of sstables) {
      const level = sstable.level || 0;
      if (!levelMap.has(level)) {
        levelMap.set(level, []);
      }
      levelMap.get(level)!.push(sstable);
    }

    for (const [level, levelSSTables] of levelMap.entries()) {
      if (level > 0 && levelSSTables.length >= 10) {
        return true;
      }
    }

    return false;
  }

  /**
   * TimeWindowCompactionStrategy: compact based on time windows
   */
  private shouldCompactTimeWindow(sstables: SSTable[]): boolean {
    if (sstables.length < 4) return false;

    // Group by time windows (1 hour windows)
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    const windowMap = new Map<number, SSTable[]>();

    for (const sstable of sstables) {
      const window = Math.floor((now - sstable.createdAt) / oneHour);
      if (!windowMap.has(window)) {
        windowMap.set(window, []);
      }
      windowMap.get(window)!.push(sstable);
    }

    // Compact if any window has 4+ SSTables
    for (const windowSSTables of windowMap.values()) {
      if (windowSSTables.length >= 4) {
        return true;
      }
    }

    return false;
  }

  /**
   * Perform compaction for a table
   */
  private performCompaction(tableKey: string): void {
    const sstables = this.sstables.get(tableKey);
    if (!sstables || sstables.length < MIN_SSTABLES_FOR_COMPACTION) return;

    let compactedSSTables: SSTable[];
    let remainingSSTables: SSTable[];

    switch (this.compactionStrategy) {
      case 'SizeTieredCompactionStrategy':
        ({ compactedSSTables, remainingSSTables } = this.compactSizeTiered(sstables));
        break;
      case 'LeveledCompactionStrategy':
        ({ compactedSSTables, remainingSSTables } = this.compactLeveled(sstables));
        break;
      case 'TimeWindowCompactionStrategy':
        ({ compactedSSTables, remainingSSTables } = this.compactTimeWindow(sstables));
        break;
      default:
        return;
    }

    // Replace old SSTables with compacted ones
    this.sstables.set(tableKey, [...remainingSSTables, ...compactedSSTables]);
    this.compactionCount++;
  }

  /**
   * Compact using SizeTieredCompactionStrategy
   */
  private compactSizeTiered(sstables: SSTable[]): { compactedSSTables: SSTable[]; remainingSSTables: SSTable[] } {
    const sorted = [...sstables].sort((a, b) => a.size - b.size);
    const toCompact: SSTable[] = [];
    const remaining: SSTable[] = [];

    // Find 4 similar-sized SSTables to compact
    for (let i = 0; i < sorted.length - 3; i++) {
      const group = sorted.slice(i, i + 4);
      const avgSize = group.reduce((sum, s) => sum + s.size, 0) / group.length;
      const allSimilar = group.every(s => {
        const ratio = s.size / avgSize;
        return ratio >= 0.5 && ratio <= 1.5;
      });

      if (allSimilar) {
        toCompact.push(...group);
        remaining.push(...sorted.slice(0, i), ...sorted.slice(i + 4));
        break;
      }
    }

    if (toCompact.length === 0) {
      // Fallback: compact first 4
      toCompact.push(...sorted.slice(0, 4));
      remaining.push(...sorted.slice(4));
    }

    // Create compacted SSTable
    const compacted: SSTable = {
      id: `sstable-compacted-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      tableKey: toCompact[0].tableKey,
      size: toCompact.reduce((sum, s) => sum + s.size, 0) * 0.9, // 10% reduction due to deduplication
      rows: toCompact.reduce((sum, s) => sum + s.rows, 0),
      createdAt: Date.now(),
      level: 0,
    };

    return {
      compactedSSTables: [compacted],
      remainingSSTables: remaining,
    };
  }

  /**
   * Compact using LeveledCompactionStrategy
   */
  private compactLeveled(sstables: SSTable[]): { compactedSSTables: SSTable[]; remainingSSTables: SSTable[] } {
    // Find level 0 SSTables to compact
    const level0 = sstables.filter(s => s.level === 0);
    const otherLevels = sstables.filter(s => (s.level || 0) > 0);

    if (level0.length < 4) {
      return {
        compactedSSTables: [],
        remainingSSTables: sstables,
      };
    }

    // Compact 4 level 0 SSTables into level 1
    const toCompact = level0.slice(0, 4);
    const remainingLevel0 = level0.slice(4);

    const compacted: SSTable = {
      id: `sstable-leveled-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      tableKey: toCompact[0].tableKey,
      size: toCompact.reduce((sum, s) => sum + s.size, 0) * 0.85, // More reduction in leveled
      rows: toCompact.reduce((sum, s) => sum + s.rows, 0),
      createdAt: Date.now(),
      level: 1,
    };

    return {
      compactedSSTables: [compacted],
      remainingSSTables: [...remainingLevel0, ...otherLevels],
    };
  }

  /**
   * Compact using TimeWindowCompactionStrategy
   */
  private compactTimeWindow(sstables: SSTable[]): { compactedSSTables: SSTable[]; remainingSSTables: SSTable[] } {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    const windowMap = new Map<number, SSTable[]>();

    for (const sstable of sstables) {
      const window = Math.floor((now - sstable.createdAt) / oneHour);
      if (!windowMap.has(window)) {
        windowMap.set(window, []);
      }
      windowMap.get(window)!.push(sstable);
    }

    // Find window with most SSTables
    let maxWindow = -1;
    let maxCount = 0;
    for (const [window, windowSSTables] of windowMap.entries()) {
      if (windowSSTables.length > maxCount) {
        maxCount = windowSSTables.length;
        maxWindow = window;
      }
    }

    if (maxWindow === -1 || maxCount < 4) {
      return {
        compactedSSTables: [],
        remainingSSTables: sstables,
      };
    }

    const toCompact = windowMap.get(maxWindow)!;
    const remaining = sstables.filter(s => !toCompact.includes(s));

    const compacted: SSTable = {
      id: `sstable-timewindow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      tableKey: toCompact[0].tableKey,
      size: toCompact.reduce((sum, s) => sum + s.size, 0) * 0.9,
      rows: toCompact.reduce((sum, s) => sum + s.rows, 0),
      createdAt: Date.now(),
      level: 0,
    };

    return {
      compactedSSTables: [compacted],
      remainingSSTables: remaining,
    };
  }

  /**
   * Periodic compaction check (called from update loop)
   */
  public periodicCompactionCheck(): void {
    const now = Date.now();
    if (now - this.lastCompactionCheck < COMPACTION_INTERVAL_MS) {
      return;
    }

    this.lastCompactionCheck = now;

    // Check all tables for compaction
    for (const tableKey of this.sstables.keys()) {
      this.checkAndTriggerCompaction(tableKey);
    }
  }

  /**
   * Get compaction metrics
   */
  public getMetrics(): CompactionMetrics {
    let totalSSTables = 0;
    let totalSSTableSize = 0;
    let pendingCompactions = 0;

    for (const sstables of this.sstables.values()) {
      totalSSTables += sstables.length;
      totalSSTableSize += sstables.reduce((sum, s) => sum + s.size, 0);

      // Count pending compactions
      if (sstables.length >= MIN_SSTABLES_FOR_COMPACTION) {
        let shouldCompact = false;
        switch (this.compactionStrategy) {
          case 'SizeTieredCompactionStrategy':
            shouldCompact = this.shouldCompactSizeTiered(sstables);
            break;
          case 'LeveledCompactionStrategy':
            shouldCompact = this.shouldCompactLeveled(sstables);
            break;
          case 'TimeWindowCompactionStrategy':
            shouldCompact = this.shouldCompactTimeWindow(sstables);
            break;
        }
        if (shouldCompact) {
          pendingCompactions++;
        }
      }
    }

    return {
      pendingCompactions,
      totalSSTables,
      totalSSTableSize,
      lastCompactionTime: this.lastCompactionCheck,
      compactionCount: this.compactionCount,
    };
  }

  /**
   * Get SSTables for a table
   */
  public getSSTables(tableKey: string): SSTable[] {
    return this.sstables.get(tableKey) || [];
  }

  /**
   * Clear all SSTables (for testing/reset)
   */
  public clear(): void {
    this.sstables.clear();
    this.memtables.clear();
    this.compactionCount = 0;
  }
}

/**
 * TTL Manager for Cassandra
 * Manages Time To Live (TTL) for records in a simulative way
 * No hardcoding - all values are configurable and based on real operations
 */

export interface TTLRecord {
  tableKey: string;
  rowKey: string;
  ttlSeconds: number;
  createdAt: number; // Timestamp in milliseconds
  expiresAt: number; // Timestamp in milliseconds (createdAt + ttlSeconds * 1000)
}

/**
 * TTL Manager
 * Simulates TTL expiration and cleanup for Cassandra records
 */
export class TTLManager {
  private ttlRecords: Map<string, TTLRecord> = new Map();
  private cleanupInterval: number = 1000; // Check every 1 second (configurable)
  private lastCleanup: number = Date.now();

  /**
   * Set TTL for a record
   * @param tableKey Table identifier (keyspace.table)
   * @param rowKey Row identifier (for tracking)
   * @param ttlSeconds TTL in seconds (0 means no TTL)
   */
  public setTTL(tableKey: string, rowKey: string, ttlSeconds: number): void {
    if (ttlSeconds <= 0) {
      // Remove TTL if set to 0 or negative
      this.ttlRecords.delete(rowKey);
      return;
    }

    const now = Date.now();
    const expiresAt = now + (ttlSeconds * 1000);

    this.ttlRecords.set(rowKey, {
      tableKey,
      rowKey,
      ttlSeconds,
      createdAt: now,
      expiresAt,
    });
  }

  /**
   * Get TTL for a record
   * @param rowKey Row identifier
   * @returns TTL record or null if no TTL
   */
  public getTTL(rowKey: string): TTLRecord | null {
    return this.ttlRecords.get(rowKey) || null;
  }

  /**
   * Check if a record has expired
   * @param rowKey Row identifier
   * @returns true if expired, false otherwise
   */
  public isExpired(rowKey: string): boolean {
    const record = this.ttlRecords.get(rowKey);
    if (!record) {
      return false; // No TTL means never expires
    }

    return Date.now() >= record.expiresAt;
  }

  /**
   * Get remaining TTL for a record in seconds
   * @param rowKey Row identifier
   * @returns Remaining TTL in seconds, or null if no TTL or expired
   */
  public getRemainingTTL(rowKey: string): number | null {
    const record = this.ttlRecords.get(rowKey);
    if (!record) {
      return null; // No TTL
    }

    const now = Date.now();
    if (now >= record.expiresAt) {
      return 0; // Expired
    }

    return Math.ceil((record.expiresAt - now) / 1000);
  }

  /**
   * Remove TTL for a record
   * @param rowKey Row identifier
   */
  public removeTTL(rowKey: string): void {
    this.ttlRecords.delete(rowKey);
  }

  /**
   * Get all expired row keys
   * @returns Array of expired row keys
   */
  public getExpiredRowKeys(): string[] {
    const now = Date.now();
    const expired: string[] = [];

    for (const [rowKey, record] of this.ttlRecords.entries()) {
      if (now >= record.expiresAt) {
        expired.push(rowKey);
      }
    }

    return expired;
  }

  /**
   * Cleanup expired records
   * Should be called periodically (e.g., in updateMetrics)
   * @returns Array of expired row keys that were cleaned up
   */
  public cleanupExpired(): string[] {
    const now = Date.now();
    
    // Only cleanup if enough time has passed (to avoid too frequent cleanup)
    if (now - this.lastCleanup < this.cleanupInterval) {
      return [];
    }

    this.lastCleanup = now;

    const expired = this.getExpiredRowKeys();
    
    // Remove expired records from tracking
    for (const rowKey of expired) {
      this.ttlRecords.delete(rowKey);
    }

    return expired;
  }

  /**
   * Get all TTL records for a table
   * @param tableKey Table identifier
   * @returns Array of TTL records
   */
  public getTTLRecordsForTable(tableKey: string): TTLRecord[] {
    const records: TTLRecord[] = [];
    
    for (const record of this.ttlRecords.values()) {
      if (record.tableKey === tableKey) {
        records.push(record);
      }
    }

    return records;
  }

  /**
   * Get TTL data as a Map for a table (for easier lookup)
   * @param tableKey Table identifier
   * @returns Map of rowKey -> { ttl: number, expiresAt: number | null }
   */
  public getTTLData(tableKey: string): Map<string, { ttl: number; expiresAt: number | null }> {
    const data = new Map<string, { ttl: number; expiresAt: number | null }>();
    
    for (const record of this.ttlRecords.values()) {
      if (record.tableKey === tableKey) {
        data.set(record.rowKey, {
          ttl: record.ttlSeconds,
          expiresAt: record.expiresAt,
        });
      }
    }

    return data;
  }

  /**
   * Get metrics about TTL
   * @returns TTL metrics
   */
  public getMetrics(): {
    totalTTLRecords: number;
    expiredRecords: number;
    activeRecords: number;
  } {
    const now = Date.now();
    let expired = 0;
    let active = 0;

    for (const record of this.ttlRecords.values()) {
      if (now >= record.expiresAt) {
        expired++;
      } else {
        active++;
      }
    }

    return {
      totalTTLRecords: this.ttlRecords.size,
      expiredRecords: expired,
      activeRecords: active,
    };
  }

  /**
   * Clear all TTL records (for cleanup/testing)
   */
  public clear(): void {
    this.ttlRecords.clear();
  }

  /**
   * Set cleanup interval (configurable)
   * @param intervalMs Interval in milliseconds
   */
  public setCleanupInterval(intervalMs: number): void {
    this.cleanupInterval = intervalMs;
  }
}

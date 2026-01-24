/**
 * Cassandra Hinted Handoff Manager
 * 
 * Симулирует hinted handoff механизм Cassandra:
 * - Сохранение hints для недоступных узлов при write операциях
 * - TTL для hints (3 часа по умолчанию)
 * - Доставка hints когда узел возвращается
 * - Очистка expired hints
 */

import { HINT_TTL_MS } from './constants';

export interface Hint {
  id: string; // Unique hint ID
  targetNode: string; // Node address that should receive this hint
  keyspace: string;
  table: string;
  rowKey: string; // Composite key for the row
  data: any; // Row data to be written
  timestamp: number; // When hint was created
  expiresAt: number; // When hint expires (timestamp + TTL)
  retryCount: number; // Number of delivery attempts
}

export interface HintedHandoffMetrics {
  totalHints: number;
  pendingHints: number;
  deliveredHints: number;
  expiredHints: number;
  hintsByNode: Map<string, number>; // node address -> hint count
}

/**
 * Hinted Handoff Manager для симуляции hinted handoff
 */
export class CassandraHintedHandoffManager {
  private hints: Map<string, Hint> = new Map(); // hintId -> Hint
  private hintsByTarget: Map<string, Set<string>> = new Map(); // targetNode -> set of hintIds
  private hintIdCounter: number = 0;
  private hintTTL: number = HINT_TTL_MS;
  private maxRetries: number = 10; // Maximum delivery attempts before giving up

  // Metrics
  private totalHintsCreated: number = 0;
  private totalHintsDelivered: number = 0;
  private totalHintsExpired: number = 0;

  /**
   * Create a hint for a write operation to an unavailable node
   */
  public createHint(
    targetNode: string,
    keyspace: string,
    table: string,
    rowKey: string,
    data: any
  ): string {
    const now = Date.now();
    const hintId = `hint_${this.hintIdCounter++}_${now}`;
    
    const hint: Hint = {
      id: hintId,
      targetNode,
      keyspace,
      table,
      rowKey,
      data,
      timestamp: now,
      expiresAt: now + this.hintTTL,
      retryCount: 0,
    };

    this.hints.set(hintId, hint);
    
    // Track hints by target node
    if (!this.hintsByTarget.has(targetNode)) {
      this.hintsByTarget.set(targetNode, new Set());
    }
    this.hintsByTarget.get(targetNode)!.add(hintId);

    this.totalHintsCreated++;
    return hintId;
  }

  /**
   * Attempt to deliver hints to a node that came back online
   */
  public deliverHintsToNode(nodeAddress: string): number {
    const hintsForNode = this.hintsByTarget.get(nodeAddress);
    if (!hintsForNode || hintsForNode.size === 0) {
      return 0;
    }

    const now = Date.now();
    let deliveredCount = 0;
    const hintsToRemove: string[] = [];

    for (const hintId of hintsForNode) {
      const hint = this.hints.get(hintId);
      if (!hint) {
        continue;
      }

      // Check if hint expired
      if (now > hint.expiresAt) {
        hintsToRemove.push(hintId);
        this.totalHintsExpired++;
        continue;
      }

      // Attempt delivery (simulate: always succeeds if node is up)
      // In real Cassandra, this would actually write to the node
      deliveredCount++;
      hintsToRemove.push(hintId);
      this.totalHintsDelivered++;
    }

    // Remove delivered/expired hints
    for (const hintId of hintsToRemove) {
      this.removeHint(hintId);
    }

    return deliveredCount;
  }

  /**
   * Clean up expired hints (called periodically)
   */
  public cleanupExpiredHints(): number {
    const now = Date.now();
    const expiredHints: string[] = [];

    for (const [hintId, hint] of this.hints.entries()) {
      if (now > hint.expiresAt) {
        expiredHints.push(hintId);
        this.totalHintsExpired++;
      }
    }

    for (const hintId of expiredHints) {
      this.removeHint(hintId);
    }

    return expiredHints.length;
  }

  /**
   * Remove a hint
   */
  private removeHint(hintId: string): void {
    const hint = this.hints.get(hintId);
    if (!hint) {
      return;
    }

    this.hints.delete(hintId);
    
    const hintsForNode = this.hintsByTarget.get(hint.targetNode);
    if (hintsForNode) {
      hintsForNode.delete(hintId);
      if (hintsForNode.size === 0) {
        this.hintsByTarget.delete(hint.targetNode);
      }
    }
  }

  /**
   * Get all hints for a specific node
   */
  public getHintsForNode(nodeAddress: string): Hint[] {
    const hintIds = this.hintsByTarget.get(nodeAddress);
    if (!hintIds) {
      return [];
    }

    const hints: Hint[] = [];
    for (const hintId of hintIds) {
      const hint = this.hints.get(hintId);
      if (hint) {
        hints.push(hint);
      }
    }

    return hints;
  }

  /**
   * Get all pending hints
   */
  public getAllHints(): Hint[] {
    return Array.from(this.hints.values());
  }

  /**
   * Get hint count for a specific node
   */
  public getHintCountForNode(nodeAddress: string): number {
    return this.hintsByTarget.get(nodeAddress)?.size || 0;
  }

  /**
   * Get total hint count
   */
  public getTotalHintCount(): number {
    return this.hints.size;
  }

  /**
   * Get metrics
   */
  public getMetrics(): HintedHandoffMetrics {
    const hintsByNode = new Map<string, number>();
    
    for (const [nodeAddress, hintIds] of this.hintsByTarget.entries()) {
      hintsByNode.set(nodeAddress, hintIds.size);
    }

    return {
      totalHints: this.totalHintsCreated,
      pendingHints: this.hints.size,
      deliveredHints: this.totalHintsDelivered,
      expiredHints: this.totalHintsExpired,
      hintsByNode,
    };
  }

  /**
   * Clear all hints (for testing/reset)
   */
  public clear(): void {
    this.hints.clear();
    this.hintsByTarget.clear();
    this.hintIdCounter = 0;
    this.totalHintsCreated = 0;
    this.totalHintsDelivered = 0;
    this.totalHintsExpired = 0;
  }

  /**
   * Set hint TTL (for configuration)
   */
  public setHintTTL(ttlMs: number): void {
    this.hintTTL = ttlMs;
  }

  /**
   * Get hint TTL
   */
  public getHintTTL(): number {
    return this.hintTTL;
  }
}

/**
 * Cassandra Replica State Manager
 * 
 * Отслеживание состояния реплик для каждой записи и определение
 * consistency violations на основе реального состояния, а не случайности.
 */

import { ConsistencyLevel, CassandraNode } from '../CassandraRoutingEngine';
import {
  CONSISTENCY_VIOLATION_CHANCE_HEALTHY,
  CONSISTENCY_VIOLATION_CHANCE_UNHEALTHY,
} from './constants';

export interface ReplicaState {
  nodeAddress: string;
  version: number; // Version/timestamp of the data
  isSynced: boolean; // Whether this replica is in sync with others
  lastUpdated: number; // Timestamp of last update
}

export interface RowReplicaState {
  rowKey: string; // Composite key for the row
  replicas: Map<string, ReplicaState>; // nodeAddress -> ReplicaState
  primaryReplica: string; // Address of primary replica
  lastWriteTime: number;
}

/**
 * Manages replica state for Cassandra rows
 */
export class ReplicaStateManager {
  private rowStates: Map<string, RowReplicaState> = new Map(); // rowKey -> RowReplicaState
  private versionCounter: number = 0;

  /**
   * Initialize replica state for a write operation
   */
  public initializeReplicas(
    rowKey: string,
    replicaNodes: string[],
    primaryReplica: string
  ): void {
    const now = Date.now();
    this.versionCounter++;

    const replicaStates = new Map<string, ReplicaState>();
    for (const nodeAddress of replicaNodes) {
      replicaStates.set(nodeAddress, {
        nodeAddress,
        version: this.versionCounter,
        isSynced: true,
        lastUpdated: now,
      });
    }

    this.rowStates.set(rowKey, {
      rowKey,
      replicas: replicaStates,
      primaryReplica,
      lastWriteTime: now,
    });
  }

  /**
   * Update replica state after a write operation
   */
  public updateReplica(
    rowKey: string,
    nodeAddress: string,
    success: boolean
  ): void {
    const rowState = this.rowStates.get(rowKey);
    if (!rowState) {
      // Initialize if doesn't exist
      this.initializeReplicas(rowKey, [nodeAddress], nodeAddress);
      return;
    }

    const replica = rowState.replicas.get(nodeAddress);
    if (!replica) {
      // Add new replica
      this.versionCounter++;
      rowState.replicas.set(nodeAddress, {
        nodeAddress,
        version: this.versionCounter,
        isSynced: false,
        lastUpdated: Date.now(),
      });
      return;
    }

    if (success) {
      // Successful write: update version and sync status
      this.versionCounter++;
      replica.version = this.versionCounter;
      replica.lastUpdated = Date.now();
      replica.isSynced = true;
    } else {
      // Failed write: mark as out of sync
      replica.isSynced = false;
    }

    rowState.lastWriteTime = Date.now();
  }

  /**
   * Check consistency violation based on actual replica state
   */
  public checkConsistencyViolation(
    rowKey: string,
    consistency: ConsistencyLevel,
    replicationFactor: number,
    nodes: Map<string, CassandraNode>
  ): boolean {
    const rowState = this.rowStates.get(rowKey);
    if (!rowState) {
      // No state yet, assume no violation
      return false;
    }

    // Get required number of replicas for consistency
    const requiredReplicas = this.getRequiredReplicas(consistency, replicationFactor);

    // Count healthy and synced replicas
    let healthySyncedReplicas = 0;
    let healthyReplicas = 0;

    for (const [nodeAddress, replica] of rowState.replicas.entries()) {
      const node = nodes.get(nodeAddress);
      if (node && node.status === 'up') {
        healthyReplicas++;
        if (replica.isSynced) {
          healthySyncedReplicas++;
        }
      }
    }

    // Violation occurs if:
    // 1. Not enough healthy replicas
    // 2. Not enough synced replicas
    if (healthyReplicas < requiredReplicas) {
      return true; // Not enough healthy nodes
    }

    if (healthySyncedReplicas < requiredReplicas) {
      return true; // Not enough synced replicas
    }

    // Check for version mismatch (some replicas have different versions)
    const versions = Array.from(rowState.replicas.values())
      .filter(r => {
        const node = nodes.get(r.nodeAddress);
        return node && node.status === 'up';
      })
      .map(r => r.version);

    if (versions.length === 0) {
      return true; // No healthy replicas
    }

    const maxVersion = Math.max(...versions);
    const minVersion = Math.min(...versions);
    const hasVersionMismatch = maxVersion !== minVersion;

    // Violation if versions don't match and we need all replicas synced
    if (hasVersionMismatch && healthySyncedReplicas < requiredReplicas) {
      return true;
    }

    // Small chance of violation even when everything looks good (network issues, etc.)
    const violationChance = healthyReplicas === replicationFactor
      ? CONSISTENCY_VIOLATION_CHANCE_HEALTHY
      : CONSISTENCY_VIOLATION_CHANCE_UNHEALTHY;

    return Math.random() < violationChance;
  }

  /**
   * Simulate read repair: fix inconsistencies between replicas
   */
  public performReadRepair(
    rowKey: string,
    nodes: Map<string, CassandraNode>
  ): number {
    const rowState = this.rowStates.get(rowKey);
    if (!rowState) {
      return 0; // No state to repair
    }

    // Find the most recent version (consensus)
    const healthyReplicas = Array.from(rowState.replicas.values())
      .filter(r => {
        const node = nodes.get(r.nodeAddress);
        return node && node.status === 'up';
      });

    if (healthyReplicas.length === 0) {
      return 0; // No healthy replicas to repair
    }

    // Find max version (most recent)
    const maxVersion = Math.max(...healthyReplicas.map(r => r.version));

    // Update all replicas to max version (repair)
    let repairedCount = 0;
    for (const replica of healthyReplicas) {
      if (replica.version < maxVersion) {
        replica.version = maxVersion;
        replica.isSynced = true;
        replica.lastUpdated = Date.now();
        repairedCount++;
      }
    }

    return repairedCount;
  }

  /**
   * Simulate node going down: mark replicas on that node as out of sync
   */
  public markNodeDown(nodeAddress: string): void {
    for (const rowState of this.rowStates.values()) {
      const replica = rowState.replicas.get(nodeAddress);
      if (replica) {
        replica.isSynced = false;
      }
    }
  }

  /**
   * Simulate node coming up: attempt to sync replicas
   */
  public markNodeUp(nodeAddress: string, nodes: Map<string, CassandraNode>): void {
    for (const rowState of this.rowStates.values()) {
      const replica = rowState.replicas.get(nodeAddress);
      if (replica) {
        // Try to sync with other replicas
        const otherReplicas = Array.from(rowState.replicas.values())
          .filter(r => r.nodeAddress !== nodeAddress)
          .filter(r => {
            const node = nodes.get(r.nodeAddress);
            return node && node.status === 'up';
          });

        if (otherReplicas.length > 0) {
          // Sync to most recent version
          const maxVersion = Math.max(...otherReplicas.map(r => r.version));
          replica.version = maxVersion;
          replica.isSynced = true;
          replica.lastUpdated = Date.now();
        }
      }
    }
  }

  /**
   * Get required number of replicas for consistency level
   */
  private getRequiredReplicas(consistency: ConsistencyLevel, replicationFactor: number): number {
    switch (consistency) {
      case 'ONE':
      case 'LOCAL_ONE':
        return 1;
      case 'TWO':
        return 2;
      case 'THREE':
        return 3;
      case 'QUORUM':
      case 'LOCAL_QUORUM':
        return Math.floor(replicationFactor / 2) + 1;
      case 'ALL':
      case 'EACH_QUORUM':
        return replicationFactor;
      case 'SERIAL':
      case 'LOCAL_SERIAL':
        return Math.floor(replicationFactor / 2) + 1;
      default:
        return Math.floor(replicationFactor / 2) + 1;
    }
  }

  /**
   * Get replica state for a row
   */
  public getRowState(rowKey: string): RowReplicaState | undefined {
    return this.rowStates.get(rowKey);
  }

  /**
   * Clear all replica states (for testing/reset)
   */
  public clear(): void {
    this.rowStates.clear();
    this.versionCounter = 0;
  }
}

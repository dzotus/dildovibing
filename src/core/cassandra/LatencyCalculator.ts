/**
 * Cassandra Latency Calculator
 * 
 * Динамический расчет latency на основе реальных операций, состояния узлов,
 * network latency и consistency level. Избегает хардкода и скриптованности.
 */

import { ConsistencyLevel, CassandraNode } from '../CassandraRoutingEngine';
import {
  BASE_READ_LATENCY_MS,
  BASE_WRITE_LATENCY_MS,
  NETWORK_JITTER_MAX_MS,
  NETWORK_JITTER_MAX_WRITE_MS,
} from './constants';

export interface LatencyCalculationParams {
  consistency: ConsistencyLevel;
  replicationFactor: number;
  nodes: Map<string, CassandraNode>;
  replicaNodes: string[]; // Addresses of replica nodes for this operation
  operationType: 'read' | 'write';
  datacenter?: string;
  networkLatencyMap?: Map<string, number>; // Map of node address -> network latency
}

/**
 * Calculates latency for Cassandra operations based on real conditions
 */
export class CassandraLatencyCalculator {
  /**
   * Calculate read latency based on real conditions
   */
  public calculateReadLatency(params: LatencyCalculationParams): number {
    const {
      consistency,
      replicationFactor,
      nodes,
      replicaNodes,
      networkLatencyMap,
      datacenter,
    } = params;

    // Base latency from constants (configurable)
    let latency = BASE_READ_LATENCY_MS;

    // Get required number of replicas for consistency level
    const requiredReplicas = this.getRequiredReplicas(consistency, replicationFactor);

    // Calculate latency based on actual replica nodes
    const actualReplicas = this.getActualReplicas(replicaNodes, nodes, requiredReplicas);
    
    // Network latency: sum of latencies to all replica nodes (parallel reads)
    // In real Cassandra, reads are done in parallel, so we take the max latency
    let maxNetworkLatency = 0;
    let totalNodeLoad = 0;
    let healthyReplicas = 0;

    for (const nodeAddress of actualReplicas) {
      const node = nodes.get(nodeAddress);
      if (!node) continue;

      if (node.status === 'up') {
        healthyReplicas++;

        // Network latency from connection (if available)
        const networkLatency = networkLatencyMap?.get(nodeAddress) || this.estimateNetworkLatency(nodeAddress);
        maxNetworkLatency = Math.max(maxNetworkLatency, networkLatency);

        // Node load affects latency (loaded nodes respond slower)
        totalNodeLoad += node.load;
      }
    }

    // If not enough healthy replicas, add penalty
    if (healthyReplicas < requiredReplicas) {
      const missingReplicas = requiredReplicas - healthyReplicas;
      latency += missingReplicas * 10; // Penalty for missing replicas
    }

    // Replica latency: parallel reads, so we use max (not sum)
    // More replicas = slightly higher latency due to coordination
    const replicaLatency = Math.log(requiredReplicas + 1) * 2;

    // Node load penalty: average load of all queried nodes
    const avgLoad = actualReplicas.length > 0 ? totalNodeLoad / actualReplicas.length : 0;
    const loadPenalty = avgLoad * 5; // 0-5ms penalty based on load

    // Datacenter topology: LOCAL_QUORUM is faster than QUORUM
    let datacenterMultiplier = 1.0;
    if (consistency === 'LOCAL_ONE' || consistency === 'LOCAL_QUORUM' || consistency === 'LOCAL_SERIAL') {
      // Local operations are faster (no cross-datacenter latency)
      datacenterMultiplier = 0.7;
    } else if (consistency === 'EACH_QUORUM') {
      // EACH_QUORUM requires quorum in each datacenter (slower)
      datacenterMultiplier = 1.3;
    }

    // Network jitter (random variation)
    const jitter = Math.random() * NETWORK_JITTER_MAX_MS;

    // Total latency
    const totalLatency = (latency + replicaLatency + maxNetworkLatency + loadPenalty) * datacenterMultiplier + jitter;

    return Math.round(totalLatency);
  }

  /**
   * Calculate write latency based on real conditions
   */
  public calculateWriteLatency(params: LatencyCalculationParams): number {
    const {
      consistency,
      replicationFactor,
      nodes,
      replicaNodes,
      networkLatencyMap,
      datacenter,
    } = params;

    // Base latency from constants (configurable)
    let latency = BASE_WRITE_LATENCY_MS;

    // Get required number of replicas for consistency level
    const requiredReplicas = this.getRequiredReplicas(consistency, replicationFactor);

    // Calculate latency based on actual replica nodes
    const actualReplicas = this.getActualReplicas(replicaNodes, nodes, requiredReplicas);

    // Network latency: writes are sequential (coordinator -> replicas)
    // In real Cassandra, coordinator sends to all replicas in parallel, but waits for acknowledgments
    let totalNetworkLatency = 0;
    let totalNodeLoad = 0;
    let healthyReplicas = 0;

    for (const nodeAddress of actualReplicas) {
      const node = nodes.get(nodeAddress);
      if (!node) continue;

      if (node.status === 'up') {
        healthyReplicas++;

        // Network latency from connection (if available)
        const networkLatency = networkLatencyMap?.get(nodeAddress) || this.estimateNetworkLatency(nodeAddress);
        totalNetworkLatency += networkLatency;

        // Node load affects latency
        totalNodeLoad += node.load;
      }
    }

    // If not enough healthy replicas, add penalty
    if (healthyReplicas < requiredReplicas) {
      const missingReplicas = requiredReplicas - healthyReplicas;
      latency += missingReplicas * 15; // Higher penalty for writes
    }

    // Replica latency: writes are more linear (waiting for acknowledgments)
    const replicaLatency = requiredReplicas * 2;

    // Node load penalty
    const avgLoad = actualReplicas.length > 0 ? totalNodeLoad / actualReplicas.length : 0;
    const loadPenalty = avgLoad * 8; // Higher penalty for writes

    // Datacenter topology
    let datacenterMultiplier = 1.0;
    if (consistency === 'LOCAL_ONE' || consistency === 'LOCAL_QUORUM' || consistency === 'LOCAL_SERIAL') {
      datacenterMultiplier = 0.7;
    } else if (consistency === 'EACH_QUORUM') {
      datacenterMultiplier = 1.5; // Even slower for writes
    }

    // Average network latency (parallel writes, but wait for all)
    const avgNetworkLatency = actualReplicas.length > 0 ? totalNetworkLatency / actualReplicas.length : 0;

    // Network jitter
    const jitter = Math.random() * NETWORK_JITTER_MAX_WRITE_MS;

    // Total latency
    const totalLatency = (latency + replicaLatency + avgNetworkLatency + loadPenalty) * datacenterMultiplier + jitter;

    return Math.round(totalLatency);
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
        return Math.floor(replicationFactor / 2) + 1; // Default to QUORUM
    }
  }

  /**
   * Get actual replica nodes that are available
   */
  private getActualReplicas(
    replicaNodes: string[],
    nodes: Map<string, CassandraNode>,
    requiredReplicas: number
  ): string[] {
    const healthyReplicas = replicaNodes.filter(addr => {
      const node = nodes.get(addr);
      return node && node.status === 'up';
    });

    // Return up to requiredReplicas healthy nodes
    return healthyReplicas.slice(0, requiredReplicas);
  }

  /**
   * Estimate network latency for a node (fallback if not provided)
   */
  private estimateNetworkLatency(nodeAddress: string): number {
    // Simple estimation: localhost = 0.5ms, remote = 2-5ms
    if (nodeAddress.includes('localhost') || nodeAddress.includes('127.0.0.1')) {
      return 0.5;
    }
    return 2 + Math.random() * 3; // 2-5ms for remote nodes
  }
}

/**
 * Cassandra Replication Strategies
 * 
 * Implements replication strategies for determining replica placement:
 * - SimpleStrategy: Replicas placed sequentially around the ring
 * - NetworkTopologyStrategy: Replicas placed considering datacenter and rack topology
 */

import { CassandraTokenRing } from './TokenRing';
import { DEFAULT_REPLICATION_FACTOR } from './constants';

export interface ReplicationConfig {
  replicationFactor?: number;
  datacenterReplication?: Record<string, number>; // For NetworkTopologyStrategy: { 'dc1': 3, 'dc2': 2 }
}

/**
 * Base interface for replication strategies
 */
export interface ReplicationStrategy {
  /**
   * Get replica nodes for a partition key
   */
  getReplicas(
    tokenRing: CassandraTokenRing,
    partitionKey: string,
    config: ReplicationConfig,
    availableNodes?: Set<string>
  ): string[];
}

/**
 * SimpleStrategy: Replicas are placed sequentially around the ring
 * 
 * This is the simplest replication strategy. It places replicas sequentially
 * starting from the primary replica node.
 */
export class SimpleStrategy implements ReplicationStrategy {
  public getReplicas(
    tokenRing: CassandraTokenRing,
    partitionKey: string,
    config: ReplicationConfig,
    availableNodes?: Set<string>
  ): string[] {
    const replicationFactor = config.replicationFactor || DEFAULT_REPLICATION_FACTOR;
    const primaryReplica = tokenRing.getPrimaryReplica(partitionKey);
    
    if (!primaryReplica) {
      return [];
    }

    const replicas: string[] = [primaryReplica];
    const nodesInOrder = tokenRing.getNodesInOrder(primaryReplica);
    
    // Filter to only available nodes if specified
    const filteredNodes = availableNodes
      ? nodesInOrder.filter(node => availableNodes.has(node))
      : nodesInOrder;

    // Add replicas sequentially
    for (let i = 1; i < replicationFactor && i < filteredNodes.length; i++) {
      const nextNode = filteredNodes[i];
      if (nextNode && !replicas.includes(nextNode)) {
        replicas.push(nextNode);
      }
    }

    return replicas;
  }
}

/**
 * NetworkTopologyStrategy: Replicas are placed considering datacenter and rack topology
 * 
 * This strategy places replicas in different datacenters and racks to ensure
 * high availability and fault tolerance.
 */
export class NetworkTopologyStrategy implements ReplicationStrategy {
  public getReplicas(
    tokenRing: CassandraTokenRing,
    partitionKey: string,
    config: ReplicationConfig,
    availableNodes?: Set<string>
  ): string[] {
    const primaryReplica = tokenRing.getPrimaryReplica(partitionKey);
    
    if (!primaryReplica) {
      return [];
    }

    const replicas: string[] = [];
    const usedDatacenters = new Set<string>();
    const usedRacks = new Map<string, Set<string>>(); // datacenter -> set of racks

    // Get primary node info
    const primaryNodeInfo = tokenRing.getNodeInfo(primaryReplica);
    if (primaryNodeInfo) {
      replicas.push(primaryReplica);
      if (primaryNodeInfo.datacenter) {
        usedDatacenters.add(primaryNodeInfo.datacenter);
        if (primaryNodeInfo.rack) {
          if (!usedRacks.has(primaryNodeInfo.datacenter)) {
            usedRacks.set(primaryNodeInfo.datacenter, new Set());
          }
          usedRacks.get(primaryNodeInfo.datacenter)!.add(primaryNodeInfo.rack);
        }
      }
    }

    // If datacenter replication is specified, use it
    if (config.datacenterReplication) {
      return this.getReplicasByDatacenter(
        tokenRing,
        partitionKey,
        config.datacenterReplication,
        replicas,
        usedDatacenters,
        usedRacks,
        availableNodes
      );
    }

    // Otherwise, use default replication factor and try to place in different datacenters/racks
    const replicationFactor = config.replicationFactor || DEFAULT_REPLICATION_FACTOR;
    const nodesInOrder = tokenRing.getNodesInOrder(primaryReplica);

    // Filter to only available nodes if specified
    const filteredNodes = availableNodes
      ? nodesInOrder.filter(node => availableNodes.has(node))
      : nodesInOrder;

    // Try to place replicas in different datacenters and racks
    for (const nodeAddress of filteredNodes) {
      if (replicas.length >= replicationFactor) {
        break;
      }

      if (replicas.includes(nodeAddress)) {
        continue;
      }

      const nodeInfo = tokenRing.getNodeInfo(nodeAddress);
      if (!nodeInfo) {
        continue;
      }

      // Prefer nodes in different datacenters
      if (nodeInfo.datacenter && !usedDatacenters.has(nodeInfo.datacenter)) {
        replicas.push(nodeAddress);
        usedDatacenters.add(nodeInfo.datacenter);
        if (nodeInfo.rack) {
          if (!usedRacks.has(nodeInfo.datacenter)) {
            usedRacks.set(nodeInfo.datacenter, new Set());
          }
          usedRacks.get(nodeInfo.datacenter)!.add(nodeInfo.rack);
        }
        continue;
      }

      // If same datacenter, prefer different rack
      if (nodeInfo.datacenter && nodeInfo.rack) {
        const racksInDc = usedRacks.get(nodeInfo.datacenter) || new Set();
        if (!racksInDc.has(nodeInfo.rack)) {
          replicas.push(nodeAddress);
          racksInDc.add(nodeInfo.rack);
          usedRacks.set(nodeInfo.datacenter, racksInDc);
          continue;
        }
      }

      // If no datacenter/rack info, add if we need more replicas
      if (!nodeInfo.datacenter && !nodeInfo.rack) {
        replicas.push(nodeAddress);
      }
    }

    // If we still need more replicas, fill with any available nodes
    if (replicas.length < replicationFactor) {
      for (const nodeAddress of filteredNodes) {
        if (replicas.length >= replicationFactor) {
          break;
        }
        if (!replicas.includes(nodeAddress)) {
          replicas.push(nodeAddress);
        }
      }
    }

    return replicas;
  }

  /**
   * Get replicas based on datacenter replication configuration
   */
  private getReplicasByDatacenter(
    tokenRing: CassandraTokenRing,
    partitionKey: string,
    datacenterReplication: Record<string, number>,
    initialReplicas: string[],
    usedDatacenters: Set<string>,
    usedRacks: Map<string, Set<string>>,
    availableNodes?: Set<string>
  ): string[] {
    const replicas = [...initialReplicas];
    const nodesInOrder = tokenRing.getNodesInOrder(initialReplicas[0] || '');
    
    // Filter to only available nodes if specified
    const filteredNodes = availableNodes
      ? nodesInOrder.filter(node => availableNodes.has(node))
      : nodesInOrder;

    // Place replicas for each datacenter
    for (const [datacenter, replicationCount] of Object.entries(datacenterReplication)) {
      const currentReplicasInDc = replicas.filter(addr => {
        const info = tokenRing.getNodeInfo(addr);
        return info?.datacenter === datacenter;
      });

      const needed = replicationCount - currentReplicasInDc.length;

      if (needed <= 0) {
        continue;
      }

      const racksInDc = usedRacks.get(datacenter) || new Set<string>();

      // Try to place replicas in different racks
      for (const nodeAddress of filteredNodes) {
        if (needed <= 0) {
          break;
        }

        if (replicas.includes(nodeAddress)) {
          continue;
        }

        const nodeInfo = tokenRing.getNodeInfo(nodeAddress);
        if (!nodeInfo || nodeInfo.datacenter !== datacenter) {
          continue;
        }

        // Prefer different rack
        if (nodeInfo.rack && !racksInDc.has(nodeInfo.rack)) {
          replicas.push(nodeAddress);
          racksInDc.add(nodeInfo.rack);
          usedRacks.set(datacenter, racksInDc);
          continue;
        }

        // If no rack info or same rack, add if we need more
        if (!nodeInfo.rack || racksInDc.size === 0) {
          replicas.push(nodeAddress);
          if (nodeInfo.rack) {
            racksInDc.add(nodeInfo.rack);
            usedRacks.set(datacenter, racksInDc);
          }
        }
      }
    }

    return replicas;
  }
}

/**
 * Factory function to create replication strategy instance
 */
export function createReplicationStrategy(
  strategyName: 'SimpleStrategy' | 'NetworkTopologyStrategy'
): ReplicationStrategy {
  switch (strategyName) {
    case 'SimpleStrategy':
      return new SimpleStrategy();
    case 'NetworkTopologyStrategy':
      return new NetworkTopologyStrategy();
    default:
      return new NetworkTopologyStrategy(); // Default to NetworkTopologyStrategy
  }
}

/**
 * Cassandra Gossip Engine
 * 
 * Симулирует gossip протокол для обмена информацией о кластере между узлами.
 * Gossip протокол используется в Cassandra для:
 * - Обмена информацией о состоянии узлов
 * - Распространения изменений по кластеру
 * - Определения недоступных узлов (heartbeat timeout)
 * - Синхронизации метаданных (tokens, datacenter, rack)
 */

import { CassandraNode } from '../CassandraRoutingEngine';
import {
  GOSSIP_INTERVAL_MS,
  HEARTBEAT_TIMEOUT_MS,
  GOSSIP_PARTNERS_COUNT,
} from './constants';

export interface GossipNodeState {
  address: string;
  status: 'up' | 'down';
  load: number;
  tokens: number;
  datacenter?: string;
  rack?: string;
  lastHeartbeat: number; // Timestamp of last heartbeat received
  version: number; // Version of node state (increments on changes)
}

export interface GossipMessage {
  from: string; // Source node address
  to: string; // Target node address
  timestamp: number;
  nodeStates: Map<string, GossipNodeState>; // address -> state
}

/**
 * Gossip Engine для симуляции gossip протокола
 */
export class CassandraGossipEngine {
  private nodeStates: Map<string, GossipNodeState> = new Map(); // address -> state
  private gossipPartners: Map<string, Set<string>> = new Map(); // address -> set of partner addresses
  private lastGossipTime: Map<string, number> = new Map(); // address -> last gossip timestamp
  private gossipInterval: number = GOSSIP_INTERVAL_MS;
  private heartbeatTimeout: number = HEARTBEAT_TIMEOUT_MS;
  private partnersCount: number = GOSSIP_PARTNERS_COUNT;

  /**
   * Initialize gossip engine with nodes
   */
  public initialize(nodes: Map<string, CassandraNode>): void {
    const now = Date.now();
    this.nodeStates.clear();
    this.gossipPartners.clear();
    this.lastGossipTime.clear();

    // Initialize node states from current node configuration
    for (const [address, node] of nodes.entries()) {
      this.nodeStates.set(address, {
        address,
        status: node.status,
        load: node.load,
        tokens: node.tokens,
        datacenter: node.datacenter,
        rack: node.rack,
        lastHeartbeat: now,
        version: 1,
      });
      this.lastGossipTime.set(address, now);
    }

    // Initialize gossip partners (each node gossips with a few random partners)
    this.updateGossipPartners();
  }

  /**
   * Update gossip partners for all nodes
   * Each node gossips with a random subset of other nodes
   */
  private updateGossipPartners(): void {
    const nodeAddresses = Array.from(this.nodeStates.keys());

    for (const address of nodeAddresses) {
      const partners = new Set<string>();
      const otherNodes = nodeAddresses.filter(a => a !== address);

      // Select random partners (up to partnersCount)
      const shuffled = [...otherNodes].sort(() => Math.random() - 0.5);
      const selected = shuffled.slice(0, Math.min(this.partnersCount, otherNodes.length));

      for (const partner of selected) {
        partners.add(partner);
      }

      this.gossipPartners.set(address, partners);
    }
  }

  /**
   * Perform gossip exchange (called periodically)
   * Simulates nodes exchanging state information
   */
  public performGossipExchange(currentTime: number): void {
    // Check if it's time for gossip (every gossipInterval)
    const shouldGossip = Array.from(this.lastGossipTime.entries()).some(
      ([address, lastTime]) => currentTime - lastTime >= this.gossipInterval
    );

    if (!shouldGossip) {
      return;
    }

    // Perform gossip for each node
    for (const [address, partners] of this.gossipPartners.entries()) {
      const lastTime = this.lastGossipTime.get(address) || 0;
      
      if (currentTime - lastTime >= this.gossipInterval) {
        // This node gossips with its partners
        for (const partnerAddress of partners) {
          this.exchangeGossip(address, partnerAddress, currentTime);
        }
        
        this.lastGossipTime.set(address, currentTime);
      }
    }

    // Check for nodes that haven't sent heartbeat (mark as down)
    this.checkHeartbeatTimeouts(currentTime);
  }

  /**
   * Exchange gossip between two nodes
   */
  private exchangeGossip(fromAddress: string, toAddress: string, currentTime: number): void {
    const fromState = this.nodeStates.get(fromAddress);
    const toState = this.nodeStates.get(toAddress);

    if (!fromState || !toState) {
      return;
    }

    // Both nodes exchange their knowledge of all nodes
    // In real Cassandra, nodes exchange digests and merge states
    // Here we simulate by merging states (keeping most recent version)

    // Update toState's knowledge about fromState
    this.mergeNodeState(toAddress, fromAddress, fromState, currentTime);

    // Update fromState's knowledge about toState
    this.mergeNodeState(fromAddress, toAddress, toState, currentTime);

    // Also exchange knowledge about other nodes (simplified: exchange all known states)
    for (const [knownAddress, knownState] of this.nodeStates.entries()) {
      if (knownAddress !== fromAddress && knownAddress !== toAddress) {
        // fromState tells toState about knownAddress
        this.mergeNodeState(toAddress, knownAddress, knownState, currentTime);
        
        // toState tells fromState about knownAddress
        this.mergeNodeState(fromAddress, knownAddress, knownState, currentTime);
      }
    }
  }

  /**
   * Merge node state from gossip message
   * Keeps the state with higher version (more recent)
   */
  private mergeNodeState(
    receivingNode: string,
    knownNodeAddress: string,
    knownState: GossipNodeState,
    currentTime: number
  ): void {
    const currentState = this.nodeStates.get(knownNodeAddress);
    
    if (!currentState) {
      // New node discovered - add it
      this.nodeStates.set(knownNodeAddress, {
        ...knownState,
        lastHeartbeat: currentTime,
      });
      // Update gossip partners to include new node
      this.updateGossipPartners();
      return;
    }

    // Merge: keep state with higher version or more recent heartbeat
    if (knownState.version > currentState.version || 
        knownState.lastHeartbeat > currentState.lastHeartbeat) {
      // Update with newer information
      this.nodeStates.set(knownNodeAddress, {
        ...knownState,
        lastHeartbeat: currentTime,
      });
    } else {
      // Update heartbeat timestamp (we heard about this node)
      currentState.lastHeartbeat = currentTime;
    }
  }

  /**
   * Update node state (called when node status/load changes)
   */
  public updateNodeState(
    address: string,
    updates: Partial<Pick<CassandraNode, 'status' | 'load' | 'tokens' | 'datacenter' | 'rack'>>
  ): void {
    const state = this.nodeStates.get(address);
    if (!state) {
      return;
    }

    // Check if any meaningful change occurred
    let hasChange = false;
    
    if (updates.status !== undefined && updates.status !== state.status) {
      state.status = updates.status;
      hasChange = true;
    }
    
    if (updates.load !== undefined && Math.abs(updates.load - state.load) > 0.01) {
      state.load = updates.load;
      hasChange = true;
    }
    
    if (updates.tokens !== undefined && updates.tokens !== state.tokens) {
      state.tokens = updates.tokens;
      hasChange = true;
    }
    
    if (updates.datacenter !== undefined && updates.datacenter !== state.datacenter) {
      state.datacenter = updates.datacenter;
      hasChange = true;
    }
    
    if (updates.rack !== undefined && updates.rack !== state.rack) {
      state.rack = updates.rack;
      hasChange = true;
    }

    if (hasChange) {
      // Increment version to indicate state change
      state.version++;
      state.lastHeartbeat = Date.now();
    }
  }

  /**
   * Check for nodes that haven't sent heartbeat (mark as down)
   */
  private checkHeartbeatTimeouts(currentTime: number): void {
    for (const [address, state] of this.nodeStates.entries()) {
      const timeSinceHeartbeat = currentTime - state.lastHeartbeat;
      
      if (timeSinceHeartbeat > this.heartbeatTimeout && state.status === 'up') {
        // Node hasn't sent heartbeat - mark as down
        state.status = 'down';
        state.version++;
      }
    }
  }

  /**
   * Get healthy nodes based on gossip state
   */
  public getHealthyNodes(): Set<string> {
    const healthy = new Set<string>();
    
    for (const [address, state] of this.nodeStates.entries()) {
      if (state.status === 'up') {
        const timeSinceHeartbeat = Date.now() - state.lastHeartbeat;
        if (timeSinceHeartbeat <= this.heartbeatTimeout) {
          healthy.add(address);
        }
      }
    }
    
    return healthy;
  }

  /**
   * Get node state from gossip
   */
  public getNodeState(address: string): GossipNodeState | undefined {
    return this.nodeStates.get(address);
  }

  /**
   * Get all node states
   */
  public getAllNodeStates(): Map<string, GossipNodeState> {
    return new Map(this.nodeStates);
  }

  /**
   * Add a new node to gossip (when node joins cluster)
   */
  public addNode(node: CassandraNode): void {
    const now = Date.now();
    this.nodeStates.set(node.address, {
      address: node.address,
      status: node.status,
      load: node.load,
      tokens: node.tokens,
      datacenter: node.datacenter,
      rack: node.rack,
      lastHeartbeat: now,
      version: 1,
    });
    this.lastGossipTime.set(node.address, now);
    this.updateGossipPartners();
  }

  /**
   * Remove a node from gossip (when node leaves cluster)
   */
  public removeNode(address: string): void {
    this.nodeStates.delete(address);
    this.gossipPartners.delete(address);
    this.lastGossipTime.delete(address);
    
    // Remove from other nodes' partner lists
    for (const partners of this.gossipPartners.values()) {
      partners.delete(address);
    }
  }

  /**
   * Sync with actual node configuration (called periodically to sync gossip state with real state)
   */
  public syncWithNodes(nodes: Map<string, CassandraNode>): void {
    const now = Date.now();
    
    // Update states for existing nodes
    for (const [address, node] of nodes.entries()) {
      this.updateNodeState(address, {
        status: node.status,
        load: node.load,
        tokens: node.tokens,
        datacenter: node.datacenter,
        rack: node.rack,
      });
    }

    // Remove nodes that no longer exist in actual configuration
    const actualAddresses = new Set(nodes.keys());
    for (const address of this.nodeStates.keys()) {
      if (!actualAddresses.has(address)) {
        this.removeNode(address);
      }
    }

    // Add new nodes
    for (const [address, node] of nodes.entries()) {
      if (!this.nodeStates.has(address)) {
        this.addNode(node);
      }
    }
  }

  /**
   * Get gossip metrics
   */
  public getMetrics(): {
    totalNodes: number;
    healthyNodes: number;
    downNodes: number;
    averageLoad: number;
  } {
    const healthyNodes = this.getHealthyNodes();
    let totalLoad = 0;
    let nodeCount = 0;

    for (const state of this.nodeStates.values()) {
      if (state.status === 'up') {
        totalLoad += state.load;
        nodeCount++;
      }
    }

    return {
      totalNodes: this.nodeStates.size,
      healthyNodes: healthyNodes.size,
      downNodes: this.nodeStates.size - healthyNodes.size,
      averageLoad: nodeCount > 0 ? totalLoad / nodeCount : 0,
    };
  }
}

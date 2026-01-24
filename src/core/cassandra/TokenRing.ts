/**
 * Cassandra Token Ring
 * 
 * Implements token ring topology for Cassandra data distribution.
 * Uses Murmur3Partitioner to hash partition keys and determine replica placement.
 */

import { MAX_TOKEN, DEFAULT_NODE_TOKENS } from './constants';

export interface TokenRange {
  start: number;
  end: number;
  nodeAddress: string;
}

export interface NodeTokenInfo {
  address: string;
  tokens: number[];
  datacenter?: string;
  rack?: string;
}

/**
 * Murmur3 hash function implementation for partition key hashing
 * Simplified version for simulation purposes
 */
function murmur3Hash(key: string): number {
  // Simplified Murmur3 hash for simulation
  // In real Cassandra, this uses the full Murmur3 algorithm
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Convert to signed 64-bit integer range (-2^63 to 2^63-1)
  // Using JavaScript's safe integer range for simulation
  const maxSafe = Number.MAX_SAFE_INTEGER;
  const minSafe = Number.MIN_SAFE_INTEGER;
  hash = hash % maxSafe;
  
  // Map to token range
  if (hash < 0) {
    hash = maxSafe + hash;
  }
  
  return hash;
}

/**
 * Token Ring for Cassandra cluster
 * 
 * Manages token distribution and replica placement based on token ranges.
 */
export class CassandraTokenRing {
  private nodeTokens: Map<string, NodeTokenInfo> = new Map();
  private tokenRanges: TokenRange[] = [];
  private sortedTokens: Array<{ token: number; nodeAddress: string }> = [];

  /**
   * Initialize token ring with nodes
   */
  public initialize(nodes: Array<{ address: string; tokens: number; datacenter?: string; rack?: string }>): void {
    this.nodeTokens.clear();
    this.tokenRanges = [];
    this.sortedTokens = [];

    // Generate tokens for each node
    for (const node of nodes) {
      const numTokens = node.tokens || DEFAULT_NODE_TOKENS;
      const tokens: number[] = [];
      
      // Generate tokens evenly distributed across the ring
      // Each node gets numTokens tokens spread across the ring
      for (let i = 0; i < numTokens; i++) {
        // Distribute tokens evenly: each token is MAX_TOKEN / (totalTokens * numTokens) apart
        const totalNodes = nodes.length;
        const totalTokens = totalNodes * numTokens;
        const tokenStep = MAX_TOKEN / totalTokens;
        const baseToken = (nodes.indexOf(node) * numTokens + i) * tokenStep;
        const token = Math.floor(baseToken) % MAX_TOKEN;
        tokens.push(token);
      }

      // Sort tokens for this node
      tokens.sort((a, b) => a - b);

      this.nodeTokens.set(node.address, {
        address: node.address,
        tokens,
        datacenter: node.datacenter,
        rack: node.rack,
      });

      // Add to sorted tokens list
      for (const token of tokens) {
        this.sortedTokens.push({ token, nodeAddress: node.address });
      }
    }

    // Sort all tokens
    this.sortedTokens.sort((a, b) => a.token - b.token);

    // Build token ranges
    this.buildTokenRanges();
  }

  /**
   * Build token ranges for the ring
   */
  private buildTokenRanges(): void {
    this.tokenRanges = [];

    if (this.sortedTokens.length === 0) {
      return;
    }

    // Each token defines the start of a range that extends to the next token
    for (let i = 0; i < this.sortedTokens.length; i++) {
      const current = this.sortedTokens[i];
      const next = this.sortedTokens[(i + 1) % this.sortedTokens.length];

      let start = current.token;
      let end = next.token;

      // Handle wrap-around (ring topology)
      if (end <= start) {
        end = MAX_TOKEN;
      }

      this.tokenRanges.push({
        start,
        end,
        nodeAddress: current.nodeAddress,
      });
    }
  }

  /**
   * Get token for a partition key
   */
  public getToken(partitionKey: string): number {
    // Convert partition key to string for hashing
    const keyString = typeof partitionKey === 'string' 
      ? partitionKey 
      : JSON.stringify(partitionKey);
    
    return murmur3Hash(keyString);
  }

  /**
   * Find the node that owns a token (primary replica)
   */
  public findOwnerNode(token: number): string | null {
    if (this.tokenRanges.length === 0) {
      return null;
    }

    // Find the range that contains this token
    for (const range of this.tokenRanges) {
      if (range.start <= token && token < range.end) {
        return range.nodeAddress;
      }
    }

    // Handle wrap-around: if token is at the end of the ring
    const lastRange = this.tokenRanges[this.tokenRanges.length - 1];
    if (token >= lastRange.end || token < this.tokenRanges[0].start) {
      return lastRange.nodeAddress;
    }

    // Fallback: return first node
    return this.tokenRanges[0]?.nodeAddress || null;
  }

  /**
   * Get primary replica node for a partition key
   */
  public getPrimaryReplica(partitionKey: string): string | null {
    const token = this.getToken(partitionKey);
    return this.findOwnerNode(token);
  }

  /**
   * Get all tokens for a node
   */
  public getNodeTokens(nodeAddress: string): number[] {
    return this.nodeTokens.get(nodeAddress)?.tokens || [];
  }

  /**
   * Get token ranges for a node
   */
  public getNodeTokenRanges(nodeAddress: string): TokenRange[] {
    return this.tokenRanges.filter(range => range.nodeAddress === nodeAddress);
  }

  /**
   * Get all nodes in the ring
   */
  public getNodes(): string[] {
    return Array.from(this.nodeTokens.keys());
  }

  /**
   * Get node info
   */
  public getNodeInfo(nodeAddress: string): NodeTokenInfo | null {
    return this.nodeTokens.get(nodeAddress) || null;
  }

  /**
   * Get next node in the ring (for SimpleStrategy)
   */
  public getNextNode(nodeAddress: string): string | null {
    const nodes = this.getNodes();
    const index = nodes.indexOf(nodeAddress);
    if (index === -1) {
      return null;
    }
    return nodes[(index + 1) % nodes.length];
  }

  /**
   * Get nodes in order starting from a given node
   */
  public getNodesInOrder(startNode: string): string[] {
    const nodes = this.getNodes();
    const startIndex = nodes.indexOf(startNode);
    if (startIndex === -1) {
      return nodes;
    }
    return [...nodes.slice(startIndex), ...nodes.slice(0, startIndex)];
  }

  /**
   * Update node status (add/remove nodes)
   */
  public updateNodes(nodes: Array<{ address: string; tokens: number; datacenter?: string; rack?: string }>): void {
    this.initialize(nodes);
  }

  /**
   * Get all token ranges
   */
  public getAllTokenRanges(): TokenRange[] {
    return [...this.tokenRanges];
  }

  /**
   * Get sorted tokens
   */
  public getSortedTokens(): Array<{ token: number; nodeAddress: string }> {
    return [...this.sortedTokens];
  }
}

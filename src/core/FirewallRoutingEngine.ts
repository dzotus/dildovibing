/**
 * Firewall Routing Engine
 * Handles network-level packet filtering, connection tracking, and rule matching
 */

import { CanvasNode } from '@/types';

export interface FirewallRule {
  id: string;
  name: string;
  action: 'allow' | 'deny' | 'reject';
  protocol: 'tcp' | 'udp' | 'icmp' | 'all';
  source?: string; // IP address or CIDR (e.g., "192.168.1.0/24" or "10.0.0.1")
  destination?: string; // IP address or CIDR
  port?: number; // Port number (for TCP/UDP)
  sourcePort?: number; // Source port (for TCP/UDP)
  enabled: boolean;
  priority: number; // Higher priority = evaluated first
  hits?: number; // Number of times this rule matched
}

export interface FirewallLog {
  id: string;
  timestamp: number;
  action: 'allowed' | 'blocked' | 'rejected';
  source: string;
  destination: string;
  protocol: string;
  port?: number;
  sourcePort?: number;
  ruleId?: string;
  ruleName?: string;
  reason?: string;
}

export interface FirewallPacket {
  source: string; // IP address
  destination: string; // IP address
  protocol: 'tcp' | 'udp' | 'icmp' | 'all';
  port?: number; // Destination port
  sourcePort?: number; // Source port
  timestamp?: number;
}

export interface FirewallResponse {
  allowed: boolean;
  blocked: boolean;
  action: 'allow' | 'deny' | 'reject';
  latency: number;
  matchedRule?: FirewallRule;
  error?: string;
}

export interface FirewallConfig {
  enableFirewall?: boolean;
  enableLogging?: boolean;
  enableIntrusionDetection?: boolean;
  enableStatefulInspection?: boolean; // Track connection state
  defaultPolicy?: 'allow' | 'deny' | 'reject';
  logRetention?: number; // Days
  rules?: FirewallRule[];
}

export interface FirewallStats {
  totalPackets: number;
  allowedPackets: number;
  blockedPackets: number;
  rejectedPackets: number;
  activeRules: number;
  totalConnections: number;
  activeConnections: number;
}

/**
 * Connection state for stateful inspection
 */
interface ConnectionState {
  source: string;
  destination: string;
  sourcePort: number;
  destinationPort: number;
  protocol: string;
  state: 'new' | 'established' | 'related' | 'invalid';
  firstSeen: number;
  lastSeen: number;
  packets: number;
}

/**
 * Firewall Routing Engine
 * Simulates network-level firewall packet filtering behavior
 */
export class FirewallRoutingEngine {
  private config: FirewallConfig | null = null;
  private rules: Map<string, FirewallRule> = new Map();
  private logs: FirewallLog[] = [];
  private stats: FirewallStats = {
    totalPackets: 0,
    allowedPackets: 0,
    blockedPackets: 0,
    rejectedPackets: 0,
    activeRules: 0,
    totalConnections: 0,
    activeConnections: 0,
  };

  // Stateful inspection: track active connections
  private connections: Map<string, ConnectionState> = new Map();
  private readonly MAX_CONNECTIONS = 10000;
  private readonly CONNECTION_TIMEOUT_MS = 300000; // 5 minutes

  // Log retention
  private readonly MAX_LOGS = 10000;

  /**
   * Initialize firewall configuration from node
   */
  public initializeConfig(node: CanvasNode): void {
    const raw = (node.data.config || {}) as any;

    this.config = {
      enableFirewall: raw.enableFirewall ?? true,
      enableLogging: raw.enableLogging ?? true,
      enableIntrusionDetection: raw.enableIntrusionDetection ?? false,
      enableStatefulInspection: raw.enableStatefulInspection ?? true,
      defaultPolicy: raw.defaultPolicy || 'deny',
      logRetention: raw.logRetention || 30,
      rules: Array.isArray(raw.rules) ? raw.rules : [],
    };

    // Load rules
    this.rules.clear();
    if (this.config.rules) {
      for (const rule of this.config.rules) {
        if (rule.id && rule.enabled) {
          this.rules.set(rule.id, rule);
        }
      }
    }

    // Update stats
    this.stats.activeRules = Array.from(this.rules.values()).filter(r => r.enabled).length;

    // Clean old logs
    this.cleanOldLogs();
  }

  /**
   * Process incoming packet through firewall
   */
  public processPacket(packet: FirewallPacket): FirewallResponse {
    const startTime = performance.now();
    const timestamp = packet.timestamp || Date.now();

    // If firewall is disabled, allow all
    if (!this.config?.enableFirewall) {
      return {
        allowed: true,
        blocked: false,
        action: 'allow',
        latency: performance.now() - startTime,
      };
    }

    this.stats.totalPackets++;

    // Check stateful inspection first (if enabled)
    if (this.config?.enableStatefulInspection) {
      const connectionKey = this.getConnectionKey(packet);
      const existingConnection = this.connections.get(connectionKey);

      if (existingConnection) {
        // Update connection state
        existingConnection.lastSeen = timestamp;
        existingConnection.packets++;
        existingConnection.state = 'established';

        // Allow established connections (if policy allows)
        // In real firewalls, established connections are typically allowed
        if (existingConnection.state === 'established') {
          this.stats.allowedPackets++;
          this.logPacket(packet, 'allowed', undefined, 'Established connection');
          return {
            allowed: true,
            blocked: false,
            action: 'allow',
            latency: performance.now() - startTime,
          };
        }
      } else {
        // New connection
        if (this.connections.size < this.MAX_CONNECTIONS) {
          this.connections.set(connectionKey, {
            source: packet.source,
            destination: packet.destination,
            sourcePort: packet.sourcePort || 0,
            destinationPort: packet.port || 0,
            protocol: packet.protocol,
            state: 'new',
            firstSeen: timestamp,
            lastSeen: timestamp,
            packets: 1,
          });
          this.stats.totalConnections++;
        }
      }
    }

    // Evaluate rules in priority order (higher priority first)
    const sortedRules = Array.from(this.rules.values())
      .filter(r => r.enabled)
      .sort((a, b) => b.priority - a.priority);

    for (const rule of sortedRules) {
      const matchResult = this.matchRule(rule, packet);
      if (matchResult.matched) {
        // Update rule hits
        rule.hits = (rule.hits || 0) + 1;

        // Log the packet
        if (this.config?.enableLogging) {
          this.logPacket(packet, rule.action === 'allow' ? 'allowed' : rule.action === 'deny' ? 'blocked' : 'rejected', rule, matchResult.reason);
        }

        // Update stats
        if (rule.action === 'allow') {
          this.stats.allowedPackets++;
        } else if (rule.action === 'deny') {
          this.stats.blockedPackets++;
        } else {
          this.stats.rejectedPackets++;
        }

        // Update connection state for allowed packets
        if (rule.action === 'allow' && this.config?.enableStatefulInspection) {
          const connectionKey = this.getConnectionKey(packet);
          const connection = this.connections.get(connectionKey);
          if (connection) {
            connection.state = 'established';
          }
        }

        return {
          allowed: rule.action === 'allow',
          blocked: rule.action === 'deny' || rule.action === 'reject',
          action: rule.action,
          latency: performance.now() - startTime,
          matchedRule: rule,
        };
      }
    }

    // No rule matched - apply default policy
    const defaultAction = this.config?.defaultPolicy || 'deny';
    const action = defaultAction === 'allow' ? 'allowed' : defaultAction === 'deny' ? 'blocked' : 'rejected';

    if (this.config?.enableLogging) {
      this.logPacket(packet, action, undefined, `Default policy: ${defaultAction}`);
    }

    if (defaultAction === 'allow') {
      this.stats.allowedPackets++;
    } else if (defaultAction === 'deny') {
      this.stats.blockedPackets++;
    } else {
      this.stats.rejectedPackets++;
    }

    return {
      allowed: defaultAction === 'allow',
      blocked: defaultAction === 'deny' || defaultAction === 'reject',
      action: defaultAction,
      latency: performance.now() - startTime,
    };
  }

  /**
   * Check if packet matches a rule
   */
  private matchRule(rule: FirewallRule, packet: FirewallPacket): {
    matched: boolean;
    reason?: string;
  } {
    // Check protocol
    if (rule.protocol !== 'all' && rule.protocol !== packet.protocol) {
      return { matched: false };
    }

    // Check source IP
    if (rule.source && !this.matchIP(packet.source, rule.source)) {
      return { matched: false };
    }

    // Check destination IP
    if (rule.destination && !this.matchIP(packet.destination, rule.destination)) {
      return { matched: false };
    }

    // Check port (for TCP/UDP)
    if ((packet.protocol === 'tcp' || packet.protocol === 'udp') && rule.port !== undefined) {
      if (packet.port !== rule.port) {
        return { matched: false };
      }
    }

    // Check source port (for TCP/UDP)
    if ((packet.protocol === 'tcp' || packet.protocol === 'udp') && rule.sourcePort !== undefined) {
      if (packet.sourcePort !== rule.sourcePort) {
        return { matched: false };
      }
    }

    return { matched: true, reason: `Matched rule: ${rule.name}` };
  }

  /**
   * Check if IP matches CIDR or exact IP
   */
  private matchIP(ip: string, rule: string): boolean {
    // Exact match
    if (ip === rule) {
      return true;
    }

    // CIDR notation (e.g., "192.168.1.0/24")
    if (rule.includes('/')) {
      const [network, prefixLength] = rule.split('/');
      const prefix = parseInt(prefixLength, 10);
      
      if (isNaN(prefix) || prefix < 0 || prefix > 32) {
        return false;
      }

      const ipNum = this.ipToNumber(ip);
      const networkNum = this.ipToNumber(network);
      const mask = (0xFFFFFFFF << (32 - prefix)) >>> 0;

      return (ipNum & mask) === (networkNum & mask);
    }

    return false;
  }

  /**
   * Convert IP address to number
   */
  private ipToNumber(ip: string): number {
    const parts = ip.split('.');
    if (parts.length !== 4) {
      return 0;
    }
    return (parseInt(parts[0], 10) << 24) +
           (parseInt(parts[1], 10) << 16) +
           (parseInt(parts[2], 10) << 8) +
           parseInt(parts[3], 10);
  }

  /**
   * Generate connection key for stateful inspection
   */
  private getConnectionKey(packet: FirewallPacket): string {
    return `${packet.source}:${packet.sourcePort || 0}-${packet.destination}:${packet.port || 0}-${packet.protocol}`;
  }

  /**
   * Log packet processing
   */
  private logPacket(packet: FirewallPacket, action: 'allowed' | 'blocked' | 'rejected', rule?: FirewallRule, reason?: string): void {
    if (!this.config?.enableLogging) {
      return;
    }

    const log: FirewallLog = {
      id: `log-${Date.now()}-${Math.random()}`,
      timestamp: packet.timestamp || Date.now(),
      action,
      source: packet.source,
      destination: packet.destination,
      protocol: packet.protocol,
      port: packet.port,
      sourcePort: packet.sourcePort,
      ruleId: rule?.id,
      ruleName: rule?.name,
      reason: reason || rule?.name,
    };

    this.logs.push(log);

    // Keep only recent logs
    if (this.logs.length > this.MAX_LOGS) {
      this.logs.shift();
    }
  }

  /**
   * Clean old logs based on retention policy
   */
  private cleanOldLogs(): void {
    if (!this.config?.logRetention) {
      return;
    }

    const retentionMs = this.config.logRetention * 24 * 60 * 60 * 1000;
    const cutoffTime = Date.now() - retentionMs;

    this.logs = this.logs.filter(log => log.timestamp >= cutoffTime);
  }

  /**
   * Clean old connections
   */
  public cleanupConnections(): void {
    const now = Date.now();
    const timeout = this.CONNECTION_TIMEOUT_MS;

    for (const [key, connection] of this.connections.entries()) {
      if (now - connection.lastSeen > timeout) {
        this.connections.delete(key);
      }
    }

    this.stats.activeConnections = this.connections.size;
  }

  /**
   * Get firewall statistics
   */
  public getStats(): FirewallStats {
    this.stats.activeConnections = this.connections.size;
    return { ...this.stats };
  }

  /**
   * Get firewall logs
   */
  public getLogs(limit?: number): FirewallLog[] {
    const logs = [...this.logs].reverse(); // Most recent first
    return limit ? logs.slice(0, limit) : logs;
  }

  /**
   * Get firewall rules
   */
  public getRules(): FirewallRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Get configuration
   */
  public getConfig(): FirewallConfig | null {
    return this.config;
  }
}


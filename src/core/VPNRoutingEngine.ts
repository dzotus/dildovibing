/**
 * VPN Routing Engine
 * Handles VPN tunnel management, connection tracking, encryption/decryption simulation
 */

import { CanvasNode } from '@/types';

export interface VPNConnection {
  id: string;
  username: string;
  remoteIP: string;
  localIP?: string;
  status: 'connected' | 'disconnected' | 'connecting' | 'disconnecting';
  protocol: 'openvpn' | 'ipsec' | 'wireguard' | 'l2tp' | 'pptp';
  connectedAt?: number;
  bytesIn: number;
  bytesOut: number;
  packetsIn: number;
  packetsOut: number;
  lastActivity?: number;
  encryptionAlgorithm?: 'aes-128' | 'aes-256' | 'chacha20-poly1305';
  compressionEnabled?: boolean;
}

export interface VPNTunnel {
  id: string;
  name: string;
  type: 'site-to-site' | 'remote-access';
  protocol: 'openvpn' | 'ipsec' | 'wireguard';
  localEndpoint: string;
  remoteEndpoint: string;
  status: 'up' | 'down' | 'connecting' | 'disconnecting';
  connections: string[]; // Connection IDs using this tunnel
  bytesIn: number;
  bytesOut: number;
  packetsIn: number;
  packetsOut: number;
  lastActivity?: number;
  encryptionAlgorithm?: 'aes-128' | 'aes-256' | 'chacha20-poly1305';
  compressionEnabled?: boolean;
  keepAliveEnabled?: boolean;
  keepAliveInterval?: number;
}

export interface VPNPacket {
  source: string;
  destination: string;
  protocol: 'tcp' | 'udp';
  port?: number;
  sourcePort?: number;
  payload?: any;
  encrypted?: boolean;
  connectionId?: string;
  tunnelId?: string;
  timestamp?: number;
}

export interface VPNProcessResult {
  success: boolean;
  encrypted: boolean;
  latency: number;
  connectionId?: string;
  tunnelId?: string;
  error?: string;
  bytesProcessed: number;
}

export interface VPNConfig {
  vpnProtocol?: 'openvpn' | 'ipsec' | 'wireguard';
  encryptionAlgorithm?: 'aes-128' | 'aes-256' | 'chacha20-poly1305';
  enableCompression?: boolean;
  enableKeepAlive?: boolean;
  maxConnections?: number;
  connectionTimeout?: number;
  enableSSL?: boolean;
  sslPort?: number;
  enableIPSec?: boolean;
  ipsecPort?: number;
  enableL2TP?: boolean;
  enablePPTP?: boolean;
  enableRadius?: boolean;
  radiusServer?: string;
  enableMFA?: boolean;
  mfaProvider?: 'totp' | 'sms' | 'email';
  connections?: VPNConnection[];
  tunnels?: VPNTunnel[];
}

export interface VPNStats {
  totalConnections: number;
  activeConnections: number;
  totalTunnels: number;
  activeTunnels: number;
  totalBytesIn: number;
  totalBytesOut: number;
  totalPacketsIn: number;
  totalPacketsOut: number;
  encryptionOperations: number;
  compressionOperations: number;
  failedConnections: number;
  averageLatency: number;
}

/**
 * VPN Routing Engine
 * Simulates VPN concentrator behavior: tunnel management, encryption, connection tracking
 */
export class VPNRoutingEngine {
  private config: VPNConfig | null = null;
  private connections: Map<string, VPNConnection> = new Map();
  private tunnels: Map<string, VPNTunnel> = new Map();
  private stats: VPNStats = {
    totalConnections: 0,
    activeConnections: 0,
    totalTunnels: 0,
    activeTunnels: 0,
    totalBytesIn: 0,
    totalBytesOut: 0,
    totalPacketsIn: 0,
    totalPacketsOut: 0,
    encryptionOperations: 0,
    compressionOperations: 0,
    failedConnections: 0,
    averageLatency: 0,
  };

  private latencyHistory: number[] = [];
  private readonly MAX_LATENCY_HISTORY = 200;
  private readonly CONNECTION_TIMEOUT_MS = 300000; // 5 minutes default

  /**
   * Initialize VPN configuration from node
   */
  public initializeConfig(node: CanvasNode): void {
    const raw = (node.data.config || {}) as any;

    this.config = {
      vpnProtocol: raw.vpnProtocol || 'openvpn',
      encryptionAlgorithm: raw.encryptionAlgorithm || 'aes-256',
      enableCompression: raw.enableCompression ?? true,
      enableKeepAlive: raw.enableKeepAlive ?? true,
      maxConnections: raw.maxConnections || 1000,
      connectionTimeout: raw.connectionTimeout || 300,
      enableSSL: raw.enableSSL ?? true,
      sslPort: raw.sslPort || 443,
      enableIPSec: raw.enableIPSec ?? true,
      ipsecPort: raw.ipsecPort || 500,
      enableL2TP: raw.enableL2TP ?? false,
      enablePPTP: raw.enablePPTP ?? false,
      enableRadius: raw.enableRadius ?? false,
      radiusServer: raw.radiusServer || '',
      enableMFA: raw.enableMFA ?? false,
      mfaProvider: raw.mfaProvider || 'totp',
      connections: Array.isArray(raw.connections) ? raw.connections : [],
      tunnels: Array.isArray(raw.tunnels) ? raw.tunnels : [],
    };

    // Load connections
    this.connections.clear();
    if (this.config.connections) {
      for (const conn of this.config.connections) {
        if (conn.id) {
          this.connections.set(conn.id, {
            ...conn,
            bytesIn: conn.bytesIn || 0,
            bytesOut: conn.bytesOut || 0,
            packetsIn: conn.packetsIn || 0,
            packetsOut: conn.packetsOut || 0,
            protocol: conn.protocol || this.config.vpnProtocol || 'openvpn',
            encryptionAlgorithm: conn.encryptionAlgorithm || this.config.encryptionAlgorithm,
            compressionEnabled: conn.compressionEnabled ?? this.config.enableCompression,
            lastActivity: conn.lastActivity || Date.now(),
          });
        }
      }
    }

    // Load tunnels
    this.tunnels.clear();
    if (this.config.tunnels) {
      for (const tunnel of this.config.tunnels) {
        if (tunnel.id) {
          this.tunnels.set(tunnel.id, {
            ...tunnel,
            bytesIn: tunnel.bytesIn || 0,
            bytesOut: tunnel.bytesOut || 0,
            packetsIn: tunnel.packetsIn || 0,
            packetsOut: tunnel.packetsOut || 0,
            protocol: tunnel.protocol || this.config.vpnProtocol || 'openvpn',
            encryptionAlgorithm: tunnel.encryptionAlgorithm || this.config.encryptionAlgorithm,
            compressionEnabled: tunnel.compressionEnabled ?? this.config.enableCompression,
            keepAliveEnabled: tunnel.keepAliveEnabled ?? this.config.enableKeepAlive,
            keepAliveInterval: tunnel.keepAliveInterval || 30,
            connections: tunnel.connections || [],
            lastActivity: tunnel.lastActivity || Date.now(),
          });
        }
      }
    }

    // Update stats
    this.updateStats();
  }

  /**
   * Process packet through VPN
   */
  public processPacket(packet: VPNPacket): VPNProcessResult {
    const startTime = performance.now();
    const timestamp = packet.timestamp || Date.now();

    // Find connection or tunnel
    let connection: VPNConnection | undefined;
    let tunnel: VPNTunnel | undefined;

    if (packet.connectionId) {
      connection = this.connections.get(packet.connectionId);
    } else if (packet.tunnelId) {
      tunnel = this.tunnels.get(packet.tunnelId);
    } else {
      // Try to find connection by source IP
      for (const conn of this.connections.values()) {
        if (conn.remoteIP === packet.source && conn.status === 'connected') {
          connection = conn;
          break;
        }
      }
    }

    // If no connection found, create a simulated one for processing
    if (!connection && !tunnel) {
      // Simulate packet processing without active connection (might be dropped)
      const latency = this.calculateEncryptionLatency(this.config?.encryptionAlgorithm || 'aes-256');
      this.recordLatency(latency);
      
      return {
        success: false,
        encrypted: false,
        latency,
        error: 'No active VPN connection or tunnel found',
        bytesProcessed: 0,
      };
    }

    // Determine if packet needs encryption/decryption
    const needsEncryption = Boolean(!packet.encrypted && connection?.status === 'connected');
    const needsDecryption = Boolean(packet.encrypted && connection?.status === 'connected');

    // Calculate processing latency based on encryption/compression
    let processingLatency = 0;
    let bytesProcessed = 0;

    if (needsEncryption || needsDecryption) {
      processingLatency += this.calculateEncryptionLatency(
        connection?.encryptionAlgorithm || tunnel?.encryptionAlgorithm || this.config?.encryptionAlgorithm || 'aes-256'
      );
      this.stats.encryptionOperations++;
    }

    if (connection?.compressionEnabled || tunnel?.compressionEnabled || this.config?.enableCompression) {
      processingLatency += this.calculateCompressionLatency();
      this.stats.compressionOperations++;
    }

    // Estimate packet size
    const packetSize = this.estimatePacketSize(packet);
    bytesProcessed = packetSize;

    // Update connection/tunnel stats
    if (connection) {
      if (needsEncryption || needsDecryption) {
        connection.bytesIn += packetSize;
        connection.packetsIn++;
        this.stats.totalBytesIn += packetSize;
        this.stats.totalPacketsIn++;
      } else {
        connection.bytesOut += packetSize;
        connection.packetsOut++;
        this.stats.totalBytesOut += packetSize;
        this.stats.totalPacketsOut++;
      }
      connection.lastActivity = timestamp;
    }

    if (tunnel) {
      if (needsEncryption || needsDecryption) {
        tunnel.bytesIn += packetSize;
        tunnel.packetsIn++;
      } else {
        tunnel.bytesOut += packetSize;
        tunnel.packetsOut++;
      }
      tunnel.lastActivity = timestamp;
    }

    this.recordLatency(processingLatency);
    this.updateStats();

    return {
      success: true,
      encrypted: Boolean(needsEncryption || (packet.encrypted && needsDecryption)),
      latency: processingLatency,
      connectionId: connection?.id,
      tunnelId: tunnel?.id,
      bytesProcessed,
    };
  }

  /**
   * Create or update VPN connection
   */
  public createConnection(connection: VPNConnection): void {
    if (this.connections.size >= (this.config?.maxConnections || 1000)) {
      this.stats.failedConnections++;
      throw new Error('Maximum connections reached');
    }

    this.connections.set(connection.id, {
      ...connection,
      bytesIn: connection.bytesIn || 0,
      bytesOut: connection.bytesOut || 0,
      packetsIn: connection.packetsIn || 0,
      packetsOut: connection.packetsOut || 0,
      protocol: connection.protocol || this.config?.vpnProtocol || 'openvpn',
      encryptionAlgorithm: connection.encryptionAlgorithm || this.config?.encryptionAlgorithm,
      compressionEnabled: connection.compressionEnabled ?? (this.config?.enableCompression ?? true),
      lastActivity: connection.lastActivity || Date.now(),
    });

    this.stats.totalConnections++;
    this.updateStats();
  }

  /**
   * Update connection status
   */
  public updateConnectionStatus(connectionId: string, status: VPNConnection['status']): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.status = status;
      if (status === 'connected') {
        connection.connectedAt = connection.connectedAt || Date.now();
      }
      this.updateStats();
    }
  }

  /**
   * Remove connection
   */
  public removeConnection(connectionId: string): void {
    if (this.connections.delete(connectionId)) {
      this.updateStats();
    }
  }

  /**
   * Create or update VPN tunnel
   */
  public createTunnel(tunnel: VPNTunnel): void {
    this.tunnels.set(tunnel.id, {
      ...tunnel,
      bytesIn: tunnel.bytesIn || 0,
      bytesOut: tunnel.bytesOut || 0,
      packetsIn: tunnel.packetsIn || 0,
      packetsOut: tunnel.packetsOut || 0,
      protocol: tunnel.protocol || this.config?.vpnProtocol || 'openvpn',
      encryptionAlgorithm: tunnel.encryptionAlgorithm || this.config?.encryptionAlgorithm,
      compressionEnabled: tunnel.compressionEnabled ?? this.config?.enableCompression,
      keepAliveEnabled: tunnel.keepAliveEnabled ?? this.config?.enableKeepAlive,
      keepAliveInterval: tunnel.keepAliveInterval || 30,
      connections: tunnel.connections || [],
      lastActivity: tunnel.lastActivity || Date.now(),
    });

    this.stats.totalTunnels++;
    this.updateStats();
  }

  /**
   * Update tunnel status
   */
  public updateTunnelStatus(tunnelId: string, status: VPNTunnel['status']): void {
    const tunnel = this.tunnels.get(tunnelId);
    if (tunnel) {
      tunnel.status = status;
      this.updateStats();
    }
  }

  /**
   * Remove tunnel
   */
  public removeTunnel(tunnelId: string): void {
    if (this.tunnels.delete(tunnelId)) {
      this.updateStats();
    }
  }

  /**
   * Get all connections
   */
  public getConnections(): VPNConnection[] {
    return Array.from(this.connections.values());
  }

  /**
   * Get all tunnels
   */
  public getTunnels(): VPNTunnel[] {
    return Array.from(this.tunnels.values());
  }

  /**
   * Get statistics
   */
  public getStats(): VPNStats {
    return { ...this.stats };
  }

  /**
   * Get configuration
   */
  public getConfig(): VPNConfig | null {
    return this.config ? { ...this.config } : null;
  }

  /**
   * Calculate encryption latency based on algorithm
   */
  private calculateEncryptionLatency(algorithm: string): number {
    // Simulated latency in milliseconds
    switch (algorithm) {
      case 'aes-128':
        return 0.5 + Math.random() * 0.5; // 0.5-1ms
      case 'aes-256':
        return 0.8 + Math.random() * 0.7; // 0.8-1.5ms
      case 'chacha20-poly1305':
        return 0.6 + Math.random() * 0.6; // 0.6-1.2ms
      default:
        return 1 + Math.random() * 1; // 1-2ms default
    }
  }

  /**
   * Calculate compression latency
   */
  private calculateCompressionLatency(): number {
    return 0.2 + Math.random() * 0.3; // 0.2-0.5ms
  }

  /**
   * Estimate packet size
   */
  private estimatePacketSize(packet: VPNPacket): number {
    if (packet.payload) {
      if (typeof packet.payload === 'string') {
        return Buffer.byteLength(packet.payload, 'utf8');
      }
      if (typeof packet.payload === 'object') {
        return Buffer.byteLength(JSON.stringify(packet.payload), 'utf8');
      }
    }
    // Default packet size estimate
    return 1500; // Typical MTU size
  }

  /**
   * Record latency for statistics
   */
  private recordLatency(latency: number): void {
    this.latencyHistory.push(latency);
    if (this.latencyHistory.length > this.MAX_LATENCY_HISTORY) {
      this.latencyHistory.shift();
    }

    // Calculate average latency
    const sum = this.latencyHistory.reduce((a, b) => a + b, 0);
    this.stats.averageLatency = sum / this.latencyHistory.length;
  }

  /**
   * Update statistics
   */
  private updateStats(): void {
    this.stats.activeConnections = Array.from(this.connections.values())
      .filter(c => c.status === 'connected').length;
    
    this.stats.activeTunnels = Array.from(this.tunnels.values())
      .filter(t => t.status === 'up').length;

    // Calculate total bytes
    let totalBytesIn = 0;
    let totalBytesOut = 0;
    let totalPacketsIn = 0;
    let totalPacketsOut = 0;

    for (const conn of this.connections.values()) {
      totalBytesIn += conn.bytesIn;
      totalBytesOut += conn.bytesOut;
      totalPacketsIn += conn.packetsIn;
      totalPacketsOut += conn.packetsOut;
    }

    for (const tunnel of this.tunnels.values()) {
      totalBytesIn += tunnel.bytesIn;
      totalBytesOut += tunnel.bytesOut;
      totalPacketsIn += tunnel.packetsIn;
      totalPacketsOut += tunnel.packetsOut;
    }

    this.stats.totalBytesIn = totalBytesIn;
    this.stats.totalBytesOut = totalBytesOut;
    this.stats.totalPacketsIn = totalPacketsIn;
    this.stats.totalPacketsOut = totalPacketsOut;
  }

  /**
   * Clean up stale connections
   */
  public cleanupStaleConnections(): void {
    const timeout = (this.config?.connectionTimeout || 300) * 1000;
    const now = Date.now();

    for (const [id, conn] of this.connections.entries()) {
      if (conn.status === 'connected' && conn.lastActivity) {
        if (now - conn.lastActivity > timeout) {
          conn.status = 'disconnected';
          this.updateStats();
        }
      }
    }
  }
}


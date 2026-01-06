/**
 * VPN Emulation Engine
 * Simulates VPN Concentrator behavior: connection management, tunnel management, encryption processing
 */

import { CanvasNode } from '@/types';
import { 
  VPNRoutingEngine, 
  VPNConfig, 
  VPNStats, 
  VPNConnection, 
  VPNTunnel,
  VPNPacket 
} from './VPNRoutingEngine';

/**
 * VPN Emulation Config (синхронизирован с VPNConfigAdvanced)
 */
export interface VPNEmulationConfig {
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

/**
 * Внутренние метрики VPN
 */
export interface VPNEngineMetrics {
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
 * Агрегированные показатели нагрузки для EmulationEngine
 */
export interface VPNLoad {
  connectionsPerSecond: number;
  packetsPerSecond: number;
  bytesPerSecond: number;
  averageLatency: number;
  errorRate: number;
  utilization: number;
}

/**
 * VPN Emulation Engine
 * Симулирует работу VPN Concentrator: управление соединениями, туннелями, шифрование
 */
export class VPNEmulationEngine {
  private config: VPNEmulationConfig | null = null;
  private routingEngine: VPNRoutingEngine;

  private metrics: VPNEngineMetrics = {
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

  // Для оценки PPS и средней латентности
  private firstPacketTime: number | null = null;
  private lastPacketTime: number | null = null;
  private packetCount: number = 0;
  private byteCount: number = 0;
  private connectionCount: number = 0;
  private lastConnectionTime: number | null = null;

  // Симуляция входящих пакетов (для расчета метрик без реальных пакетов)
  private simulatedPacketRate: number = 0;
  private simulatedConnectionRate: number = 0;
  private lastSimulationTime: number = Date.now();

  constructor() {
    this.routingEngine = new VPNRoutingEngine();
  }

  /**
   * Инициализация конфигурации из узла VPN
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

    // Инициализируем routing engine
    this.routingEngine.initializeConfig(node);

    // Обновляем метрики
    this.updateMetricsFromStats();
  }

  /**
   * Обработка пакета через VPN (вызывается из DataFlowEngine)
   */
  public processPacket(packet: {
    source: string;
    destination: string;
    protocol: 'tcp' | 'udp';
    port?: number;
    sourcePort?: number;
    payload?: any;
    encrypted?: boolean;
    connectionId?: string;
    tunnelId?: string;
  }): {
    success: boolean;
    encrypted: boolean;
    latency: number;
    error?: string;
    bytesProcessed: number;
  } {
    const startTime = performance.now();

    // Создаем VPN packet
    const vpnPacket: VPNPacket = {
      source: packet.source,
      destination: packet.destination,
      protocol: packet.protocol,
      port: packet.port,
      sourcePort: packet.sourcePort,
      payload: packet.payload,
      encrypted: packet.encrypted,
      connectionId: packet.connectionId,
      tunnelId: packet.tunnelId,
      timestamp: Date.now(),
    };

    // Обрабатываем через routing engine
    const result = this.routingEngine.processPacket(vpnPacket);

    // Обновляем статистику времени
    const now = Date.now();
    if (!this.firstPacketTime) {
      this.firstPacketTime = now;
    }
    this.lastPacketTime = now;
    this.packetCount++;
    this.byteCount += result.bytesProcessed;

    // Обновляем метрики
    this.updateMetricsFromStats();

    return {
      success: result.success,
      encrypted: result.encrypted,
      latency: result.latency,
      error: result.error,
      bytesProcessed: result.bytesProcessed,
    };
  }

  /**
   * Создать соединение
   */
  public createConnection(connection: VPNConnection): void {
    try {
      this.routingEngine.createConnection(connection);
      this.connectionCount++;
      this.lastConnectionTime = Date.now();
      this.updateMetricsFromStats();
    } catch (error) {
      this.metrics.failedConnections++;
      throw error;
    }
  }

  /**
   * Обновить статус соединения
   */
  public updateConnectionStatus(connectionId: string, status: VPNConnection['status']): void {
    this.routingEngine.updateConnectionStatus(connectionId, status);
    this.updateMetricsFromStats();
  }

  /**
   * Удалить соединение
   */
  public removeConnection(connectionId: string): void {
    this.routingEngine.removeConnection(connectionId);
    this.updateMetricsFromStats();
  }

  /**
   * Создать туннель
   */
  public createTunnel(tunnel: VPNTunnel): void {
    this.routingEngine.createTunnel(tunnel);
    this.updateMetricsFromStats();
  }

  /**
   * Обновить статус туннеля
   */
  public updateTunnelStatus(tunnelId: string, status: VPNTunnel['status']): void {
    this.routingEngine.updateTunnelStatus(tunnelId, status);
    this.updateMetricsFromStats();
  }

  /**
   * Удалить туннель
   */
  public removeTunnel(tunnelId: string): void {
    this.routingEngine.removeTunnel(tunnelId);
    this.updateMetricsFromStats();
  }

  /**
   * Получить соединения
   */
  public getConnections(): VPNConnection[] {
    return this.routingEngine.getConnections();
  }

  /**
   * Получить туннели
   */
  public getTunnels(): VPNTunnel[] {
    return this.routingEngine.getTunnels();
  }

  /**
   * Получить конфигурацию
   */
  public getConfig(): VPNEmulationConfig | null {
    return this.config ? { ...this.config } : null;
  }

  /**
   * Получить метрики
   */
  public getMetrics(): VPNEngineMetrics {
    return { ...this.metrics };
  }

  /**
   * Получить routing engine (для DataFlowEngine)
   */
  public getRoutingEngine(): VPNRoutingEngine {
    return this.routingEngine;
  }

  /**
   * Рассчитать нагрузку для EmulationEngine
   */
  public calculateLoad(): VPNLoad {
    const now = Date.now();
    const timeWindow = 1000; // 1 second window

    // Рассчитываем PPS и BPS на основе реальных данных
    let packetsPerSecond = 0;
    let bytesPerSecond = 0;
    let connectionsPerSecond = 0;

    if (this.firstPacketTime && this.lastPacketTime) {
      const elapsed = (this.lastPacketTime - this.firstPacketTime) / 1000;
      if (elapsed > 0) {
        packetsPerSecond = this.packetCount / elapsed;
        bytesPerSecond = this.byteCount / elapsed;
      }
    }

    if (this.lastConnectionTime) {
      const elapsed = (now - this.lastConnectionTime) / 1000;
      if (elapsed > 0 && elapsed < timeWindow) {
        connectionsPerSecond = this.connectionCount / elapsed;
      }
    }

    // Если нет реальных данных, используем симулированные
    if (packetsPerSecond === 0) {
      packetsPerSecond = this.simulatedPacketRate;
    }
    if (bytesPerSecond === 0) {
      bytesPerSecond = packetsPerSecond * 1500; // Estimate bytes from packets
    }
    if (connectionsPerSecond === 0) {
      connectionsPerSecond = this.simulatedConnectionRate;
    }

    // Рассчитываем utilization на основе активных соединений и туннелей
    const maxConnections = this.config?.maxConnections || 1000;
    const connectionUtilization = Math.min(1, this.metrics.activeConnections / maxConnections);
    const tunnelUtilization = this.metrics.activeTunnels > 0 ? 0.3 : 0;
    const trafficUtilization = Math.min(0.5, bytesPerSecond / (100 * 1024 * 1024)); // 100 MB/s max
    const encryptionUtilization = Math.min(0.2, this.metrics.encryptionOperations / 10000);

    const utilization = Math.min(0.95, 
      0.1 + // Base utilization
      connectionUtilization * 0.4 +
      tunnelUtilization +
      trafficUtilization +
      encryptionUtilization
    );

    // Рассчитываем error rate на основе failed connections
    const totalAttempts = this.metrics.totalConnections + this.metrics.failedConnections;
    const errorRate = totalAttempts > 0 
      ? this.metrics.failedConnections / totalAttempts 
      : 0;

    return {
      connectionsPerSecond,
      packetsPerSecond,
      bytesPerSecond,
      averageLatency: this.metrics.averageLatency,
      errorRate,
      utilization,
    };
  }

  /**
   * Обновить метрики из статистики routing engine
   */
  private updateMetricsFromStats(): void {
    const stats = this.routingEngine.getStats();
    this.metrics = {
      totalConnections: stats.totalConnections,
      activeConnections: stats.activeConnections,
      totalTunnels: stats.totalTunnels,
      activeTunnels: stats.activeTunnels,
      totalBytesIn: stats.totalBytesIn,
      totalBytesOut: stats.totalBytesOut,
      totalPacketsIn: stats.totalPacketsIn,
      totalPacketsOut: stats.totalPacketsOut,
      encryptionOperations: stats.encryptionOperations,
      compressionOperations: stats.compressionOperations,
      failedConnections: stats.failedConnections,
      averageLatency: stats.averageLatency,
    };
  }

  /**
   * Симулировать входящий трафик (для расчета метрик без реальных пакетов)
   */
  public simulateIncomingTraffic(packetRate: number, connectionRate: number): void {
    this.simulatedPacketRate = packetRate;
    this.simulatedConnectionRate = connectionRate;
    this.lastSimulationTime = Date.now();
  }

  /**
   * Очистить устаревшие соединения
   */
  public cleanupStaleConnections(): void {
    this.routingEngine.cleanupStaleConnections();
    this.updateMetricsFromStats();
  }
}


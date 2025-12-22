import { CanvasNode } from '@/types';
import { FirewallRoutingEngine, FirewallConfig, FirewallStats, FirewallPacket } from './FirewallRoutingEngine';

/**
 * Firewall Emulation Config (синхронизирован с FirewallConfigAdvanced)
 */
export interface FirewallEmulationConfig {
  enableFirewall?: boolean;
  enableLogging?: boolean;
  enableIntrusionDetection?: boolean;
  enableStatefulInspection?: boolean;
  defaultPolicy?: 'allow' | 'deny' | 'reject';
  logRetention?: number;
  rules?: Array<{
    id: string;
    name: string;
    action: 'allow' | 'deny' | 'reject';
    protocol: 'tcp' | 'udp' | 'icmp' | 'all';
    source?: string;
    destination?: string;
    port?: number;
    sourcePort?: number;
    enabled: boolean;
    priority: number;
    hits?: number;
  }>;
}

/**
 * Внутренние метрики Firewall
 */
export interface FirewallEngineMetrics {
  packetsTotal: number;
  packetsAllowed: number;
  packetsBlocked: number;
  packetsRejected: number;
  activeRules: number;
  totalConnections: number;
  activeConnections: number;
  averageLatency: number;
}

/**
 * Агрегированные показатели нагрузки для EmulationEngine
 */
export interface FirewallLoad {
  packetsPerSecond: number;
  averageLatency: number;
  blockRate: number;
  rejectionRate: number;
}

/**
 * Firewall Emulation Engine
 * Симулирует работу сетевого файрвола: фильтрация пакетов, отслеживание соединений, расчет метрик.
 */
export class FirewallEmulationEngine {
  private config: FirewallEmulationConfig | null = null;
  private routingEngine: FirewallRoutingEngine;

  private metrics: FirewallEngineMetrics = {
    packetsTotal: 0,
    packetsAllowed: 0,
    packetsBlocked: 0,
    packetsRejected: 0,
    activeRules: 0,
    totalConnections: 0,
    activeConnections: 0,
    averageLatency: 0,
  };

  // Для оценки PPS и средней латентности
  private firstPacketTime: number | null = null;
  private lastPacketTime: number | null = null;
  private latencyHistory: number[] = [];
  private readonly MAX_LATENCY_HISTORY = 200;

  // Симуляция входящих пакетов (для расчета метрик без реальных пакетов)
  private simulatedPacketRate: number = 0;
  private lastSimulationTime: number = Date.now();

  constructor() {
    this.routingEngine = new FirewallRoutingEngine();
  }

  /**
   * Инициализация конфигурации из узла Firewall
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

    // Инициализируем routing engine
    this.routingEngine.initializeConfig(node);

    // Обновляем метрики
    this.updateMetricsFromStats();
  }

  /**
   * Обработка пакета через Firewall (вызывается из DataFlowEngine)
   */
  public processPacket(packet: {
    source: string;
    destination: string;
    protocol: 'tcp' | 'udp' | 'icmp' | 'all';
    port?: number;
    sourcePort?: number;
  }): {
    success: boolean;
    blocked: boolean;
    latency: number;
    error?: string;
  } {
    const startTime = performance.now();

    // Создаем Firewall packet
    const firewallPacket: FirewallPacket = {
      source: packet.source,
      destination: packet.destination,
      protocol: packet.protocol,
      port: packet.port,
      sourcePort: packet.sourcePort,
      timestamp: Date.now(),
    };

    // Обрабатываем через routing engine
    const result = this.routingEngine.processPacket(firewallPacket);

    const latency = performance.now() - startTime;
    this.recordLatency(latency);

    // Обновляем метрики
    this.updateMetricsFromStats();

    return {
      success: result.allowed,
      blocked: result.blocked,
      latency,
      error: result.blocked ? (result.matchedRule?.name || `Packet ${result.action}`) : undefined,
    };
  }

  /**
   * Симуляция обработки пакетов (для расчета метрик без реальных пакетов)
   */
  public simulatePackets(packetRate: number): void {
    const now = Date.now();
    const deltaTime = now - this.lastSimulationTime;
    this.lastSimulationTime = now;

    if (deltaTime <= 0 || packetRate <= 0) {
      return;
    }

    // Количество пакетов за прошедшее время
    const packetsCount = Math.floor((packetRate * deltaTime) / 1000);

    if (packetsCount === 0) {
      return;
    }

    // Генерируем случайные пакеты
    for (let i = 0; i < packetsCount; i++) {
      const packet = this.generateRandomPacket();
      this.processPacket(packet);
    }

    // Обновляем метрики из stats
    this.updateMetricsFromStats();
  }

  /**
   * Генерация случайного пакета для симуляции
   */
  private generateRandomPacket(): {
    source: string;
    destination: string;
    protocol: 'tcp' | 'udp' | 'icmp' | 'all';
    port?: number;
    sourcePort?: number;
  } {
    const protocols: ('tcp' | 'udp' | 'icmp')[] = ['tcp', 'udp', 'icmp'];
    const protocol = protocols[Math.floor(Math.random() * protocols.length)];

    // Генерируем случайные IP адреса
    const source = `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
    const destination = `10.0.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;

    // Генерируем порты для TCP/UDP
    const port = protocol === 'icmp' ? undefined : Math.floor(Math.random() * 65535);
    const sourcePort = protocol === 'icmp' ? undefined : Math.floor(Math.random() * 65535);

    return {
      source,
      destination,
      protocol,
      port,
      sourcePort,
    };
  }

  /**
   * Записать латентность в историю
   */
  private recordLatency(latency: number): void {
    this.latencyHistory.push(latency);
    if (this.latencyHistory.length > this.MAX_LATENCY_HISTORY) {
      this.latencyHistory.shift();
    }
  }

  /**
   * Обновить метрики из статистики routing engine
   */
  private updateMetricsFromStats(): void {
    const stats = this.routingEngine.getStats();
    const rules = this.routingEngine.getRules();

    this.metrics.packetsTotal = stats.totalPackets;
    this.metrics.packetsAllowed = stats.allowedPackets;
    this.metrics.packetsBlocked = stats.blockedPackets;
    this.metrics.packetsRejected = stats.rejectedPackets;
    this.metrics.activeRules = stats.activeRules;
    this.metrics.totalConnections = stats.totalConnections;
    this.metrics.activeConnections = stats.activeConnections;

    // Вычисляем среднюю латентность
    if (this.latencyHistory.length > 0) {
      const sum = this.latencyHistory.reduce((a, b) => a + b, 0);
      this.metrics.averageLatency = sum / this.latencyHistory.length;
    }
  }

  /**
   * Установить скорость симуляции пакетов
   */
  public setSimulatedPacketRate(rate: number): void {
    this.simulatedPacketRate = rate;
  }

  /**
   * Получить метрики движка
   */
  public getMetrics(): FirewallEngineMetrics {
    return { ...this.metrics };
  }

  /**
   * Получить статистику routing engine
   */
  public getStats(): FirewallStats {
    return this.routingEngine.getStats();
  }

  /**
   * Получить логи
   */
  public getLogs(limit?: number) {
    return this.routingEngine.getLogs(limit);
  }

  /**
   * Получить правила
   */
  public getRules() {
    return this.routingEngine.getRules();
  }

  /**
   * Получить конфигурацию
   */
  public getConfig(): FirewallEmulationConfig | null {
    return this.config;
  }

  /**
   * Вычислить нагрузку для EmulationEngine
   */
  public calculateLoad(): FirewallLoad {
    const now = Date.now();

    // Вычисляем PPS (packets per second)
    let packetsPerSecond = 0;
    if (this.firstPacketTime && this.lastPacketTime) {
      const timeWindow = (this.lastPacketTime - this.firstPacketTime) / 1000;
      if (timeWindow > 0) {
        packetsPerSecond = this.metrics.packetsTotal / timeWindow;
      }
    }

    // Если нет реальных пакетов, используем симулированную скорость
    if (packetsPerSecond === 0 && this.simulatedPacketRate > 0) {
      packetsPerSecond = this.simulatedPacketRate;
    }

    // Вычисляем block rate и rejection rate
    const blockRate = this.metrics.packetsTotal > 0
      ? this.metrics.packetsBlocked / this.metrics.packetsTotal
      : 0;
    const rejectionRate = this.metrics.packetsTotal > 0
      ? this.metrics.packetsRejected / this.metrics.packetsTotal
      : 0;

    return {
      packetsPerSecond,
      averageLatency: this.metrics.averageLatency,
      blockRate,
      rejectionRate,
    };
  }

  /**
   * Очистка старых соединений
   */
  public cleanup(): void {
    this.routingEngine.cleanupConnections();
    this.updateMetricsFromStats();
  }
}


import { CanvasNode } from '@/types';
import { IDSIPSRoutingEngine, IDSIPSConfig, IDSIPSStats, IDSIPSAlert, IDSIPSPacket } from './IDSIPSRoutingEngine';

/**
 * IDS/IPS Emulation Config (синхронизирован с IDSIPSConfigAdvanced / SECURITY_PROFILES)
 */
export interface IDSIPSEmulationConfig {
  mode?: 'ids' | 'ips';
  enableSignatureDetection?: boolean;
  enableAnomalyDetection?: boolean;
  enableBehavioralAnalysis?: boolean;
  alertThreshold?: 'low' | 'medium' | 'high' | 'critical';
  enableAutoBlock?: boolean;
  blockDuration?: number;
  enableLogging?: boolean;
  logRetention?: number;
  signatures?: Array<{
    id: string;
    name: string;
    description: string;
    enabled: boolean;
    severity: 'critical' | 'high' | 'medium' | 'low';
    pattern: string;
    action: 'alert' | 'block' | 'log';
    protocol?: 'tcp' | 'udp' | 'icmp' | 'all';
    sourceIP?: string;
    destinationIP?: string;
    port?: number;
    sourcePort?: number;
  }>;
  blockedIPs?: Array<{
    ip: string;
    reason: string;
    blockedAt: string;
    expiresAt?: string;
    duration?: number;
  }>;
}

/**
 * Внутренние метрики IDS/IPS
 */
export interface IDSIPSEngineMetrics {
  packetsTotal: number;
  packetsAnalyzed: number;
  alertsGenerated: number;
  alertsBlocked: number;
  signatureMatches: number;
  anomalyDetections: number;
  behavioralDetections: number;
  activeSignatures: number;
  blockedIPs: number;
  averageLatency: number;
}

/**
 * Агрегированные показатели нагрузки для EmulationEngine
 */
export interface IDSIPSLoad {
  packetsPerSecond: number;
  averageLatency: number;
  errorRate: number;
  blockRate: number;
  alertRate: number;
}

/**
 * IDS/IPS Emulation Engine
 * Симулирует работу IDS/IPS: обнаружение вторжений, блокировка угроз, расчет метрик.
 */
export class IDSIPSEmulationEngine {
  private config: IDSIPSEmulationConfig | null = null;
  private routingEngine: IDSIPSRoutingEngine;

  private metrics: IDSIPSEngineMetrics = {
    packetsTotal: 0,
    packetsAnalyzed: 0,
    alertsGenerated: 0,
    alertsBlocked: 0,
    signatureMatches: 0,
    anomalyDetections: 0,
    behavioralDetections: 0,
    activeSignatures: 0,
    blockedIPs: 0,
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
    this.routingEngine = new IDSIPSRoutingEngine();
  }

  /**
   * Инициализация конфигурации из узла IDS/IPS
   */
  public initializeConfig(node: CanvasNode): void {
    const raw = (node.data.config || {}) as any;

    this.config = {
      mode: raw.mode || 'ids',
      enableSignatureDetection: raw.enableSignatureDetection ?? true,
      enableAnomalyDetection: raw.enableAnomalyDetection ?? true,
      enableBehavioralAnalysis: raw.enableBehavioralAnalysis ?? false,
      alertThreshold: raw.alertThreshold || 'medium',
      enableAutoBlock: raw.enableAutoBlock ?? false,
      blockDuration: raw.blockDuration || 3600,
      enableLogging: raw.enableLogging ?? true,
      logRetention: raw.logRetention || 30,
      signatures: Array.isArray(raw.signatures) ? raw.signatures : [],
      blockedIPs: Array.isArray(raw.blockedIPs) ? raw.blockedIPs : [],
    };

    // Инициализируем routing engine
    this.routingEngine.initializeConfig(node);

    // Обновляем метрики
    this.updateMetricsFromStats();
  }

  /**
   * Обработка пакета через IDS/IPS (вызывается из DataFlowEngine)
   */
  public processPacket(packet: {
    source: string;
    destination: string;
    protocol: 'tcp' | 'udp' | 'icmp' | 'all';
    port?: number;
    sourcePort?: number;
    payload?: string;
  }): {
    success: boolean;
    blocked: boolean;
    latency: number;
    alertGenerated?: boolean;
    error?: string;
  } {
    const startTime = performance.now();

    // Создаем IDS/IPS packet
    const idsPacket: IDSIPSPacket = {
      source: packet.source,
      destination: packet.destination,
      protocol: packet.protocol,
      port: packet.port,
      sourcePort: packet.sourcePort,
      payload: packet.payload,
      timestamp: Date.now(),
    };

    // Обрабатываем через routing engine
    const response = this.routingEngine.processPacket(idsPacket);

    const latency = performance.now() - startTime + response.latency;

    // Обновляем историю латентности
    this.recordLatency(latency);

    // Обновляем метрики
    this.metrics.packetsTotal++;
    if (response.alertGenerated) {
      this.metrics.alertsGenerated++;
    }
    if (response.blocked) {
      this.metrics.alertsBlocked++;
    }

    // Обновляем временные метки
    const now = Date.now();
    if (!this.firstPacketTime) {
      this.firstPacketTime = now;
    }
    this.lastPacketTime = now;

    // Обновляем метрики из stats
    this.updateMetricsFromStats();

    return {
      success: response.allowed,
      blocked: response.blocked,
      latency,
      alertGenerated: response.alertGenerated,
      error: response.error,
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
    payload?: string;
  } {
    const protocols: ('tcp' | 'udp' | 'icmp')[] = ['tcp', 'udp', 'icmp'];
    const protocol = protocols[Math.floor(Math.random() * protocols.length)];

    // Генерируем случайные IP адреса
    const source = `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
    const destination = `10.0.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;

    // Генерируем порты для TCP/UDP
    const port = protocol === 'icmp' ? undefined : Math.floor(Math.random() * 65535);
    const sourcePort = protocol === 'icmp' ? undefined : Math.floor(Math.random() * 65535);

    // Иногда генерируем подозрительные пакеты (для симуляции вторжений)
    const isSuspicious = Math.random() < 0.05; // 5% подозрительных пакетов
    let payload: string | undefined;

    if (isSuspicious) {
      // Генерируем подозрительный payload
      const suspiciousPayloads = [
        'SELECT * FROM users WHERE id = 1 OR 1=1',
        '<script>alert("XSS")</script>',
        'DROP TABLE users',
        'UNION SELECT password FROM users',
        '../../../etc/passwd',
        'eval(base64_decode(',
      ];
      payload = suspiciousPayloads[Math.floor(Math.random() * suspiciousPayloads.length)];
    } else if (Math.random() < 0.3) {
      // Нормальный payload
      payload = `GET /api/data HTTP/1.1\r\nHost: example.com\r\nUser-Agent: Mozilla/5.0`;
    }

    return {
      source,
      destination,
      protocol,
      port,
      sourcePort,
      payload,
    };
  }

  /**
   * Генерация случайного IP адреса
   */
  private generateRandomIP(): string {
    return `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
  }

  /**
   * Запись латентности в историю
   */
  private recordLatency(latency: number): void {
    this.latencyHistory.push(latency);
    if (this.latencyHistory.length > this.MAX_LATENCY_HISTORY) {
      this.latencyHistory.shift();
    }

    // Обновляем среднюю латентность
    const sum = this.latencyHistory.reduce((a, b) => a + b, 0);
    this.metrics.averageLatency = sum / this.latencyHistory.length;
  }

  /**
   * Обновление метрик из stats routing engine
   */
  private updateMetricsFromStats(): void {
    const stats = this.routingEngine.getStats();
    this.metrics.packetsTotal = stats.totalPackets;
    this.metrics.packetsAnalyzed = stats.packetsAnalyzed;
    this.metrics.alertsGenerated = stats.alertsGenerated;
    this.metrics.alertsBlocked = stats.alertsBlocked;
    this.metrics.signatureMatches = stats.signatureMatches;
    this.metrics.anomalyDetections = stats.anomalyDetections;
    this.metrics.behavioralDetections = stats.behavioralDetections;
    this.metrics.activeSignatures = stats.activeSignatures;
    this.metrics.blockedIPs = stats.blockedIPs;
  }

  /**
   * Расчет нагрузки на основе метрик
   */
  public calculateLoad(): IDSIPSLoad {
    const now = Date.now();
    let packetsPerSecond = 0;

    if (this.firstPacketTime && this.lastPacketTime && this.lastPacketTime > this.firstPacketTime) {
      const timeWindow = (this.lastPacketTime - this.firstPacketTime) / 1000; // seconds
      if (timeWindow > 0) {
        packetsPerSecond = this.metrics.packetsTotal / timeWindow;
      }
    }

    // Если нет реальных пакетов, используем симулированную скорость
    if (packetsPerSecond === 0 && this.simulatedPacketRate > 0) {
      packetsPerSecond = this.simulatedPacketRate;
    }

    const averageLatency = this.metrics.averageLatency || 5; // default 5ms

    // Error rate = заблокированные пакеты / общее количество (в IPS режиме)
    const errorRate = this.config?.mode === 'ips' && this.metrics.packetsTotal > 0
      ? this.metrics.alertsBlocked / this.metrics.packetsTotal
      : 0;

    // Block rate = процент заблокированных пакетов
    const blockRate = this.metrics.packetsTotal > 0
      ? this.metrics.alertsBlocked / this.metrics.packetsTotal
      : 0;

    // Alert rate = процент сгенерированных алертов
    const alertRate = this.metrics.packetsTotal > 0
      ? this.metrics.alertsGenerated / this.metrics.packetsTotal
      : 0;

    return {
      packetsPerSecond,
      averageLatency,
      errorRate,
      blockRate,
      alertRate,
    };
  }

  /**
   * Получить метрики
   */
  public getMetrics(): IDSIPSEngineMetrics {
    return { ...this.metrics };
  }

  /**
   * Получить конфигурацию
   */
  public getConfig(): IDSIPSEmulationConfig | null {
    return this.config;
  }

  /**
   * Получить алерты
   */
  public getAlerts(limit: number = 100): IDSIPSAlert[] {
    return this.routingEngine.getAlerts(limit);
  }

  /**
   * Получить статистику
   */
  public getStats(): IDSIPSStats {
    return this.routingEngine.getStats();
  }

  /**
   * Получить заблокированные IP
   */
  public getBlockedIPs() {
    return this.routingEngine.getBlockedIPs();
  }

  /**
   * Разблокировать IP
   */
  public unblockIP(ip: string): void {
    this.routingEngine.unblockIP(ip);
    this.updateMetricsFromStats();
  }

  /**
   * Установить симулированную скорость пакетов
   */
  public setSimulatedPacketRate(rate: number): void {
    this.simulatedPacketRate = rate;
  }

  /**
   * Сброс метрик
   */
  public resetMetrics(): void {
    this.metrics = {
      packetsTotal: 0,
      packetsAnalyzed: 0,
      alertsGenerated: 0,
      alertsBlocked: 0,
      signatureMatches: 0,
      anomalyDetections: 0,
      behavioralDetections: 0,
      activeSignatures: this.metrics.activeSignatures,
      blockedIPs: this.metrics.blockedIPs,
      averageLatency: 0,
    };
    this.latencyHistory = [];
    this.firstPacketTime = null;
    this.lastPacketTime = null;
    this.routingEngine.resetStats();
  }
}


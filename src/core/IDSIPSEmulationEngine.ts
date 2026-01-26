import { CanvasNode, CanvasConnection } from '@/types';
import { IDSIPSRoutingEngine, IDSIPSConfig, IDSIPSStats, IDSIPSAlert, IDSIPSPacket } from './IDSIPSRoutingEngine';
import { ServiceDiscovery } from '@/services/connection/ServiceDiscovery';

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
  private discovery: ServiceDiscovery;
  private nodes: CanvasNode[] = [];
  private connections: CanvasConnection[] = [];

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

  // История реальных пакетов для симуляции (используем реальные IP из логов)
  private recentPackets: Array<{ source: string; destination: string; protocol: 'tcp' | 'udp' | 'icmp' | 'all'; port?: number; sourcePort?: number; payload?: string }> = [];
  private readonly MAX_RECENT_PACKETS = 100;

  constructor() {
    this.routingEngine = new IDSIPSRoutingEngine();
    this.discovery = new ServiceDiscovery();
  }

  /**
   * Инициализация конфигурации из узла IDS/IPS
   */
  public initializeConfig(node: CanvasNode, nodes?: CanvasNode[], connections?: CanvasConnection[]): void {
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

    // Обновляем nodes и connections для использования в симуляции
    if (nodes) {
      this.nodes = nodes;
    }
    if (connections) {
      this.connections = connections;
    }

    // Инициализируем routing engine
    this.routingEngine.initializeConfig(node);

    // Обновляем метрики
    this.updateMetricsFromStats();
  }

  /**
   * Обновление nodes и connections
   */
  public updateNodesAndConnections(nodes: CanvasNode[], connections: CanvasConnection[]): void {
    this.nodes = nodes;
    this.connections = connections;
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
    // Дополнительная информация для протокольного анализа
    tcpFlags?: { syn?: boolean; ack?: boolean; fin?: boolean; rst?: boolean; psh?: boolean; urg?: boolean };
    tcpSeq?: number;
    tcpAck?: number;
    fragmentOffset?: number;
    fragmentId?: number;
    isFragment?: boolean;
  }): {
    success: boolean;
    blocked: boolean;
    latency: number;
    alertGenerated?: boolean;
    error?: string;
  } {
    const startTime = performance.now();

    // Создаем IDS/IPS packet (с расширенной информацией для протокольного анализа)
    const idsPacket: IDSIPSPacket = {
      source: packet.source,
      destination: packet.destination,
      protocol: packet.protocol,
      port: packet.port,
      sourcePort: packet.sourcePort,
      payload: packet.payload,
      timestamp: Date.now(),
      // Дополнительная информация для протокольного анализа
      tcpFlags: packet.tcpFlags,
      tcpSeq: packet.tcpSeq,
      tcpAck: packet.tcpAck,
      fragmentOffset: packet.fragmentOffset,
      fragmentId: packet.fragmentId,
      isFragment: packet.isFragment,
    };

    // Обрабатываем через routing engine
    const response = this.routingEngine.processPacket(idsPacket);

    const latency = performance.now() - startTime + response.latency;

    // Обновляем историю латентности
    this.recordLatency(latency);

    // Сохраняем реальный пакет для использования в симуляции
    this.recentPackets.push({
      source: packet.source,
      destination: packet.destination,
      protocol: packet.protocol,
      port: packet.port,
      sourcePort: packet.sourcePort,
      payload: packet.payload,
    });
    if (this.recentPackets.length > this.MAX_RECENT_PACKETS) {
      this.recentPackets.shift();
    }

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
   * Генерация пакета для симуляции на основе реальных данных
   * Использует реальные IP адреса из подключенных компонентов и истории пакетов
   */
  private generateRandomPacket(): {
    source: string;
    destination: string;
    protocol: 'tcp' | 'udp' | 'icmp' | 'all';
    port?: number;
    sourcePort?: number;
    payload?: string;
  } {
    // Приоритет 1: Используем реальные пакеты из истории
    if (this.recentPackets.length > 0) {
      const randomIndex = Math.floor(Math.random() * this.recentPackets.length);
      return { ...this.recentPackets[randomIndex] };
    }

    // Приоритет 2: Используем реальные IP из сигнатур IDS/IPS
    const signatures = this.routingEngine.getSignatures();
    const signaturesWithIPs = signatures.filter(s => s.sourceIP || s.destinationIP);
    
    if (signaturesWithIPs.length > 0) {
      const sig = signaturesWithIPs[Math.floor(Math.random() * signaturesWithIPs.length)];
      const protocols: ('tcp' | 'udp' | 'icmp')[] = sig.protocol === 'all' 
        ? ['tcp', 'udp', 'icmp'] 
        : [sig.protocol as 'tcp' | 'udp' | 'icmp'];
      const protocol = protocols[Math.floor(Math.random() * protocols.length)];

      // Используем IP из сигнатур
      let source = sig.sourceIP || '0.0.0.0';
      let destination = sig.destinationIP || '0.0.0.0';

      // Если это CIDR, берем первый IP из диапазона
      if (source.includes('/')) {
        const [network] = source.split('/');
        source = network;
      }
      if (destination.includes('/')) {
        const [network] = destination.split('/');
        destination = network;
      }

      return {
        source,
        destination,
        protocol,
        port: sig.port,
        sourcePort: sig.sourcePort,
        payload: sig.pattern ? undefined : undefined, // Не используем pattern как payload
      };
    }

    // Приоритет 3: Используем реальные хосты из подключенных компонентов
    const connectedNodes: CanvasNode[] = [];
    
    // Находим компоненты, подключенные к IDS/IPS
    for (const conn of this.connections) {
      // Находим узел IDS/IPS
      const idsIpsNode = this.nodes.find(n => n.type === 'ids-ips');
      if (!idsIpsNode) continue;

      // Если соединение связано с IDS/IPS
      if (conn.source === idsIpsNode.id) {
        const targetNode = this.nodes.find(n => n.id === conn.target);
        if (targetNode) connectedNodes.push(targetNode);
      } else if (conn.target === idsIpsNode.id) {
        const sourceNode = this.nodes.find(n => n.id === conn.source);
        if (sourceNode) connectedNodes.push(sourceNode);
      }
    }

    if (connectedNodes.length > 0) {
      const sourceNode = connectedNodes[Math.floor(Math.random() * connectedNodes.length)];
      const targetNode = connectedNodes[Math.floor(Math.random() * connectedNodes.length)];
      
      const sourceHost = this.discovery.getHost(sourceNode);
      const targetHost = this.discovery.getHost(targetNode);
      const sourcePort = this.discovery.getPort(sourceNode, 'main');
      const targetPort = this.discovery.getPort(targetNode, 'main');

      // Преобразуем hostname в IP (стабильное преобразование на основе хеша)
      const source = this.hostnameToIP(sourceHost || sourceNode.id);
      const destination = this.hostnameToIP(targetHost || targetNode.id);

      const protocols: ('tcp' | 'udp' | 'icmp')[] = ['tcp', 'udp', 'icmp'];
      const protocol = protocols[Math.floor(Math.random() * protocols.length)];

      return {
        source,
        destination,
        protocol,
        port: targetPort,
        sourcePort: sourcePort,
      };
    }

    // Приоритет 4: Используем реальные IP из заблокированных IP (для симуляции атак)
    const blockedIPs = this.routingEngine.getBlockedIPs();
    if (blockedIPs.length > 0) {
      const blocked = blockedIPs[Math.floor(Math.random() * blockedIPs.length)];
      const protocols: ('tcp' | 'udp' | 'icmp')[] = ['tcp', 'udp', 'icmp'];
      const protocol = protocols[Math.floor(Math.random() * protocols.length)];

      return {
        source: blocked.ip,
        destination: '10.0.0.1', // Дефолтный destination
        protocol,
        port: Math.floor(Math.random() * 65535),
        sourcePort: Math.floor(Math.random() * 65535),
      };
    }

    // Fallback: Используем дефолтные значения (не случайные)
    return {
      source: '192.168.1.1',
      destination: '10.0.0.1',
      protocol: 'tcp',
      port: 80,
      sourcePort: 50000,
    };
  }

  /**
   * Преобразование hostname в IP адрес (стабильное преобразование на основе хеша)
   */
  private hostnameToIP(hostname: string): string {
    // Простой хеш для стабильного преобразования
    let hash = 0;
    for (let i = 0; i < hostname.length; i++) {
      const char = hostname.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    
    // Преобразуем хеш в IP адрес (10.x.y.z)
    const x = Math.abs(hash % 255);
    const y = Math.abs((hash >> 8) % 255);
    const z = Math.abs((hash >> 16) % 255);
    
    return `10.${x}.${y}.${z}`;
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


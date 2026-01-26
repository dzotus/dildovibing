import { CanvasNode, CanvasConnection } from '@/types';
import { FirewallRoutingEngine, FirewallConfig, FirewallStats, FirewallPacket } from './FirewallRoutingEngine';
import { ServiceDiscovery } from '@/services/connection/ServiceDiscovery';

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
  private discovery: ServiceDiscovery;
  private nodes: CanvasNode[] = [];
  private connections: CanvasConnection[] = [];

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

  // История реальных пакетов для симуляции (используем реальные IP из логов)
  private recentPackets: Array<{ source: string; destination: string; protocol: 'tcp' | 'udp' | 'icmp'; port?: number; sourcePort?: number }> = [];
  private readonly MAX_RECENT_PACKETS = 100;

  constructor() {
    this.routingEngine = new FirewallRoutingEngine();
    this.discovery = new ServiceDiscovery();
  }

  /**
   * Инициализация конфигурации из узла Firewall
   */
  public initializeConfig(node: CanvasNode, nodes?: CanvasNode[], connections?: CanvasConnection[]): void {
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

    // Сохраняем nodes и connections для использования в симуляции
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
   * Обновить nodes и connections (вызывается из EmulationEngine)
   */
  public updateNodesAndConnections(nodes: CanvasNode[], connections: CanvasConnection[]): void {
    this.nodes = nodes;
    this.connections = connections;
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

    // Сохраняем реальный пакет для использования в симуляции
    this.recentPackets.push({
      source: packet.source,
      destination: packet.destination,
      protocol: packet.protocol,
      port: packet.port,
      sourcePort: packet.sourcePort,
    });
    if (this.recentPackets.length > this.MAX_RECENT_PACKETS) {
      this.recentPackets.shift();
    }

    // Обновляем временные метки для расчета PPS
    if (!this.firstPacketTime) {
      this.firstPacketTime = Date.now();
    }
    this.lastPacketTime = Date.now();

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
   * Генерация пакета для симуляции на основе реальных данных
   * Использует реальные IP адреса из подключенных компонентов и истории пакетов
   */
  private generateRandomPacket(): {
    source: string;
    destination: string;
    protocol: 'tcp' | 'udp' | 'icmp' | 'all';
    port?: number;
    sourcePort?: number;
  } {
    // Приоритет 1: Используем реальные пакеты из истории
    if (this.recentPackets.length > 0) {
      const randomIndex = Math.floor(Math.random() * this.recentPackets.length);
      return { ...this.recentPackets[randomIndex] };
    }

    // Приоритет 2: Используем реальные IP из правил Firewall
    const rules = this.routingEngine.getRules();
    const rulesWithIPs = rules.filter(r => r.source || r.destination);
    
    if (rulesWithIPs.length > 0) {
      const rule = rulesWithIPs[Math.floor(Math.random() * rulesWithIPs.length)];
      const protocols: ('tcp' | 'udp' | 'icmp')[] = rule.protocol === 'all' 
        ? ['tcp', 'udp', 'icmp'] 
        : [rule.protocol as 'tcp' | 'udp' | 'icmp'];
      const protocol = protocols[Math.floor(Math.random() * protocols.length)];

      // Используем IP из правил
      let source = rule.source || '0.0.0.0';
      let destination = rule.destination || '0.0.0.0';

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
        port: rule.port,
        sourcePort: rule.sourcePort,
      };
    }

    // Приоритет 3: Используем реальные хосты из подключенных компонентов
    const connectedNodes: CanvasNode[] = [];
    
    // Находим компоненты, подключенные к Firewall
    for (const conn of this.connections) {
      // Находим узел Firewall
      const firewallNode = this.nodes.find(n => n.type === 'firewall');
      if (!firewallNode) continue;

      // Если соединение связано с Firewall
      if (conn.source === firewallNode.id) {
        const targetNode = this.nodes.find(n => n.id === conn.target);
        if (targetNode) connectedNodes.push(targetNode);
      } else if (conn.target === firewallNode.id) {
        const sourceNode = this.nodes.find(n => n.id === conn.source);
        if (sourceNode) connectedNodes.push(sourceNode);
      }
    }

    if (connectedNodes.length > 0) {
      const sourceNode = connectedNodes[Math.floor(Math.random() * connectedNodes.length)];
      const destinationNode = connectedNodes[Math.floor(Math.random() * connectedNodes.length)];

      const sourceHost = this.discovery.getHost(sourceNode);
      const destinationHost = this.discovery.getHost(destinationNode);
      const sourcePort = this.discovery.getPort(sourceNode, 'main') || 8080;
      const destinationPort = this.discovery.getPort(destinationNode, 'main') || 8080;

      // Преобразуем hostname в IP (упрощенная реализация)
      const source = this.hostnameToIP(sourceHost);
      const destination = this.hostnameToIP(destinationHost);

      const protocols: ('tcp' | 'udp' | 'icmp')[] = ['tcp', 'udp', 'icmp'];
      const protocol = protocols[Math.floor(Math.random() * protocols.length)];

      return {
        source,
        destination,
        protocol,
        port: protocol === 'icmp' ? undefined : destinationPort,
        sourcePort: protocol === 'icmp' ? undefined : sourcePort,
      };
    }

    // Fallback: используем дефолтные значения (но не случайные)
    return {
      source: '0.0.0.0',
      destination: '10.0.0.1',
      protocol: 'tcp',
      port: 80,
      sourcePort: 49152,
    };
  }

  /**
   * Преобразует hostname в IP адрес (упрощенная реализация)
   * В реальности это должно использовать DNS или конфигурацию сети
   */
  private hostnameToIP(hostname: string): string {
    // Если уже IP адрес, возвращаем как есть
    if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
      return hostname;
    }

    // Простое преобразование hostname в IP (для симуляции)
    // Используем хеш hostname для генерации стабильного IP
    let hash = 0;
    for (let i = 0; i < hostname.length; i++) {
      hash = ((hash << 5) - hash) + hostname.charCodeAt(i);
      hash = hash & hash; // Convert to 32bit integer
    }

    // Генерируем IP в диапазоне 10.0.0.0/8
    const octet1 = 10;
    const octet2 = Math.abs(hash) % 256;
    const octet3 = (Math.abs(hash) >> 8) % 256;
    const octet4 = (Math.abs(hash) >> 16) % 256;

    return `${octet1}.${octet2}.${octet3}.${octet4}`;
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


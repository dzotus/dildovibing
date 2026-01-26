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
  // TCP flags (optional, для улучшенного stateful inspection)
  tcpFlags?: {
    syn?: boolean;
    ack?: boolean;
    fin?: boolean;
    rst?: boolean;
    psh?: boolean;
    urg?: boolean;
  };
  // ICMP type and code (optional)
  icmpType?: number;
  icmpCode?: number;
  // Bytes in packet (для расчета метрик)
  bytes?: number;
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
  protocol: 'tcp' | 'udp' | 'icmp';
  // TCP states: new, syn-sent, syn-received, established, fin-wait-1, fin-wait-2, close-wait, closing, last-ack, time-wait, closed
  // UDP/ICMP states: new, established, related, invalid
  state: 'new' | 'syn-sent' | 'syn-received' | 'established' | 'fin-wait-1' | 'fin-wait-2' | 'close-wait' | 'closing' | 'last-ack' | 'time-wait' | 'closed' | 'related' | 'invalid';
  tcpFlags?: {
    syn?: boolean;
    ack?: boolean;
    fin?: boolean;
    rst?: boolean;
  };
  firstSeen: number;
  lastSeen: number;
  packets: number;
  bytes: number;
  direction: 'original' | 'reply'; // Направление пакета
  // Для ICMP - связь с оригинальным соединением
  relatedConnection?: string; // Ключ связанного соединения
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
  // Timeouts для разных протоколов и состояний
  private readonly TCP_ESTABLISHED_TIMEOUT_MS = 3600000; // 1 hour для established TCP
  private readonly TCP_TIME_WAIT_TIMEOUT_MS = 120000; // 2 minutes для TIME-WAIT
  private readonly TCP_NEW_TIMEOUT_MS = 120000; // 2 minutes для новых TCP соединений
  private readonly UDP_TIMEOUT_MS = 30000; // 30 seconds для UDP
  private readonly ICMP_TIMEOUT_MS = 30000; // 30 seconds для ICMP

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
    
    // Базовая латентность обработки пакета (микросекунды для hardware, миллисекунды для software)
    // В реальных файрволах: hardware ~0.1-0.5ms, software ~1-5ms
    const baseLatency = 0.5; // 0.5ms базовая латентность (software firewall)
    
    // Увеличение латентности при большом количестве правил
    const rulesCount = Array.from(this.rules.values()).filter(r => r.enabled).length;
    const rulesLatency = Math.min(2.0, rulesCount * 0.01); // До 2ms за правила
    
    // Увеличение латентности при stateful inspection
    const statefulLatency = this.config?.enableStatefulInspection ? 0.3 : 0;
    
    // Увеличение латентности при высокой нагрузке (количество активных соединений)
    const activeConnections = this.connections.size;
    const loadLatency = Math.min(1.0, activeConnections / 1000 * 0.1); // До 1ms при высокой нагрузке
    
    // Итоговая базовая латентность
    const totalBaseLatency = baseLatency + rulesLatency + statefulLatency + loadLatency;

    // If firewall is disabled, allow all
    if (!this.config?.enableFirewall) {
      return {
        allowed: true,
        blocked: false,
        action: 'allow',
        latency: totalBaseLatency,
      };
    }

    this.stats.totalPackets++;

    // Check stateful inspection first (if enabled)
    if (this.config?.enableStatefulInspection) {
      const connectionResult = this.processStatefulInspection(packet, timestamp);
      if (connectionResult.allowed !== undefined) {
        // Stateful inspection решил судьбу пакета
        if (connectionResult.allowed) {
          this.stats.allowedPackets++;
          this.logPacket(packet, 'allowed', undefined, connectionResult.reason || 'Established connection');
          return {
            allowed: true,
            blocked: false,
            action: 'allow',
            latency: totalBaseLatency * 0.5, // Established connections быстрее
          };
        } else {
          // Пакет заблокирован stateful inspection (например, invalid state)
          this.stats.blockedPackets++;
          this.logPacket(packet, 'blocked', undefined, connectionResult.reason || 'Invalid connection state');
        return {
          allowed: false,
          blocked: true,
          action: 'deny',
          latency: totalBaseLatency,
          error: connectionResult.reason,
        };
        }
      }
      // Если stateful inspection не решил, продолжаем с правилами
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

        // Латентность зависит от позиции правила (раньше найдено = быстрее)
        const ruleIndex = sortedRules.indexOf(rule);
        const ruleLatency = totalBaseLatency * (1 + ruleIndex * 0.1); // Увеличение за каждое проверенное правило
        
        return {
          allowed: rule.action === 'allow',
          blocked: rule.action === 'deny' || rule.action === 'reject',
          action: rule.action,
          latency: ruleLatency,
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

    // Default policy - проверены все правила, максимальная латентность
    const maxRuleLatency = totalBaseLatency * (1 + sortedRules.length * 0.1);
    
    return {
      allowed: defaultAction === 'allow',
      blocked: defaultAction === 'deny' || defaultAction === 'reject',
      action: defaultAction,
      latency: maxRuleLatency,
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
  private getConnectionKey(packet: FirewallPacket, reverse: boolean = false): string {
    if (reverse) {
      // Обратное направление (reply)
      return `${packet.destination}:${packet.port || 0}-${packet.source}:${packet.sourcePort || 0}-${packet.protocol}`;
    }
    return `${packet.source}:${packet.sourcePort || 0}-${packet.destination}:${packet.port || 0}-${packet.protocol}`;
  }

  /**
   * Process stateful inspection for packet
   */
  private processStatefulInspection(packet: FirewallPacket, timestamp: number): {
    allowed?: boolean;
    reason?: string;
  } {
    if (packet.protocol === 'tcp') {
      return this.processTCPStateful(packet, timestamp);
    } else if (packet.protocol === 'udp') {
      return this.processUDPStateful(packet, timestamp);
    } else if (packet.protocol === 'icmp') {
      return this.processICMPStateful(packet, timestamp);
    }
    
    // Для 'all' протокола не применяем stateful inspection
    return {};
  }

  /**
   * Process TCP stateful inspection
   */
  private processTCPStateful(packet: FirewallPacket, timestamp: number): {
    allowed?: boolean;
    reason?: string;
  } {
    const connectionKey = this.getConnectionKey(packet);
    const reverseKey = this.getConnectionKey(packet, true);
    const existingConnection = this.connections.get(connectionKey) || this.connections.get(reverseKey);
    const flags = packet.tcpFlags || {};

    if (existingConnection) {
      // Обновляем существующее соединение
      existingConnection.lastSeen = timestamp;
      existingConnection.packets++;
      existingConnection.bytes += packet.bytes || 0;

      // Обрабатываем TCP флаги для изменения состояния
      if (flags.rst) {
        // RST - сбрасываем соединение
        existingConnection.state = 'closed';
        this.connections.delete(connectionKey);
        this.connections.delete(reverseKey);
        return { allowed: false, reason: 'Connection reset' };
      }

      if (flags.fin) {
        // FIN - начинаем закрытие соединения
        if (existingConnection.state === 'established') {
          existingConnection.state = 'fin-wait-1';
        } else if (existingConnection.state === 'close-wait') {
          existingConnection.state = 'last-ack';
        } else if (existingConnection.state === 'fin-wait-1' && flags.ack) {
          existingConnection.state = 'fin-wait-2';
        } else if (existingConnection.state === 'fin-wait-2' && flags.ack) {
          existingConnection.state = 'time-wait';
        }
      }

      if (flags.syn && flags.ack && existingConnection.state === 'syn-sent') {
        // SYN-ACK - соединение устанавливается
        existingConnection.state = 'established';
        return { allowed: true, reason: 'TCP connection established' };
      }

      if (flags.ack && existingConnection.state === 'syn-received') {
        // ACK после SYN-ACK - соединение установлено
        existingConnection.state = 'established';
        return { allowed: true, reason: 'TCP connection established' };
      }

      // Established соединения разрешаем
      if (existingConnection.state === 'established') {
        return { allowed: true, reason: 'Established TCP connection' };
      }

      // TIME-WAIT соединения разрешаем (для завершения)
      if (existingConnection.state === 'time-wait') {
        return { allowed: true, reason: 'TCP connection in TIME-WAIT' };
      }
    } else {
      // Новое соединение
      if (flags.syn && !flags.ack) {
        // SYN без ACK - новое соединение
        if (this.connections.size < this.MAX_CONNECTIONS) {
          const newConnection: ConnectionState = {
            source: packet.source,
            destination: packet.destination,
            sourcePort: packet.sourcePort || 0,
            destinationPort: packet.port || 0,
            protocol: 'tcp',
            state: 'syn-sent',
            firstSeen: timestamp,
            lastSeen: timestamp,
            packets: 1,
            bytes: packet.bytes || 0,
            direction: 'original',
            tcpFlags: { syn: true },
          };
          this.connections.set(connectionKey, newConnection);
          this.stats.totalConnections++;
          // Новые SYN пакеты проверяем правилами
          return {};
        }
      } else if (flags.syn && flags.ack) {
        // SYN-ACK без существующего соединения - возможно reply
        if (this.connections.size < this.MAX_CONNECTIONS) {
          const newConnection: ConnectionState = {
            source: packet.source,
            destination: packet.destination,
            sourcePort: packet.sourcePort || 0,
            destinationPort: packet.port || 0,
            protocol: 'tcp',
            state: 'syn-received',
            firstSeen: timestamp,
            lastSeen: timestamp,
            packets: 1,
            bytes: packet.bytes || 0,
            direction: 'reply',
            tcpFlags: { syn: true, ack: true },
          };
          this.connections.set(connectionKey, newConnection);
          this.stats.totalConnections++;
          return {};
        }
      } else {
        // Пакет без SYN для несуществующего соединения - возможно invalid
        // Проверяем, может быть это reply для существующего соединения
        const reverseConnection = this.connections.get(reverseKey);
        if (reverseConnection && reverseConnection.state === 'syn-sent' && flags.ack) {
          // Это reply на SYN
          reverseConnection.state = 'established';
          return { allowed: true, reason: 'TCP connection established (reply)' };
        }
        // Иначе - invalid пакет, но пусть правила решают
        return {};
      }
    }

    return {};
  }

  /**
   * Process UDP stateful inspection
   */
  private processUDPStateful(packet: FirewallPacket, timestamp: number): {
    allowed?: boolean;
    reason?: string;
  } {
    const connectionKey = this.getConnectionKey(packet);
    const reverseKey = this.getConnectionKey(packet, true);
    const existingConnection = this.connections.get(connectionKey) || this.connections.get(reverseKey);

    if (existingConnection) {
      // Обновляем существующую UDP "сессию"
      existingConnection.lastSeen = timestamp;
      existingConnection.packets++;
      existingConnection.bytes += packet.bytes || 0;
      existingConnection.state = 'established';
      // UDP соединения разрешаем если они уже установлены
      return { allowed: true, reason: 'Established UDP session' };
    } else {
      // Новая UDP "сессия"
      if (this.connections.size < this.MAX_CONNECTIONS) {
        const newConnection: ConnectionState = {
          source: packet.source,
          destination: packet.destination,
          sourcePort: packet.sourcePort || 0,
          destinationPort: packet.port || 0,
          protocol: 'udp',
          state: 'new',
          firstSeen: timestamp,
          lastSeen: timestamp,
          packets: 1,
          bytes: packet.bytes || 0,
          direction: 'original',
        };
        this.connections.set(connectionKey, newConnection);
        this.stats.totalConnections++;
        // Новые UDP пакеты проверяем правилами
        return {};
      }
    }

    return {};
  }

  /**
   * Process ICMP stateful inspection
   */
  private processICMPStateful(packet: FirewallPacket, timestamp: number): {
    allowed?: boolean;
    reason?: string;
  } {
    const icmpType = packet.icmpType || 0;
    
    // ICMP echo request/reply (ping)
    if (icmpType === 8 || icmpType === 0) {
      const connectionKey = this.getConnectionKey(packet);
      const reverseKey = this.getConnectionKey(packet, true);
      const existingConnection = this.connections.get(connectionKey) || this.connections.get(reverseKey);

      if (existingConnection) {
        // Обновляем существующее ICMP соединение
        existingConnection.lastSeen = timestamp;
        existingConnection.packets++;
        existingConnection.bytes += packet.bytes || 0;
        existingConnection.state = 'established';
        // ICMP reply разрешаем если есть соответствующий request
        if (icmpType === 0 && existingConnection.icmpType === 8) {
          return { allowed: true, reason: 'ICMP echo reply' };
        }
      } else if (icmpType === 8) {
        // Новый ICMP echo request
        if (this.connections.size < this.MAX_CONNECTIONS) {
          const newConnection: ConnectionState = {
            source: packet.source,
            destination: packet.destination,
            sourcePort: 0, // ICMP не использует порты
            destinationPort: 0,
            protocol: 'icmp',
            state: 'new',
            firstSeen: timestamp,
            lastSeen: timestamp,
            packets: 1,
            bytes: packet.bytes || 0,
            direction: 'original',
          };
          // Сохраняем ICMP type для связи
          (newConnection as any).icmpType = icmpType;
          this.connections.set(connectionKey, newConnection);
          this.stats.totalConnections++;
          // Новые ICMP requests проверяем правилами
          return {};
        }
      }
    }

    // ICMP error messages связаны с TCP/UDP соединениями
    if (icmpType >= 3 && icmpType <= 5) {
      // ICMP error (destination unreachable, source quench, redirect)
      // Ищем связанное TCP/UDP соединение
      // Упрощенная реализация - разрешаем ICMP errors для established соединений
      return { allowed: true, reason: 'ICMP error for related connection' };
    }

    return {};
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
   * Clean old connections with protocol-specific timeouts
   */
  public cleanupConnections(): void {
    const now = Date.now();

    for (const [key, connection] of this.connections.entries()) {
      let timeout = this.TCP_ESTABLISHED_TIMEOUT_MS; // Default

      if (connection.protocol === 'tcp') {
        // Разные timeout для разных TCP состояний
        if (connection.state === 'time-wait') {
          timeout = this.TCP_TIME_WAIT_TIMEOUT_MS;
        } else if (connection.state === 'new' || connection.state === 'syn-sent' || connection.state === 'syn-received') {
          timeout = this.TCP_NEW_TIMEOUT_MS;
        } else if (connection.state === 'established') {
          timeout = this.TCP_ESTABLISHED_TIMEOUT_MS;
        } else if (connection.state === 'closed') {
          // Закрытые соединения удаляем сразу
          this.connections.delete(key);
          continue;
        }
      } else if (connection.protocol === 'udp') {
        timeout = this.UDP_TIMEOUT_MS;
      } else if (connection.protocol === 'icmp') {
        timeout = this.ICMP_TIMEOUT_MS;
      }

      if (now - connection.lastSeen > timeout) {
        this.connections.delete(key);
      }
    }

    // Ограничение размера таблицы соединений
    if (this.connections.size > this.MAX_CONNECTIONS) {
      // Удаляем самые старые соединения
      const sorted = Array.from(this.connections.entries())
        .sort((a, b) => a[1].lastSeen - b[1].lastSeen);
      
      const toDelete = sorted.slice(0, this.connections.size - this.MAX_CONNECTIONS);
      for (const [key] of toDelete) {
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


/**
 * IDS/IPS Routing Engine
 * Handles intrusion detection and prevention: signature detection, anomaly detection, behavioral analysis
 */

import { CanvasNode } from '@/types';

export interface IDSIPSSignature {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  severity: 'critical' | 'high' | 'medium' | 'low';
  pattern: string; // Detection pattern (regex, Snort rule, etc.)
  action: 'alert' | 'block' | 'log';
  protocol?: 'tcp' | 'udp' | 'icmp' | 'all';
  sourceIP?: string; // IP or CIDR
  destinationIP?: string; // IP or CIDR
  port?: number;
  sourcePort?: number;
}

export interface IDSIPSAlert {
  id: string;
  type: 'signature' | 'anomaly' | 'behavioral';
  sourceIP: string;
  destinationIP: string;
  protocol: string;
  port?: number;
  sourcePort?: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  timestamp: number;
  description: string;
  blocked: boolean;
  signature?: string;
  signatureId?: string;
  anomalyScore?: number;
  behavioralPattern?: string;
}

export interface IDSIPSPacket {
  source: string; // IP address
  destination: string; // IP address
  protocol: 'tcp' | 'udp' | 'icmp' | 'all';
  port?: number; // Destination port
  sourcePort?: number; // Source port
  payload?: string; // Packet payload/data
  timestamp?: number;
}

export interface IDSIPSResponse {
  allowed: boolean;
  blocked: boolean;
  alertGenerated: boolean;
  latency: number;
  alert?: IDSIPSAlert;
  error?: string;
}

export interface IDSIPSConfig {
  mode?: 'ids' | 'ips'; // IDS = detection only, IPS = prevention (blocking)
  enableSignatureDetection?: boolean;
  enableAnomalyDetection?: boolean;
  enableBehavioralAnalysis?: boolean;
  alertThreshold?: 'low' | 'medium' | 'high' | 'critical';
  enableAutoBlock?: boolean;
  blockDuration?: number; // seconds
  enableLogging?: boolean;
  logRetention?: number; // days
  signatures?: IDSIPSSignature[];
}

export interface IDSIPSStats {
  totalPackets: number;
  packetsAnalyzed: number;
  alertsGenerated: number;
  alertsBlocked: number;
  signatureMatches: number;
  anomalyDetections: number;
  behavioralDetections: number;
  activeSignatures: number;
  blockedIPs: number;
}

/**
 * Blocked IP entry
 */
interface BlockedIP {
  ip: string;
  reason: string;
  blockedAt: number;
  expiresAt: number;
}

/**
 * Behavioral pattern tracking (for ML-based detection)
 */
interface BehavioralPattern {
  sourceIP: string;
  destinationIP: string;
  protocol: string;
  port?: number;
  requestCount: number;
  firstSeen: number;
  lastSeen: number;
  suspiciousScore: number;
}

/**
 * IDS/IPS Routing Engine
 * Simulates intrusion detection and prevention behavior
 */
export class IDSIPSRoutingEngine {
  private config: IDSIPSConfig | null = null;
  private signatures: Map<string, IDSIPSSignature> = new Map();
  private alerts: IDSIPSAlert[] = [];
  private stats: IDSIPSStats = {
    totalPackets: 0,
    packetsAnalyzed: 0,
    alertsGenerated: 0,
    alertsBlocked: 0,
    signatureMatches: 0,
    anomalyDetections: 0,
    behavioralDetections: 0,
    activeSignatures: 0,
    blockedIPs: 0,
  };

  // Blocked IPs tracking
  private blockedIPs: Map<string, BlockedIP> = new Map();

  // Behavioral analysis tracking
  private behavioralPatterns: Map<string, BehavioralPattern> = new Map();
  private readonly MAX_BEHAVIORAL_PATTERNS = 10000;
  private readonly BEHAVIORAL_WINDOW_MS = 300000; // 5 minutes

  // Alert history (keep last 10000 alerts)
  private readonly MAX_ALERTS = 10000;

  /**
   * Initialize IDS/IPS configuration from node
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
    };

    // Load signatures
    this.signatures.clear();
    if (this.config.signatures) {
      for (const sig of this.config.signatures) {
        if (sig.id && sig.enabled) {
          this.signatures.set(sig.id, sig);
        }
      }
    }

    // Load blocked IPs from config
    if (Array.isArray(raw.blockedIPs)) {
      this.blockedIPs.clear();
      for (const blocked of raw.blockedIPs) {
        if (blocked.ip) {
          const expiresAt = blocked.expiresAt
            ? new Date(blocked.expiresAt).getTime()
            : Date.now() + (this.config.blockDuration || 3600) * 1000;
          this.blockedIPs.set(blocked.ip, {
            ip: blocked.ip,
            reason: blocked.reason || 'Intrusion detected',
            blockedAt: blocked.blockedAt ? new Date(blocked.blockedAt).getTime() : Date.now(),
            expiresAt,
          });
        }
      }
    }

    // Update stats
    this.stats.activeSignatures = Array.from(this.signatures.values()).filter(s => s.enabled).length;
    this.stats.blockedIPs = this.blockedIPs.size;

    // Clean expired blocked IPs
    this.cleanExpiredBlocks();
  }

  /**
   * Process incoming packet through IDS/IPS
   */
  public processPacket(packet: IDSIPSPacket): IDSIPSResponse {
    const startTime = performance.now();
    this.stats.totalPackets++;

    // Check if source IP is blocked
    if (this.isIPBlocked(packet.source)) {
      this.stats.alertsBlocked++;
      return {
        allowed: false,
        blocked: true,
        alertGenerated: false,
        latency: performance.now() - startTime,
        error: `IP ${packet.source} is blocked`,
      };
    }

    // Analyze packet
    this.stats.packetsAnalyzed++;

    let alert: IDSIPSAlert | undefined;
    let shouldBlock = false;

    // 1. Signature Detection
    if (this.config?.enableSignatureDetection) {
      const signatureMatch = this.detectSignature(packet);
      if (signatureMatch) {
        alert = signatureMatch;
        this.stats.signatureMatches++;
        this.stats.alertsGenerated++;

        if (signatureMatch.signatureId) {
          const sig = this.signatures.get(signatureMatch.signatureId);
          if (sig && sig.action === 'block' && this.config.mode === 'ips') {
            shouldBlock = true;
          }
        }
      }
    }

    // 2. Anomaly Detection
    if (!alert && this.config?.enableAnomalyDetection) {
      const anomaly = this.detectAnomaly(packet);
      if (anomaly) {
        alert = anomaly;
        this.stats.anomalyDetections++;
        this.stats.alertsGenerated++;

        // Auto-block if threshold exceeded
        if (this.config.enableAutoBlock && anomaly.anomalyScore && anomaly.anomalyScore > 0.8) {
          shouldBlock = true;
        }
      }
    }

    // 3. Behavioral Analysis
    if (!alert && this.config?.enableBehavioralAnalysis) {
      const behavioral = this.detectBehavioral(packet);
      if (behavioral) {
        alert = behavioral;
        this.stats.behavioralDetections++;
        this.stats.alertsGenerated++;

        // Auto-block suspicious patterns
        if (this.config.enableAutoBlock && behavioral.behavioralPattern === 'suspicious') {
          shouldBlock = true;
        }
      }
    }

    // Block if needed (IPS mode)
    if (shouldBlock && this.config?.mode === 'ips') {
      this.blockIP(packet.source, alert?.description || 'Intrusion detected', alert?.signatureId);
      this.stats.alertsBlocked++;
      alert = alert ? { ...alert, blocked: true } : undefined;
    }

    // Generate alert if threshold met
    if (alert && this.shouldGenerateAlert(alert.severity)) {
      this.addAlert(alert);
    }

    const latency = performance.now() - startTime;

    return {
      allowed: !shouldBlock,
      blocked: shouldBlock,
      alertGenerated: !!alert,
      latency,
      alert,
    };
  }

  /**
   * Detect signature match
   */
  private detectSignature(packet: IDSIPSPacket): IDSIPSAlert | null {
    const sortedSignatures = Array.from(this.signatures.values())
      .filter(s => s.enabled)
      .sort((a, b) => {
        const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        return severityOrder[b.severity] - severityOrder[a.severity];
      });

    for (const sig of sortedSignatures) {
      // Check protocol match
      if (sig.protocol && sig.protocol !== 'all' && sig.protocol !== packet.protocol) {
        continue;
      }

      // Check IP match
      if (sig.sourceIP && !this.matchIP(packet.source, sig.sourceIP)) {
        continue;
      }
      if (sig.destinationIP && !this.matchIP(packet.destination, sig.destinationIP)) {
        continue;
      }

      // Check port match
      if (sig.port !== undefined && packet.port !== undefined && sig.port !== packet.port) {
        continue;
      }
      if (sig.sourcePort !== undefined && packet.sourcePort !== undefined && sig.sourcePort !== packet.sourcePort) {
        continue;
      }

      // Check pattern match (simplified regex matching)
      if (sig.pattern && packet.payload) {
        try {
          const regex = new RegExp(sig.pattern, 'i');
          if (regex.test(packet.payload)) {
            return {
              id: `alert-${Date.now()}-${Math.random()}`,
              type: 'signature',
              sourceIP: packet.source,
              destinationIP: packet.destination,
              protocol: packet.protocol,
              port: packet.port,
              sourcePort: packet.sourcePort,
              severity: sig.severity,
              timestamp: packet.timestamp || Date.now(),
              description: sig.description || `Signature match: ${sig.name}`,
              blocked: false,
              signature: sig.name,
              signatureId: sig.id,
            };
          }
        } catch (e) {
          // Invalid regex pattern, skip
        }
      } else if (!sig.pattern) {
        // Signature without pattern (IP/port based)
        return {
          id: `alert-${Date.now()}-${Math.random()}`,
          type: 'signature',
          sourceIP: packet.source,
          destinationIP: packet.destination,
          protocol: packet.protocol,
          port: packet.port,
          sourcePort: packet.sourcePort,
          severity: sig.severity,
          timestamp: packet.timestamp || Date.now(),
          description: sig.description || `Signature match: ${sig.name}`,
          blocked: false,
          signature: sig.name,
          signatureId: sig.id,
        };
      }
    }

    return null;
  }

  /**
   * Detect anomaly in packet
   */
  private detectAnomaly(packet: IDSIPSPacket): IDSIPSAlert | null {
    // Simplified anomaly detection based on:
    // - Unusual port access
    // - Unusual protocol usage
    // - Unusual payload size
    // - Unusual source IP patterns

    let anomalyScore = 0;

    // Check for unusual ports (commonly attacked ports)
    const suspiciousPorts = [22, 23, 80, 443, 3306, 5432, 27017, 6379, 8080];
    if (packet.port && suspiciousPorts.includes(packet.port)) {
      anomalyScore += 0.2;
    }

    // Check for unusual protocols
    if (packet.protocol === 'icmp') {
      anomalyScore += 0.1;
    }

    // Check payload size (very large or very small)
    if (packet.payload) {
      const payloadSize = packet.payload.length;
      if (payloadSize > 10000 || payloadSize < 10) {
        anomalyScore += 0.3;
      }
    }

    // Check for suspicious patterns in payload
    if (packet.payload) {
      const suspiciousPatterns = ['SELECT', 'UNION', 'DROP', 'DELETE', 'INSERT', 'UPDATE', '<script', 'eval(', 'base64'];
      for (const pattern of suspiciousPatterns) {
        if (packet.payload.toLowerCase().includes(pattern.toLowerCase())) {
          anomalyScore += 0.4;
          break;
        }
      }
    }

    // Generate alert if score exceeds threshold
    const threshold = this.getAnomalyThreshold();
    if (anomalyScore >= threshold) {
      const severity = anomalyScore >= 0.8 ? 'critical' : anomalyScore >= 0.6 ? 'high' : 'medium';
      return {
        id: `alert-${Date.now()}-${Math.random()}`,
        type: 'anomaly',
        sourceIP: packet.source,
        destinationIP: packet.destination,
        protocol: packet.protocol,
        port: packet.port,
        sourcePort: packet.sourcePort,
        severity,
        timestamp: packet.timestamp || Date.now(),
        description: `Anomaly detected: unusual network activity (score: ${anomalyScore.toFixed(2)})`,
        blocked: false,
        anomalyScore,
      };
    }

    return null;
  }

  /**
   * Detect behavioral patterns
   */
  private detectBehavioral(packet: IDSIPSPacket): IDSIPSAlert | null {
    const patternKey = `${packet.source}-${packet.destination}-${packet.protocol}-${packet.port || 'any'}`;
    const now = Date.now();

    // Get or create pattern
    let pattern = this.behavioralPatterns.get(patternKey);
    if (!pattern) {
      pattern = {
        sourceIP: packet.source,
        destinationIP: packet.destination,
        protocol: packet.protocol,
        port: packet.port,
        requestCount: 0,
        firstSeen: now,
        lastSeen: now,
        suspiciousScore: 0,
      };
      this.behavioralPatterns.set(patternKey, pattern);
    }

    // Update pattern
    pattern.requestCount++;
    pattern.lastSeen = now;

    // Clean old patterns
    if (this.behavioralPatterns.size > this.MAX_BEHAVIORAL_PATTERNS) {
      this.cleanOldBehavioralPatterns();
    }

    // Calculate suspicious score
    const timeWindow = (now - pattern.firstSeen) / 1000; // seconds
    const requestsPerSecond = timeWindow > 0 ? pattern.requestCount / timeWindow : pattern.requestCount;

    // High request rate = suspicious
    if (requestsPerSecond > 10) {
      pattern.suspiciousScore = Math.min(1.0, requestsPerSecond / 100);
    }

    // Generate alert if suspicious
    if (pattern.suspiciousScore > 0.7) {
      return {
        id: `alert-${Date.now()}-${Math.random()}`,
        type: 'behavioral',
        sourceIP: packet.source,
        destinationIP: packet.destination,
        protocol: packet.protocol,
        port: packet.port,
        sourcePort: packet.sourcePort,
        severity: pattern.suspiciousScore > 0.9 ? 'critical' : 'high',
        timestamp: now,
        description: `Behavioral pattern detected: high request rate (${requestsPerSecond.toFixed(2)} req/s)`,
        blocked: false,
        behavioralPattern: 'suspicious',
      };
    }

    return null;
  }

  /**
   * Check if IP is blocked
   */
  private isIPBlocked(ip: string): boolean {
    this.cleanExpiredBlocks();
    return this.blockedIPs.has(ip);
  }

  /**
   * Block IP address
   */
  private blockIP(ip: string, reason: string, signatureId?: string): void {
    const expiresAt = Date.now() + (this.config?.blockDuration || 3600) * 1000;
    this.blockedIPs.set(ip, {
      ip,
      reason,
      blockedAt: Date.now(),
      expiresAt,
    });
    this.stats.blockedIPs = this.blockedIPs.size;
  }

  /**
   * Clean expired blocked IPs
   */
  private cleanExpiredBlocks(): void {
    const now = Date.now();
    for (const [ip, blocked] of this.blockedIPs.entries()) {
      if (blocked.expiresAt < now) {
        this.blockedIPs.delete(ip);
      }
    }
    this.stats.blockedIPs = this.blockedIPs.size;
  }

  /**
   * Clean old behavioral patterns
   */
  private cleanOldBehavioralPatterns(): void {
    const now = Date.now();
    for (const [key, pattern] of this.behavioralPatterns.entries()) {
      if (now - pattern.lastSeen > this.BEHAVIORAL_WINDOW_MS) {
        this.behavioralPatterns.delete(key);
      }
    }
  }

  /**
   * Check if alert should be generated based on threshold
   */
  private shouldGenerateAlert(severity: 'critical' | 'high' | 'medium' | 'low'): boolean {
    const threshold = this.config?.alertThreshold || 'medium';
    const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    const thresholdOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    return severityOrder[severity] >= thresholdOrder[threshold];
  }

  /**
   * Get anomaly detection threshold
   */
  private getAnomalyThreshold(): number {
    const threshold = this.config?.alertThreshold || 'medium';
    const thresholds = { low: 0.9, medium: 0.7, high: 0.5, critical: 0.3 };
    return thresholds[threshold];
  }

  /**
   * Match IP address against pattern (IP or CIDR)
   */
  private matchIP(ip: string, pattern: string): boolean {
    if (ip === pattern) return true;

    // CIDR matching (simplified)
    if (pattern.includes('/')) {
      const [network, prefixLength] = pattern.split('/');
      const prefix = parseInt(prefixLength, 10);
      // Simplified CIDR matching - in production would use proper IP address library
      return ip.startsWith(network.split('.').slice(0, Math.floor(prefix / 8)).join('.'));
    }

    return false;
  }

  /**
   * Add alert to history
   */
  private addAlert(alert: IDSIPSAlert): void {
    this.alerts.push(alert);
    if (this.alerts.length > this.MAX_ALERTS) {
      this.alerts.shift();
    }
  }

  /**
   * Get alerts
   */
  public getAlerts(limit: number = 100): IDSIPSAlert[] {
    return this.alerts.slice(-limit).reverse();
  }

  /**
   * Get blocked IPs
   */
  public getBlockedIPs(): BlockedIP[] {
    this.cleanExpiredBlocks();
    return Array.from(this.blockedIPs.values());
  }

  /**
   * Unblock IP
   */
  public unblockIP(ip: string): void {
    this.blockedIPs.delete(ip);
    this.stats.blockedIPs = this.blockedIPs.size;
  }

  /**
   * Get statistics
   */
  public getStats(): IDSIPSStats {
    return { ...this.stats };
  }

  /**
   * Get signatures
   */
  public getSignatures(): IDSIPSSignature[] {
    return Array.from(this.signatures.values());
  }

  /**
   * Reset statistics
   */
  public resetStats(): void {
    this.stats = {
      totalPackets: 0,
      packetsAnalyzed: 0,
      alertsGenerated: 0,
      alertsBlocked: 0,
      signatureMatches: 0,
      anomalyDetections: 0,
      behavioralDetections: 0,
      activeSignatures: this.stats.activeSignatures,
      blockedIPs: this.blockedIPs.size,
    };
  }
}


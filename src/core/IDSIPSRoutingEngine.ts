/**
 * IDS/IPS Routing Engine
 * Handles intrusion detection and prevention: signature detection, anomaly detection, behavioral analysis
 */

import { CanvasNode } from '@/types';
import { parseSnortRule, ParsedSnortRule } from '@/utils/idsips/signatureParser';

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
  // Дополнительная информация для протокольного анализа
  tcpFlags?: { syn?: boolean; ack?: boolean; fin?: boolean; rst?: boolean; psh?: boolean; urg?: boolean };
  tcpSeq?: number; // TCP sequence number
  tcpAck?: number; // TCP acknowledgment number
  fragmentOffset?: number; // Fragment offset
  fragmentId?: number; // Fragment ID
  isFragment?: boolean; // Is this a fragmented packet
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
  // Временные паттерны
  hourlyPatterns: Map<number, number>; // hour -> count
  dailyPatterns: Map<number, number>; // day of week -> count
  // Географические паттерны (если доступны)
  country?: string;
  // Паттерны сканирования
  portScanning: boolean;
  networkScanning: boolean;
  ddosPattern: boolean;
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

  // Cache for parsed Snort rules (signature ID -> parsed rule)
  private parsedSnortRules: Map<string, ParsedSnortRule> = new Map();

  // Blocked IPs tracking
  private blockedIPs: Map<string, BlockedIP> = new Map();

  // Behavioral analysis tracking
  private behavioralPatterns: Map<string, BehavioralPattern> = new Map();
  private readonly MAX_BEHAVIORAL_PATTERNS = 10000;
  private readonly BEHAVIORAL_WINDOW_MS = 300000; // 5 minutes

  // Alert history (keep last 10000 alerts)
  private readonly MAX_ALERTS = 10000;

  // Anomaly detection baselines (statistical analysis)
  private portBaselines: Map<number, { count: number; mean: number; stdDev: number; lastSeen: number }> = new Map();
  private protocolBaselines: Map<string, { count: number; mean: number; stdDev: number; lastSeen: number }> = new Map();
  private payloadSizeBaselines: { count: number; mean: number; stdDev: number; samples: number[] } = {
    count: 0,
    mean: 0,
    stdDev: 0,
    samples: [],
  };
  private readonly MAX_BASELINE_SAMPLES = 1000;
  private readonly BASELINE_LEARNING_WINDOW_MS = 600000; // 10 minutes

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
    this.parsedSnortRules.clear(); // Clear parsed rules cache
    if (this.config.signatures) {
      for (const sig of this.config.signatures) {
        if (sig.id && sig.enabled) {
          this.signatures.set(sig.id, sig);
          
          // Try to parse as Snort rule and cache if successful
          if (sig.pattern) {
            const parseResult = parseSnortRule(sig.pattern);
            if (parseResult.valid && parseResult.parsed) {
              this.parsedSnortRules.set(sig.id, parseResult.parsed);
            }
          }
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

    // 0. Protocol Analysis (Deep Packet Inspection) - проверяем перед другими методами
    if (packet.protocol === 'tcp' && packet.tcpFlags) {
      const protocolAlert = this.analyzeProtocol(packet);
      if (protocolAlert) {
        alert = protocolAlert;
        this.stats.anomalyDetections++;
        this.stats.alertsGenerated++;

        // Auto-block suspicious protocol violations
        if (this.config?.enableAutoBlock && protocolAlert.severity === 'critical') {
          shouldBlock = true;
        }
      }
    }

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
   * Protocol analysis (Deep Packet Inspection)
   * Analyzes TCP flags, sequence numbers, fragmentation
   */
  private analyzeProtocol(packet: IDSIPSPacket): IDSIPSAlert | null {
    if (packet.protocol !== 'tcp' || !packet.tcpFlags) {
      return null;
    }

    const flags = packet.tcpFlags;
    const reasons: string[] = [];

    // Check for suspicious TCP flag combinations
    // SYN without ACK is normal for connection establishment
    // But SYN+ACK without proper handshake is suspicious
    if (flags.syn && flags.ack && !flags.fin && !flags.rst) {
      // SYN+ACK is normal in TCP handshake, but check sequence numbers
      if (packet.tcpSeq !== undefined && packet.tcpAck !== undefined) {
        // Check for sequence number anomalies
        if (packet.tcpSeq === 0 && packet.tcpAck === 0) {
          reasons.push('Suspicious TCP sequence numbers (both zero)');
        }
      }
    }

    // FIN without ACK is suspicious (connection termination without acknowledgment)
    if (flags.fin && !flags.ack) {
      reasons.push('Suspicious TCP flags: FIN without ACK');
    }

    // RST flag indicates connection reset - could be port scanning
    if (flags.rst && !flags.ack) {
      reasons.push('TCP RST flag detected (possible port scanning)');
    }

    // Multiple flags set simultaneously (except SYN+ACK which is normal)
    const flagCount = [flags.syn, flags.ack, flags.fin, flags.rst, flags.psh, flags.urg].filter(Boolean).length;
    if (flagCount > 2 && !(flags.syn && flags.ack)) {
      reasons.push(`Multiple TCP flags set simultaneously (${flagCount} flags)`);
    }

    // Check for fragmentation attacks
    if (packet.isFragment) {
      reasons.push('Fragmented packet detected');
      
      // Check for overlapping fragments (potential attack)
      if (packet.fragmentOffset !== undefined && packet.fragmentId !== undefined) {
        // Store fragment info for reassembly checking (simplified)
        // In real IDS/IPS, would track fragments and check for overlaps
      }
    }

    // Check for out-of-order packets (if sequence numbers are available)
    if (packet.tcpSeq !== undefined) {
      // In real IDS/IPS, would track sequence numbers per connection
      // Here we do basic validation
      if (packet.tcpSeq < 0 || packet.tcpSeq > 4294967295) {
        reasons.push('Invalid TCP sequence number');
      }
    }

    // Generate alert if protocol violations detected
    if (reasons.length > 0) {
      const severity = reasons.some(r => r.includes('critical') || r.includes('attack')) ? 'critical' :
                       reasons.length > 2 ? 'high' : 'medium';
      
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
        description: `Protocol violation detected: ${reasons.join('; ')}`,
        blocked: false,
        anomalyScore: Math.min(1.0, reasons.length * 0.2),
      };
    }

    return null;
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

      // Check pattern match (Snort rule or regex)
      if (sig.pattern && packet.payload) {
        // Check if this is a cached Snort rule
        const parsedSnort = this.parsedSnortRules.get(sig.id);
        
        if (parsedSnort) {
          // This is a Snort rule - check content option
          const content = parsedSnort.options.content;
          if (content) {
            try {
              // Snort content option can be a simple string or regex-like pattern
              // For simplicity, we'll do a case-insensitive search
              // In real Snort, content matching is more complex (byte matching, etc.)
              if (packet.payload.toLowerCase().includes(content.toLowerCase())) {
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
                  description: sig.description || parsedSnort.options.msg || `Signature match: ${sig.name}`,
                  blocked: false,
                  signature: sig.name,
                  signatureId: sig.id,
                };
              }
            } catch (e) {
              // Error matching content, skip
            }
          } else {
            // Snort rule without content - IP/port based match (already checked above)
            // If we got here, it means IP/port matched, so this is a match
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
              description: sig.description || parsedSnort.options.msg || `Signature match: ${sig.name}`,
              blocked: false,
              signature: sig.name,
              signatureId: sig.id,
            };
          }
        } else {
          // Not a Snort rule, treat as regex pattern
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
   * Detect anomaly in packet using statistical baselines
   */
  private detectAnomaly(packet: IDSIPSPacket): IDSIPSAlert | null {
    // Update baselines first (learning phase)
    this.updateBaselines(packet);

    let anomalyScore = 0;
    const reasons: string[] = [];

    // Check for unusual port access (statistical deviation from baseline)
    if (packet.port !== undefined) {
      const baseline = this.portBaselines.get(packet.port);
      if (baseline && baseline.count > 10) {
        // Port is known, check if access frequency is anomalous
        const timeSinceLastSeen = Date.now() - baseline.lastSeen;
        const expectedInterval = baseline.mean;
        
        // If port was accessed too frequently or after long silence
        if (timeSinceLastSeen < expectedInterval * 0.1) {
          anomalyScore += 0.3;
          reasons.push(`Unusual port ${packet.port} access frequency`);
        }
      } else if (!baseline) {
        // Unknown port - could be suspicious if it's not a common port
        const commonPorts = [80, 443, 22, 53, 25, 110, 143, 993, 995, 3306, 5432, 27017, 6379, 8080, 8443];
        if (!commonPorts.includes(packet.port)) {
          anomalyScore += 0.2;
          reasons.push(`Access to uncommon port ${packet.port}`);
        }
      }
    }

    // Check for unusual protocol usage (statistical deviation)
    const protocolBaseline = this.protocolBaselines.get(packet.protocol);
    if (protocolBaseline && protocolBaseline.count > 10) {
      const timeSinceLastSeen = Date.now() - protocolBaseline.lastSeen;
      const expectedInterval = protocolBaseline.mean;
      
      if (timeSinceLastSeen < expectedInterval * 0.1) {
        anomalyScore += 0.2;
        reasons.push(`Unusual ${packet.protocol} protocol usage`);
      }
    }

    // Check payload size (statistical deviation from baseline)
    if (packet.payload) {
      const payloadSize = packet.payload.length;
      const baseline = this.payloadSizeBaselines;
      
      if (baseline.count > 20) {
        const zScore = Math.abs((payloadSize - baseline.mean) / (baseline.stdDev || 1));
        
        // Z-score > 3 indicates significant deviation (3-sigma rule)
        if (zScore > 3) {
          anomalyScore += 0.3;
          reasons.push(`Unusual payload size: ${payloadSize} bytes (z-score: ${zScore.toFixed(2)})`);
        }
      }
    }

    // Check for suspicious patterns in payload (signature-based, not statistical)
    if (packet.payload) {
      const suspiciousPatterns = [
        { pattern: /SELECT.*FROM.*WHERE.*OR.*1\s*=\s*1/i, weight: 0.4, name: 'SQL Injection' },
        { pattern: /UNION.*SELECT/i, weight: 0.4, name: 'SQL Injection (UNION)' },
        { pattern: /DROP\s+TABLE/i, weight: 0.5, name: 'SQL DROP TABLE' },
        { pattern: /<script[^>]*>/i, weight: 0.4, name: 'XSS attempt' },
        { pattern: /eval\s*\(/i, weight: 0.3, name: 'Code injection' },
        { pattern: /base64_decode/i, weight: 0.3, name: 'Obfuscated code' },
        { pattern: /\.\.\/\.\.\/\.\./i, weight: 0.3, name: 'Path traversal' },
        { pattern: /\/etc\/passwd/i, weight: 0.4, name: 'File access attempt' },
      ];
      
      for (const { pattern, weight, name } of suspiciousPatterns) {
        if (pattern.test(packet.payload)) {
          anomalyScore += weight;
          reasons.push(name);
          break; // Only count first match
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
        description: `Anomaly detected: ${reasons.join('; ')} (score: ${anomalyScore.toFixed(2)})`,
        blocked: false,
        anomalyScore,
      };
    }

    return null;
  }

  /**
   * Update statistical baselines for anomaly detection
   */
  private updateBaselines(packet: IDSIPSPacket): void {
    const now = Date.now();

    // Update port baseline
    if (packet.port !== undefined) {
      const baseline = this.portBaselines.get(packet.port) || {
        count: 0,
        mean: 0,
        stdDev: 0,
        lastSeen: now,
      };
      
      const timeSinceLastSeen = now - baseline.lastSeen;
      baseline.count++;
      
      // Update mean (exponential moving average)
      const alpha = 0.1; // Learning rate
      baseline.mean = baseline.mean * (1 - alpha) + timeSinceLastSeen * alpha;
      
      // Update stdDev (simplified)
      if (baseline.count > 1) {
        const variance = Math.pow(timeSinceLastSeen - baseline.mean, 2);
        baseline.stdDev = Math.sqrt(variance * alpha + baseline.stdDev * baseline.stdDev * (1 - alpha));
      }
      
      baseline.lastSeen = now;
      this.portBaselines.set(packet.port, baseline);
    }

    // Update protocol baseline
    const protocolBaseline = this.protocolBaselines.get(packet.protocol) || {
      count: 0,
      mean: 0,
      stdDev: 0,
      lastSeen: now,
    };
    
    const timeSinceLastProtocolSeen = now - protocolBaseline.lastSeen;
    protocolBaseline.count++;
    
    const alpha = 0.1;
    protocolBaseline.mean = protocolBaseline.mean * (1 - alpha) + timeSinceLastProtocolSeen * alpha;
    
    if (protocolBaseline.count > 1) {
      const variance = Math.pow(timeSinceLastProtocolSeen - protocolBaseline.mean, 2);
      protocolBaseline.stdDev = Math.sqrt(variance * alpha + protocolBaseline.stdDev * protocolBaseline.stdDev * (1 - alpha));
    }
    
    protocolBaseline.lastSeen = now;
    this.protocolBaselines.set(packet.protocol, protocolBaseline);

    // Update payload size baseline
    if (packet.payload) {
      const payloadSize = packet.payload.length;
      const baseline = this.payloadSizeBaselines;
      
      baseline.samples.push(payloadSize);
      if (baseline.samples.length > this.MAX_BASELINE_SAMPLES) {
        baseline.samples.shift();
      }
      
      baseline.count = baseline.samples.length;
      
      // Calculate mean
      const sum = baseline.samples.reduce((a, b) => a + b, 0);
      baseline.mean = sum / baseline.samples.length;
      
      // Calculate stdDev
      if (baseline.samples.length > 1) {
        const variance = baseline.samples.reduce((acc, val) => acc + Math.pow(val - baseline.mean, 2), 0) / baseline.samples.length;
        baseline.stdDev = Math.sqrt(variance);
      }
    }
  }

  /**
   * Detect behavioral patterns (improved with temporal and geographic analysis)
   */
  private detectBehavioral(packet: IDSIPSPacket): IDSIPSAlert | null {
    const patternKey = `${packet.source}-${packet.destination}-${packet.protocol}-${packet.port || 'any'}`;
    const now = Date.now();
    const date = new Date(now);

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
        hourlyPatterns: new Map(),
        dailyPatterns: new Map(),
        portScanning: false,
        networkScanning: false,
        ddosPattern: false,
      };
      this.behavioralPatterns.set(patternKey, pattern);
    }

    // Update pattern
    pattern.requestCount++;
    pattern.lastSeen = now;

    // Update temporal patterns
    const hour = date.getHours();
    pattern.hourlyPatterns.set(hour, (pattern.hourlyPatterns.get(hour) || 0) + 1);
    
    const dayOfWeek = date.getDay();
    pattern.dailyPatterns.set(dayOfWeek, (pattern.dailyPatterns.get(dayOfWeek) || 0) + 1);

    // Clean old patterns
    if (this.behavioralPatterns.size > this.MAX_BEHAVIORAL_PATTERNS) {
      this.cleanOldBehavioralPatterns();
    }

    // Calculate suspicious score based on multiple factors
    const timeWindow = (now - pattern.firstSeen) / 1000; // seconds
    const requestsPerSecond = timeWindow > 0 ? pattern.requestCount / timeWindow : pattern.requestCount;

    // Factor 1: High request rate
    let suspiciousScore = 0;
    if (requestsPerSecond > 10) {
      suspiciousScore += Math.min(0.4, requestsPerSecond / 250);
    }

    // Factor 2: Temporal anomaly (unusual time of day)
    const currentHourCount = pattern.hourlyPatterns.get(hour) || 0;
    const avgHourlyCount = pattern.requestCount / 24;
    if (currentHourCount > avgHourlyCount * 3) {
      suspiciousScore += 0.2;
    }

    // Factor 3: Port scanning detection
    if (this.detectPortScanning(packet.source)) {
      pattern.portScanning = true;
      suspiciousScore += 0.3;
    }

    // Factor 4: Network scanning detection
    if (this.detectNetworkScanning(packet.source)) {
      pattern.networkScanning = true;
      suspiciousScore += 0.3;
    }

    // Factor 5: DDoS pattern detection
    if (this.detectDDoSPattern(packet.source)) {
      pattern.ddosPattern = true;
      suspiciousScore += 0.4;
    }

    pattern.suspiciousScore = Math.min(1.0, suspiciousScore);

    // Generate alert if suspicious
    if (pattern.suspiciousScore > 0.7) {
      const reasons: string[] = [];
      if (requestsPerSecond > 10) {
        reasons.push(`High request rate (${requestsPerSecond.toFixed(2)} req/s)`);
      }
      if (pattern.portScanning) {
        reasons.push('Port scanning detected');
      }
      if (pattern.networkScanning) {
        reasons.push('Network scanning detected');
      }
      if (pattern.ddosPattern) {
        reasons.push('DDoS pattern detected');
      }
      if (currentHourCount > avgHourlyCount * 3) {
        reasons.push(`Unusual activity at hour ${hour}`);
      }

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
        description: `Behavioral pattern detected: ${reasons.join('; ')}`,
        blocked: false,
        behavioralPattern: pattern.portScanning || pattern.networkScanning || pattern.ddosPattern ? 'attack' : 'suspicious',
      };
    }

    return null;
  }

  /**
   * Detect port scanning (multiple ports from same source IP)
   */
  private detectPortScanning(sourceIP: string): boolean {
    // Count unique ports accessed by this source IP
    const ports = new Set<number>();
    for (const [key, pattern] of this.behavioralPatterns.entries()) {
      if (pattern.sourceIP === sourceIP && pattern.port !== undefined) {
        ports.add(pattern.port);
      }
    }
    
    // If source IP accessed more than 10 different ports, likely port scanning
    return ports.size > 10;
  }

  /**
   * Detect network scanning (multiple destinations from same source IP)
   */
  private detectNetworkScanning(sourceIP: string): boolean {
    // Count unique destinations accessed by this source IP
    const destinations = new Set<string>();
    for (const [key, pattern] of this.behavioralPatterns.entries()) {
      if (pattern.sourceIP === sourceIP) {
        destinations.add(pattern.destinationIP);
      }
    }
    
    // If source IP accessed more than 20 different destinations, likely network scanning
    return destinations.size > 20;
  }

  /**
   * Detect DDoS pattern (high request rate from multiple sources to same destination)
   */
  private detectDDoSPattern(sourceIP: string): boolean {
    // Count unique sources accessing same destination
    const sources = new Set<string>();
    for (const [key, pattern] of this.behavioralPatterns.entries()) {
      // Check if this source is part of a DDoS (many sources to same destination)
      if (pattern.destinationIP) {
        sources.add(pattern.sourceIP);
      }
    }
    
    // If more than 50 different sources accessing same destination, likely DDoS
    return sources.size > 50;
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
   * Uses proper CIDR matching logic
   */
  private matchIP(ip: string, pattern: string): boolean {
    if (ip === pattern) return true;

    // CIDR matching
    if (pattern.includes('/')) {
      const [network, prefixLengthStr] = pattern.split('/');
      const prefixLength = parseInt(prefixLengthStr, 10);
      
      if (isNaN(prefixLength) || prefixLength < 0 || prefixLength > 32) {
        return false;
      }

      // Convert IP addresses to numbers for comparison
      const ipNum = this.ipToNumber(ip);
      const networkNum = this.ipToNumber(network);
      
      if (isNaN(ipNum) || isNaN(networkNum)) {
        return false;
      }

      // Calculate network mask
      const mask = prefixLength === 0 ? 0 : (0xFFFFFFFF << (32 - prefixLength)) >>> 0;
      
      // Check if IP is in the network
      return (ipNum & mask) === (networkNum & mask);
    }

    return false;
  }

  /**
   * Convert IP address string to number
   */
  private ipToNumber(ip: string): number {
    const parts = ip.split('.');
    if (parts.length !== 4) {
      return NaN;
    }
    
    let num = 0;
    for (let i = 0; i < 4; i++) {
      const part = parseInt(parts[i], 10);
      if (isNaN(part) || part < 0 || part > 255) {
        return NaN;
      }
      num = (num << 8) + part;
    }
    
    return num >>> 0; // Convert to unsigned 32-bit integer
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


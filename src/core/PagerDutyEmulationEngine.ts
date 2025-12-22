import { CanvasNode } from '@/types';
import { Alert } from './AlertSystem';

export type PagerDutySeverity = 'critical' | 'error' | 'warning' | 'info';

export interface PagerDutyServiceConfig {
  id: string;
  name: string;
  integrationKey?: string;
  status?: 'active' | 'maintenance' | 'disabled';
  escalationPolicy?: string;
  autoResolve?: boolean;
  resolveTimeout?: number; // seconds
}

export interface PagerDutyIncident {
  id: string;
  title: string;
  serviceId: string;
  status: 'triggered' | 'acknowledged' | 'resolved';
  severity: PagerDutySeverity;
  createdAt: number;
  acknowledgedAt?: number;
  resolvedAt?: number;
  lastSignalAt?: number;
  alertIds?: string[];
}

export interface PagerDutyEscalationLevel {
  level: number;
  timeout: number; // minutes
  targets: string[]; // user ids or schedule ids
}

export interface PagerDutyEscalationPolicy {
  id: string;
  name: string;
  levels: PagerDutyEscalationLevel[];
}

export interface PagerDutyOnCallUser {
  id: string;
  name: string;
  email: string;
  status: 'on-call' | 'off-call';
}

export interface PagerDutyEngineConfig {
  services: PagerDutyServiceConfig[];
  escalationPolicies: PagerDutyEscalationPolicy[];
  onCallUsers: PagerDutyOnCallUser[];
  severityMapping: 'standard' | 'error-focused' | 'warning-demoted';
  enableAutoResolve: boolean;
  resolveTimeout: number;
}

export interface PagerDutyEngineMetrics {
  incidentsTotal: number;
  incidentsActive: number;
  incidentsResolved: number;
  notificationsSent: number;
  escalationsTriggered: number;
  acknowledgements: number;
  averageAckLatency: number;
  averageResolveLatency: number;
  apiRequestsPerSecond: number;
  webhooksPerSecond: number;
  errorRate: number;
  cpuUtilization: number;
  memoryUtilization: number;
}

interface ActiveIncidentState {
  escalationLevelIndex: number;
  lastEscalationAt: number;
}

export class PagerDutyEmulationEngine {
  private config: PagerDutyEngineConfig | null = null;
  private incidents: Map<string, PagerDutyIncident> = new Map();
  private incidentState: Map<string, ActiveIncidentState> = new Map();

  private metrics: {
    notificationsSent: number;
    escalationsTriggered: number;
    acknowledgements: number;
    totalAckLatency: number;
    totalAckCount: number;
    totalResolveLatency: number;
    totalResolveCount: number;
    apiRequests: number;
    webhookCalls: number;
    errors: number;
  } = {
    notificationsSent: 0,
    escalationsTriggered: 0,
    acknowledgements: 0,
    totalAckLatency: 0,
    totalAckCount: 0,
    totalResolveLatency: 0,
    totalResolveCount: 0,
    apiRequests: 0,
    webhookCalls: 0,
    errors: 0,
  };

  /**
   * Initialize engine from PagerDuty node config
   */
  initializeFromNode(node: CanvasNode): void {
    const raw = (node.data.config || {}) as any;

    const services: PagerDutyServiceConfig[] = (raw.services || []).map((s: any) => ({
      id: String(s.id ?? s.name ?? 'service'),
      name: String(s.name ?? 'service'),
      integrationKey: s.integrationKey,
      status: s.status ?? 'active',
      escalationPolicy: s.escalationPolicy ?? raw.escalationPolicy ?? 'default-policy',
      autoResolve: s.autoResolve ?? raw.enableAutoResolve ?? true,
      resolveTimeout: s.resolveTimeout ?? raw.resolveTimeout ?? 300,
    }));

    const escalationPolicies: PagerDutyEscalationPolicy[] = (raw.escalationPolicies || []).map((p: any) => ({
      id: String(p.id ?? p.name ?? 'policy'),
      name: String(p.name ?? 'policy'),
      levels: Array.isArray(p.levels)
        ? p.levels.map((l: any, index: number) => ({
            level: typeof l.level === 'number' ? l.level : index + 1,
            timeout: typeof l.timeout === 'number' ? l.timeout : 5,
            targets: Array.isArray(l.targets) ? l.targets.map((t: any) => String(t)) : [],
          }))
        : [],
    }));

    const onCallUsers: PagerDutyOnCallUser[] = (raw.onCallUsers || []).map((u: any) => ({
      id: String(u.id ?? u.email ?? u.name ?? 'user'),
      name: String(u.name ?? 'On-Call User'),
      email: String(u.email ?? 'user@example.com'),
      status: u.status === 'off-call' ? 'off-call' : 'on-call',
    }));

    this.config = {
      services,
      escalationPolicies,
      onCallUsers,
      severityMapping: raw.severityMapping ?? 'standard',
      enableAutoResolve: raw.enableAutoResolve ?? true,
      resolveTimeout: raw.resolveTimeout ?? 300,
    };
  }

  /**
   * Ingest new alerts from AlertSystem and map them to incidents
   */
  processAlerts(currentTime: number, alerts: Alert[]): void {
    if (!this.config || alerts.length === 0) return;

    for (const alert of alerts) {
      const service = this.findServiceForAlert(alert);
      if (!service || service.status === 'disabled') continue;

      const severity = this.mapSeverity(alert);
      const existing = this.findExistingIncident(alert, service);

      if (existing) {
        existing.lastSignalAt = currentTime;
        existing.alertIds = Array.from(new Set([...(existing.alertIds || []), alert.id]));
        this.incidents.set(existing.id, existing);
        this.metrics.apiRequests++;
      } else {
        const incidentId = `inc-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const incident: PagerDutyIncident = {
          id: incidentId,
          title: alert.title,
          serviceId: service.id,
          status: 'triggered',
          severity,
          createdAt: currentTime,
          lastSignalAt: currentTime,
          alertIds: [alert.id],
        };

        this.incidents.set(incidentId, incident);
        this.incidentState.set(incidentId, {
          escalationLevelIndex: 0,
          lastEscalationAt: currentTime,
        });

        this.metrics.apiRequests++;
        this.triggerEscalation(currentTime, incident, service);
      }
    }
  }

  /**
   * Advance incident lifecycle: auto-resolve and escalations
   */
  advanceTime(currentTime: number): void {
    if (!this.config) return;

    for (const [id, incident] of this.incidents.entries()) {
      if (incident.status === 'resolved') continue;

      const service = this.config.services.find((s) => s.id === incident.serviceId);
      if (!service) continue;

      // Auto resolve on inactivity
      const effectiveAutoResolve = service.autoResolve ?? this.config.enableAutoResolve;
      const effectiveTimeout = (service.resolveTimeout ?? this.config.resolveTimeout) * 1000;

      if (
        effectiveAutoResolve &&
        incident.status !== 'resolved' &&
        incident.lastSignalAt &&
        currentTime - incident.lastSignalAt >= effectiveTimeout
      ) {
        this.resolveIncident(currentTime, incident);
        this.incidents.set(id, incident);
        continue;
      }

      // Escalation
      const policy = this.findEscalationPolicy(service);
      if (!policy || policy.levels.length === 0) continue;

      const state = this.incidentState.get(id);
      if (!state) continue;

      const currentLevel = policy.levels[state.escalationLevelIndex];
      if (!currentLevel) continue;

      const timeoutMs = currentLevel.timeout * 60 * 1000;
      const shouldEscalate =
        incident.status === 'triggered' &&
        currentTime - state.lastEscalationAt >= timeoutMs;

      if (shouldEscalate && state.escalationLevelIndex < policy.levels.length - 1) {
        state.escalationLevelIndex += 1;
        state.lastEscalationAt = currentTime;
        this.incidentState.set(id, state);
        this.triggerEscalation(currentTime, incident, service, state.escalationLevelIndex);
      }
    }
  }

  /**
   * Mark an incident as acknowledged (used by external controllers if needed)
   */
  acknowledgeIncident(currentTime: number, incidentId: string): void {
    const incident = this.incidents.get(incidentId);
    if (!incident || incident.status !== 'triggered') return;

    incident.status = 'acknowledged';
    incident.acknowledgedAt = currentTime;
    this.incidents.set(incidentId, incident);

    this.metrics.acknowledgements++;
    this.metrics.totalAckCount++;
    this.metrics.totalAckLatency += currentTime - incident.createdAt;
  }

  /**
   * Manually resolve an incident (used by external controllers or UI actions)
   */
  resolveIncidentManually(currentTime: number, incidentId: string): void {
    const incident = this.incidents.get(incidentId);
    if (!incident || incident.status === 'resolved') return;

    this.resolveIncident(currentTime, incident);
    this.incidents.set(incidentId, incident);
  }

  /**
   * Current snapshot of incidents for UI
   */
  getIncidents(): PagerDutyIncident[] {
    return Array.from(this.incidents.values());
  }

  /**
   * Get aggregated engine metrics
   */
  getMetrics(): PagerDutyEngineMetrics {
    const all = Array.from(this.incidents.values());
    const total = all.length;
    const active = all.filter((i) => i.status !== 'resolved').length;
    const resolved = all.filter((i) => i.status === 'resolved').length;

    const averageAckLatency =
      this.metrics.totalAckCount > 0
        ? this.metrics.totalAckLatency / this.metrics.totalAckCount
        : 0;

    const averageResolveLatency =
      this.metrics.totalResolveCount > 0
        ? this.metrics.totalResolveLatency / this.metrics.totalResolveCount
        : 0;

    const observationWindowSeconds = 300;
    const apiRequestsPerSecond = this.metrics.apiRequests / observationWindowSeconds;
    const webhooksPerSecond = this.metrics.webhookCalls / observationWindowSeconds;

    const operationVolume =
      apiRequestsPerSecond + webhooksPerSecond + active * 0.1 + this.metrics.notificationsSent / observationWindowSeconds;
    const cpuUtilization = Math.min(0.95, 0.1 + operationVolume / 200);
    const memoryUtilization = Math.min(0.95, 0.2 + total / 1000);

    const totalOperations = this.metrics.apiRequests + this.metrics.webhookCalls + 1;
    const errorRate = this.metrics.errors / totalOperations;

    return {
      incidentsTotal: total,
      incidentsActive: active,
      incidentsResolved: resolved,
      notificationsSent: this.metrics.notificationsSent,
      escalationsTriggered: this.metrics.escalationsTriggered,
      acknowledgements: this.metrics.acknowledgements,
      averageAckLatency,
      averageResolveLatency,
      apiRequestsPerSecond,
      webhooksPerSecond,
      errorRate,
      cpuUtilization,
      memoryUtilization,
    };
  }

  /**
   * Calculate component-level load for EmulationEngine
   */
  calculateLoad(): {
    throughput: number;
    latency: number;
    errorRate: number;
    utilization: number;
  } {
    const m = this.getMetrics();
    const throughput =
      m.apiRequestsPerSecond +
      m.webhooksPerSecond +
      m.incidentsActive / 60 +
      m.notificationsSent / 300;

    const baseLatency = 100;
    const latency =
      baseLatency +
      (m.averageAckLatency || 0) * 0.01 +
      (m.averageResolveLatency || 0) * 0.005;

    const utilization = (m.cpuUtilization + m.memoryUtilization) / 2;

    return {
      throughput,
      latency,
      errorRate: m.errorRate,
      utilization,
    };
  }

  private findServiceForAlert(alert: Alert): PagerDutyServiceConfig | undefined {
    if (!this.config) return undefined;

    if (alert.nodeLabel) {
      const normalized = alert.nodeLabel.toLowerCase();
      const byLabel = this.config.services.find((s) =>
        s.name.toLowerCase() === normalized ||
        normalized.includes(s.name.toLowerCase())
      );
      if (byLabel) return byLabel;
    }

    if (alert.nodeId) {
      const byId = this.config.services.find((s) => s.id === alert.nodeId);
      if (byId) return byId;
    }

    return this.config.services[0];
  }

  private mapSeverity(alert: Alert): PagerDutySeverity {
    if (!this.config) return 'warning';

    const base: PagerDutySeverity =
      alert.type === 'critical'
        ? 'critical'
        : alert.type === 'warning'
        ? 'warning'
        : 'info';

    switch (this.config.severityMapping) {
      case 'error-focused':
        if (base === 'warning') return 'error';
        return base;
      case 'warning-demoted':
        if (base === 'warning') return 'info';
        return base;
      default:
        return base;
    }
  }

  private findExistingIncident(alert: Alert, service: PagerDutyServiceConfig): PagerDutyIncident | undefined {
    for (const incident of this.incidents.values()) {
      if (
        incident.serviceId === service.id &&
        incident.status !== 'resolved' &&
        incident.title === alert.title
      ) {
        return incident;
      }
    }
    return undefined;
  }

  private findEscalationPolicy(service: PagerDutyServiceConfig): PagerDutyEscalationPolicy | undefined {
    if (!this.config) return undefined;
    if (!service.escalationPolicy) return this.config.escalationPolicies[0];

    return (
      this.config.escalationPolicies.find(
        (p) => p.id === service.escalationPolicy || p.name === service.escalationPolicy
      ) ?? this.config.escalationPolicies[0]
    );
  }

  private resolveIncident(currentTime: number, incident: PagerDutyIncident): void {
    if (incident.status === 'resolved') return;

    incident.status = 'resolved';
    incident.resolvedAt = currentTime;

    this.metrics.totalResolveCount++;
    this.metrics.totalResolveLatency += currentTime - incident.createdAt;
  }

  private triggerEscalation(
    currentTime: number,
    incident: PagerDutyIncident,
    service: PagerDutyServiceConfig,
    levelIndex: number = 0
  ): void {
    if (!this.config) return;
    const policy = this.findEscalationPolicy(service);
    if (!policy) return;

    const level = policy.levels[levelIndex];
    if (!level) return;

    const onCallTargets = this.config.onCallUsers.filter(
      (u) => u.status === 'on-call' && level.targets.includes(u.id)
    );

    const recipients = onCallTargets.length > 0 ? onCallTargets : this.config.onCallUsers;
    const notifications = Math.max(1, recipients.length);

    this.metrics.notificationsSent += notifications;
    this.metrics.escalationsTriggered++;
    this.metrics.webhookCalls += 1;
  }
}



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

/**
 * PagerDuty Schedule Layer Restriction
 */
export interface PagerDutyScheduleRestriction {
  type: 'weekly_restriction';
  start_time_of_day: string; // HH:mm format
  duration_seconds: number;
  start_day_of_week: number; // 0 = Sunday, 1 = Monday, etc.
}

/**
 * PagerDuty Schedule Layer
 */
export interface PagerDutyScheduleLayer {
  start: string; // ISO date string
  rotation_virtual_start: string; // ISO date string
  rotation_turn_length_seconds: number; // Duration of each rotation
  users: Array<{ user: { id: string } }>;
  restrictions?: PagerDutyScheduleRestriction[];
}

/**
 * PagerDuty Schedule
 */
export interface PagerDutySchedule {
  id: string;
  name: string;
  timezone: string; // IANA timezone (e.g., 'America/New_York')
  layers: PagerDutyScheduleLayer[];
}

export interface PagerDutyEngineConfig {
  services: PagerDutyServiceConfig[];
  escalationPolicies: PagerDutyEscalationPolicy[];
  onCallUsers: PagerDutyOnCallUser[];
  schedules?: PagerDutySchedule[];
  severityMapping: 'standard' | 'error-focused' | 'warning-demoted';
  enableAutoResolve: boolean;
  resolveTimeout: number;
  enableWebhooks?: boolean;
  webhookUrl?: string;
}

/**
 * PagerDuty Events API v2 Event
 */
export interface PagerDutyEvent {
  routing_key: string;
  event_action: 'trigger' | 'acknowledge' | 'resolve';
  dedup_key?: string;
  payload: {
    summary: string;
    source: string;
    severity: 'critical' | 'error' | 'warning' | 'info';
    custom_details?: Record<string, any>;
    timestamp?: string;
  };
}

/**
 * Webhook delivery status
 */
interface WebhookDelivery {
  id: string;
  incidentId: string;
  url: string;
  status: 'pending' | 'success' | 'failed';
  attempts: number;
  lastAttemptAt: number;
  nextRetryAt?: number;
  error?: string;
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
  private webhookDeliveries: Map<string, WebhookDelivery> = new Map();
  private schedules: Map<string, PagerDutySchedule> = new Map();
  private readonly MAX_WEBHOOK_DELIVERIES = 1000;
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly RETRY_DELAY_MS = 5000; // 5 seconds

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
    webhookSuccesses: number;
    webhookFailures: number;
    webhookRetries: number;
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
    webhookSuccesses: 0,
    webhookFailures: 0,
    webhookRetries: 0,
    errors: 0,
  };

  /**
   * Initialize engine from PagerDuty node config
   */
  initializeFromNode(node: CanvasNode): void {
    const raw = (node?.data?.config || {}) as any;

    const services: PagerDutyServiceConfig[] = Array.isArray(raw.services)
      ? raw.services.map((s: any) => ({
          id: String(s.id ?? s.name ?? `service-${Date.now()}-${Math.random()}`),
          name: String(s.name ?? 'service'),
          integrationKey: s.integrationKey,
          status: s.status ?? 'active',
          escalationPolicy: s.escalationPolicy ?? raw.escalationPolicy,
          autoResolve: s.autoResolve ?? raw.enableAutoResolve ?? true,
          resolveTimeout: s.resolveTimeout ?? raw.resolveTimeout ?? 300,
        }))
      : [];

    const escalationPolicies: PagerDutyEscalationPolicy[] = Array.isArray(raw.escalationPolicies)
      ? raw.escalationPolicies.map((p: any) => ({
          id: String(p.id ?? p.name ?? `policy-${Date.now()}-${Math.random()}`),
          name: String(p.name ?? 'policy'),
          levels: Array.isArray(p.levels)
            ? p.levels.map((l: any, index: number) => ({
                level: typeof l.level === 'number' ? l.level : index + 1,
                timeout: typeof l.timeout === 'number' ? l.timeout : 5,
                targets: Array.isArray(l.targets) ? l.targets.map((t: any) => String(t)) : [],
              }))
            : [],
        }))
      : [];

    const onCallUsers: PagerDutyOnCallUser[] = Array.isArray(raw.onCallUsers)
      ? raw.onCallUsers.map((u: any) => ({
          id: String(u.id ?? u.email ?? u.name ?? `user-${Date.now()}-${Math.random()}`),
          name: String(u.name ?? 'On-Call User'),
          email: String(u.email ?? ''),
          status: u.status === 'off-call' ? 'off-call' : 'on-call',
        }))
      : [];

    const schedules: PagerDutySchedule[] = Array.isArray(raw.schedules)
      ? raw.schedules.map((s: any) => ({
          id: String(s.id ?? s.name ?? `schedule-${Date.now()}-${Math.random()}`),
          name: String(s.name ?? 'Schedule'),
          timezone: String(s.timezone ?? 'UTC'),
          layers: Array.isArray(s.layers)
            ? s.layers.map((l: any) => ({
                start: String(l.start ?? new Date().toISOString()),
                rotation_virtual_start: String(l.rotation_virtual_start ?? l.start ?? new Date().toISOString()),
                rotation_turn_length_seconds: typeof l.rotation_turn_length_seconds === 'number' ? l.rotation_turn_length_seconds : 604800, // 7 days default
                users: Array.isArray(l.users)
                  ? l.users.map((u: any) => ({
                      user: {
                        id: String(u?.user?.id ?? u?.id ?? u ?? ''),
                      },
                    }))
                  : [],
                restrictions: Array.isArray(l.restrictions) ? l.restrictions : undefined,
              }))
            : [],
        }))
      : [];

    this.config = {
      services,
      escalationPolicies,
      onCallUsers,
      schedules,
      severityMapping: raw.severityMapping ?? 'standard',
      enableAutoResolve: raw.enableAutoResolve ?? true,
      resolveTimeout: raw.resolveTimeout ?? 300,
      enableWebhooks: raw.enableWebhooks ?? false,
      webhookUrl: raw.webhookUrl ?? '',
    };

    // Initialize schedules map
    this.schedules.clear();
    for (const schedule of schedules) {
      this.schedules.set(schedule.id, schedule);
    }
  }

  /**
   * Update configuration from node (preserves active incidents)
   */
  updateConfig(node: CanvasNode): void {
    const oldConfig = this.config;
    const oldIncidents = new Map(this.incidents);
    const oldIncidentState = new Map(this.incidentState);

    // Reinitialize config
    this.initializeFromNode(node);

    // Validate new configuration
    if (!this.validateConfig()) {
      // Restore old config if validation fails
      this.config = oldConfig;
      this.incidents = oldIncidents;
      this.incidentState = oldIncidentState;
      return;
    }

    // Update incident service references if services changed
    if (oldConfig) {
      const serviceIdMap = new Map<string, string>();
      for (const oldService of oldConfig.services) {
        const newService = this.config?.services.find(
          (s) => s.id === oldService.id || s.name === oldService.name
        );
        if (newService && newService.id !== oldService.id) {
          serviceIdMap.set(oldService.id, newService.id);
        }
      }

      // Update incident service IDs
      for (const [id, incident] of this.incidents.entries()) {
        const newServiceId = serviceIdMap.get(incident.serviceId);
        if (newServiceId) {
          incident.serviceId = newServiceId;
          this.incidents.set(id, incident);
        }
      }
    }
  }

  /**
   * Validate configuration
   */
  private validateConfig(): boolean {
    if (!this.config) return false;

    // Validate integration keys uniqueness
    const integrationKeys = new Set<string>();
    for (const service of this.config.services) {
      if (service.integrationKey) {
        if (integrationKeys.has(service.integrationKey)) {
          console.warn('PagerDuty: Duplicate integration key found:', service.integrationKey);
          return false;
        }
        integrationKeys.add(service.integrationKey);
      }
    }

    // Validate email format for on-call users
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const user of this.config.onCallUsers) {
      if (user.email && !emailRegex.test(user.email)) {
        console.warn('PagerDuty: Invalid email format:', user.email);
        return false;
      }
    }

    return true;
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

    // Process webhook retries
    this.processWebhookRetries(currentTime);

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
   * Send Events API v2 event
   */
  sendEvent(event: PagerDutyEvent): void {
    if (!this.config) return;

    this.metrics.apiRequests++;

    // Find service by routing key (integration key)
    const service = this.config.services.find(
      (s) => s.integrationKey === event.routing_key
    );

    if (!service || service.status === 'disabled') {
      this.metrics.errors++;
      return;
    }

    // Handle event action
    if (event.event_action === 'trigger') {
      // Create or update incident
      const incidentKey = event.dedup_key || `inc-${Date.now()}-${Math.random()}`;
      const existing = Array.from(this.incidents.values()).find(
        (i) => i.id === incidentKey || (event.dedup_key && i.alertIds?.includes(event.dedup_key))
      );

      if (existing) {
        existing.lastSignalAt = Date.now();
        this.incidents.set(existing.id, existing);
      } else {
        const incident: PagerDutyIncident = {
          id: incidentKey,
          title: event.payload.summary,
          serviceId: service.id,
          status: 'triggered',
          severity: event.payload.severity,
          createdAt: Date.now(),
          lastSignalAt: Date.now(),
          alertIds: event.dedup_key ? [event.dedup_key] : undefined,
        };

        this.incidents.set(incidentKey, incident);
        this.incidentState.set(incidentKey, {
          escalationLevelIndex: 0,
          lastEscalationAt: Date.now(),
        });

        this.triggerEscalation(Date.now(), incident, service);
        this.sendWebhook(incident, 'incident.triggered');
      }
    } else if (event.event_action === 'acknowledge') {
      const incident = Array.from(this.incidents.values()).find(
        (i) => i.serviceId === service.id && i.status === 'triggered'
      );
      if (incident) {
        this.acknowledgeIncident(Date.now(), incident.id);
        this.sendWebhook(incident, 'incident.acknowledged');
      }
    } else if (event.event_action === 'resolve') {
      const incident = Array.from(this.incidents.values()).find(
        (i) => i.serviceId === service.id && i.status !== 'resolved'
      );
      if (incident) {
        this.resolveIncidentManually(Date.now(), incident.id);
        this.sendWebhook(incident, 'incident.resolved');
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

    this.sendWebhook(incident, 'incident.acknowledged');
  }

  /**
   * Manually resolve an incident (used by external controllers or UI actions)
   */
  resolveIncidentManually(currentTime: number, incidentId: string): void {
    const incident = this.incidents.get(incidentId);
    if (!incident || incident.status === 'resolved') return;

    this.resolveIncident(currentTime, incident);
    this.incidents.set(incidentId, incident);
    this.sendWebhook(incident, 'incident.resolved');
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
    const webhookSuccessRate =
      this.metrics.webhookCalls > 0
        ? this.metrics.webhookSuccesses / this.metrics.webhookCalls
        : 0;

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
   * Get webhook delivery status
   */
  getWebhookStatus(): {
    total: number;
    success: number;
    failed: number;
    pending: number;
    successRate: number;
  } {
    const deliveries = Array.from(this.webhookDeliveries.values());
    const success = deliveries.filter((d) => d.status === 'success').length;
    const failed = deliveries.filter((d) => d.status === 'failed').length;
    const pending = deliveries.filter((d) => d.status === 'pending').length;

    return {
      total: deliveries.length,
      success,
      failed,
      pending,
      successRate: deliveries.length > 0 ? success / deliveries.length : 0,
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

  /**
   * Send webhook for incident event
   */
  private sendWebhook(incident: PagerDutyIncident, eventType: string): void {
    if (!this.config || !this.config.enableWebhooks || !this.config.webhookUrl) {
      return;
    }

    const deliveryId = `webhook-${incident.id}-${eventType}-${Date.now()}`;
    const delivery: WebhookDelivery = {
      id: deliveryId,
      incidentId: incident.id,
      url: this.config.webhookUrl,
      status: 'pending',
      attempts: 0,
      lastAttemptAt: Date.now(),
    };

    // Simulate webhook delivery (with potential failure)
    this.attemptWebhookDelivery(delivery, incident, eventType);
  }

  /**
   * Attempt webhook delivery (simulation)
   */
  private attemptWebhookDelivery(
    delivery: WebhookDelivery,
    incident: PagerDutyIncident,
    eventType: string
  ): void {
    delivery.attempts++;
    delivery.lastAttemptAt = Date.now();
    this.metrics.webhookCalls++;

    // Simulate webhook delivery (90% success rate)
    const success = Math.random() > 0.1;

    if (success) {
      delivery.status = 'success';
      this.metrics.webhookSuccesses++;
      this.webhookDeliveries.set(delivery.id, delivery);
    } else {
      // Retry logic
      if (delivery.attempts < this.MAX_RETRY_ATTEMPTS) {
        delivery.status = 'pending';
        delivery.nextRetryAt = Date.now() + this.RETRY_DELAY_MS;
        this.metrics.webhookRetries++;
        this.webhookDeliveries.set(delivery.id, delivery);
      } else {
        delivery.status = 'failed';
        delivery.error = 'Max retry attempts exceeded';
        this.metrics.webhookFailures++;
        this.metrics.errors++;
        this.webhookDeliveries.set(delivery.id, delivery);
      }
    }

    // Cleanup old deliveries
    if (this.webhookDeliveries.size > this.MAX_WEBHOOK_DELIVERIES) {
      const sorted = Array.from(this.webhookDeliveries.entries())
        .sort((a, b) => a[1].lastAttemptAt - b[1].lastAttemptAt);
      const toRemove = sorted.slice(0, sorted.length - this.MAX_WEBHOOK_DELIVERIES);
      for (const [id] of toRemove) {
        this.webhookDeliveries.delete(id);
      }
    }
  }

  /**
   * Process webhook retries
   */
  private processWebhookRetries(currentTime: number): void {
    for (const [id, delivery] of this.webhookDeliveries.entries()) {
      if (
        delivery.status === 'pending' &&
        delivery.nextRetryAt &&
        currentTime >= delivery.nextRetryAt
      ) {
        const incident = this.incidents.get(delivery.incidentId);
        if (incident) {
          const eventType = delivery.id.includes('triggered')
            ? 'incident.triggered'
            : delivery.id.includes('acknowledged')
            ? 'incident.acknowledged'
            : 'incident.resolved';
          this.attemptWebhookDelivery(delivery, incident, eventType);
        }
      }
    }
  }

  /**
   * Get timezone offset in minutes (simplified - for common timezones)
   * In production, would use proper timezone library like date-fns-tz
   */
  private getTimezoneOffset(timezone: string): number {
    // Simplified timezone offset mapping (UTC offset in minutes)
    // This is a basic implementation - real system would use proper timezone database
    const timezoneOffsets: Record<string, number> = {
      'UTC': 0,
      'America/New_York': -5 * 60, // EST (adjust for DST in real implementation)
      'America/Chicago': -6 * 60, // CST
      'America/Denver': -7 * 60, // MST
      'America/Los_Angeles': -8 * 60, // PST
      'Europe/London': 0, // GMT (adjust for BST in real implementation)
      'Europe/Paris': 1 * 60, // CET
      'Europe/Berlin': 1 * 60, // CET
      'Europe/Moscow': 3 * 60, // MSK
      'Asia/Dubai': 4 * 60, // GST
      'Asia/Kolkata': 5.5 * 60, // IST
      'Asia/Shanghai': 8 * 60, // CST
      'Asia/Tokyo': 9 * 60, // JST
      'Australia/Sydney': 10 * 60, // AEST (adjust for AEDT in real implementation)
      'Pacific/Auckland': 12 * 60, // NZST (adjust for NZDT in real implementation)
    };
    
    return timezoneOffsets[timezone] ?? 0; // Default to UTC if unknown
  }

  /**
   * Convert UTC time to schedule timezone time
   */
  private convertToScheduleTime(utcTime: number, timezone: string): Date {
    const offsetMinutes = this.getTimezoneOffset(timezone);
    const scheduleTime = new Date(utcTime + offsetMinutes * 60 * 1000);
    return scheduleTime;
  }

  /**
   * Get current on-call user IDs from a schedule
   */
  private getOnCallUsersFromSchedule(scheduleId: string, currentTime: number): string[] {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule || schedule.layers.length === 0) return [];

    // Convert current time to schedule timezone
    const scheduleTime = this.convertToScheduleTime(currentTime, schedule.timezone);
    
    // Find active layer (most recent start date)
    let activeLayer: PagerDutyScheduleLayer | null = null;
    let latestStart = 0;

    for (const layer of schedule.layers) {
      const layerStart = new Date(layer.start).getTime();
      if (layerStart <= currentTime && layerStart > latestStart) {
        latestStart = layerStart;
        activeLayer = layer;
      }
    }

    if (!activeLayer || activeLayer.users.length === 0) return [];

    // Check restrictions (e.g., only weekdays) - using schedule timezone
    if (activeLayer.restrictions && activeLayer.restrictions.length > 0) {
      const dayOfWeek = scheduleTime.getUTCDay(); // 0 = Sunday, 1 = Monday, etc.
      const hours = scheduleTime.getUTCHours();
      const minutes = scheduleTime.getUTCMinutes();

      for (const restriction of activeLayer.restrictions) {
        if (restriction.type === 'weekly_restriction') {
          // Check if current time is within restriction
          const restrictionStartDay = restriction.start_day_of_week;
          const restrictionStartTime = restriction.start_time_of_day;
          const restrictionDuration = restriction.duration_seconds;
          
          // Check if day matches and time is within window
          if (dayOfWeek === restrictionStartDay) {
            const [restrictionHour, restrictionMinute] = restrictionStartTime.split(':').map(Number);
            const restrictionStartSeconds = restrictionHour * 3600 + restrictionMinute * 60;
            const restrictionEndSeconds = restrictionStartSeconds + restrictionDuration;
            const currentSeconds = hours * 3600 + minutes * 60;
            
            if (currentSeconds < restrictionStartSeconds || currentSeconds > restrictionEndSeconds) {
              return []; // Outside restriction window
            }
          }
        }
      }
    }

    // Calculate current user in rotation
    // Rotation is calculated based on schedule timezone
    const rotationStart = new Date(activeLayer.rotation_virtual_start).getTime();
    const elapsed = currentTime - rotationStart;
    const rotationIndex = Math.floor(elapsed / (activeLayer.rotation_turn_length_seconds * 1000));
    const userIndex = rotationIndex % activeLayer.users.length;
    
    const currentUser = activeLayer.users[userIndex];
    return currentUser ? [currentUser.user.id] : [];
  }

  /**
   * Get on-call user IDs from targets (can be user IDs or schedule IDs)
   */
  private getOnCallUserIdsFromTargets(targets: string[], currentTime: number): string[] {
    if (!this.config) return [];

    const userIds: string[] = [];

    for (const target of targets) {
      // Check if target is a schedule ID
      if (this.schedules.has(target)) {
        const scheduleUserIds = this.getOnCallUsersFromSchedule(target, currentTime);
        userIds.push(...scheduleUserIds);
      } else {
        // Target is a user ID
        const user = this.config.onCallUsers.find((u) => u.id === target);
        if (user && user.status === 'on-call') {
          userIds.push(user.id);
        }
      }
    }

    return Array.from(new Set(userIds)); // Remove duplicates
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

    // Get on-call users from targets (can be user IDs or schedule IDs)
    const onCallUserIds = this.getOnCallUserIdsFromTargets(level.targets, currentTime);
    
    // Fallback to all on-call users if no targets found
    const recipients = onCallUserIds.length > 0
      ? this.config.onCallUsers.filter((u) => onCallUserIds.includes(u.id))
      : this.config.onCallUsers.filter((u) => u.status === 'on-call');

    const notifications = Math.max(1, recipients.length);

    this.metrics.notificationsSent += notifications;
    this.metrics.escalationsTriggered++;
    this.metrics.webhookCalls += 1;
  }

  /**
   * Get current on-call users for a schedule (for UI display)
   */
  getScheduleOnCallUsers(scheduleId: string): string[] {
    return this.getOnCallUsersFromSchedule(scheduleId, Date.now());
  }

  /**
   * Get all schedules
   */
  getSchedules(): PagerDutySchedule[] {
    return Array.from(this.schedules.values());
  }
}



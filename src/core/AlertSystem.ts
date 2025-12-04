import { CanvasNode } from '@/types';
import { ComponentMetrics, ConnectionMetrics } from './EmulationEngine';
import { ComponentStatus } from './DependencyGraphEngine';

export interface Alert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  nodeId?: string;
  nodeLabel?: string;
  timestamp: number;
  acknowledged: boolean;
  severity: number; // 0-1, for sorting
}

export class AlertSystem {
  private alerts: Map<string, Alert> = new Map();
  private alertCallbacks: Array<(alert: Alert) => void> = [];

  /**
   * Register callback for new alerts
   */
  public onAlert(callback: (alert: Alert) => void) {
    this.alertCallbacks.push(callback);
  }

  /**
   * Analyze system and generate alerts
   */
  public analyze(
    nodes: CanvasNode[],
    componentMetrics: Map<string, ComponentMetrics>,
    connectionMetrics: Map<string, ConnectionMetrics>,
    componentStatuses: ComponentStatus[]
  ): Alert[] {
    const newAlerts: Alert[] = [];

    // Check each component
    for (const node of nodes) {
      const metrics = componentMetrics.get(node.id);
      const status = componentStatuses.find(s => s.nodeId === node.id);

      if (!metrics || !status) continue;

      // Critical: Component is down
      if (status.health === 'down') {
        const alertId = `down-${node.id}`;
        if (!this.alerts.has(alertId)) {
          const alert: Alert = {
            id: alertId,
            type: 'critical',
            title: 'Component Down',
            message: `${node.data.label} is down and not responding`,
            nodeId: node.id,
            nodeLabel: node.data.label,
            timestamp: Date.now(),
            acknowledged: false,
            severity: 1.0,
          };
          this.addAlert(alert);
          newAlerts.push(alert);
        }
      }

      // Critical: Very high error rate
      if (metrics.errorRate > 0.1) {
        const alertId = `error-${node.id}`;
        const existingAlert = this.alerts.get(alertId);
        if (!existingAlert || existingAlert.acknowledged) {
          const alert: Alert = {
            id: alertId,
            type: 'critical',
            title: 'High Error Rate',
            message: `${node.data.label} has ${(metrics.errorRate * 100).toFixed(1)}% error rate`,
            nodeId: node.id,
            nodeLabel: node.data.label,
            timestamp: Date.now(),
            acknowledged: false,
            severity: 0.9,
          };
          this.addAlert(alert);
          newAlerts.push(alert);
        }
      }

      // Warning: High latency
      if (metrics.latency > 2000) {
        const alertId = `latency-${node.id}`;
        const existingAlert = this.alerts.get(alertId);
        if (!existingAlert || existingAlert.acknowledged) {
          const alert: Alert = {
            id: alertId,
            type: 'warning',
            title: 'High Latency',
            message: `${node.data.label} has latency of ${metrics.latency.toFixed(0)}ms`,
            nodeId: node.id,
            nodeLabel: node.data.label,
            timestamp: Date.now(),
            acknowledged: false,
            severity: 0.7,
          };
          this.addAlert(alert);
          newAlerts.push(alert);
        }
      }

      // Warning: High utilization
      if (metrics.utilization > 0.9) {
        const alertId = `utilization-${node.id}`;
        const existingAlert = this.alerts.get(alertId);
        if (!existingAlert || existingAlert.acknowledged) {
          const alert: Alert = {
            id: alertId,
            type: 'warning',
            title: 'High Utilization',
            message: `${node.data.label} is at ${(metrics.utilization * 100).toFixed(0)}% capacity`,
            nodeId: node.id,
            nodeLabel: node.data.label,
            timestamp: Date.now(),
            acknowledged: false,
            severity: 0.6,
          };
          this.addAlert(alert);
          newAlerts.push(alert);
        }
      }
    }

    // Check connections for bottlenecks
    for (const [connId, metrics] of connectionMetrics.entries()) {
      if (metrics.bottleneck) {
        const alertId = `bottleneck-${connId}`;
        const existingAlert = this.alerts.get(alertId);
        if (!existingAlert || existingAlert.acknowledged) {
          const alert: Alert = {
            id: alertId,
            type: 'critical',
            title: 'Connection Bottleneck',
            message: `Bottleneck detected in connection`,
            timestamp: Date.now(),
            acknowledged: false,
            severity: 0.85,
          };
          this.addAlert(alert);
          newAlerts.push(alert);
        }
      }
    }

    // Remove resolved alerts
    this.cleanupResolvedAlerts(nodes, componentMetrics, connectionMetrics, componentStatuses);

    return newAlerts;
  }

  private addAlert(alert: Alert) {
    this.alerts.set(alert.id, alert);
    // Notify callbacks
    this.alertCallbacks.forEach(cb => cb(alert));
  }

  private cleanupResolvedAlerts(
    nodes: CanvasNode[],
    componentMetrics: Map<string, ComponentMetrics>,
    connectionMetrics: Map<string, ConnectionMetrics>,
    componentStatuses: ComponentStatus[]
  ) {
    const nodeIds = new Set(nodes.map(n => n.id));
    const connIds = new Set(connectionMetrics.keys());

    for (const [alertId, alert] of this.alerts.entries()) {
      // Skip acknowledged alerts
      if (alert.acknowledged) continue;

      // Check if alert is still valid
      let shouldRemove = false;

      if (alert.nodeId) {
        const node = nodes.find(n => n.id === alert.nodeId);
        if (!node) {
          shouldRemove = true;
        } else {
          const metrics = componentMetrics.get(alert.nodeId);
          const status = componentStatuses.find(s => s.nodeId === alert.nodeId);

          if (alertId.startsWith('down-') && status && status.health !== 'down') {
            shouldRemove = true;
          } else if (alertId.startsWith('error-') && metrics && metrics.errorRate <= 0.1) {
            shouldRemove = true;
          } else if (alertId.startsWith('latency-') && metrics && metrics.latency <= 2000) {
            shouldRemove = true;
          } else if (alertId.startsWith('utilization-') && metrics && metrics.utilization <= 0.9) {
            shouldRemove = true;
          }
        }
      } else if (alertId.startsWith('bottleneck-')) {
        const connId = alertId.replace('bottleneck-', '');
        const metrics = connectionMetrics.get(connId);
        if (!metrics || !metrics.bottleneck) {
          shouldRemove = true;
        }
      }

      if (shouldRemove) {
        this.alerts.delete(alertId);
      }
    }
  }

  /**
   * Acknowledge an alert
   */
  public acknowledge(alertId: string) {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.acknowledged = true;
      this.alerts.set(alertId, alert);
    }
  }

  /**
   * Get all active alerts
   */
  public getAlerts(): Alert[] {
    return Array.from(this.alerts.values())
      .filter(a => !a.acknowledged)
      .sort((a, b) => b.severity - a.severity);
  }

  /**
   * Get alerts by type
   */
  public getAlertsByType(type: 'critical' | 'warning' | 'info'): Alert[] {
    return this.getAlerts().filter(a => a.type === type);
  }

  /**
   * Clear all alerts
   */
  public clear() {
    this.alerts.clear();
  }
}

export const alertSystem = new AlertSystem();


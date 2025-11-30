import { ComponentMetrics, ConnectionMetrics } from './EmulationEngine';
import { CanvasNode } from '@/types';

/**
 * Exports component and connection metrics in Prometheus format
 */
export class PrometheusMetricsExporter {
  private componentMetrics: Map<string, ComponentMetrics> = new Map();
  private connectionMetrics: Map<string, ConnectionMetrics> = new Map();
  private nodes: CanvasNode[] = [];

  /**
   * Update metrics from emulation engine
   */
  updateMetrics(
    componentMetrics: Map<string, ComponentMetrics>,
    connectionMetrics: Map<string, ConnectionMetrics>,
    nodes: CanvasNode[]
  ) {
    this.componentMetrics = componentMetrics;
    this.connectionMetrics = connectionMetrics;
    this.nodes = nodes;
  }

  /**
   * Export metrics in Prometheus text format
   */
  exportPrometheusFormat(): string {
    const lines: string[] = [];
    
    // Export component metrics
    this.componentMetrics.forEach((metrics, nodeId) => {
      const node = this.nodes.find(n => n.id === nodeId);
      const labels = `component_id="${nodeId}",component_type="${metrics.type}",component_label="${node?.data.label || 'unknown'}"`;
      
      lines.push(`# HELP component_throughput Component throughput in requests/sec`);
      lines.push(`# TYPE component_throughput gauge`);
      lines.push(`component_throughput{${labels}} ${metrics.throughput}`);
      
      lines.push(`# HELP component_latency Component latency in milliseconds`);
      lines.push(`# TYPE component_latency gauge`);
      lines.push(`component_latency{${labels}} ${metrics.latency}`);
      
      if (metrics.latencyP50 !== undefined) {
        lines.push(`component_latency_p50{${labels}} ${metrics.latencyP50}`);
      }
      
      if (metrics.latencyP99 !== undefined) {
        lines.push(`component_latency_p99{${labels}} ${metrics.latencyP99}`);
      }
      
      lines.push(`# HELP component_error_rate Component error rate (0-1)`);
      lines.push(`# TYPE component_error_rate gauge`);
      lines.push(`component_error_rate{${labels}} ${metrics.errorRate}`);
      
      lines.push(`# HELP component_utilization Component utilization (0-1)`);
      lines.push(`# TYPE component_utilization gauge`);
      lines.push(`component_utilization{${labels}} ${metrics.utilization}`);
      
      // Export custom metrics if any
      if (metrics.customMetrics) {
        Object.entries(metrics.customMetrics).forEach(([key, value]) => {
          lines.push(`component_custom_${key}{${labels}} ${value}`);
        });
      }
    });

    // Export connection metrics
    this.connectionMetrics.forEach((metrics, connectionId) => {
      const labels = `connection_id="${connectionId}",source="${metrics.source}",target="${metrics.target}"`;
      
      lines.push(`# HELP connection_traffic Connection traffic in bytes/sec`);
      lines.push(`# TYPE connection_traffic gauge`);
      lines.push(`connection_traffic{${labels}} ${metrics.traffic}`);
      
      lines.push(`# HELP connection_latency Connection latency in milliseconds`);
      lines.push(`# TYPE connection_latency gauge`);
      lines.push(`connection_latency{${labels}} ${metrics.latency}`);
      
      if (metrics.latencyP50 !== undefined) {
        lines.push(`connection_latency_p50{${labels}} ${metrics.latencyP50}`);
      }
      
      if (metrics.latencyP99 !== undefined) {
        lines.push(`connection_latency_p99{${labels}} ${metrics.latencyP99}`);
      }
      
      lines.push(`# HELP connection_error_rate Connection error rate (0-1)`);
      lines.push(`# TYPE connection_error_rate gauge`);
      lines.push(`connection_error_rate{${labels}} ${metrics.errorRate}`);
      
      lines.push(`# HELP connection_utilization Connection utilization (0-1)`);
      lines.push(`# TYPE connection_utilization gauge`);
      lines.push(`connection_utilization{${labels}} ${metrics.utilization}`);
      
      lines.push(`# HELP connection_backpressure Connection backpressure (0-1)`);
      lines.push(`# TYPE connection_backpressure gauge`);
      lines.push(`connection_backpressure{${labels}} ${metrics.backpressure}`);
      
      lines.push(`# HELP connection_congestion Connection congestion (0-1)`);
      lines.push(`# TYPE connection_congestion gauge`);
      lines.push(`connection_congestion{${labels}} ${metrics.congestion}`);
    });

    return lines.join('\n') + '\n';
  }

  /**
   * Get metrics as JSON for API queries
   */
  exportJSON(): Record<string, any> {
    const result: Record<string, any> = {
      component_metrics: [],
      connection_metrics: [],
    };

    this.componentMetrics.forEach((metrics, nodeId) => {
      const node = this.nodes.find(n => n.id === nodeId);
      result.component_metrics.push({
        component_id: nodeId,
        component_type: metrics.type,
        component_label: node?.data.label || 'unknown',
        throughput: metrics.throughput,
        latency: metrics.latency,
        latency_p50: metrics.latencyP50,
        latency_p99: metrics.latencyP99,
        error_rate: metrics.errorRate,
        utilization: metrics.utilization,
        custom_metrics: metrics.customMetrics || {},
        timestamp: metrics.timestamp,
      });
    });

    this.connectionMetrics.forEach((metrics, connectionId) => {
      result.connection_metrics.push({
        connection_id: connectionId,
        source: metrics.source,
        target: metrics.target,
        traffic: metrics.traffic,
        latency: metrics.latency,
        latency_p50: metrics.latencyP50,
        latency_p99: metrics.latencyP99,
        error_rate: metrics.errorRate,
        utilization: metrics.utilization,
        backpressure: metrics.backpressure,
        congestion: metrics.congestion,
        bottleneck: metrics.bottleneck,
        timestamp: metrics.timestamp,
      });
    });

    return result;
  }

  /**
   * Query metrics using PromQL-like syntax (simplified)
   */
  query(expression: string): number | null {
    // Simple query parser for common patterns
    // Example: component_throughput{component_type="kafka"}
    // Example: avg(component_latency)
    // Example: rate(component_throughput[5m])
    
    try {
      // Handle aggregation functions
      if (expression.startsWith('avg(')) {
        const metric = expression.match(/avg\((\w+)\)/)?.[1];
        if (metric === 'component_latency') {
          const values = Array.from(this.componentMetrics.values()).map(m => m.latency);
          return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
        }
        if (metric === 'component_throughput') {
          const values = Array.from(this.componentMetrics.values()).map(m => m.throughput);
          return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
        }
      }

      if (expression.startsWith('sum(')) {
        const metric = expression.match(/sum\((\w+)\)/)?.[1];
        if (metric === 'component_throughput') {
          return Array.from(this.componentMetrics.values()).reduce((sum, m) => sum + m.throughput, 0);
        }
      }

      if (expression.startsWith('rate(')) {
        // Simplified rate calculation (would need history in real implementation)
        const metric = expression.match(/rate\((\w+)\[.*?\]\)/)?.[1];
        if (metric === 'component_throughput') {
          return Array.from(this.componentMetrics.values()).reduce((sum, m) => sum + m.throughput, 0);
        }
      }

      // Handle label selectors
      const labelMatch = expression.match(/(\w+)\{([^}]+)\}/);
      if (labelMatch) {
        const metricName = labelMatch[1];
        const labels = labelMatch[2];
        
        // Parse labels
        const labelPairs: Record<string, string> = {};
        labels.split(',').forEach(pair => {
          const [key, value] = pair.split('=').map(s => s.trim().replace(/"/g, ''));
          labelPairs[key] = value;
        });

        // Find matching metrics
        if (metricName === 'component_throughput') {
          for (const [nodeId, metrics] of this.componentMetrics.entries()) {
            const node = this.nodes.find(n => n.id === nodeId);
            let matches = true;
            
            if (labelPairs.component_type && metrics.type !== labelPairs.component_type) matches = false;
            if (labelPairs.component_id && nodeId !== labelPairs.component_id) matches = false;
            
            if (matches) return metrics.throughput;
          }
        }
      }

      // Direct metric name (simple queries)
      const trimmedExpr = expression.trim();
      
      if (trimmedExpr === 'component_throughput') {
        const values = Array.from(this.componentMetrics.values()).map(m => m.throughput);
        return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
      }
      if (trimmedExpr === 'component_latency') {
        const values = Array.from(this.componentMetrics.values()).map(m => m.latency);
        return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
      }
      if (trimmedExpr === 'component_error_rate') {
        const values = Array.from(this.componentMetrics.values()).map(m => m.errorRate);
        return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
      }
      if (trimmedExpr === 'component_utilization') {
        const values = Array.from(this.componentMetrics.values()).map(m => m.utilization);
        return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
      }
      if (trimmedExpr === 'sum(component_throughput)') {
        return Array.from(this.componentMetrics.values()).reduce((sum, m) => sum + m.throughput, 0);
      }
      if (trimmedExpr === 'sum(component_latency)') {
        return Array.from(this.componentMetrics.values()).reduce((sum, m) => sum + m.latency, 0);
      }
      
      // Handle queries with label selectors (improved)
      if (labelMatch) {
        const metricName = labelMatch[1];
        const labels = labelMatch[2];
        
        // Parse labels
        const labelPairs: Record<string, string> = {};
        labels.split(',').forEach(pair => {
          const [key, value] = pair.split('=').map(s => s.trim().replace(/"/g, '').replace(/'/g, ''));
          if (key && value) {
            labelPairs[key] = value;
          }
        });

        // Find matching metrics
        if (metricName === 'component_throughput' || metricName === 'component_latency' || 
            metricName === 'component_error_rate' || metricName === 'component_utilization') {
          const matchingMetrics: ComponentMetrics[] = [];
          
          for (const [nodeId, metrics] of this.componentMetrics.entries()) {
            const node = this.nodes.find(n => n.id === nodeId);
            let matches = true;
            
            if (labelPairs.component_type && metrics.type !== labelPairs.component_type) matches = false;
            if (labelPairs.component_id && nodeId !== labelPairs.component_id) matches = false;
            if (labelPairs.component_label && node?.data.label !== labelPairs.component_label) matches = false;
            
            if (matches) {
              matchingMetrics.push(metrics);
            }
          }
          
          if (matchingMetrics.length > 0) {
            if (metricName === 'component_throughput') {
              return matchingMetrics.reduce((sum, m) => sum + m.throughput, 0) / matchingMetrics.length;
            }
            if (metricName === 'component_latency') {
              return matchingMetrics.reduce((sum, m) => sum + m.latency, 0) / matchingMetrics.length;
            }
            if (metricName === 'component_error_rate') {
              return matchingMetrics.reduce((sum, m) => sum + m.errorRate, 0) / matchingMetrics.length;
            }
            if (metricName === 'component_utilization') {
              return matchingMetrics.reduce((sum, m) => sum + m.utilization, 0) / matchingMetrics.length;
            }
          }
        }
      }
    } catch (error) {
      console.error('Query error:', error, expression);
    }

    return null;
  }
}

export const prometheusExporter = new PrometheusMetricsExporter();


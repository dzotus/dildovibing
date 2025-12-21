import { ComponentMetrics } from './EmulationEngine';
import { CanvasNode } from '@/types';

/**
 * Prometheus Metrics Exporter
 * Конвертирует ComponentMetrics в Prometheus exposition format
 * 
 * Prometheus exposition format:
 * # HELP metric_name Description
 * # TYPE metric_name counter|gauge|histogram|summary
 * metric_name{label1="value1",label2="value2"} value timestamp
 */
export class PrometheusMetricsExporter {
  /**
   * Конвертирует ComponentMetrics в Prometheus exposition format
   */
  static exportMetrics(node: CanvasNode, metrics: ComponentMetrics): string {
    const lines: string[] = [];
    const labels = this.buildLabels(node, metrics);
    const timestamp = metrics.timestamp || Date.now();

    // Throughput metric (gauge)
    lines.push(`# HELP component_throughput_total Component throughput in operations per second`);
    lines.push(`# TYPE component_throughput_total gauge`);
    lines.push(`component_throughput_total{${labels}} ${metrics.throughput || 0} ${timestamp}`);

    // Latency metric (gauge)
    lines.push(`# HELP component_latency_ms Component latency in milliseconds`);
    lines.push(`# TYPE component_latency_ms gauge`);
    lines.push(`component_latency_ms{${labels}} ${metrics.latency || 0} ${timestamp}`);

    // Latency percentiles (gauge)
    if (metrics.latencyP50 !== undefined) {
      lines.push(`# HELP component_latency_p50_ms Component 50th percentile latency in milliseconds`);
      lines.push(`# TYPE component_latency_p50_ms gauge`);
      lines.push(`component_latency_p50_ms{${labels}} ${metrics.latencyP50} ${timestamp}`);
    }

    if (metrics.latencyP99 !== undefined) {
      lines.push(`# HELP component_latency_p99_ms Component 99th percentile latency in milliseconds`);
      lines.push(`# TYPE component_latency_p99_ms gauge`);
      lines.push(`component_latency_p99_ms{${labels}} ${metrics.latencyP99} ${timestamp}`);
    }

    // Error rate (gauge, 0-1)
    lines.push(`# HELP component_error_rate Component error rate (0-1)`);
    lines.push(`# TYPE component_error_rate gauge`);
    lines.push(`component_error_rate{${labels}} ${metrics.errorRate || 0} ${timestamp}`);

    // Utilization (gauge, 0-1)
    lines.push(`# HELP component_utilization Component utilization (0-1)`);
    lines.push(`# TYPE component_utilization gauge`);
    lines.push(`component_utilization{${labels}} ${metrics.utilization || 0} ${timestamp}`);

    // Custom metrics
    if (metrics.customMetrics) {
      for (const [key, value] of Object.entries(metrics.customMetrics)) {
        const metricName = this.sanitizeMetricName(key);
        lines.push(`# HELP component_${metricName} Component custom metric: ${key}`);
        lines.push(`# TYPE component_${metricName} gauge`);
        lines.push(`component_${metricName}{${labels}} ${value} ${timestamp}`);
      }
    }

    return lines.join('\n') + '\n';
  }

  /**
   * Строит строку labels для метрик Prometheus
   */
  private static buildLabels(node: CanvasNode, metrics: ComponentMetrics): string {
    const labels: string[] = [];
    
    // Обязательные labels
    labels.push(`component_id="${this.escapeLabelValue(node.id)}"`);
    labels.push(`component_type="${this.escapeLabelValue(node.type)}"`);
    
    if (node.data.label) {
      labels.push(`component_name="${this.escapeLabelValue(node.data.label)}"`);
    }

    // Дополнительные labels из конфига компонента
    const config = node.data.config || {};
    if (config.environment) {
      labels.push(`environment="${this.escapeLabelValue(String(config.environment))}"`);
    }
    if (config.namespace) {
      labels.push(`namespace="${this.escapeLabelValue(String(config.namespace))}"`);
    }

    return labels.join(',');
  }

  /**
   * Экранирует значения labels согласно Prometheus спецификации
   */
  private static escapeLabelValue(value: string): string {
    return value
      .replace(/\\/g, '\\\\')  // Экранируем обратные слэши
      .replace(/"/g, '\\"')     // Экранируем кавычки
      .replace(/\n/g, '\\n');   // Экранируем переносы строк
  }

  /**
   * Санитизирует имя метрики согласно Prometheus спецификации
   * Метрика должна начинаться с буквы и содержать только [a-zA-Z0-9_:]
   */
  private static sanitizeMetricName(name: string): string {
    return name
      .replace(/[^a-zA-Z0-9_:]/g, '_')  // Заменяем недопустимые символы на подчеркивание
      .replace(/^[^a-zA-Z]/, '_');       // Если начинается не с буквы, добавляем подчеркивание
  }

  /**
   * Экспортирует метрики для всех компонентов
   */
  static exportAllMetrics(nodes: CanvasNode[], metricsMap: Map<string, ComponentMetrics>): string {
    const sections: string[] = [];
    
    for (const node of nodes) {
      const metrics = metricsMap.get(node.id);
      if (metrics) {
        sections.push(this.exportMetrics(node, metrics));
      }
    }
    
    return sections.join('\n');
  }

  /**
   * Экспортирует метрики для конкретного endpoint (компонента)
   * Используется при симуляции HTTP endpoint /metrics
   */
  static exportEndpointMetrics(node: CanvasNode, metrics: ComponentMetrics | undefined): string {
    if (!metrics) {
      // Если метрик нет, возвращаем пустой ответ (target будет down)
      return '';
    }
    return this.exportMetrics(node, metrics);
  }
}


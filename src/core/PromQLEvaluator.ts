import { PromQLParser, PromQLNode, ParsedPromQL } from './PromQLParser';
import { ComponentMetrics } from './EmulationEngine';
import { CanvasNode } from '@/types';

/**
 * Результат выполнения PromQL запроса
 */
export interface PromQLResult {
  value: number | null;
  success: boolean;
  error?: string;
  series?: Array<{
    labels: Record<string, string>;
    value: number;
  }>;
}

/**
 * PromQL Evaluator
 * Выполняет PromQL запросы над scraped метриками
 */
export class PromQLEvaluator {
  private scrapedMetrics: Map<string, ComponentMetrics>;
  private nodes: Map<string, CanvasNode>;
  private targetLabels: Map<string, Record<string, string>>; // key -> labels

  constructor(
    scrapedMetrics: Map<string, ComponentMetrics>,
    nodes: Map<string, CanvasNode>,
    targetLabels: Map<string, Record<string, string>>
  ) {
    this.scrapedMetrics = scrapedMetrics;
    this.nodes = nodes;
    this.targetLabels = targetLabels;
  }

  /**
   * Выполняет PromQL запрос
   */
  evaluate(expr: string): PromQLResult {
    try {
      const parser = new PromQLParser(expr);
      const parsed = parser.parse();
      const result = this.evaluateNode(parsed.root);
      
      return {
        value: result,
        success: true,
      };
    } catch (error) {
      return {
        value: null,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Выполняет range query (для "for" duration в alerting rules)
   */
  evaluateRange(expr: string, durationMs: number, currentTime: number): PromQLResult {
    // Для симуляции range query, мы просто выполняем обычный запрос
    // В реальном Prometheus это было бы несколько значений за период
    // В симуляции мы используем текущее значение
    return this.evaluate(expr);
  }

  /**
   * Рекурсивно выполняет узел AST
   */
  private evaluateNode(node: PromQLNode): number {
    switch (node.type) {
      case 'number':
        return node.value as number;

      case 'metric':
        return this.evaluateMetric(node);

      case 'operator':
        return this.evaluateOperator(node);

      case 'comparison':
        return this.evaluateComparison(node) ? 1 : 0;

      case 'function':
        return this.evaluateFunction(node);

      case 'aggregation':
        return this.evaluateAggregation(node);

      default:
        throw new Error(`Unknown node type: ${(node as any).type}`);
    }
  }

  /**
   * Выполняет метрику
   */
  private evaluateMetric(node: PromQLNode): number {
    const metricName = node.value as string;
    const labels = node.labels || {};

    // Ищем все метрики, которые соответствуют имени и labels
    const matchingMetrics: Array<{ value: number; labels: Record<string, string> }> = [];

    for (const [key, metrics] of this.scrapedMetrics.entries()) {
      const node = this.nodes.get(metrics.id);
      if (!node) continue;

      // Получаем labels для этого target
      const targetLabels = this.targetLabels.get(key) || {};

      // Проверяем соответствие метрики
      if (this.matchesMetric(metricName, labels, metrics, node, targetLabels)) {
        const value = this.getMetricValue(metricName, metrics);
        if (value !== null) {
          matchingMetrics.push({
            value,
            labels: { ...targetLabels, component_id: node.id, component_type: node.type },
          });
        }
      }
    }

    // Если метрика не найдена, возвращаем 0 (как в Prometheus)
    if (matchingMetrics.length === 0) {
      return 0;
    }

    // Если одна метрика - возвращаем её значение
    if (matchingMetrics.length === 1) {
      return matchingMetrics[0].value;
    }

    // Если несколько метрик - возвращаем сумму (для симуляции)
    // В реальном Prometheus это было бы несколько series
    return matchingMetrics.reduce((sum, m) => sum + m.value, 0);
  }

  /**
   * Проверяет соответствие метрики
   */
  private matchesMetric(
    metricName: string,
    filterLabels: Record<string, string>,
    metrics: ComponentMetrics,
    node: CanvasNode,
    targetLabels: Record<string, string>
  ): boolean {
    // Проверяем имя метрики
    const actualMetricName = this.getActualMetricName(metricName);
    if (!this.hasMetric(actualMetricName, metrics)) {
      return false;
    }

    // Проверяем labels фильтры
    for (const [key, value] of Object.entries(filterLabels)) {
      let actualValue: string | undefined;

      if (key === 'component_id') {
        actualValue = node.id;
      } else if (key === 'component_type') {
        actualValue = node.type;
      } else if (key === 'component_name') {
        actualValue = node.data?.label;
      } else if (key === 'job' || key === 'instance') {
        // Эти labels из target labels
        actualValue = targetLabels[key];
      } else {
        // Ищем в target labels или config
        actualValue = targetLabels[key] || (node.data?.config as any)?.[key];
      }

      if (actualValue !== value) {
        return false;
      }
    }

    return true;
  }

  /**
   * Получает значение метрики из ComponentMetrics
   */
  private getMetricValue(metricName: string, metrics: ComponentMetrics): number | null {
    const actualName = this.getActualMetricName(metricName);

    switch (actualName) {
      case 'component_throughput_total':
      case 'throughput':
        return metrics.throughput || 0;

      case 'component_latency_ms':
      case 'latency':
        return metrics.latency || 0;

      case 'component_latency_p50_ms':
      case 'latency_p50':
        return metrics.latencyP50 || 0;

      case 'component_latency_p99_ms':
      case 'latency_p99':
        return metrics.latencyP99 || 0;

      case 'component_error_rate':
      case 'error_rate':
        return metrics.errorRate || 0;

      case 'component_utilization':
      case 'utilization':
        return metrics.utilization || 0;

      default:
        // Ищем в customMetrics
        if (metrics.customMetrics) {
          const key = actualName.replace(/^component_/, '');
          if (key in metrics.customMetrics) {
            return metrics.customMetrics[key];
          }
        }
        return null;
    }
  }

  /**
   * Получает реальное имя метрики (убирает префикс component_ если есть)
   */
  private getActualMetricName(metricName: string): string {
    // Поддержка как с префиксом, так и без
    if (metricName.startsWith('component_')) {
      return metricName;
    }
    return `component_${metricName}`;
  }

  /**
   * Проверяет наличие метрики
   */
  private hasMetric(metricName: string, metrics: ComponentMetrics): boolean {
    const actualName = this.getActualMetricName(metricName);

    switch (actualName) {
      case 'component_throughput_total':
      case 'component_latency_ms':
      case 'component_error_rate':
      case 'component_utilization':
        return true;

      case 'component_latency_p50_ms':
        return metrics.latencyP50 !== undefined;

      case 'component_latency_p99_ms':
        return metrics.latencyP99 !== undefined;

      default:
        if (metrics.customMetrics) {
          const key = actualName.replace(/^component_/, '');
          return key in metrics.customMetrics;
        }
        return false;
    }
  }

  /**
   * Выполняет оператор
   */
  private evaluateOperator(node: PromQLNode): number {
    const left = this.evaluateNode(node.left!);
    const right = this.evaluateNode(node.right!);

    switch (node.operator) {
      case '+':
        return left + right;
      case '-':
        return left - right;
      case '*':
        return left * right;
      case '/':
        if (right === 0) return 0; // Избегаем деления на ноль
        return left / right;
      case '%':
        if (right === 0) return 0;
        return left % right;
      case '^':
        return Math.pow(left, right);
      default:
        throw new Error(`Unknown operator: ${node.operator}`);
    }
  }

  /**
   * Выполняет сравнение
   */
  private evaluateComparison(node: PromQLNode): boolean {
    const left = this.evaluateNode(node.left!);
    const right = this.evaluateNode(node.right!);

    switch (node.operator) {
      case '==':
        return left === right;
      case '!=':
        return left !== right;
      case '<':
        return left < right;
      case '<=':
        return left <= right;
      case '>':
        return left > right;
      case '>=':
        return left >= right;
      default:
        throw new Error(`Unknown comparison operator: ${node.operator}`);
    }
  }

  /**
   * Выполняет функцию
   */
  private evaluateFunction(node: PromQLNode): number {
    const funcName = node.functionName!;
    const args = node.args || [];

    if (args.length === 0) {
      throw new Error(`Function ${funcName} requires at least one argument`);
    }

    const argValue = this.evaluateNode(args[0]);

    switch (funcName) {
      case 'abs':
        return Math.abs(argValue);
      case 'ceil':
        return Math.ceil(argValue);
      case 'floor':
        return Math.floor(argValue);
      case 'round':
        return Math.round(argValue);

      case 'rate':
      case 'increase':
        // Для симуляции rate/increase просто возвращаем значение
        // В реальном Prometheus это было бы изменение за период
        return argValue;

      case 'sum':
      case 'avg':
      case 'min':
      case 'max':
      case 'count':
        // Эти функции обычно используются как агрегации
        // Но могут быть использованы и как обычные функции
        return argValue;

      default:
        throw new Error(`Unknown function: ${funcName}`);
    }
  }

  /**
   * Выполняет агрегацию
   */
  private evaluateAggregation(node: PromQLNode): number {
    const aggregationOp = node.aggregationOp!;
    const args = node.args || [];

    if (args.length === 0) {
      throw new Error(`Aggregation ${aggregationOp} requires at least one argument`);
    }

    // Выполняем выражение для всех метрик
    const values: number[] = [];

    // Для упрощения, выполняем выражение один раз
    // В реальном Prometheus это было бы по всем series
    const value = this.evaluateNode(args[0]);
    values.push(value);

    switch (aggregationOp) {
      case 'sum':
        return values.reduce((sum, v) => sum + v, 0);
      case 'avg':
        return values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;
      case 'min':
        return values.length > 0 ? Math.min(...values) : 0;
      case 'max':
        return values.length > 0 ? Math.max(...values) : 0;
      case 'count':
        return values.length;
      default:
        throw new Error(`Unknown aggregation: ${aggregationOp}`);
    }
  }
}

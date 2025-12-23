/**
 * ErrorCollector - универсальная система сбора и управления ошибками симуляции
 * 
 * Собирает все ошибки, возникающие во время симуляции, независимо от их источника.
 * Поддерживает категоризацию, фильтрацию и автоматическую очистку старых ошибок.
 */

export type ErrorSeverity = 'critical' | 'warning' | 'info';
export type ErrorSource = 
  | 'emulation-engine'
  | 'component-engine'
  | 'alert-system'
  | 'data-flow'
  | 'routing-engine'
  | 'initialization'
  | 'configuration'
  | 'unknown';

export interface SimulationError {
  id: string;
  timestamp: number;
  severity: ErrorSeverity;
  source: ErrorSource;
  componentId?: string;
  componentLabel?: string;
  componentType?: string;
  message: string;
  errorType?: string; // Тип ошибки (TypeError, RangeError, etc.)
  stack?: string;
  context?: Record<string, any>; // Дополнительный контекст ошибки
  count?: number; // Количество повторений этой ошибки
}

export class ErrorCollector {
  private errors: SimulationError[] = [];
  private maxErrors: number = 200; // Максимальное количество хранимых ошибок
  private errorCounts: Map<string, number> = new Map(); // Подсчет повторяющихся ошибок
  private listeners: Array<(error: SimulationError) => void> = [];

  /**
   * Добавить ошибку в коллектор
   */
  public addError(
    error: Error | string,
    options: {
      severity?: ErrorSeverity;
      source?: ErrorSource;
      componentId?: string;
      componentLabel?: string;
      componentType?: string;
      context?: Record<string, any>;
    } = {}
  ): string {
    const errorId = this.generateErrorId(error, options);
    const existingCount = this.errorCounts.get(errorId) || 0;
    this.errorCounts.set(errorId, existingCount + 1);

    // Если ошибка уже существует, обновляем счетчик вместо создания дубликата
    const existingError = this.errors.find(e => e.id === errorId);
    if (existingError && existingError.count !== undefined) {
      existingError.count = existingCount + 1;
      existingError.timestamp = Date.now(); // Обновляем время последнего появления
      this.notifyListeners(existingError);
      return errorId;
    }

    const simulationError: SimulationError = {
      id: errorId,
      timestamp: Date.now(),
      severity: options.severity || this.determineSeverity(error),
      source: options.source || 'unknown',
      componentId: options.componentId,
      componentLabel: options.componentLabel,
      componentType: options.componentType,
      message: error instanceof Error ? error.message : String(error),
      errorType: error instanceof Error ? error.constructor.name : undefined,
      stack: error instanceof Error ? error.stack : undefined,
      context: options.context,
      count: existingCount + 1,
    };

    // Добавляем ошибку в начало массива
    this.errors.unshift(simulationError);

    // Ограничиваем количество ошибок
    if (this.errors.length > this.maxErrors) {
      const removed = this.errors.pop();
      if (removed) {
        this.errorCounts.delete(removed.id);
      }
    }

    this.notifyListeners(simulationError);
    return errorId;
  }

  /**
   * Генерирует уникальный ID для ошибки на основе её содержимого
   */
  private generateErrorId(
    error: Error | string,
    options: {
      componentId?: string;
      componentType?: string;
      source?: ErrorSource;
    }
  ): string {
    const message = error instanceof Error ? error.message : String(error);
    const key = `${options.source || 'unknown'}-${options.componentType || 'unknown'}-${options.componentId || 'global'}-${message}`;
    // Создаем простой hash из строки
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `error-${Math.abs(hash)}`;
  }

  /**
   * Определяет серьезность ошибки на основе её типа
   */
  private determineSeverity(error: Error | string): ErrorSeverity {
    if (error instanceof Error) {
      const errorName = error.constructor.name;
      const message = error.message.toLowerCase();

      // Критические ошибки
      if (
        errorName === 'RangeError' ||
        errorName === 'ReferenceError' ||
        message.includes('maximum call stack') ||
        message.includes('cannot read property') ||
        message.includes('is not a function')
      ) {
        return 'critical';
      }

      // Предупреждения
      if (
        errorName === 'TypeError' ||
        message.includes('undefined') ||
        message.includes('null')
      ) {
        return 'warning';
      }
    }

    return 'info';
  }

  /**
   * Получить все ошибки
   */
  public getErrors(): SimulationError[] {
    return [...this.errors];
  }

  /**
   * Получить ошибки по серьезности
   */
  public getErrorsBySeverity(severity: ErrorSeverity): SimulationError[] {
    return this.errors.filter(e => e.severity === severity);
  }

  /**
   * Получить ошибки по источнику
   */
  public getErrorsBySource(source: ErrorSource): SimulationError[] {
    return this.errors.filter(e => e.source === source);
  }

  /**
   * Получить ошибки по компоненту
   */
  public getErrorsByComponent(componentId: string): SimulationError[] {
    return this.errors.filter(e => e.componentId === componentId);
  }

  /**
   * Получить критические ошибки
   */
  public getCriticalErrors(): SimulationError[] {
    return this.getErrorsBySeverity('critical');
  }

  /**
   * Получить количество ошибок по серьезности
   */
  public getErrorCount(severity?: ErrorSeverity): number {
    if (severity) {
      return this.getErrorsBySeverity(severity).length;
    }
    return this.errors.length;
  }

  /**
   * Очистить все ошибки
   */
  public clear(): void {
    this.errors = [];
    this.errorCounts.clear();
  }

  /**
   * Очистить ошибки по фильтру
   */
  public clearByFilter(filter: (error: SimulationError) => boolean): void {
    this.errors = this.errors.filter(error => {
      const shouldKeep = !filter(error);
      if (!shouldKeep) {
        this.errorCounts.delete(error.id);
      }
      return shouldKeep;
    });
  }

  /**
   * Удалить конкретную ошибку
   */
  public removeError(errorId: string): void {
    this.errors = this.errors.filter(e => e.id !== errorId);
    this.errorCounts.delete(errorId);
  }

  /**
   * Подписаться на новые ошибки
   */
  public onError(callback: (error: SimulationError) => void): () => void {
    this.listeners.push(callback);
    // Возвращаем функцию для отписки
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Уведомить слушателей о новой ошибке
   */
  private notifyListeners(error: SimulationError): void {
    this.listeners.forEach(listener => {
      try {
        listener(error);
      } catch (e) {
        console.error('Error in error listener:', e);
      }
    });
  }

  /**
   * Получить статистику ошибок
   */
  public getStats(): {
    total: number;
    critical: number;
    warning: number;
    info: number;
    bySource: Record<ErrorSource, number>;
  } {
    const stats = {
      total: this.errors.length,
      critical: this.getErrorCount('critical'),
      warning: this.getErrorCount('warning'),
      info: this.getErrorCount('info'),
      bySource: {} as Record<ErrorSource, number>,
    };

    // Подсчитываем по источникам
    const sources: ErrorSource[] = [
      'emulation-engine',
      'component-engine',
      'alert-system',
      'data-flow',
      'routing-engine',
      'initialization',
      'configuration',
      'unknown',
    ];

    sources.forEach(source => {
      stats.bySource[source] = this.getErrorsBySource(source).length;
    });

    return stats;
  }
}

// Singleton instance
export const errorCollector = new ErrorCollector();



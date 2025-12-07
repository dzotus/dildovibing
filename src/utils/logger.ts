/**
 * Централизованный сервис логирования
 * Заменяет разбросанные console.error/warn/log на единую систему
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

interface LogEntry {
  level: LogLevel;
  message: string;
  error?: Error;
  timestamp: number;
  context?: Record<string, unknown>;
}

class Logger {
  private logLevel: LogLevel;
  private logs: LogEntry[] = [];
  private maxLogs = 100; // Максимальное количество логов в памяти

  constructor() {
    // В production показываем только WARN и ERROR
    // В development показываем все
    this.logLevel = process.env.NODE_ENV === 'production' ? LogLevel.WARN : LogLevel.DEBUG;
  }

  /**
   * Логирование с уровнем DEBUG
   */
  debug(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, undefined, context);
  }

  /**
   * Логирование с уровнем INFO
   */
  info(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, undefined, context);
  }

  /**
   * Логирование с уровнем WARN
   */
  warn(message: string, error?: Error, context?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, error, context);
  }

  /**
   * Логирование с уровнем ERROR
   */
  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, message, error, context);
  }

  /**
   * Внутренний метод логирования
   */
  private log(
    level: LogLevel,
    message: string,
    error?: Error,
    context?: Record<string, unknown>
  ): void {
    // Пропускаем логи ниже установленного уровня
    if (level < this.logLevel) {
      return;
    }

    const entry: LogEntry = {
      level,
      message,
      error,
      timestamp: Date.now(),
      context,
    };

    // Сохраняем в память (для возможного отображения в UI)
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Выводим в консоль
    const logMessage = `[${this.getLevelName(level)}] ${message}`;
    const logContext = context ? { ...context, error } : error;

    switch (level) {
      case LogLevel.DEBUG:
        console.debug(logMessage, logContext || '');
        break;
      case LogLevel.INFO:
        console.info(logMessage, logContext || '');
        break;
      case LogLevel.WARN:
        console.warn(logMessage, logContext || '');
        break;
      case LogLevel.ERROR:
        console.error(logMessage, logContext || '');
        // В production можно отправлять ошибки в сервис мониторинга (Sentry, etc.)
        // if (process.env.NODE_ENV === 'production') {
        //   Sentry.captureException(error || new Error(message), { extra: context });
        // }
        break;
    }
  }

  /**
   * Получить имя уровня логирования
   */
  private getLevelName(level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG:
        return 'DEBUG';
      case LogLevel.INFO:
        return 'INFO';
      case LogLevel.WARN:
        return 'WARN';
      case LogLevel.ERROR:
        return 'ERROR';
      default:
        return 'UNKNOWN';
    }
  }

  /**
   * Получить последние логи (для отображения в UI)
   */
  getRecentLogs(level?: LogLevel, limit: number = 50): LogEntry[] {
    let filtered = this.logs;
    if (level !== undefined) {
      filtered = this.logs.filter((log) => log.level >= level);
    }
    return filtered.slice(-limit);
  }

  /**
   * Очистить логи
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * Установить уровень логирования
   */
  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }
}

// Создаем singleton экземпляр
export const logger = new Logger();

// Экспортируем удобные функции для использования
export const logDebug = (message: string, context?: Record<string, unknown>) =>
  logger.debug(message, context);
export const logInfo = (message: string, context?: Record<string, unknown>) =>
  logger.info(message, context);
export const logWarn = (message: string, error?: Error, context?: Record<string, unknown>) =>
  logger.warn(message, error, context);
export const logError = (message: string, error?: Error, context?: Record<string, unknown>) =>
  logger.error(message, error, context);

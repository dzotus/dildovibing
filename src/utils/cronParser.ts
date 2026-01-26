/**
 * Cron Parser для Jenkins
 * Поддерживает полный синтаксис cron выражений с Jenkins-специфичными расширениями
 */

export interface CronFields {
  minute: number[];
  hour: number[];
  day: number[];
  month: number[];
  weekday: number[];
}

/**
 * Парсер cron выражений для Jenkins
 * Поддерживает: *, ,, -, /, H, ?, @yearly, @monthly, @weekly, @daily, @hourly
 */
export class CronParser {
  /**
   * Парсит cron выражение (5 полей: minute hour day month weekday)
   * Поддерживает: *, ,, -, /, H, ?
   */
  static parse(cronExpression: string): CronFields | null {
    // Поддержка Jenkins-специфичных макросов
    const normalized = this.normalizeExpression(cronExpression);
    if (!normalized) return null;
    
    const parts = normalized.trim().split(/\s+/);
    if (parts.length !== 5) {
      return null; // Неверный формат
    }
    
    try {
      return {
        minute: this.parseField(parts[0], 0, 59),
        hour: this.parseField(parts[1], 0, 23),
        day: this.parseField(parts[2], 1, 31),
        month: this.parseField(parts[3], 1, 12),
        weekday: this.parseField(parts[4], 0, 7), // 0 и 7 = воскресенье
      };
    } catch (error) {
      return null;
    }
  }
  
  /**
   * Нормализует cron выражение (обрабатывает макросы)
   */
  private static normalizeExpression(expr: string): string | null {
    const trimmed = expr.trim();
    
    // Jenkins макросы
    if (trimmed === '@yearly' || trimmed === '@annually') {
      return '0 0 1 1 *';
    }
    if (trimmed === '@monthly') {
      return '0 0 1 * *';
    }
    if (trimmed === '@weekly') {
      return '0 0 * * 0';
    }
    if (trimmed === '@daily' || trimmed === '@midnight') {
      return '0 0 * * *';
    }
    if (trimmed === '@hourly') {
      return '0 * * * *';
    }
    
    return trimmed;
  }
  
  /**
   * Парсит одно поле cron выражения
   */
  private static parseField(field: string, min: number, max: number): number[] {
    // H - Jenkins hash (случайное значение в диапазоне)
    if (field === 'H') {
      // Для симуляции возвращаем случайное значение
      return [Math.floor(Math.random() * (max - min + 1)) + min];
    }
    
    // ? - любое значение (только для day/month)
    if (field === '?') {
      return Array.from({ length: max - min + 1 }, (_, i) => i + min);
    }
    
    // * - все значения
    if (field === '*') {
      return Array.from({ length: max - min + 1 }, (_, i) => i + min);
    }
    
    // Список значений через запятую
    if (field.includes(',')) {
      const values = new Set<number>();
      for (const part of field.split(',')) {
        const parsed = this.parseField(part.trim(), min, max);
        parsed.forEach(v => values.add(v));
      }
      return Array.from(values).sort((a, b) => a - b);
    }
    
    // Диапазон с шагом: H/15, */5, 0-59/10
    if (field.includes('/')) {
      const [range, stepStr] = field.split('/');
      const step = parseInt(stepStr.trim(), 10);
      if (isNaN(step) || step <= 0) {
        throw new Error(`Invalid step: ${stepStr}`);
      }
      
      let rangeMin = min;
      let rangeMax = max;
      
      if (range === '*' || range === 'H') {
        // Весь диапазон
      } else if (range.includes('-')) {
        const [start, end] = range.split('-').map(s => parseInt(s.trim(), 10));
        if (isNaN(start) || isNaN(end)) {
          throw new Error(`Invalid range: ${range}`);
        }
        rangeMin = Math.max(min, start);
        rangeMax = Math.min(max, end);
      } else {
        // Начало с конкретного значения
        const start = parseInt(range.trim(), 10);
        if (isNaN(start)) {
          throw new Error(`Invalid range start: ${range}`);
        }
        rangeMin = Math.max(min, start);
      }
      
      const values: number[] = [];
      for (let i = rangeMin; i <= rangeMax; i += step) {
        values.push(i);
      }
      return values;
    }
    
    // Диапазон: 0-59
    if (field.includes('-')) {
      const [start, end] = field.split('-').map(s => parseInt(s.trim(), 10));
      if (isNaN(start) || isNaN(end)) {
        throw new Error(`Invalid range: ${field}`);
      }
      const rangeMin = Math.max(min, start);
      const rangeMax = Math.min(max, end);
      return Array.from({ length: rangeMax - rangeMin + 1 }, (_, i) => i + rangeMin);
    }
    
    // Конкретное значение
    const value = parseInt(field, 10);
    if (isNaN(value) || value < min || value > max) {
      throw new Error(`Invalid value: ${field} (must be between ${min} and ${max})`);
    }
    return [value];
  }
  
  /**
   * Проверяет, должен ли триггер сработать в указанное время
   */
  static shouldTrigger(cronExpression: string, currentTime: Date): boolean {
    const fields = this.parse(cronExpression);
    if (!fields) return false;
    
    const minute = currentTime.getMinutes();
    const hour = currentTime.getHours();
    const day = currentTime.getDate();
    const month = currentTime.getMonth() + 1; // JavaScript months are 0-based
    const weekday = currentTime.getDay(); // 0 = Sunday, 6 = Saturday
    
    return (
      fields.minute.includes(minute) &&
      fields.hour.includes(hour) &&
      fields.day.includes(day) &&
      fields.month.includes(month) &&
      (fields.weekday.includes(weekday) || fields.weekday.includes(weekday === 0 ? 7 : weekday))
    );
  }
  
  /**
   * Вычисляет следующее время срабатывания
   */
  static getNextTriggerTime(cronExpression: string, fromTime: Date): Date {
    const fields = this.parse(cronExpression);
    if (!fields) {
      throw new Error(`Invalid cron expression: ${cronExpression}`);
    }
    
    let current = new Date(fromTime);
    current.setSeconds(0, 0); // Сбрасываем секунды и миллисекунды
    
    // Пробуем найти следующее время (максимум 1 год вперед)
    const maxIterations = 365 * 24 * 60;
    let iterations = 0;
    
    while (iterations < maxIterations) {
      const minute = current.getMinutes();
      const hour = current.getHours();
      const day = current.getDate();
      const month = current.getMonth() + 1;
      const weekday = current.getDay();
      
      // Проверяем все поля
      if (!fields.minute.includes(minute)) {
        const nextMinute = fields.minute.find(m => m > minute);
        if (nextMinute !== undefined) {
          current.setMinutes(nextMinute);
          continue;
        } else {
          // Переходим на следующий час
          current.setMinutes(fields.minute[0]);
          current.setHours(current.getHours() + 1);
          continue;
        }
      }
      
      if (!fields.hour.includes(hour)) {
        const nextHour = fields.hour.find(h => h > hour);
        if (nextHour !== undefined) {
          current.setHours(nextHour);
          current.setMinutes(fields.minute[0]);
          continue;
        } else {
          // Переходим на следующий день
          current.setHours(fields.hour[0]);
          current.setMinutes(fields.minute[0]);
          current.setDate(current.getDate() + 1);
          continue;
        }
      }
      
      if (!fields.day.includes(day)) {
        const nextDay = fields.day.find(d => d > day);
        if (nextDay !== undefined) {
          current.setDate(nextDay);
          current.setHours(fields.hour[0]);
          current.setMinutes(fields.minute[0]);
          continue;
        } else {
          // Переходим на следующий месяц
          current.setDate(1);
          current.setMonth(current.getMonth() + 1);
          current.setHours(fields.hour[0]);
          current.setMinutes(fields.minute[0]);
          continue;
        }
      }
      
      if (!fields.month.includes(month)) {
        const nextMonth = fields.month.find(m => m > month);
        if (nextMonth !== undefined) {
          current.setMonth(nextMonth - 1); // JavaScript months are 0-based
          current.setDate(1);
          current.setHours(fields.hour[0]);
          current.setMinutes(fields.minute[0]);
          continue;
        } else {
          // Переходим на следующий год
          current.setFullYear(current.getFullYear() + 1);
          current.setMonth(fields.month[0] - 1);
          current.setDate(1);
          current.setHours(fields.hour[0]);
          current.setMinutes(fields.minute[0]);
          continue;
        }
      }
      
      const weekdayCheck = weekday === 0 ? 7 : weekday;
      if (!fields.weekday.includes(weekday) && !fields.weekday.includes(weekdayCheck)) {
        // Переходим на следующий день
        current.setDate(current.getDate() + 1);
        current.setHours(fields.hour[0]);
        current.setMinutes(fields.minute[0]);
        continue;
      }
      
      // Все поля совпадают
      if (current > fromTime) {
        return current;
      }
      
      // Если время совпадает или в прошлом, переходим на следующую минуту
      current.setMinutes(current.getMinutes() + 1);
      iterations++;
    }
    
    throw new Error(`Could not find next trigger time for: ${cronExpression}`);
  }
  
  /**
   * Валидирует cron выражение
   */
  static validate(cronExpression: string): { valid: boolean; error?: string } {
    try {
      const fields = this.parse(cronExpression);
      if (!fields) {
        return { valid: false, error: 'Invalid cron expression format' };
      }
      return { valid: true };
    } catch (error) {
      return { valid: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}

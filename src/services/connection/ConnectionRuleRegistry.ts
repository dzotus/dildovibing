import { ConnectionRule } from './types';

/**
 * Реестр правил подключения компонентов
 */
export class ConnectionRuleRegistry {
  private rules: Map<string, ConnectionRule[]> = new Map();
  private allRules: ConnectionRule[] = [];

  /**
   * Зарегистрировать правило подключения
   */
  register(rule: ConnectionRule): void {
    const key = rule.sourceType;
    
    if (!this.rules.has(key)) {
      this.rules.set(key, []);
    }
    
    const rulesForKey = this.rules.get(key);
    if (rulesForKey) {
      rulesForKey.push(rule);
    this.allRules.push(rule);
    
    // Сортируем по приоритету (высший приоритет первым)
      rulesForKey.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    }
  }

  /**
   * Зарегистрировать несколько правил
   */
  registerMany(rules: ConnectionRule[]): void {
    rules.forEach(rule => this.register(rule));
  }

  /**
   * Найти правила для пары компонентов
   */
  findRules(sourceType: string, targetType: string): ConnectionRule[] {
    const rules: ConnectionRule[] = [];
    
    // Ищем правила для конкретного типа источника
    const sourceRules = this.rules.get(sourceType) || [];
    for (const rule of sourceRules) {
      if (rule.targetTypes === '*' || 
          (Array.isArray(rule.targetTypes) && rule.targetTypes.includes(targetType))) {
        rules.push(rule);
      }
    }
    
    // Ищем правила для универсального источника (*)
    const universalRules = this.rules.get('*') || [];
    for (const rule of universalRules) {
      if (rule.targetTypes === '*' || 
          (Array.isArray(rule.targetTypes) && rule.targetTypes.includes(targetType))) {
        rules.push(rule);
      }
    }
    
    // Сортируем по приоритету
    return rules.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }

  /**
   * Получить все правила
   */
  getAllRules(): ConnectionRule[] {
    return [...this.allRules];
  }

  /**
   * Получить правила для конкретного типа источника
   */
  getRulesForSource(sourceType: string): ConnectionRule[] {
    return this.rules.get(sourceType) || [];
  }

  /**
   * Очистить все правила
   */
  clear(): void {
    this.rules.clear();
    this.allRules = [];
  }
}

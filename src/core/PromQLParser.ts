/**
 * PromQL Parser
 * Базовый парсер PromQL выражений для симуляции alerting rules
 * Поддерживает основные операции: сравнения, агрегации, функции
 */

export interface PromQLNode {
  type: 'metric' | 'number' | 'operator' | 'function' | 'aggregation' | 'comparison';
  value?: string | number;
  operator?: string;
  left?: PromQLNode;
  right?: PromQLNode;
  args?: PromQLNode[];
  functionName?: string;
  aggregationOp?: string;
  labels?: Record<string, string>;
  without?: boolean;
  by?: string[];
}

export interface ParsedPromQL {
  root: PromQLNode;
  originalExpr: string;
}

/**
 * Базовый парсер PromQL выражений
 * Поддерживает:
 * - Метрики: metric_name{label="value"}
 * - Операторы: +, -, *, /, %, ^
 * - Сравнения: ==, !=, <, <=, >, >=
 * - Функции: rate(), increase(), sum(), avg(), max(), min(), count()
 * - Агрегации: sum by (label), avg without (label)
 */
export class PromQLParser {
  private expr: string;
  private pos: number = 0;

  constructor(expr: string) {
    this.expr = expr.trim();
  }

  /**
   * Парсит PromQL выражение
   */
  parse(): ParsedPromQL {
    this.pos = 0;
    const root = this.parseExpression();
    return {
      root,
      originalExpr: this.expr,
    };
  }

  /**
   * Парсит выражение (с учетом приоритетов операторов)
   */
  private parseExpression(): PromQLNode {
    return this.parseComparison();
  }

  /**
   * Парсит сравнение (==, !=, <, <=, >, >=)
   */
  private parseComparison(): PromQLNode {
    let left = this.parseAddition();

    while (this.pos < this.expr.length) {
      const op = this.matchOperator(['==', '!=', '<=', '>=', '<', '>']);
      if (!op) break;

      const right = this.parseAddition();
      left = {
        type: 'comparison',
        operator: op,
        left,
        right,
      };
    }

    return left;
  }

  /**
   * Парсит сложение/вычитание (+, -)
   */
  private parseAddition(): PromQLNode {
    let left = this.parseMultiplication();

    while (this.pos < this.expr.length) {
      const op = this.matchOperator(['+', '-']);
      if (!op) break;

      const right = this.parseMultiplication();
      left = {
        type: 'operator',
        operator: op,
        left,
        right,
      };
    }

    return left;
  }

  /**
   * Парсит умножение/деление/степень (*, /, %, ^)
   */
  private parseMultiplication(): PromQLNode {
    let left = this.parseUnary();

    while (this.pos < this.expr.length) {
      const op = this.matchOperator(['*', '/', '%', '^']);
      if (!op) break;

      const right = this.parseUnary();
      left = {
        type: 'operator',
        operator: op,
        left,
        right,
      };
    }

    return left;
  }

  /**
   * Парсит унарные операции (+, -)
   */
  private parseUnary(): PromQLNode {
    if (this.matchOperator(['+', '-'])) {
      const op = this.expr[this.pos - 1];
      const operand = this.parseUnary();
      return {
        type: 'operator',
        operator: op,
        left: { type: 'number', value: 0 },
        right: operand,
      };
    }
    return this.parsePrimary();
  }

  /**
   * Парсит первичные выражения (метрики, числа, функции, агрегации)
   */
  private parsePrimary(): PromQLNode {
    this.skipWhitespace();

    // Агрегации: sum(...) by (label), avg(...) without (label)
    if (this.matchAggregation()) {
      const aggregationOp = this.expr.substring(this.pos - 3, this.pos).toLowerCase();
      this.skipWhitespace();
      
      if (this.expr[this.pos] !== '(') {
        throw new Error(`Expected '(' after aggregation operator`);
      }
      this.pos++;

      const expr = this.parseExpression();
      
      this.skipWhitespace();
      if (this.expr[this.pos] !== ')') {
        throw new Error(`Expected ')' after aggregation expression`);
      }
      this.pos++;

      // Парсим by/without
      let by: string[] | undefined;
      let without = false;
      this.skipWhitespace();
      
      if (this.matchKeyword('by')) {
        this.skipWhitespace();
        if (this.expr[this.pos] !== '(') {
          throw new Error(`Expected '(' after 'by'`);
        }
        this.pos++;
        by = this.parseLabelList();
        if (this.expr[this.pos] !== ')') {
          throw new Error(`Expected ')' after label list`);
        }
        this.pos++;
      } else if (this.matchKeyword('without')) {
        without = true;
        this.skipWhitespace();
        if (this.expr[this.pos] !== '(') {
          throw new Error(`Expected '(' after 'without'`);
        }
        this.pos++;
        by = this.parseLabelList();
        if (this.expr[this.pos] !== ')') {
          throw new Error(`Expected ')' after label list`);
        }
        this.pos++;
      }

      return {
        type: 'aggregation',
        aggregationOp,
        args: [expr],
        by,
        without,
      };
    }

    // Функции: rate(...), increase(...), sum(...), etc.
    if (this.matchFunction()) {
      const funcName = this.expr.substring(this.pos - this.getFunctionNameLength(), this.pos).toLowerCase();
      this.skipWhitespace();
      
      if (this.expr[this.pos] !== '(') {
        throw new Error(`Expected '(' after function name`);
      }
      this.pos++;

      const args: PromQLNode[] = [];
      this.skipWhitespace();
      
      if (this.expr[this.pos] !== ')') {
        args.push(this.parseExpression());
        
        // Поддержка range: rate(metric[5m])
        this.skipWhitespace();
        if (this.expr[this.pos] === '[') {
          this.pos++;
          const range = this.parseDuration();
          if (this.expr[this.pos] !== ']') {
            throw new Error(`Expected ']' after duration`);
          }
          this.pos++;
          // Сохраняем range как часть функции (для evaluator)
          args[0] = { ...args[0], value: `${args[0].value || ''}[${range}]` };
        }
      }

      this.skipWhitespace();
      if (this.expr[this.pos] !== ')') {
        throw new Error(`Expected ')' after function arguments`);
      }
      this.pos++;

      return {
        type: 'function',
        functionName: funcName,
        args,
      };
    }

    // Метрики: metric_name{label="value"}
    if (this.matchMetric()) {
      const metricName = this.parseIdentifier();
      let labels: Record<string, string> | undefined;

      this.skipWhitespace();
      if (this.expr[this.pos] === '{') {
        this.pos++;
        labels = this.parseLabels();
        if (this.expr[this.pos] !== '}') {
          throw new Error(`Expected '}' after labels`);
        }
        this.pos++;
      }

      return {
        type: 'metric',
        value: metricName,
        labels,
      };
    }

    // Числа
    if (this.matchNumber()) {
      const numStr = this.parseNumber();
      const num = parseFloat(numStr);
      return {
        type: 'number',
        value: num,
      };
    }

    // Скобки
    if (this.expr[this.pos] === '(') {
      this.pos++;
      const expr = this.parseExpression();
      this.skipWhitespace();
      if (this.expr[this.pos] !== ')') {
        throw new Error(`Expected ')' after expression`);
      }
      this.pos++;
      return expr;
    }

    throw new Error(`Unexpected character at position ${this.pos}: ${this.expr[this.pos]}`);
  }

  /**
   * Парсит список меток: label1, label2, label3
   */
  private parseLabelList(): string[] {
    const labels: string[] = [];
    this.skipWhitespace();

    while (this.pos < this.expr.length) {
      const label = this.parseIdentifier();
      labels.push(label);
      
      this.skipWhitespace();
      if (this.expr[this.pos] === ',') {
        this.pos++;
        this.skipWhitespace();
      } else {
        break;
      }
    }

    return labels;
  }

  /**
   * Парсит метки: {label1="value1", label2="value2"}
   */
  private parseLabels(): Record<string, string> {
    const labels: Record<string, string> = {};
    this.skipWhitespace();

    while (this.pos < this.expr.length && this.expr[this.pos] !== '}') {
      const key = this.parseIdentifier();
      this.skipWhitespace();
      
      if (this.expr[this.pos] !== '=') {
        throw new Error(`Expected '=' after label key`);
      }
      this.pos++;
      this.skipWhitespace();

      let value: string;
      if (this.expr[this.pos] === '"' || this.expr[this.pos] === "'") {
        const quote = this.expr[this.pos];
        this.pos++;
        value = this.parseString(quote);
        if (this.expr[this.pos] !== quote) {
          throw new Error(`Expected closing quote`);
        }
        this.pos++;
      } else {
        value = this.parseIdentifier();
      }

      labels[key] = value;
      
      this.skipWhitespace();
      if (this.expr[this.pos] === ',') {
        this.pos++;
        this.skipWhitespace();
      }
    }

    return labels;
  }

  /**
   * Парсит строку в кавычках
   */
  private parseString(quote: string): string {
    let str = '';
    while (this.pos < this.expr.length && this.expr[this.pos] !== quote) {
      if (this.expr[this.pos] === '\\') {
        this.pos++;
        if (this.pos < this.expr.length) {
          str += this.expr[this.pos];
          this.pos++;
        }
      } else {
        str += this.expr[this.pos];
        this.pos++;
      }
    }
    return str;
  }

  /**
   * Парсит идентификатор (имя метрики, метка)
   */
  private parseIdentifier(): string {
    let id = '';
    while (this.pos < this.expr.length && /[a-zA-Z0-9_:]/.test(this.expr[this.pos])) {
      id += this.expr[this.pos];
      this.pos++;
    }
    return id;
  }

  /**
   * Парсит число
   */
  private parseNumber(): string {
    let num = '';
    let hasDot = false;
    
    if (this.expr[this.pos] === '-') {
      num += '-';
      this.pos++;
    }

    while (this.pos < this.expr.length) {
      const char = this.expr[this.pos];
      if (char >= '0' && char <= '9') {
        num += char;
        this.pos++;
      } else if (char === '.' && !hasDot) {
        num += char;
        hasDot = true;
        this.pos++;
      } else {
        break;
      }
    }

    return num;
  }

  /**
   * Парсит duration (5m, 1h, 30s)
   */
  private parseDuration(): string {
    let duration = '';
    while (this.pos < this.expr.length && /[0-9smhd]/.test(this.expr[this.pos])) {
      duration += this.expr[this.pos];
      this.pos++;
    }
    return duration;
  }

  /**
   * Проверяет совпадение оператора
   */
  private matchOperator(operators: string[]): string | null {
    this.skipWhitespace();
    for (const op of operators) {
      if (this.expr.substring(this.pos, this.pos + op.length) === op) {
        this.pos += op.length;
        return op;
      }
    }
    return null;
  }

  /**
   * Проверяет совпадение ключевого слова
   */
  private matchKeyword(keyword: string): boolean {
    this.skipWhitespace();
    if (this.expr.substring(this.pos, this.pos + keyword.length).toLowerCase() === keyword.toLowerCase()) {
      const nextChar = this.expr[this.pos + keyword.length];
      if (!nextChar || !/[a-zA-Z0-9_]/.test(nextChar)) {
        this.pos += keyword.length;
        return true;
      }
    }
    return false;
  }

  /**
   * Проверяет совпадение агрегации
   */
  private matchAggregation(): boolean {
    this.skipWhitespace();
    const aggregations = ['sum', 'avg', 'min', 'max', 'count'];
    for (const agg of aggregations) {
      if (this.expr.substring(this.pos, this.pos + agg.length).toLowerCase() === agg) {
        const nextChar = this.expr[this.pos + agg.length];
        if (!nextChar || !/[a-zA-Z0-9_]/.test(nextChar)) {
          this.pos += agg.length;
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Получает длину имени функции
   */
  private getFunctionNameLength(): number {
    const functions = ['rate', 'increase', 'sum', 'avg', 'min', 'max', 'count', 'abs', 'ceil', 'floor', 'round'];
    for (const func of functions) {
      if (this.expr.substring(this.pos, this.pos + func.length).toLowerCase() === func) {
        const nextChar = this.expr[this.pos + func.length];
        if (!nextChar || !/[a-zA-Z0-9_]/.test(nextChar)) {
          return func.length;
        }
      }
    }
    return 0;
  }

  /**
   * Проверяет совпадение функции
   */
  private matchFunction(): boolean {
    this.skipWhitespace();
    return this.getFunctionNameLength() > 0;
  }

  /**
   * Проверяет совпадение метрики
   */
  private matchMetric(): boolean {
    this.skipWhitespace();
    return /[a-zA-Z_]/.test(this.expr[this.pos]);
  }

  /**
   * Проверяет совпадение числа
   */
  private matchNumber(): boolean {
    this.skipWhitespace();
    return /[0-9-]/.test(this.expr[this.pos]);
  }

  /**
   * Пропускает пробелы
   */
  private skipWhitespace(): void {
    while (this.pos < this.expr.length && /\s/.test(this.expr[this.pos])) {
      this.pos++;
    }
  }
}

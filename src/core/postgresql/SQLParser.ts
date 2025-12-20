import { Parser } from 'node-sql-parser';
import { ParsedSQLQuery, SQLCondition, SQLConditionItem, SQLJoin, SQLOrderBy } from './types';

// Type for AST from node-sql-parser
type AST = any;

/**
 * SQL Parser for PostgreSQL queries
 * Uses node-sql-parser library to parse SQL into structured format
 */
export class PostgreSQLSQLParser {
  private parser: Parser;

  constructor() {
    this.parser = new Parser();
  }

  /**
   * Parse SQL query string into structured format
   */
  parse(sql: string): ParsedSQLQuery {
    try {
      const ast = this.parser.astify(sql) as AST | AST[];
      const queries = Array.isArray(ast) ? ast : [ast];
      
      if (queries.length === 0) {
        return this.createUnknownQuery(sql);
      }

      const firstQuery = queries[0];
      return this.parseAST(firstQuery, sql);
    } catch (error) {
      console.error('SQL Parse Error:', error);
      return this.createUnknownQuery(sql);
    }
  }

  /**
   * Parse AST node into ParsedSQLQuery
   */
  private parseAST(ast: AST, originalSQL: string): ParsedSQLQuery {
    const query: ParsedSQLQuery = {
      type: this.getQueryType(ast),
      raw: originalSQL,
    };

    switch (ast.type) {
      case 'select':
        return this.parseSelect(ast as any, query);
      case 'insert':
        return this.parseInsert(ast as any, query);
      case 'update':
        return this.parseUpdate(ast as any, query);
      case 'delete':
        return this.parseDelete(ast as any, query);
      default:
        return { ...query, type: 'UNKNOWN' };
    }
  }

  /**
   * Get query type from AST
   */
  private getQueryType(ast: AST): ParsedSQLQuery['type'] {
    switch (ast.type) {
      case 'select':
        return 'SELECT';
      case 'insert':
        return 'INSERT';
      case 'update':
        return 'UPDATE';
      case 'delete':
        return 'DELETE';
      default:
        return 'UNKNOWN';
    }
  }

  /**
   * Parse SELECT query
   */
  private parseSelect(ast: any, query: ParsedSQLQuery): ParsedSQLQuery {
    // Extract table name
    if (ast.from && ast.from.length > 0) {
      const fromTable = ast.from[0];
      if (fromTable.table) {
        query.table = fromTable.table;
        query.schema = fromTable.db || 'public';
      }
    }

    // Extract columns
    if (ast.columns) {
      query.columns = ast.columns.map((col: any) => {
        if (col.expr && col.expr.column) {
          return col.expr.column;
        }
        if (col.expr && col.expr.ast) {
          return this.extractColumnName(col.expr.ast);
        }
        return '*';
      });
    }

    // Parse WHERE clause
    if (ast.where) {
      query.where = this.parseWhere(ast.where);
    }

    // Parse JOINs
    if (ast.from && ast.from.length > 1) {
      query.join = [];
      for (let i = 1; i < ast.from.length; i++) {
        const join = this.parseJoin(ast.from[i]);
        if (join) {
          query.join.push(join);
        }
      }
    }

    // Parse ORDER BY
    if (ast.orderby) {
      query.orderBy = ast.orderby.map((order: any) => ({
        column: order.expr?.column || order.expr?.value || '',
        direction: order.type === 'DESC' ? 'DESC' : 'ASC',
      }));
    }

    // Parse LIMIT
    if (ast.limit) {
      query.limit = ast.limit.value?.[0]?.value;
      query.offset = ast.limit.value?.[1]?.value;
    }

    return query;
  }

  /**
   * Parse INSERT query
   */
  private parseInsert(ast: any, query: ParsedSQLQuery): ParsedSQLQuery {
    if (ast.table) {
      query.table = ast.table[0]?.table;
      query.schema = ast.table[0]?.db || 'public';
    }

    if (ast.columns) {
      query.columns = ast.columns.map((col: any) => col.column || col.value);
    }

    if (ast.values) {
      query.values = ast.values.map((val: any) => {
        if (val.value) {
          return val.value.map((v: any) => this.extractValue(v));
        }
        return [];
      });
    }

    return query;
  }

  /**
   * Parse UPDATE query
   */
  private parseUpdate(ast: any, query: ParsedSQLQuery): ParsedSQLQuery {
    if (ast.table) {
      query.table = ast.table[0]?.table;
      query.schema = ast.table[0]?.db || 'public';
    }

    if (ast.set) {
      query.set = {};
      ast.set.forEach((setItem: any) => {
        if (setItem.column && setItem.value) {
          query.set![setItem.column] = this.extractValue(setItem.value);
        }
      });
    }

    if (ast.where) {
      query.where = this.parseWhere(ast.where);
    }

    return query;
  }

  /**
   * Parse DELETE query
   */
  private parseDelete(ast: any, query: ParsedSQLQuery): ParsedSQLQuery {
    if (ast.from) {
      query.table = ast.from[0]?.table;
      query.schema = ast.from[0]?.db || 'public';
    }

    if (ast.where) {
      query.where = this.parseWhere(ast.where);
    }

    return query;
  }

  /**
   * Parse WHERE clause
   */
  private parseWhere(where: any): SQLCondition {
    if (where.operator) {
      // Binary expression (AND, OR)
      return {
        operator: where.operator,
        conditions: [
          ...this.parseCondition(where.left),
          ...this.parseCondition(where.right),
        ],
      };
    } else {
      // Single condition
      return {
        operator: 'AND',
        conditions: this.parseCondition(where),
      };
    }
  }

  /**
   * Parse condition item
   */
  private parseCondition(expr: any): SQLConditionItem[] {
    if (!expr) return [];

    if (expr.operator) {
      // Binary operator
      const condition: SQLConditionItem = {
        column: expr.left?.column || expr.left?.value || '',
        operator: this.mapOperator(expr.operator),
        value: this.extractValue(expr.right),
      };

      // Handle IN operator
      if (expr.operator === 'IN' && expr.right?.value) {
        condition.operator = 'IN';
        condition.values = Array.isArray(expr.right.value)
          ? expr.right.value.map((v: any) => this.extractValue(v))
          : [this.extractValue(expr.right)];
      }

      // Handle IS NULL / IS NOT NULL
      if (expr.operator === 'IS' && expr.right?.keyword === 'NULL') {
        condition.operator = 'IS NULL';
        delete condition.value;
      }
      if (expr.operator === 'IS NOT' && expr.right?.keyword === 'NULL') {
        condition.operator = 'IS NOT NULL';
        delete condition.value;
      }

      return [condition];
    }

    return [];
  }

  /**
   * Map SQL operator to our operator type
   */
  private mapOperator(op: string): SQLConditionItem['operator'] {
    switch (op.toUpperCase()) {
      case '=':
        return '=';
      case '!=':
      case '<>':
        return '!=';
      case '>':
        return '>';
      case '<':
        return '<';
      case '>=':
        return '>=';
      case '<=':
        return '<=';
      case 'LIKE':
        return 'LIKE';
      case 'IN':
        return 'IN';
      case 'IS':
        return 'IS NULL';
      case 'IS NOT':
        return 'IS NOT NULL';
      default:
        return '=';
    }
  }

  /**
   * Parse JOIN clause
   */
  private parseJoin(from: any): SQLJoin | null {
    if (!from.join) return null;

    return {
      type: from.join || 'INNER',
      table: from.table,
      schema: from.db || 'public',
      on: this.parseWhere(from.on),
    };
  }

  /**
   * Extract column name from expression
   */
  private extractColumnName(expr: any): string {
    if (expr.column) return expr.column;
    if (expr.value) return expr.value;
    if (expr.ast) return this.extractColumnName(expr.ast);
    return '*';
  }

  /**
   * Extract value from expression
   */
  private extractValue(expr: any): any {
    if (expr === null || expr === undefined) return null;
    if (typeof expr === 'string' || typeof expr === 'number' || typeof expr === 'boolean') {
      return expr;
    }
    if (expr.value !== undefined) return expr.value;
    if (expr.column) return expr.column;
    if (expr.type === 'string') return expr.value;
    if (expr.type === 'number') return expr.value;
    return null;
  }

  /**
   * Create unknown query result
   */
  private createUnknownQuery(sql: string): ParsedSQLQuery {
    return {
      type: 'UNKNOWN',
      raw: sql,
    };
  }
}


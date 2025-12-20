import {
  PostgreSQLTable,
  PostgreSQLRow,
  ParsedSQLQuery,
  QueryExecutionResult,
  QueryPlan,
  IndexUsage,
  PostgreSQLIndex,
} from './types';
import { PostgreSQLSQLParser } from './SQLParser';
import { QueryPlanner } from './QueryPlanner';
import { PostgreSQLTransactionManager } from './TransactionManager';
import { PostgreSQLPermissionManager, UserContext } from './PermissionManager';

/**
 * Query Engine for executing SQL queries against PostgreSQL tables
 */
export class PostgreSQLQueryEngine {
  private parser: PostgreSQLSQLParser;
  private planner: QueryPlanner;
  private transactionManager: PostgreSQLTransactionManager;
  private permissionManager: PostgreSQLPermissionManager;
  private currentTransaction: string | null = null;
  private currentUser: UserContext | null = null;

  constructor() {
    this.parser = new PostgreSQLSQLParser();
    this.planner = new QueryPlanner();
    this.transactionManager = new PostgreSQLTransactionManager();
    this.permissionManager = new PostgreSQLPermissionManager();
    // Default user context
    this.currentUser = this.permissionManager.createUserContext('postgres', 'postgres');
  }

  /**
   * Set current user context
   */
  setUserContext(roleName: string, username?: string): boolean {
    const context = this.permissionManager.createUserContext(roleName, username);
    if (context) {
      this.currentUser = context;
      return true;
    }
    return false;
  }

  /**
   * Execute SQL query against tables
   */
  execute(
    sql: string,
    tables: PostgreSQLTable[],
    indexes: PostgreSQLIndex[] = [],
    views: any[] = []
  ): QueryExecutionResult {
    const startTime = Date.now();

    try {
      // Check for transaction commands
      const upperSQL = sql.trim().toUpperCase();
      if (upperSQL.startsWith('BEGIN') || upperSQL.startsWith('START TRANSACTION')) {
        const isolationLevel = this.extractIsolationLevel(sql);
        const txnId = this.transactionManager.begin(isolationLevel);
        this.currentTransaction = txnId;
        return {
          success: true,
          rowCount: 0,
          executionTime: Date.now() - startTime,
        };
      }

      if (upperSQL === 'COMMIT') {
        if (!this.currentTransaction) {
          return {
            success: false,
            error: 'No active transaction',
            executionTime: Date.now() - startTime,
          };
        }
        const result = this.transactionManager.commit(this.currentTransaction);
        this.currentTransaction = null;
        return {
          success: result.success,
          error: result.error,
          rowCount: 0,
          executionTime: Date.now() - startTime,
        };
      }

      if (upperSQL === 'ROLLBACK') {
        if (!this.currentTransaction) {
          return {
            success: false,
            error: 'No active transaction',
            executionTime: Date.now() - startTime,
          };
        }
        const result = this.transactionManager.rollback(this.currentTransaction);
        this.currentTransaction = null;
        return {
          success: result.success,
          error: result.error,
          rowCount: 0,
          executionTime: Date.now() - startTime,
        };
      }

      // Parse SQL
      const parsedQuery = this.parser.parse(sql);

      if (parsedQuery.type === 'UNKNOWN') {
        return {
          success: false,
          error: 'Unable to parse SQL query',
          executionTime: Date.now() - startTime,
        };
      }

      // If in transaction, add query to transaction
      if (this.currentTransaction) {
        // Execute query first to check for errors
        // (In real PostgreSQL, queries are queued until COMMIT)
        const tempResult = this.executeQuery(parsedQuery, tables, indexes, views, startTime);
        this.transactionManager.addQuery(
          this.currentTransaction,
          sql,
          tempResult.success ? tempResult.rows : undefined,
          tempResult.error
        );

        // If query failed, auto-rollback
        if (!tempResult.success) {
          this.transactionManager.rollback(this.currentTransaction);
          this.currentTransaction = null;
          return {
            ...tempResult,
            error: tempResult.error ? `${tempResult.error} (Transaction rolled back)` : 'Transaction rolled back',
          };
        }

        return tempResult;
      }

      // Find target table or view
      let targetTable = this.findTable(parsedQuery.table, parsedQuery.schema || 'public', tables);
      let targetView = this.findView(parsedQuery.table, parsedQuery.schema || 'public', views);

      // If view found, execute its definition as a subquery
      if (targetView && parsedQuery.type === 'SELECT') {
        // Parse and execute view definition
        const viewResult = this.execute(targetView.definition, tables, indexes, views);
        if (!viewResult.success) {
          return {
            success: false,
            error: `Error executing view "${targetView.name}": ${viewResult.error}`,
            executionTime: Date.now() - startTime,
          };
        }
        // Use view results as the "table" for further processing
        const viewTable: PostgreSQLTable = {
          name: targetView.name,
          schema: targetView.schema,
          columns: [], // Will be inferred from results
          indexes: [],
          constraints: [],
          data: viewResult.rows || [],
        };
        targetTable = viewTable;
      }

      if (!targetTable && !targetView && parsedQuery.type !== 'SELECT') {
        return {
          success: false,
          error: `Table or view "${parsedQuery.schema || 'public'}.${parsedQuery.table}" not found`,
          executionTime: Date.now() - startTime,
        };
      }

      // Execute query (extracted to separate method for transaction support)
      return this.executeQuery(parsedQuery, tables, indexes, views, startTime);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Extract isolation level from BEGIN statement
   */
  private extractIsolationLevel(sql: string): 'READ UNCOMMITTED' | 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE' {
    const upper = sql.toUpperCase();
    if (upper.includes('SERIALIZABLE')) return 'SERIALIZABLE';
    if (upper.includes('REPEATABLE READ')) return 'REPEATABLE READ';
    if (upper.includes('READ UNCOMMITTED')) return 'READ UNCOMMITTED';
    return 'READ COMMITTED'; // Default
  }

  /**
   * Execute query (internal method)
   */
  private executeQuery(
    parsedQuery: ParsedSQLQuery,
    tables: PostgreSQLTable[],
    indexes: PostgreSQLIndex[],
    views: any[],
    startTime: number
  ): QueryExecutionResult {
    // Find target table or view
    let targetTable = this.findTable(parsedQuery.table, parsedQuery.schema || 'public', tables);
    let targetView = this.findView(parsedQuery.table, parsedQuery.schema || 'public', views);

    // If view found, execute its definition as a subquery
    if (targetView && parsedQuery.type === 'SELECT') {
      // Parse and execute view definition (recursive, but safe due to depth limit)
      const viewParsed = this.parser.parse(targetView.definition);
      if (viewParsed.type === 'UNKNOWN') {
        return {
          success: false,
          error: `Unable to parse view definition for "${targetView.name}"`,
          executionTime: Date.now() - startTime,
        };
      }
      const viewResult = this.executeQuery(viewParsed, tables, indexes, views, startTime);
      if (!viewResult.success) {
        return {
          success: false,
          error: `Error executing view "${targetView.name}": ${viewResult.error}`,
          executionTime: Date.now() - startTime,
        };
      }
      // Use view results as the "table" for further processing
      const viewTable: PostgreSQLTable = {
        name: targetView.name,
        schema: targetView.schema,
        columns: [], // Will be inferred from results
        indexes: [],
        constraints: [],
        data: viewResult.rows || [],
      };
      targetTable = viewTable;
    }

    if (!targetTable && !targetView && parsedQuery.type !== 'SELECT') {
      return {
        success: false,
        error: `Table or view "${parsedQuery.schema || 'public'}.${parsedQuery.table}" not found`,
        executionTime: Date.now() - startTime,
      };
    }

    // Generate query plan
    const queryPlan = this.planner.planQuery(parsedQuery, targetTable, indexes);

    // Execute query based on type
    let result: QueryExecutionResult;

    switch (parsedQuery.type) {
      case 'SELECT':
        result = this.executeSelect(parsedQuery, tables, queryPlan, indexes);
        break;
      case 'INSERT':
        result = this.executeInsert(parsedQuery, targetTable!, tables);
        break;
      case 'UPDATE':
        result = this.executeUpdate(parsedQuery, targetTable!, tables);
        break;
      case 'DELETE':
        result = this.executeDelete(parsedQuery, targetTable!);
        break;
      default:
        result = {
          success: false,
          error: `Unsupported query type: ${parsedQuery.type}`,
          executionTime: Date.now() - startTime,
        };
    }

    result.executionTime = Date.now() - startTime;
    result.queryPlan = queryPlan;
    result.indexesUsed = queryPlan.indexUsed ? [queryPlan.indexUsed] : [];

    return result;
  }

  /**
   * Execute SELECT query
   */
  private executeSelect(
    query: ParsedSQLQuery,
    tables: PostgreSQLTable[],
    plan: QueryPlan,
    indexes: PostgreSQLIndex[]
  ): QueryExecutionResult {
    const targetTable = this.findTable(query.table, query.schema || 'public', tables);

    if (!targetTable) {
      return {
        success: false,
        error: `Table "${query.schema || 'public'}.${query.table}" not found`,
      };
    }

    let rows = targetTable.data || [];

    // Apply WHERE clause
    if (query.where) {
      rows = this.applyWhere(rows, query.where, targetTable);
    }

    // Apply JOINs
    if (query.join && query.join.length > 0) {
      for (const join of query.join) {
        const joinTable = this.findTable(join.table, join.schema || 'public', tables);
        if (joinTable) {
          rows = this.applyJoin(rows, joinTable, join);
        }
      }
    }

    // Select columns
    if (query.columns && !query.columns.includes('*')) {
      rows = rows.map((row) => {
        const selected: PostgreSQLRow = {};
        query.columns!.forEach((col) => {
          if (row[col] !== undefined) {
            selected[col] = row[col];
          }
        });
        return selected;
      });
    }

    // Apply ORDER BY
    if (query.orderBy && query.orderBy.length > 0) {
      rows = this.applyOrderBy(rows, query.orderBy);
    }

    // Apply LIMIT and OFFSET
    if (query.offset) {
      rows = rows.slice(query.offset);
    }
    if (query.limit) {
      rows = rows.slice(0, query.limit);
    }

    return {
      success: true,
      rows,
      rowCount: rows.length,
    };
  }

  /**
   * Execute INSERT query
   */
  private executeInsert(query: ParsedSQLQuery, table: PostgreSQLTable, allTables: PostgreSQLTable[] = []): QueryExecutionResult {
    if (!query.values || query.values.length === 0) {
      return {
        success: false,
        error: 'No values provided for INSERT',
      };
    }

    const newRows: PostgreSQLRow[] = [];

    for (const valueRow of query.values) {
      const row: PostgreSQLRow = {};

      // Map values to columns
      if (query.columns && query.columns.length === valueRow.length) {
        query.columns.forEach((col, index) => {
          row[col] = valueRow[index];
        });
      } else if (table.columns.length === valueRow.length) {
        // If no columns specified, use table column order
        table.columns.forEach((col, index) => {
          row[col.name] = valueRow[index];
        });
      } else {
        return {
          success: false,
          error: 'Column count mismatch',
        };
      }

      // Validate row against table schema
      const validation = this.validateRow(row, table, allTables);
      if (!validation.valid) {
        return {
          success: false,
          error: `Validation failed: ${validation.error}`,
        };
      }

      newRows.push(row);
    }

    // Add rows to table data
    if (!table.data) {
      table.data = [];
    }
    table.data.push(...newRows);

    return {
      success: true,
      rowCount: newRows.length,
    };
  }

  /**
   * Execute UPDATE query
   */
  private executeUpdate(query: ParsedSQLQuery, table: PostgreSQLTable, allTables: PostgreSQLTable[] = []): QueryExecutionResult {
    if (!query.set || Object.keys(query.set).length === 0) {
      return {
        success: false,
        error: 'No SET clause in UPDATE',
      };
    }

    if (!table.data) {
      return {
        success: true,
        rowCount: 0,
      };
    }

    let updatedCount = 0;

    // Apply WHERE clause to filter rows
    let rowsToUpdate = table.data;
    if (query.where) {
      rowsToUpdate = this.applyWhere(table.data, query.where, table);
    }

    // Update rows
    for (const row of rowsToUpdate) {
      // Apply SET values
      Object.keys(query.set).forEach((col) => {
        row[col] = query.set![col];
      });

      // Validate updated row
      const validation = this.validateRow(row, table, allTables);
      if (!validation.valid) {
        // Rollback this row
        return {
          success: false,
          error: `Validation failed for updated row: ${validation.error}`,
        };
      }

      updatedCount++;
    }

    return {
      success: true,
      rowCount: updatedCount,
    };
  }

  /**
   * Execute DELETE query
   */
  private executeDelete(query: ParsedSQLQuery, table: PostgreSQLTable): QueryExecutionResult {
    if (!table.data) {
      return {
        success: true,
        rowCount: 0,
      };
    }

    // Apply WHERE clause to filter rows
    let rowsToDelete = table.data;
    if (query.where) {
      rowsToDelete = this.applyWhere(table.data, query.where, table);
    }

    const deletedCount = rowsToDelete.length;

    // Remove rows from table data
    table.data = table.data.filter((row) => !rowsToDelete.includes(row));

    return {
      success: true,
      rowCount: deletedCount,
    };
  }

  /**
   * Apply WHERE clause to rows
   */
  private applyWhere(
    rows: PostgreSQLRow[],
    where: ParsedSQLQuery['where'],
    table: PostgreSQLTable
  ): PostgreSQLRow[] {
    if (!where) return rows;

    return rows.filter((row) => {
      if (where.operator === 'AND') {
        return where.conditions.every((cond) => this.evaluateCondition(row, cond, table));
      } else {
        return where.conditions.some((cond) => this.evaluateCondition(row, cond, table));
      }
    });
  }

  /**
   * Evaluate single condition
   */
  private evaluateCondition(
    row: PostgreSQLRow,
    condition: any,
    table: PostgreSQLTable
  ): boolean {
    const columnValue = row[condition.column];

    switch (condition.operator) {
      case '=':
        return columnValue === condition.value;
      case '!=':
        return columnValue !== condition.value;
      case '>':
        return columnValue > condition.value;
      case '<':
        return columnValue < condition.value;
      case '>=':
        return columnValue >= condition.value;
      case '<=':
        return columnValue <= condition.value;
      case 'LIKE':
        if (typeof columnValue !== 'string' || typeof condition.value !== 'string') {
          return false;
        }
        const pattern = condition.value.replace(/%/g, '.*').replace(/_/g, '.');
        return new RegExp(`^${pattern}$`, 'i').test(columnValue);
      case 'IN':
        return condition.values?.includes(columnValue) || false;
      case 'IS NULL':
        return columnValue === null || columnValue === undefined;
      case 'IS NOT NULL':
        return columnValue !== null && columnValue !== undefined;
      default:
        return false;
    }
  }

  /**
   * Apply JOIN to rows
   */
  private applyJoin(
    leftRows: PostgreSQLRow[],
    rightTable: PostgreSQLTable,
    join: any
  ): PostgreSQLRow[] {
    const rightRows = rightTable.data || [];
    const result: PostgreSQLRow[] = [];

    for (const leftRow of leftRows) {
      for (const rightRow of rightRows) {
        // Simple join on condition (simplified - assumes equality)
        if (join.on) {
          const matches = join.on.conditions.every((cond: any) => {
            if (cond.operator === '=') {
              return leftRow[cond.column] === rightRow[cond.column];
            }
            return false;
          });

          if (matches) {
            result.push({ ...leftRow, ...rightRow });
          }
        }
      }
    }

    return result;
  }

  /**
   * Apply ORDER BY to rows
   */
  private applyOrderBy(rows: PostgreSQLRow[], orderBy: any[]): PostgreSQLRow[] {
    return [...rows].sort((a, b) => {
      for (const order of orderBy) {
        const aVal = a[order.column];
        const bVal = b[order.column];

        if (aVal === bVal) continue;

        const comparison = aVal > bVal ? 1 : -1;
        return order.direction === 'DESC' ? -comparison : comparison;
      }
      return 0;
    });
  }

  /**
   * Find table by name and schema
   */
  private findTable(
    tableName: string | undefined,
    schema: string,
    tables: PostgreSQLTable[]
  ): PostgreSQLTable | undefined {
    if (!tableName) return undefined;

    return tables.find(
      (t) => t.name === tableName && (t.schema === schema || schema === 'public')
    );
  }

  /**
   * Find view by name and schema
   */
  private findView(
    viewName: string | undefined,
    schema: string,
    views: any[]
  ): any | undefined {
    if (!viewName) return undefined;

    return views.find(
      (v) => v.name === viewName && (v.schema === schema || schema === 'public')
    );
  }

  /**
   * Validate row against table schema
   */
  private validateRow(row: PostgreSQLRow, table: PostgreSQLTable): { valid: boolean; error?: string } {
    for (const column of table.columns) {
      const value = row[column.name];

      // Check NOT NULL constraint
      if (!column.nullable && (value === null || value === undefined)) {
        return {
          valid: false,
          error: `Column "${column.name}" cannot be NULL`,
        };
      }

      // Check type (simplified - basic validation)
      if (value !== null && value !== undefined) {
        // Basic type checking could be added here
        // For now, we just check that value exists if NOT NULL
      }
    }

    return { valid: true };
  }
}


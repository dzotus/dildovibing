/**
 * Types for PostgreSQL SQL query processing
 */

export interface PostgreSQLTable {
  name: string;
  schema: string;
  columns: PostgreSQLColumn[];
  indexes: string[];
  constraints: string[];
  data?: PostgreSQLRow[];
  comment?: string; // Table comment
}

export interface PostgreSQLColumn {
  name: string;
  type: string;
  nullable: boolean;
  default?: string;
  primaryKey?: boolean;
  comment?: string; // Column comment
}

export interface PostgreSQLRow {
  [key: string]: any;
}

export interface PostgreSQLSchema {
  name: string;
  owner: string;
}

export interface PostgreSQLView {
  name: string;
  schema: string;
  definition: string;
}

export interface PostgreSQLIndex {
  name: string;
  table: string;
  schema: string;
  columns: string[];
  unique?: boolean;
  type?: string; // btree, hash, gin, gist, etc.
}

/**
 * Parsed SQL query structure
 */
export interface ParsedSQLQuery {
  type: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'CREATE' | 'DROP' | 'ALTER' | 'UNKNOWN';
  table?: string;
  schema?: string;
  columns?: string[];
  where?: SQLCondition;
  join?: SQLJoin[];
  orderBy?: SQLOrderBy[];
  limit?: number;
  offset?: number;
  values?: any[][];
  set?: Record<string, any>;
  raw: string;
}

export interface SQLCondition {
  operator: 'AND' | 'OR';
  conditions: SQLConditionItem[];
}

export interface SQLConditionItem {
  column: string;
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'LIKE' | 'IN' | 'IS NULL' | 'IS NOT NULL';
  value?: any;
  values?: any[];
}

export interface SQLJoin {
  type: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';
  table: string;
  schema?: string;
  on: SQLCondition;
}

export interface SQLOrderBy {
  column: string;
  direction: 'ASC' | 'DESC';
}

/**
 * Query execution result
 */
export interface QueryExecutionResult {
  success: boolean;
  rows?: PostgreSQLRow[];
  rowCount?: number;
  error?: string;
  executionTime?: number;
  indexesUsed?: string[];
  queryPlan?: QueryPlan;
}

/**
 * Query execution plan (simplified)
 */
export interface QueryPlan {
  operation: string;
  table: string;
  indexUsed?: string;
  estimatedRows: number;
  estimatedCost: number;
  children?: QueryPlan[];
}

/**
 * Index usage information
 */
export interface IndexUsage {
  indexName: string;
  table: string;
  columns: string[];
  used: boolean;
  selectivity: number; // 0-1, how selective the index is
}


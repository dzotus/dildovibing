/**
 * Advanced CQL Parser
 * Parses CQL queries with support for complex WHERE clauses, ORDER BY, GROUP BY, and aggregate functions
 * Simulative approach - no hardcoded values
 */

export interface ParsedCQLQuery {
  type: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'CREATE_KEYSPACE' | 'CREATE_TABLE' | 'DROP_TABLE' | 'DROP_KEYSPACE' | 'BATCH' | 'UNKNOWN';
  originalQuery: string;
  normalizedQuery: string;
  error?: string;
  
  // SELECT specific
  selectColumns?: string[];
  fromTable?: string;
  whereClause?: ParsedWhereClause;
  orderBy?: ParsedOrderBy[];
  groupBy?: string[];
  limit?: number;
  aggregateFunctions?: ParsedAggregateFunction[];
  
  // INSERT specific
  insertTable?: string;
  insertColumns?: string[];
  insertValues?: any[];
  ttl?: number;
  ifNotExists?: boolean;
  
  // UPDATE specific
  updateTable?: string;
  updateSet?: Record<string, any>;
  updateWhere?: ParsedWhereClause;
  updateTTL?: number;
  ifExists?: boolean;
  
  // DELETE specific
  deleteTable?: string;
  deleteWhere?: ParsedWhereClause;
  
  // CREATE KEYSPACE specific
  keyspaceName?: string;
  replicationConfig?: ReplicationConfig;
  durableWrites?: boolean;
  
  // CREATE TABLE specific
  tableName?: string;
  tableColumns?: TableColumnDefinition[];
  primaryKey?: string[];
  
  // BATCH specific
  batchStatements?: ParsedCQLQuery[];
  batchConsistency?: string;
}

export interface ParsedWhereClause {
  conditions: WhereCondition[];
  operator?: 'AND' | 'OR';
}

export interface WhereCondition {
  column: string;
  operator: '=' | '!=' | '<>' | '>' | '<' | '>=' | '<=' | 'IN' | 'LIKE' | 'CONTAINS' | 'CONTAINS_KEY';
  value: any;
  values?: any[]; // For IN operator
}

export interface ParsedOrderBy {
  column: string;
  direction: 'ASC' | 'DESC';
}

export interface ParsedAggregateFunction {
  function: 'COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX';
  column?: string; // null for COUNT(*)
  alias?: string;
}

export interface ReplicationConfig {
  strategy: 'SimpleStrategy' | 'NetworkTopologyStrategy';
  replicationFactor?: number;
  datacenterReplication?: Record<string, number>;
}

export interface TableColumnDefinition {
  name: string;
  type: string;
  primaryKey?: boolean;
  static?: boolean;
}

/**
 * Advanced CQL Parser
 * Parses CQL queries with realistic simulation support
 */
export class CQLParser {
  /**
   * Parse a CQL query
   */
  public parse(query: string): ParsedCQLQuery {
    const normalizedQuery = query.trim().replace(/\s+/g, ' ');
    const upperQuery = normalizedQuery.toUpperCase();
    
    try {
      if (upperQuery.startsWith('SELECT')) {
        return this.parseSelect(normalizedQuery);
      } else if (upperQuery.startsWith('INSERT')) {
        return this.parseInsert(normalizedQuery);
      } else if (upperQuery.startsWith('UPDATE')) {
        return this.parseUpdate(normalizedQuery);
      } else if (upperQuery.startsWith('DELETE')) {
        return this.parseDelete(normalizedQuery);
      } else if (upperQuery.startsWith('CREATE KEYSPACE')) {
        return this.parseCreateKeyspace(normalizedQuery);
      } else if (upperQuery.startsWith('CREATE TABLE')) {
        return this.parseCreateTable(normalizedQuery);
      } else if (upperQuery.startsWith('DROP TABLE')) {
        return this.parseDropTable(normalizedQuery);
      } else if (upperQuery.startsWith('DROP KEYSPACE')) {
        return this.parseDropKeyspace(normalizedQuery);
      } else if (upperQuery.startsWith('BEGIN BATCH') || upperQuery.startsWith('BATCH')) {
        return this.parseBatch(normalizedQuery);
      } else {
        return {
          type: 'UNKNOWN',
          originalQuery: query,
          normalizedQuery,
          error: `Unsupported CQL statement: ${normalizedQuery}`,
        };
      }
    } catch (error) {
      return {
        type: 'UNKNOWN',
        originalQuery: query,
        normalizedQuery,
        error: error instanceof Error ? error.message : 'Unknown parsing error',
      };
    }
  }

  /**
   * Parse SELECT query
   */
  private parseSelect(query: string): ParsedCQLQuery {
    const result: ParsedCQLQuery = {
      type: 'SELECT',
      originalQuery: query,
      normalizedQuery: query,
    };

    // Parse SELECT columns
    const selectMatch = query.match(/SELECT\s+(.+?)\s+FROM/i);
    if (!selectMatch) {
      result.error = 'Invalid SELECT query: missing SELECT clause';
      return result;
    }

    const columnsStr = selectMatch[1].trim();
    
    // Check for aggregate functions
    const aggregateFunctions = this.parseAggregateFunctions(columnsStr);
    if (aggregateFunctions.length > 0) {
      result.aggregateFunctions = aggregateFunctions;
      // Extract non-aggregate columns
      const nonAggregateColumns = this.extractNonAggregateColumns(columnsStr);
      result.selectColumns = nonAggregateColumns.length > 0 ? nonAggregateColumns : ['*'];
    } else {
      // Regular column selection
      if (columnsStr === '*') {
        result.selectColumns = ['*'];
      } else {
        result.selectColumns = columnsStr.split(',').map(c => c.trim());
      }
    }

    // Parse FROM
    const fromMatch = query.match(/FROM\s+([\w.]+)/i);
    if (!fromMatch) {
      result.error = 'Invalid SELECT query: missing FROM clause';
      return result;
    }
    result.fromTable = fromMatch[1].trim();

    // Parse WHERE clause
    const whereMatch = query.match(/WHERE\s+(.+?)(?:\s+GROUP\s+BY|\s+ORDER\s+BY|\s+LIMIT|$)/i);
    if (whereMatch) {
      result.whereClause = this.parseWhereClause(whereMatch[1].trim());
    }

    // Parse GROUP BY
    const groupByMatch = query.match(/GROUP\s+BY\s+(.+?)(?:\s+ORDER\s+BY|\s+LIMIT|$)/i);
    if (groupByMatch) {
      result.groupBy = groupByMatch[1].trim().split(',').map(c => c.trim());
    }

    // Parse ORDER BY
    const orderByMatch = query.match(/ORDER\s+BY\s+(.+?)(?:\s+LIMIT|$)/i);
    if (orderByMatch) {
      result.orderBy = this.parseOrderBy(orderByMatch[1].trim());
    }

    // Parse LIMIT
    const limitMatch = query.match(/LIMIT\s+(\d+)/i);
    if (limitMatch) {
      result.limit = parseInt(limitMatch[1], 10);
    }

    return result;
  }

  /**
   * Parse WHERE clause with support for AND, OR, IN, comparison operators
   */
  private parseWhereClause(whereStr: string): ParsedWhereClause {
    const conditions: WhereCondition[] = [];
    
    // Check for AND/OR operators
    let operator: 'AND' | 'OR' | undefined;
    if (whereStr.includes(' AND ')) {
      operator = 'AND';
    } else if (whereStr.includes(' OR ')) {
      operator = 'OR';
    }

    // Split by operator if present
    const parts = operator 
      ? whereStr.split(new RegExp(`\\s+${operator}\\s+`, 'i'))
      : [whereStr];

    for (const part of parts) {
      const condition = this.parseWhereCondition(part.trim());
      if (condition) {
        conditions.push(condition);
      }
    }

    return {
      conditions,
      operator: operator || 'AND', // Default to AND if no operator specified
    };
  }

  /**
   * Parse a single WHERE condition
   */
  private parseWhereCondition(conditionStr: string): WhereCondition | null {
    // Try IN operator first (most complex)
    const inMatch = conditionStr.match(/(\w+)\s+IN\s+\((.+)\)/i);
    if (inMatch) {
      const column = inMatch[1].trim();
      const valuesStr = inMatch[2].trim();
      const values = this.parseValueList(valuesStr);
      return {
        column,
        operator: 'IN',
        value: null,
        values,
      };
    }

    // Try LIKE operator
    const likeMatch = conditionStr.match(/(\w+)\s+LIKE\s+(.+)/i);
    if (likeMatch) {
      return {
        column: likeMatch[1].trim(),
        operator: 'LIKE',
        value: this.parseValue(likeMatch[2].trim()),
      };
    }

    // Try comparison operators: >=, <=, !=, <>, >, <, =
    const operators = [
      { pattern: /(\w+)\s*>=\s*(.+)/i, op: '>=' as const },
      { pattern: /(\w+)\s*<=\s*(.+)/i, op: '<=' as const },
      { pattern: /(\w+)\s*!=\s*(.+)/i, op: '!=' as const },
      { pattern: /(\w+)\s*<>\s*(.+)/i, op: '<>' as const },
      { pattern: /(\w+)\s*>\s*(.+)/i, op: '>' as const },
      { pattern: /(\w+)\s*<\s*(.+)/i, op: '<' as const },
      { pattern: /(\w+)\s*=\s*(.+)/i, op: '=' as const },
    ];

    for (const { pattern, op } of operators) {
      const match = conditionStr.match(pattern);
      if (match) {
        return {
          column: match[1].trim(),
          operator: op,
          value: this.parseValue(match[2].trim()),
        };
      }
    }

    return null;
  }

  /**
   * Parse ORDER BY clause
   */
  private parseOrderBy(orderByStr: string): ParsedOrderBy[] {
    const orders: ParsedOrderBy[] = [];
    const parts = orderByStr.split(',').map(p => p.trim());
    
    for (const part of parts) {
      const ascMatch = part.match(/(\w+)\s+ASC/i);
      const descMatch = part.match(/(\w+)\s+DESC/i);
      
      if (ascMatch) {
        orders.push({ column: ascMatch[1].trim(), direction: 'ASC' });
      } else if (descMatch) {
        orders.push({ column: descMatch[1].trim(), direction: 'DESC' });
      } else {
        // Default to ASC if not specified
        orders.push({ column: part.trim(), direction: 'ASC' });
      }
    }
    
    return orders;
  }

  /**
   * Parse aggregate functions (COUNT, SUM, AVG, MIN, MAX)
   */
  private parseAggregateFunctions(columnsStr: string): ParsedAggregateFunction[] {
    const functions: ParsedAggregateFunction[] = [];
    
    // Pattern for aggregate functions: FUNCTION(column) or FUNCTION(*) [AS alias]
    const aggregatePattern = /(COUNT|SUM|AVG|MIN|MAX)\s*\(\s*(\*|\w+)\s*\)(?:\s+AS\s+(\w+))?/gi;
    let match;
    
    while ((match = aggregatePattern.exec(columnsStr)) !== null) {
      const funcName = match[1].toUpperCase() as 'COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX';
      const column = match[2] === '*' ? undefined : match[2].trim();
      const alias = match[3]?.trim();
      
      functions.push({
        function: funcName,
        column,
        alias,
      });
    }
    
    return functions;
  }

  /**
   * Extract non-aggregate columns from SELECT clause
   */
  private extractNonAggregateColumns(columnsStr: string): string[] {
    // Remove aggregate functions
    const withoutAggregates = columnsStr.replace(/(COUNT|SUM|AVG|MIN|MAX)\s*\(\s*(\*|\w+)\s*\)(?:\s+AS\s+\w+)?/gi, '');
    
    // Split by comma and filter empty
    const columns = withoutAggregates
      .split(',')
      .map(c => c.trim())
      .filter(c => c.length > 0);
    
    return columns;
  }

  /**
   * Parse INSERT query
   */
  private parseInsert(query: string): ParsedCQLQuery {
    const result: ParsedCQLQuery = {
      type: 'INSERT',
      originalQuery: query,
      normalizedQuery: query,
    };

    // Parse INTO
    const intoMatch = query.match(/INTO\s+([\w.]+)/i);
    if (!intoMatch) {
      result.error = 'Invalid INSERT query: missing INTO clause';
      return result;
    }
    result.insertTable = intoMatch[1].trim();

    // Check for IF NOT EXISTS
    result.ifNotExists = /IF\s+NOT\s+EXISTS/i.test(query);

    // Parse columns
    const columnsMatch = query.match(/\(([^)]+)\)\s*VALUES/i);
    if (columnsMatch) {
      result.insertColumns = columnsMatch[1].split(',').map(c => c.trim());
    }

    // Parse VALUES
    const valuesMatch = query.match(/VALUES\s*\(([^)]+)\)/i);
    if (valuesMatch) {
      result.insertValues = this.parseValueList(valuesMatch[1]);
    }

    // Parse TTL
    const ttlMatch = query.match(/USING\s+TTL\s+(\d+)/i);
    if (ttlMatch) {
      result.ttl = parseInt(ttlMatch[1], 10);
    }

    return result;
  }

  /**
   * Parse UPDATE query
   */
  private parseUpdate(query: string): ParsedCQLQuery {
    const result: ParsedCQLQuery = {
      type: 'UPDATE',
      originalQuery: query,
      normalizedQuery: query,
    };

    // Parse UPDATE table
    const updateMatch = query.match(/UPDATE\s+([\w.]+)\s+SET/i);
    if (!updateMatch) {
      result.error = 'Invalid UPDATE query';
      return result;
    }
    result.updateTable = updateMatch[1].trim();

    // Check for IF EXISTS
    result.ifExists = /IF\s+EXISTS/i.test(query);

    // Parse SET clause
    const setMatch = query.match(/SET\s+(.+?)(?:\s+WHERE|$)/i);
    if (!setMatch) {
      result.error = 'Invalid UPDATE query: missing SET clause';
      return result;
    }

    const setClause = setMatch[1].trim();
    result.updateSet = {};
    const pairs = setClause.split(',').map(p => p.trim());
    for (const pair of pairs) {
      const eqMatch = pair.match(/(\w+)\s*=\s*(.+)/);
      if (eqMatch) {
        const key = eqMatch[1].trim();
        const value = this.parseValue(eqMatch[2].trim());
        result.updateSet![key] = value;
      }
    }

    // Parse WHERE clause
    const whereMatch = query.match(/WHERE\s+(.+?)(?:\s+USING|$)/i);
    if (whereMatch) {
      result.updateWhere = this.parseWhereClause(whereMatch[1].trim());
    }

    // Parse TTL in USING clause
    const ttlMatch = query.match(/USING\s+TTL\s+(\d+)/i);
    if (ttlMatch) {
      result.updateTTL = parseInt(ttlMatch[1], 10);
    }

    return result;
  }

  /**
   * Parse DELETE query
   */
  private parseDelete(query: string): ParsedCQLQuery {
    const result: ParsedCQLQuery = {
      type: 'DELETE',
      originalQuery: query,
      normalizedQuery: query,
    };

    // Parse FROM
    const fromMatch = query.match(/FROM\s+([\w.]+)/i);
    if (!fromMatch) {
      result.error = 'Invalid DELETE query: missing FROM clause';
      return result;
    }
    result.deleteTable = fromMatch[1].trim();

    // Parse WHERE clause
    const whereMatch = query.match(/WHERE\s+(.+)/i);
    if (!whereMatch) {
      result.error = 'DELETE requires WHERE clause';
      return result;
    }
    result.deleteWhere = this.parseWhereClause(whereMatch[1].trim());

    return result;
  }

  /**
   * Parse CREATE KEYSPACE query
   */
  private parseCreateKeyspace(query: string): ParsedCQLQuery {
    const result: ParsedCQLQuery = {
      type: 'CREATE_KEYSPACE',
      originalQuery: query,
      normalizedQuery: query,
    };

    // Parse keyspace name
    const nameMatch = query.match(/KEYSPACE\s+(\w+)/i);
    if (!nameMatch) {
      result.error = 'Invalid CREATE KEYSPACE query';
      return result;
    }
    result.keyspaceName = nameMatch[1].trim();

    // Parse replication config
    const replicationMatch = query.match(/replication\s*=\s*\{([^}]+)\}/i);
    if (replicationMatch) {
      result.replicationConfig = this.parseReplicationConfig(replicationMatch[1]);
    } else {
      // Default replication
      result.replicationConfig = {
        strategy: 'SimpleStrategy',
        replicationFactor: 3,
      };
    }

    // Parse durable writes
    const durableWritesMatch = query.match(/durable_writes\s*=\s*(true|false)/i);
    if (durableWritesMatch) {
      result.durableWrites = durableWritesMatch[1].toLowerCase() === 'true';
    } else {
      result.durableWrites = true; // Default
    }

    return result;
  }

  /**
   * Parse replication configuration
   */
  private parseReplicationConfig(configStr: string): ReplicationConfig {
    const config: ReplicationConfig = {
      strategy: 'SimpleStrategy',
    };

    // Check for strategy
    const strategyMatch = configStr.match(/['"]class['"]\s*:\s*['"](.+?)['"]/i);
    if (strategyMatch) {
      const strategy = strategyMatch[1].trim();
      if (strategy.includes('NetworkTopologyStrategy')) {
        config.strategy = 'NetworkTopologyStrategy';
        // Parse datacenter replication
        const dcMatches = configStr.matchAll(/(\w+)\s*:\s*(\d+)/g);
        config.datacenterReplication = {};
        for (const match of dcMatches) {
          const dcName = match[1].trim();
          const rf = parseInt(match[2], 10);
          if (dcName !== 'class') {
            config.datacenterReplication![dcName] = rf;
          }
        }
      } else if (strategy.includes('SimpleStrategy')) {
        config.strategy = 'SimpleStrategy';
        // Parse replication factor
        const rfMatch = configStr.match(/['"]replication_factor['"]\s*:\s*(\d+)/i);
        if (rfMatch) {
          config.replicationFactor = parseInt(rfMatch[1], 10);
        }
      }
    } else {
      // Try simple replication factor
      const rfMatch = configStr.match(/replication_factor\s*[:=]\s*(\d+)/i);
      if (rfMatch) {
        config.replicationFactor = parseInt(rfMatch[1], 10);
      }
    }

    return config;
  }

  /**
   * Parse CREATE TABLE query
   */
  private parseCreateTable(query: string): ParsedCQLQuery {
    const result: ParsedCQLQuery = {
      type: 'CREATE_TABLE',
      originalQuery: query,
      normalizedQuery: query,
    };

    // Parse table name
    const tableMatch = query.match(/TABLE\s+([\w.]+)/i);
    if (!tableMatch) {
      result.error = 'Invalid CREATE TABLE query';
      return result;
    }
    result.tableName = tableMatch[1].trim();

    // Extract column definitions (before WITH clause)
    let queryWithoutWith = query;
    const withIndex = query.toUpperCase().indexOf(' WITH ');
    if (withIndex > 0) {
      queryWithoutWith = query.substring(0, withIndex);
    }

    const columnsMatch = queryWithoutWith.match(/\(([^)]+)\)/);
    if (!columnsMatch) {
      result.error = 'Invalid CREATE TABLE query: missing column definitions';
      return result;
    }

    const columnsStr = columnsMatch[1];
    const parsed = this.parseTableColumns(columnsStr);
    result.tableColumns = parsed.columns;
    result.primaryKey = parsed.primaryKey;

    return result;
  }

  /**
   * Parse table column definitions
   */
  private parseTableColumns(columnsStr: string): { columns: TableColumnDefinition[]; primaryKey: string[] } {
    const columns: TableColumnDefinition[] = [];
    const primaryKey: string[] = [];
    
    // Split by comma, but handle nested parentheses
    const parts: string[] = [];
    let current = '';
    let depth = 0;
    
    for (let i = 0; i < columnsStr.length; i++) {
      const char = columnsStr[i];
      if (char === '(') depth++;
      else if (char === ')') depth--;
      else if (char === ',' && depth === 0) {
        parts.push(current.trim());
        current = '';
        continue;
      }
      current += char;
    }
    if (current.trim()) {
      parts.push(current.trim());
    }

    for (const part of parts) {
      // Check for PRIMARY KEY
      if (part.toUpperCase().includes('PRIMARY KEY')) {
        const pkMatch = part.match(/PRIMARY\s+KEY\s*\(([^)]+)\)/i);
        if (pkMatch) {
          const pkColumns = pkMatch[1].split(',').map(c => c.trim());
          primaryKey.push(...pkColumns);
        }
        continue;
      }

      // Parse column definition: name type [STATIC]
      const colMatch = part.match(/(\w+)\s+(\w+(?:<[^>]+>)?(?:\s+STATIC)?)/i);
      if (colMatch) {
        const name = colMatch[1].trim();
        const typeDef = colMatch[2].trim();
        const isStatic = /STATIC/i.test(typeDef);
        const type = typeDef.replace(/\s+STATIC/i, '').trim();
        
        columns.push({
          name,
          type,
          static: isStatic,
          primaryKey: primaryKey.includes(name),
        });
      }
    }

    return { columns, primaryKey };
  }

  /**
   * Parse DROP TABLE query
   */
  private parseDropTable(query: string): ParsedCQLQuery {
    const result: ParsedCQLQuery = {
      type: 'DROP_TABLE',
      originalQuery: query,
      normalizedQuery: query,
    };

    const tableMatch = query.match(/TABLE\s+([\w.]+)/i);
    if (!tableMatch) {
      result.error = 'Invalid DROP TABLE query';
      return result;
    }
    result.tableName = tableMatch[1].trim();

    return result;
  }

  /**
   * Parse DROP KEYSPACE query
   */
  private parseDropKeyspace(query: string): ParsedCQLQuery {
    const result: ParsedCQLQuery = {
      type: 'DROP_KEYSPACE',
      originalQuery: query,
      normalizedQuery: query,
    };

    const nameMatch = query.match(/KEYSPACE\s+(\w+)/i);
    if (!nameMatch) {
      result.error = 'Invalid DROP KEYSPACE query';
      return result;
    }
    result.keyspaceName = nameMatch[1].trim();

    return result;
  }

  /**
   * Parse BATCH query
   */
  private parseBatch(query: string): ParsedCQLQuery {
    const result: ParsedCQLQuery = {
      type: 'BATCH',
      originalQuery: query,
      normalizedQuery: query,
    };

    // Parse batch consistency (if specified)
    const consistencyMatch = query.match(/USING\s+CONSISTENCY\s+(\w+)/i);
    if (consistencyMatch) {
      result.batchConsistency = consistencyMatch[1].trim();
    }

    // Extract statements between BEGIN BATCH and APPLY BATCH
    const beginMatch = query.match(/BEGIN\s+BATCH/i);
    const applyMatch = query.match(/APPLY\s+BATCH/i);
    
    if (!beginMatch || !applyMatch) {
      result.error = 'Invalid BATCH query: missing BEGIN BATCH or APPLY BATCH';
      return result;
    }

    const beginIndex = beginMatch.index! + beginMatch[0].length;
    const applyIndex = applyMatch.index!;
    const statementsStr = query.substring(beginIndex, applyIndex).trim();

    // Parse individual statements (separated by semicolons)
    const statements = statementsStr.split(';').map(s => s.trim()).filter(s => s.length > 0);
    result.batchStatements = statements.map(stmt => this.parse(stmt));

    return result;
  }

  /**
   * Parse value list (for VALUES clause or IN operator)
   */
  private parseValueList(valuesStr: string): any[] {
    const values: any[] = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';
    let depth = 0; // For nested parentheses

    for (let i = 0; i < valuesStr.length; i++) {
      const char = valuesStr[i];
      
      if ((char === '"' || char === "'") && !inQuotes) {
        inQuotes = true;
        quoteChar = char;
        continue;
      } else if (char === quoteChar && inQuotes) {
        inQuotes = false;
        quoteChar = '';
        continue;
      }

      if (char === '(' && !inQuotes) depth++;
      else if (char === ')' && !inQuotes) depth--;
      else if (char === ',' && !inQuotes && depth === 0) {
        values.push(this.parseValue(current.trim()));
        current = '';
        continue;
      }

      current += char;
    }

    if (current.trim()) {
      values.push(this.parseValue(current.trim()));
    }

    return values;
  }

  /**
   * Parse a single value (handle strings, numbers, booleans, null, UUID, timestamps)
   */
  private parseValue(value: string): any {
    value = value.trim();
    
    // Remove quotes
    if ((value.startsWith('"') && value.endsWith('"')) || 
        (value.startsWith("'") && value.endsWith("'"))) {
      return value.slice(1, -1);
    }

    // Null
    if (value.toUpperCase() === 'NULL') return null;

    // Boolean
    if (value.toUpperCase() === 'TRUE') return true;
    if (value.toUpperCase() === 'FALSE') return false;

    // UUID format: uuid('...') or just UUID string
    if (value.toUpperCase().startsWith('UUID(')) {
      const uuidMatch = value.match(/UUID\(['"]([^'"]+)['"]\)/i);
      if (uuidMatch) {
        return uuidMatch[1];
      }
    }

    // Timestamp: timestamp('...') or bigint
    if (value.toUpperCase().startsWith('TIMESTAMP(')) {
      const tsMatch = value.match(/TIMESTAMP\(['"]([^'"]+)['"]\)/i);
      if (tsMatch) {
        return new Date(tsMatch[1]).getTime();
      }
    }

    // Try to parse as number
    if (/^-?\d+$/.test(value)) {
      return parseInt(value, 10);
    }
    if (/^-?\d*\.\d+$/.test(value)) {
      return parseFloat(value);
    }

    // Return as string
    return value;
  }

  /**
   * Validate CQL syntax
   */
  public validate(query: string): { valid: boolean; error?: string } {
    const parsed = this.parse(query);
    if (parsed.error) {
      return { valid: false, error: parsed.error };
    }
    if (parsed.type === 'UNKNOWN') {
      return { valid: false, error: 'Unknown CQL statement type' };
    }
    return { valid: true };
  }
}

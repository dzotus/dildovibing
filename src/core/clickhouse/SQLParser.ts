/**
 * ClickHouse SQL Parser
 * 
 * Парсинг SQL запросов ClickHouse с поддержкой специфичных типов данных и фич.
 * Цель: симулятивность без хардкода - все параметры парсятся динамически.
 */

export interface ParsedColumn {
  name: string;
  type: string; // Полный тип (Array(String), Nullable(Int32), etc.)
  nullable?: boolean; // Явно указан Nullable
  default?: string; // DEFAULT значение
}

export interface ParsedEngineParams {
  orderBy?: string[]; // ORDER BY колонки
  partitionBy?: string; // PARTITION BY выражение
  primaryKey?: string[]; // PRIMARY KEY колонки
  sampleBy?: string; // SAMPLE BY колонка
  ttl?: string; // TTL выражение
  settings?: Record<string, string>; // ENGINE SETTINGS
}

export interface ParsedCreateTable {
  database?: string;
  table: string;
  columns: ParsedColumn[];
  engine: string; // MergeTree, ReplacingMergeTree, etc.
  engineParams?: ParsedEngineParams;
  ifNotExists?: boolean;
  onCluster?: string; // ON CLUSTER cluster_name
}

export interface ParsedSelect {
  columns: string[]; // SELECT columns
  from: string; // FROM table
  where?: string; // WHERE clause
  groupBy?: string[]; // GROUP BY columns
  orderBy?: { column: string; direction?: 'ASC' | 'DESC' }[]; // ORDER BY
  limit?: number; // LIMIT n
  offset?: number; // OFFSET n
  sample?: number; // SAMPLE 0.1
  final?: boolean; // FINAL modifier
  prewhere?: string; // PREWHERE clause
}

export interface ParsedInsert {
  into: string; // INTO table
  columns?: string[]; // (col1, col2, ...)
  values?: any[][]; // VALUES (val1, val2), (val3, val4)
  format?: string; // FORMAT JSON, CSV, etc.
}

/**
 * ClickHouse SQL Parser
 * Парсит SQL запросы ClickHouse с поддержкой специфичных типов данных
 */
export class ClickHouseSQLParser {
  /**
   * Parse CREATE TABLE statement
   */
  public parseCreateTable(query: string): { success: boolean; result?: ParsedCreateTable; error?: string } {
    try {
      const normalized = this.normalizeQuery(query);
      
      // Parse IF NOT EXISTS
      const ifNotExists = /\bIF\s+NOT\s+EXISTS\b/i.test(query);
      
      // Parse table name: CREATE TABLE [IF NOT EXISTS] database.table or table
      const tableMatch = normalized.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([\w.]+)/i);
      if (!tableMatch) {
        return { success: false, error: 'Invalid CREATE TABLE: missing table name' };
      }

      const tableFullName = tableMatch[1].trim();
      const tableParts = tableFullName.split('.');
      const database = tableParts.length > 1 ? tableParts[0] : undefined;
      const table = tableParts.length > 1 ? tableParts[1] : tableParts[0];

      // Parse ON CLUSTER
      const onClusterMatch = query.match(/ON\s+CLUSTER\s+([\w.]+)/i);
      const onCluster = onClusterMatch ? onClusterMatch[1] : undefined;

      // Extract column definitions: (col1 type1, col2 type2, ...)
      // Handle nested parentheses for complex types like Array(Tuple(...))
      const columnsMatch = this.extractColumnsDefinition(query);
      if (!columnsMatch) {
        return { success: false, error: 'Invalid CREATE TABLE: missing column definitions' };
      }

      const columns = this.parseColumns(columnsMatch);

      // Parse ENGINE
      const engineMatch = query.match(/ENGINE\s*=\s*(\w+)/i);
      const engine = engineMatch ? engineMatch[1] : 'MergeTree';

      // Parse ENGINE parameters (ORDER BY, PARTITION BY, PRIMARY KEY, etc.)
      const engineParams = this.parseEngineParams(query, engine);

      return {
        success: true,
        result: {
          database,
          table,
          columns,
          engine,
          engineParams,
          ifNotExists,
          onCluster,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown parsing error',
      };
    }
  }

  /**
   * Parse SELECT statement
   */
  public parseSelect(query: string): { success: boolean; result?: ParsedSelect; error?: string } {
    try {
      const normalized = this.normalizeQuery(query);

      // Parse SELECT columns
      const selectMatch = normalized.match(/SELECT\s+(.+?)\s+FROM/i);
      if (!selectMatch) {
        return { success: false, error: 'Invalid SELECT: missing FROM clause' };
      }

      const columnsStr = selectMatch[1].trim();
      const columns = columnsStr === '*' ? ['*'] : columnsStr.split(',').map(c => c.trim());

      // Parse FROM
      const fromMatch = normalized.match(/FROM\s+([\w.]+)/i);
      if (!fromMatch) {
        return { success: false, error: 'Invalid SELECT: missing FROM clause' };
      }
      const from = fromMatch[1].trim();

      // Parse PREWHERE (must come before WHERE)
      const prewhereMatch = normalized.match(/PREWHERE\s+(.+?)(?:\s+WHERE|\s+GROUP\s+BY|\s+ORDER\s+BY|\s+LIMIT|$)/i);
      const prewhere = prewhereMatch ? prewhereMatch[1].trim() : undefined;

      // Parse WHERE
      const whereMatch = normalized.match(/WHERE\s+(.+?)(?:\s+GROUP\s+BY|\s+ORDER\s+BY|\s+LIMIT|$)/i);
      const where = whereMatch ? whereMatch[1].trim() : undefined;

      // Parse GROUP BY
      const groupByMatch = normalized.match(/GROUP\s+BY\s+(.+?)(?:\s+ORDER\s+BY|\s+LIMIT|$)/i);
      const groupBy = groupByMatch ? groupByMatch[1].trim().split(',').map(c => c.trim()) : undefined;

      // Parse ORDER BY
      const orderByMatch = normalized.match(/ORDER\s+BY\s+(.+?)(?:\s+LIMIT|$)/i);
      const orderBy = orderByMatch
        ? orderByMatch[1]
            .trim()
            .split(',')
            .map(col => {
              const parts = col.trim().split(/\s+/);
              return {
                column: parts[0],
                direction: parts[1]?.toUpperCase() === 'DESC' ? ('DESC' as const) : ('ASC' as const),
              };
            })
        : undefined;

      // Parse LIMIT
      const limitMatch = normalized.match(/LIMIT\s+(\d+)/i);
      const limit = limitMatch ? parseInt(limitMatch[1], 10) : undefined;

      // Parse OFFSET
      const offsetMatch = normalized.match(/OFFSET\s+(\d+)/i);
      const offset = offsetMatch ? parseInt(offsetMatch[1], 10) : undefined;

      // Parse SAMPLE
      const sampleMatch = normalized.match(/SAMPLE\s+([\d.]+)/i);
      const sample = sampleMatch ? parseFloat(sampleMatch[1]) : undefined;

      // Parse FINAL
      const final = /\bFINAL\b/i.test(query);

      return {
        success: true,
        result: {
          columns,
          from,
          where,
          prewhere,
          groupBy,
          orderBy,
          limit,
          offset,
          sample,
          final,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown parsing error',
      };
    }
  }

  /**
   * Parse INSERT statement
   */
  public parseInsert(query: string): { success: boolean; result?: ParsedInsert; error?: string } {
    try {
      const normalized = this.normalizeQuery(query);

      // Parse INTO
      const intoMatch = normalized.match(/INTO\s+([\w.]+)/i);
      if (!intoMatch) {
        return { success: false, error: 'Invalid INSERT: missing INTO clause' };
      }
      const into = intoMatch[1].trim();

      // Parse columns: (col1, col2, ...)
      const columnsMatch = normalized.match(/INTO\s+[\w.]+\s*\(([^)]+)\)/i);
      const columns = columnsMatch
        ? columnsMatch[1].trim().split(',').map(c => c.trim())
        : undefined;

      // Parse VALUES
      const valuesMatch = query.match(/VALUES\s+(.+)/i);
      const values = valuesMatch ? this.parseValues(valuesMatch[1]) : undefined;

      // Parse FORMAT
      const formatMatch = query.match(/FORMAT\s+(\w+)/i);
      const format = formatMatch ? formatMatch[1] : undefined;

      return {
        success: true,
        result: {
          into,
          columns,
          values,
          format,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown parsing error',
      };
    }
  }

  /**
   * Validate ClickHouse type
   */
  public validateType(type: string): boolean {
    const upperType = type.toUpperCase().trim();

    // Basic types
    const basicTypes = [
      'UINT8', 'UINT16', 'UINT32', 'UINT64',
      'INT8', 'INT16', 'INT32', 'INT64',
      'FLOAT32', 'FLOAT64',
      'STRING', 'DATE', 'DATETIME', 'UUID',
    ];

    if (basicTypes.some(t => upperType === t)) {
      return true;
    }

    // FixedString(N)
    if (/^FIXEDSTRING\(\d+\)$/.test(upperType)) {
      return true;
    }

    // Decimal(P, S)
    if (/^DECIMAL\(\d+,\d+\)$/.test(upperType)) {
      return true;
    }

    // DateTime64(P)
    if (/^DATETIME64\(\d+\)$/.test(upperType)) {
      return true;
    }

    // Array(T)
    if (/^ARRAY\(.+\)$/.test(upperType)) {
      const innerType = upperType.match(/^ARRAY\((.+)\)$/)?.[1];
      return innerType ? this.validateType(innerType) : false;
    }

    // Tuple(T1, T2, ...)
    if (/^TUPLE\(.+\)$/.test(upperType)) {
      const innerTypes = upperType.match(/^TUPLE\((.+)\)$/)?.[1];
      if (!innerTypes) return false;
      return innerTypes.split(',').every(t => this.validateType(t.trim()));
    }

    // Map(K, V)
    if (/^MAP\(.+\)$/.test(upperType)) {
      const mapMatch = upperType.match(/^MAP\((.+),(.+)\)$/);
      if (!mapMatch) return false;
      return this.validateType(mapMatch[1].trim()) && this.validateType(mapMatch[2].trim());
    }

    // Nullable(T)
    if (/^NULLABLE\(.+\)$/.test(upperType)) {
      const innerType = upperType.match(/^NULLABLE\((.+)\)$/)?.[1];
      return innerType ? this.validateType(innerType) : false;
    }

    // LowCardinality(T)
    if (/^LOWCARDINALITY\(.+\)$/.test(upperType)) {
      const innerType = upperType.match(/^LOWCARDINALITY\((.+)\)$/)?.[1];
      return innerType ? this.validateType(innerType) : false;
    }

    // Nested
    if (/^NESTED\(.+\)$/.test(upperType)) {
      return true; // Simplified validation for Nested
    }

    return false;
  }

  /**
   * Extract column definitions from CREATE TABLE query
   * Handles nested parentheses for complex types
   */
  private extractColumnsDefinition(query: string): string | null {
    // Find the opening parenthesis after CREATE TABLE ... (
    const createTableMatch = query.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[\w.]+\s*\(/i);
    if (!createTableMatch) {
      return null;
    }

    const startIndex = createTableMatch.index! + createTableMatch[0].length - 1;
    let depth = 0;
    let inString = false;
    let stringChar = '';

    for (let i = startIndex; i < query.length; i++) {
      const char = query[i];

      // Handle string literals
      if ((char === '"' || char === "'") && (i === 0 || query[i - 1] !== '\\')) {
        if (!inString) {
          inString = true;
          stringChar = char;
        } else if (char === stringChar) {
          inString = false;
        }
        continue;
      }

      if (inString) continue;

      if (char === '(') {
        depth++;
      } else if (char === ')') {
        depth--;
        if (depth === 0) {
          // Found matching closing parenthesis
          return query.substring(startIndex + 1, i);
        }
      }
    }

    return null;
  }

  /**
   * Parse column definitions
   */
  private parseColumns(columnsStr: string): ParsedColumn[] {
    const columns: ParsedColumn[] = [];
    
    // Split by comma, but handle nested parentheses for complex types
    const parts: string[] = [];
    let current = '';
    let depth = 0;
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < columnsStr.length; i++) {
      const char = columnsStr[i];

      // Handle string literals
      if ((char === '"' || char === "'") && (i === 0 || columnsStr[i - 1] !== '\\')) {
        if (!inString) {
          inString = true;
          stringChar = char;
        } else if (char === stringChar) {
          inString = false;
        }
        current += char;
        continue;
      }

      if (inString) {
        current += char;
        continue;
      }

      if (char === '(') {
        depth++;
        current += char;
      } else if (char === ')') {
        depth--;
        current += char;
      } else if (char === ',' && depth === 0) {
        parts.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    if (current.trim()) {
      parts.push(current.trim());
    }

    // Parse each column definition
    for (const part of parts) {
      const column = this.parseColumnDefinition(part);
      if (column) {
        columns.push(column);
      }
    }

    return columns;
  }

  /**
   * Parse single column definition: name type [DEFAULT value]
   */
  private parseColumnDefinition(columnDef: string): ParsedColumn | null {
    const trimmed = columnDef.trim();
    if (!trimmed) return null;

    // Extract DEFAULT value if present
    const defaultMatch = trimmed.match(/\bDEFAULT\s+(.+)$/i);
    const defaultValue = defaultMatch ? defaultMatch[1].trim() : undefined;
    const withoutDefault = defaultMatch ? trimmed.substring(0, defaultMatch.index).trim() : trimmed;

    // Split name and type (type can be complex like Array(String) or Nullable(Int32))
    // Find the last space that separates name from type
    // Type starts after the column name and can contain parentheses
    const nameTypeMatch = withoutDefault.match(/^(\w+)\s+(.+)$/);
    if (!nameTypeMatch) {
      return null;
    }

    const name = nameTypeMatch[1];
    let type = nameTypeMatch[2].trim();

    // Check if type is Nullable
    const nullableMatch = type.match(/^NULLABLE\((.+)\)$/i);
    const isNullable = nullableMatch !== null;
    if (isNullable) {
      type = nullableMatch![1];
    }

    return {
      name,
      type,
      nullable: isNullable || undefined,
      default: defaultValue,
    };
  }

  /**
   * Parse ENGINE parameters (ORDER BY, PARTITION BY, PRIMARY KEY, etc.)
   */
  private parseEngineParams(query: string, engine: string): ParsedEngineParams | undefined {
    // Extract ENGINE clause and everything after it
    const engineMatch = query.match(/ENGINE\s*=\s*\w+\s*(.+)/i);
    if (!engineMatch) {
      return undefined;
    }

    const engineClause = engineMatch[1];

    const params: ParsedEngineParams = {};

    // Parse ORDER BY
    const orderByMatch = engineClause.match(/ORDER\s+BY\s*\(([^)]+)\)/i);
    if (orderByMatch) {
      params.orderBy = orderByMatch[1].split(',').map(c => c.trim());
    } else {
      // ORDER BY without parentheses (single column)
      const orderBySingleMatch = engineClause.match(/ORDER\s+BY\s+(\w+)/i);
      if (orderBySingleMatch) {
        params.orderBy = [orderBySingleMatch[1].trim()];
      }
    }

    // Parse PARTITION BY
    const partitionByMatch = engineClause.match(/PARTITION\s+BY\s+([^\s(]+(?:\([^)]+\))?)/i);
    if (partitionByMatch) {
      params.partitionBy = partitionByMatch[1].trim();
    }

    // Parse PRIMARY KEY
    const primaryKeyMatch = engineClause.match(/PRIMARY\s+KEY\s*\(([^)]+)\)/i);
    if (primaryKeyMatch) {
      params.primaryKey = primaryKeyMatch[1].split(',').map(c => c.trim());
    } else {
      // PRIMARY KEY without parentheses (single column)
      const primaryKeySingleMatch = engineClause.match(/PRIMARY\s+KEY\s+(\w+)/i);
      if (primaryKeySingleMatch) {
        params.primaryKey = [primaryKeySingleMatch[1].trim()];
      }
    }

    // Parse SAMPLE BY
    const sampleByMatch = engineClause.match(/SAMPLE\s+BY\s+(\w+)/i);
    if (sampleByMatch) {
      params.sampleBy = sampleByMatch[1].trim();
    }

    // Parse TTL
    const ttlMatch = engineClause.match(/TTL\s+(.+?)(?:\s+SETTINGS|\s*$)/i);
    if (ttlMatch) {
      params.ttl = ttlMatch[1].trim();
    }

    // Parse SETTINGS
    const settingsMatch = engineClause.match(/SETTINGS\s+(.+?)(?:\s*$)/i);
    if (settingsMatch) {
      params.settings = this.parseSettings(settingsMatch[1]);
    }

    return Object.keys(params).length > 0 ? params : undefined;
  }

  /**
   * Parse SETTINGS clause: key1=value1, key2=value2
   */
  private parseSettings(settingsStr: string): Record<string, string> {
    const settings: Record<string, string> = {};
    const pairs = settingsStr.split(',').map(p => p.trim());

    for (const pair of pairs) {
      const [key, value] = pair.split('=').map(s => s.trim());
      if (key && value) {
        settings[key] = value;
      }
    }

    return settings;
  }

  /**
   * Parse VALUES clause
   */
  private parseValues(valuesStr: string): any[][] {
    const rows: any[][] = [];
    
    // Simple parsing: (val1, val2), (val3, val4)
    // This is simplified - real parser would handle strings with commas, etc.
    const rowMatches = valuesStr.matchAll(/\(([^)]+)\)/g);
    
    for (const match of rowMatches) {
      const values = match[1].split(',').map(v => {
        const trimmed = v.trim();
        // Try to parse as number
        if (/^-?\d+$/.test(trimmed)) {
          return parseInt(trimmed, 10);
        }
        if (/^-?\d*\.\d+$/.test(trimmed)) {
          return parseFloat(trimmed);
        }
        // Remove quotes from strings
        if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
            (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
          return trimmed.slice(1, -1);
        }
        return trimmed;
      });
      rows.push(values);
    }

    return rows;
  }

  /**
   * Normalize query: remove extra whitespace, handle comments
   */
  private normalizeQuery(query: string): string {
    // Remove single-line comments
    let normalized = query.replace(/--.*$/gm, '');
    
    // Remove multi-line comments
    normalized = normalized.replace(/\/\*[\s\S]*?\*\//g, '');
    
    // Normalize whitespace
    normalized = normalized.replace(/\s+/g, ' ').trim();
    
    return normalized;
  }
}

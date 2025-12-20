import {
  ParsedSQLQuery,
  QueryPlan,
  PostgreSQLTable,
  PostgreSQLIndex,
  IndexUsage,
} from './types';

/**
 * Query Planner for PostgreSQL
 * Analyzes queries and determines optimal execution plan including index usage
 */
export class QueryPlanner {
  /**
   * Plan query execution
   */
  planQuery(
    query: ParsedSQLQuery,
    table: PostgreSQLTable | undefined,
    indexes: PostgreSQLIndex[]
  ): QueryPlan {
    if (!table) {
      return {
        operation: 'ERROR',
        table: query.table || 'unknown',
        estimatedRows: 0,
        estimatedCost: 0,
      };
    }

    // Analyze WHERE clause for index usage
    const indexUsage = this.analyzeIndexUsage(query, table, indexes);

    // Calculate estimated rows
    const estimatedRows = this.estimateRows(query, table, indexUsage);

    // Calculate estimated cost
    const estimatedCost = this.estimateCost(query, table, indexUsage, estimatedRows);

    // Determine operation type
    let operation = 'Seq Scan';
    if (indexUsage.used) {
      operation = `Index Scan using ${indexUsage.indexName}`;
    } else if (query.join && query.join.length > 0) {
      operation = 'Hash Join';
    }

    return {
      operation,
      table: query.table || 'unknown',
      indexUsed: indexUsage.used ? indexUsage.indexName : undefined,
      estimatedRows,
      estimatedCost,
    };
  }

  /**
   * Analyze which index can be used for the query
   */
  analyzeIndexUsage(
    query: ParsedSQLQuery,
    table: PostgreSQLTable,
    indexes: PostgreSQLIndex[]
  ): IndexUsage {
    // Find indexes for this table
    const tableIndexes = indexes.filter(
      (idx) => idx.table === table.name && idx.schema === table.schema
    );

    if (tableIndexes.length === 0 || !query.where) {
      return {
        indexName: '',
        table: table.name,
        columns: [],
        used: false,
        selectivity: 1.0,
      };
    }

    // Extract columns used in WHERE clause
    const whereColumns = this.extractWhereColumns(query.where);

    // Find best matching index
    let bestIndex: PostgreSQLIndex | null = null;
    let bestMatch = 0;

    for (const index of tableIndexes) {
      // Check if index columns match WHERE clause columns
      const match = this.calculateIndexMatch(index, whereColumns);
      if (match > bestMatch) {
        bestMatch = match;
        bestIndex = index;
      }
    }

    if (bestIndex && bestMatch > 0) {
      // Calculate selectivity (how selective the index is)
      // Lower selectivity = better (more selective = fewer rows)
      const selectivity = this.calculateSelectivity(query, bestIndex, table);

      return {
        indexName: bestIndex.name,
        table: table.name,
        columns: bestIndex.columns,
        used: true,
        selectivity,
      };
    }

    return {
      indexName: '',
      table: table.name,
      columns: [],
      used: false,
      selectivity: 1.0,
    };
  }

  /**
   * Extract column names from WHERE clause
   */
  private extractWhereColumns(where: ParsedSQLQuery['where']): string[] {
    if (!where) return [];

    const columns: string[] = [];
    for (const condition of where.conditions) {
      if (condition.column) {
        columns.push(condition.column);
      }
    }
    return [...new Set(columns)]; // Remove duplicates
  }

  /**
   * Calculate how well an index matches WHERE clause columns
   */
  private calculateIndexMatch(index: PostgreSQLIndex, whereColumns: string[]): number {
    if (whereColumns.length === 0) return 0;

    // Check if index columns match WHERE columns
    let matchCount = 0;
    for (let i = 0; i < Math.min(index.columns.length, whereColumns.length); i++) {
      if (index.columns[i] === whereColumns[i]) {
        matchCount++;
      } else {
        break; // Index columns must match in order
      }
    }

    // Return match ratio
    return matchCount / whereColumns.length;
  }

  /**
   * Calculate index selectivity (0-1, lower is better)
   */
  private calculateSelectivity(
    query: ParsedSQLQuery,
    index: PostgreSQLIndex,
    table: PostgreSQLTable
  ): number {
    // Simplified selectivity calculation
    // In real PostgreSQL, this is based on statistics

    const rowCount = table.data?.length || 1000;
    const indexColumns = index.columns.length;

    // More columns in index = more selective (lower selectivity value)
    // But we want higher selectivity = fewer rows = better
    // So we calculate: 1 / (number of index columns + 1)
    const baseSelectivity = 1 / (indexColumns + 1);

    // Adjust based on WHERE conditions
    if (query.where) {
      const conditionCount = query.where.conditions.length;
      // More conditions = more selective
      return baseSelectivity / (1 + conditionCount * 0.1);
    }

    return baseSelectivity;
  }

  /**
   * Estimate number of rows that will be returned
   */
  private estimateRows(
    query: ParsedSQLQuery,
    table: PostgreSQLTable,
    indexUsage: IndexUsage
  ): number {
    const totalRows = table.data?.length || 1000;

    // If using index, estimate based on selectivity
    if (indexUsage.used) {
      // Selectivity of 0.1 means 10% of rows
      const estimatedRows = Math.ceil(totalRows * indexUsage.selectivity);

      // Apply WHERE clause filtering (simplified)
      if (query.where) {
        // Assume each condition filters out 50% of rows
        const conditionCount = query.where.conditions.length;
        return Math.ceil(estimatedRows * Math.pow(0.5, conditionCount));
      }

      return estimatedRows;
    }

    // Sequential scan - all rows initially
    let estimatedRows = totalRows;

    // Apply WHERE clause filtering
    if (query.where) {
      const conditionCount = query.where.conditions.length;
      // Each condition filters out some rows
      estimatedRows = Math.ceil(estimatedRows * Math.pow(0.3, conditionCount));
    }

    // Apply LIMIT
    if (query.limit) {
      estimatedRows = Math.min(estimatedRows, query.limit);
    }

    return estimatedRows;
  }

  /**
   * Estimate query execution cost
   */
  private estimateCost(
    query: ParsedSQLQuery,
    table: PostgreSQLTable,
    indexUsage: IndexUsage,
    estimatedRows: number
  ): number {
    const totalRows = table.data?.length || 1000;
    let cost = 0;

    // Base cost for reading data
    if (indexUsage.used) {
      // Index scan cost: log(n) for index lookup + rows to fetch
      const indexLookupCost = Math.log2(totalRows) * 1.0;
      const rowFetchCost = estimatedRows * 0.01;
      cost = indexLookupCost + rowFetchCost;
    } else {
      // Sequential scan cost: read all rows
      cost = totalRows * 0.01;
    }

    // Add cost for WHERE clause evaluation
    if (query.where) {
      cost += estimatedRows * 0.001 * query.where.conditions.length;
    }

    // Add cost for JOINs
    if (query.join) {
      cost += estimatedRows * query.join.length * 0.1;
    }

    // Add cost for ORDER BY
    if (query.orderBy && query.orderBy.length > 0) {
      cost += estimatedRows * Math.log2(estimatedRows) * 0.01;
    }

    return Math.round(cost * 100) / 100; // Round to 2 decimal places
  }
}


/**
 * Schema Import Utilities
 * Import PostgreSQL schema from SQL (CREATE TABLE, ALTER TABLE)
 * Adapted from drawdb.io
 */

import { Parser } from 'node-sql-parser';
import { PostgreSQLTable, PostgreSQLColumn } from '@/core/postgresql/types';
import { DrawDBRelationship } from './schemaDiagramConverter';

interface ImportResult {
  tables: PostgreSQLTable[];
  relationships: DrawDBRelationship[];
  errors: string[];
}

/**
 * Parse SQL type to normalized type string
 */
function parseSQLType(typeExpr: any): string {
  if (!typeExpr) return 'TEXT';
  
  if (typeof typeExpr === 'string') {
    return typeExpr.toUpperCase();
  }
  
  if (typeExpr.dataType) {
    const dataType = typeExpr.dataType.toUpperCase();
    const length = typeExpr.length?.value?.[0]?.value;
    
    if (length) {
      return `${dataType}(${length})`;
    }
    
    return dataType;
  }
  
  return 'TEXT';
}

/**
 * Parse default value
 */
function parseDefaultValue(defaultExpr: any): string | undefined {
  if (!defaultExpr) return undefined;
  
  if (typeof defaultExpr === 'string') {
    return defaultExpr;
  }
  
  if (defaultExpr.value !== undefined) {
    return String(defaultExpr.value);
  }
  
  if (defaultExpr.keyword) {
    return defaultExpr.keyword;
  }
  
  if (defaultExpr.type === 'function') {
    return defaultExpr.name?.name || defaultExpr.name;
  }
  
  return undefined;
}

/**
 * Parse column definition from CREATE TABLE
 */
function parseColumn(columnDef: any, tableName: string, schema: string): PostgreSQLColumn | null {
  if (!columnDef || !columnDef.column) {
    return null;
  }
  
  const columnName = columnDef.column;
  const type = parseSQLType(columnDef.definition?.dataType || columnDef.dataType);
  
  // Check constraints
  let nullable = true;
  let primaryKey = false;
  let defaultValue: string | undefined = undefined;
  
  // Check for NOT NULL
  if (columnDef.definition?.nullable === false || columnDef.nullable === false) {
    nullable = false;
  }
  
  // Check for PRIMARY KEY
  if (columnDef.definition?.constraint?.some((c: any) => c.type === 'PRIMARY KEY') ||
      columnDef.constraint?.some((c: any) => c.type === 'PRIMARY KEY')) {
    primaryKey = true;
    nullable = false; // Primary keys are always NOT NULL
  }
  
  // Check for DEFAULT
  const defaultExpr = columnDef.definition?.default || columnDef.default;
  if (defaultExpr) {
    defaultValue = parseDefaultValue(defaultExpr);
  }
  
  // Check for AUTO_INCREMENT / SERIAL
  if (type.includes('SERIAL') || type.includes('AUTO_INCREMENT')) {
    if (!defaultValue) {
      defaultValue = 'nextval';
    }
  }
  
  return {
    name: columnName,
    type: type,
    nullable: nullable,
    default: defaultValue,
    primaryKey: primaryKey,
  };
}

/**
 * Parse CREATE TABLE statement
 */
function parseCreateTable(ast: any): PostgreSQLTable | null {
  if (!ast || ast.type !== 'create' || ast.table === null) {
    return null;
  }
  
  // Extract table name and schema
  const tableInfo = ast.table?.[0];
  if (!tableInfo) {
    return null;
  }
  
  const tableName = tableInfo.table || tableInfo.name;
  const schema = tableInfo.db || 'public';
  
  if (!tableName) {
    return null;
  }
  
  // Parse columns
  const columns: PostgreSQLColumn[] = [];
  const createDefinition = ast.create_definitions || ast.definition || [];
  
  // Check for PRIMARY KEY constraint at table level
  const tablePrimaryKeys: string[] = [];
  createDefinition.forEach((def: any) => {
    if (def.type === 'PRIMARY KEY' && def.columns) {
      def.columns.forEach((col: any) => {
        if (col.column) {
          tablePrimaryKeys.push(col.column);
        }
      });
    }
  });
  
  // Parse column definitions
  createDefinition.forEach((def: any) => {
    if (def.column) {
      const column = parseColumn(def, tableName, schema);
      if (column) {
        // Apply table-level PRIMARY KEY if this column is in the list
        if (tablePrimaryKeys.includes(column.name)) {
          column.primaryKey = true;
          column.nullable = false;
        }
        columns.push(column);
      }
    }
  });
  
  // Parse indexes (CREATE INDEX statements are separate, but we can extract from table definition)
  const indexes: string[] = [];
  createDefinition.forEach((def: any) => {
    if (def.type === 'INDEX' || def.type === 'UNIQUE INDEX') {
      if (def.name) {
        indexes.push(def.name);
      }
    }
  });
  
  return {
    name: tableName,
    schema: schema,
    columns: columns,
    indexes: indexes,
    constraints: [],
    data: [],
  };
}

/**
 * Parse ALTER TABLE ADD FOREIGN KEY statement
 */
function parseAlterTableForeignKey(ast: any, allTables: PostgreSQLTable[]): DrawDBRelationship | null {
  if (!ast || ast.type !== 'alter' || !ast.table) {
    return null;
  }
  
  const tableInfo = ast.table[0];
  if (!tableInfo) {
    return null;
  }
  
  const startTableName = tableInfo.table || tableInfo.name;
  const startSchema = tableInfo.db || 'public';
  
  // Find the ADD FOREIGN KEY action
  const actions = ast.action || [];
  const fkAction = actions.find((action: any) => 
    action.resource === 'foreign key' || action.type === 'ADD FOREIGN KEY'
  );
  
  if (!fkAction) {
    return null;
  }
  
  // Extract foreign key column
  const fkColumn = fkAction.column || fkAction.columns?.[0]?.column;
  if (!fkColumn) {
    return null;
  }
  
  // Extract referenced table and column
  const references = fkAction.references;
  if (!references) {
    return null;
  }
  
  const endTableName = references.table?.[0]?.table || references.table;
  const endSchema = references.table?.[0]?.db || references.db || 'public';
  const endColumn = references.column?.[0]?.column || references.column;
  
  if (!endTableName || !endColumn) {
    return null;
  }
  
  // Find tables
  const startTable = allTables.find(t => 
    t.name === startTableName && t.schema === startSchema
  );
  const endTable = allTables.find(t => 
    t.name === endTableName && t.schema === endSchema
  );
  
  if (!startTable || !endTable) {
    return null;
  }
  
  // Find column indices
  const startFieldIndex = startTable.columns.findIndex(c => c.name === fkColumn);
  const endFieldIndex = endTable.columns.findIndex(c => c.name === endColumn);
  
  if (startFieldIndex === -1 || endFieldIndex === -1) {
    return null;
  }
  
  // Parse constraint actions
  let constraint = 'No action';
  if (fkAction.onDelete) {
    const deleteAction = fkAction.onDelete.toUpperCase();
    if (deleteAction === 'CASCADE') {
      constraint = 'Cascade';
    } else if (deleteAction === 'RESTRICT') {
      constraint = 'Restrict';
    } else if (deleteAction === 'SET NULL') {
      constraint = 'Set null';
    } else if (deleteAction === 'SET DEFAULT') {
      constraint = 'Set default';
    }
  }
  
  // Determine cardinality (simplified: assume one-to-many for now)
  // Could be improved by checking if referenced column is unique
  const cardinality = endTable.columns[endFieldIndex]?.primaryKey ? 'many_to_one' : 'one_to_many';
  
  // Generate IDs
  const startTableId = `table_${startSchema}_${startTableName}`;
  const endTableId = `table_${endSchema}_${endTableName}`;
  const startFieldId = `field_${startTableName}_${fkColumn}_${startFieldIndex}`;
  const endFieldId = `field_${endTableName}_${endColumn}_${endFieldIndex}`;
  
  return {
    id: `rel_${startTableId}_${startFieldId}_${endTableId}_${endFieldId}`,
    startTableId: startTableId,
    endTableId: endTableId,
    startFieldId: startFieldId,
    endFieldId: endFieldId,
    cardinality: cardinality,
    constraint: constraint,
  };
}

/**
 * Import PostgreSQL schema from SQL
 */
export function importPostgreSQLSchema(sql: string): ImportResult {
  const result: ImportResult = {
    tables: [],
    relationships: [],
    errors: [],
  };
  
  if (!sql || !sql.trim()) {
    result.errors.push('SQL string is empty');
    return result;
  }
  
  try {
    const parser = new Parser();
    
    // Split SQL into individual statements
    // Simple approach: split by semicolon, but be careful with strings
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    // First pass: parse all CREATE TABLE statements
    for (const statement of statements) {
      try {
        const ast = parser.astify(statement);
        const queries = Array.isArray(ast) ? ast : [ast];
        
        for (const query of queries) {
          if (query.type === 'create' && query.keyword === 'table') {
            const table = parseCreateTable(query);
            if (table) {
              // Check for duplicates
              const exists = result.tables.some(
                t => t.name === table.name && t.schema === table.schema
              );
              if (!exists) {
                result.tables.push(table);
              } else {
                result.errors.push(`Table "${table.schema}.${table.name}" already exists`);
              }
            }
          }
        }
      } catch (error) {
        // Skip statements that can't be parsed (might be comments, etc.)
        if (statement.toUpperCase().trim().startsWith('CREATE TABLE')) {
          result.errors.push(`Failed to parse statement: ${statement.substring(0, 50)}...`);
        }
      }
    }
    
    // Second pass: parse ALTER TABLE FOREIGN KEY statements
    for (const statement of statements) {
      try {
        const ast = parser.astify(statement);
        const queries = Array.isArray(ast) ? ast : [ast];
        
        for (const query of queries) {
          if (query.type === 'alter') {
            const relationship = parseAlterTableForeignKey(query, result.tables);
            if (relationship) {
              // Check for duplicates
              const exists = result.relationships.some(
                r => r.id === relationship.id
              );
              if (!exists) {
                result.relationships.push(relationship);
              }
            }
          }
        }
      } catch (error) {
        // Skip statements that can't be parsed
        if (statement.toUpperCase().trim().startsWith('ALTER TABLE')) {
          result.errors.push(`Failed to parse ALTER TABLE statement: ${statement.substring(0, 50)}...`);
        }
      }
    }
    
    // Also check for inline FOREIGN KEY in CREATE TABLE
    for (const statement of statements) {
      try {
        const ast = parser.astify(statement);
        const queries = Array.isArray(ast) ? ast : [ast];
        
        for (const query of queries) {
          if (query.type === 'create' && query.keyword === 'table') {
            const createDefinition = query.create_definitions || query.definition || [];
            createDefinition.forEach((def: any) => {
              if (def.type === 'FOREIGN KEY' || def.references) {
                // This is an inline foreign key in CREATE TABLE
                // We'll handle it similarly to ALTER TABLE
                const tableInfo = query.table?.[0];
                if (tableInfo) {
                  const startTableName = tableInfo.table || tableInfo.name;
                  const startSchema = tableInfo.db || 'public';
                  
                  const startTable = result.tables.find(t => 
                    t.name === startTableName && t.schema === startSchema
                  );
                  
                  if (startTable && def.column) {
                    const fkColumn = def.column;
                    const references = def.references;
                    
                    if (references && references.table) {
                      const endTableName = references.table[0]?.table || references.table;
                      const endSchema = references.table[0]?.db || references.db || 'public';
                      const endColumn = references.column?.[0]?.column || references.column;
                      
                      if (endTableName && endColumn) {
                        const endTable = result.tables.find(t => 
                          t.name === endTableName && t.schema === endSchema
                        );
                        
                        if (endTable) {
                          const startFieldIndex = startTable.columns.findIndex(c => c.name === fkColumn);
                          const endFieldIndex = endTable.columns.findIndex(c => c.name === endColumn);
                          
                          if (startFieldIndex !== -1 && endFieldIndex !== -1) {
                            const startTableId = `table_${startSchema}_${startTableName}`;
                            const endTableId = `table_${endSchema}_${endTableName}`;
                            const startFieldId = `field_${startTableName}_${fkColumn}_${startFieldIndex}`;
                            const endFieldId = `field_${endTableName}_${endColumn}_${endFieldIndex}`;
                            
                            let constraint = 'No action';
                            if (references.onDelete) {
                              const deleteAction = references.onDelete.toUpperCase();
                              if (deleteAction === 'CASCADE') constraint = 'Cascade';
                              else if (deleteAction === 'RESTRICT') constraint = 'Restrict';
                              else if (deleteAction === 'SET NULL') constraint = 'Set null';
                              else if (deleteAction === 'SET DEFAULT') constraint = 'Set default';
                            }
                            
                            const cardinality = endTable.columns[endFieldIndex]?.primaryKey ? 'many_to_one' : 'one_to_many';
                            
                            const relationship: DrawDBRelationship = {
                              id: `rel_${startTableId}_${startFieldId}_${endTableId}_${endFieldId}`,
                              startTableId: startTableId,
                              endTableId: endTableId,
                              startFieldId: startFieldId,
                              endFieldId: endFieldId,
                              cardinality: cardinality,
                              constraint: constraint,
                            };
                            
                            const exists = result.relationships.some(r => r.id === relationship.id);
                            if (!exists) {
                              result.relationships.push(relationship);
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            });
          }
        }
      } catch (error) {
        // Skip if can't parse
      }
    }
    
  } catch (error) {
    result.errors.push(`Failed to parse SQL: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  return result;
}

/**
 * Schema validation utilities
 * Validates PostgreSQL schema for correctness
 */

import { PostgreSQLTable, PostgreSQLColumn } from '@/core/postgresql/types';
import { DrawDBRelationship } from './schemaDiagramConverter';

export interface ValidationError {
  type: 'error' | 'warning';
  message: string;
  table?: string;
  column?: string;
  relationship?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

/**
 * Validate table name
 */
function validateTableName(name: string): ValidationError[] {
  const errors: ValidationError[] = [];
  
  if (!name || name.trim().length === 0) {
    errors.push({
      type: 'error',
      message: 'Table name cannot be empty',
    });
  }
  
  // PostgreSQL identifier rules
  if (name.length > 63) {
    errors.push({
      type: 'warning',
      message: `Table name "${name}" exceeds 63 characters (PostgreSQL limit)`,
      table: name,
    });
  }
  
  // Check for reserved keywords (basic check)
  const reservedKeywords = [
    'SELECT', 'FROM', 'WHERE', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP',
    'ALTER', 'TABLE', 'INDEX', 'VIEW', 'SCHEMA', 'DATABASE', 'USER', 'ROLE',
  ];
  if (reservedKeywords.includes(name.toUpperCase())) {
    errors.push({
      type: 'warning',
      message: `Table name "${name}" is a reserved keyword`,
      table: name,
    });
  }
  
  return errors;
}

/**
 * Validate column definition
 */
function validateColumn(column: PostgreSQLColumn, tableName: string): ValidationError[] {
  const errors: ValidationError[] = [];
  
  // Column name validation
  if (!column.name || column.name.trim().length === 0) {
    errors.push({
      type: 'error',
      message: 'Column name cannot be empty',
      table: tableName,
    });
  }
  
  if (column.name.length > 63) {
    errors.push({
      type: 'warning',
      message: `Column name "${column.name}" exceeds 63 characters`,
      table: tableName,
      column: column.name,
    });
  }
  
  // Type validation
  if (!column.type || column.type.trim().length === 0) {
    errors.push({
      type: 'error',
      message: `Column "${column.name}" must have a type`,
      table: tableName,
      column: column.name,
    });
  }
  
  // Primary key validation
  if (column.primaryKey && column.nullable) {
    errors.push({
      type: 'error',
      message: `Primary key column "${column.name}" cannot be nullable`,
      table: tableName,
      column: column.name,
    });
  }
  
  // Default value validation
  if (column.default && column.nullable === false && !column.default.trim()) {
    errors.push({
      type: 'warning',
      message: `NOT NULL column "${column.name}" has empty default value`,
      table: tableName,
      column: column.name,
    });
  }
  
  return errors;
}

/**
 * Validate table structure
 */
function validateTable(table: PostgreSQLTable): ValidationError[] {
  const errors: ValidationError[] = [];
  
  // Table name validation
  errors.push(...validateTableName(table.name));
  
  // Schema validation
  if (!table.schema || table.schema.trim().length === 0) {
    errors.push({
      type: 'error',
      message: `Table "${table.name}" must have a schema`,
      table: table.name,
    });
  }
  
  // Column validation
  if (table.columns.length === 0) {
    errors.push({
      type: 'error',
      message: `Table "${table.name}" must have at least one column`,
      table: table.name,
    });
  }
  
  // Check for duplicate column names
  const columnNames = new Set<string>();
  table.columns.forEach((col) => {
    if (columnNames.has(col.name)) {
      errors.push({
        type: 'error',
        message: `Duplicate column name "${col.name}" in table "${table.name}"`,
        table: table.name,
        column: col.name,
      });
    }
    columnNames.add(col.name);
    errors.push(...validateColumn(col, table.name));
  });
  
  // Primary key validation
  const primaryKeys = table.columns.filter((col) => col.primaryKey);
  if (primaryKeys.length === 0) {
    errors.push({
      type: 'warning',
      message: `Table "${table.name}" has no primary key`,
      table: table.name,
    });
  }
  
  // Check for duplicate primary keys (shouldn't happen, but validate)
  if (primaryKeys.length > 1) {
    // This is actually valid in PostgreSQL (composite primary key)
    // But we'll add a note
  }
  
  return errors;
}

/**
 * Validate foreign key relationship
 */
function validateRelationship(
  relationship: DrawDBRelationship,
  tables: PostgreSQLTable[]
): ValidationError[] {
  const errors: ValidationError[] = [];
  
  // Find tables
  const startTable = tables.find((t) => {
    const tableId = `table_${t.schema}_${t.name}`;
    return tableId === relationship.startTableId;
  });
  
  const endTable = tables.find((t) => {
    const tableId = `table_${t.schema}_${t.name}`;
    return tableId === relationship.endTableId;
  });
  
  if (!startTable) {
    errors.push({
      type: 'error',
      message: `Relationship references non-existent table: ${relationship.startTableId}`,
      relationship: relationship.id,
    });
  }
  
  if (!endTable) {
    errors.push({
      type: 'error',
      message: `Relationship references non-existent table: ${relationship.endTableId}`,
      relationship: relationship.id,
    });
  }
  
  if (!startTable || !endTable) {
    return errors; // Can't validate further if tables don't exist
  }
  
  // Find fields
  const startField = startTable.columns.find((col, idx) => {
    const fieldId = `field_${startTable.name}_${col.name}_${idx}`;
    return fieldId === relationship.startFieldId || relationship.startFieldId.includes(col.name);
  });
  
  const endField = endTable.columns.find((col, idx) => {
    const fieldId = `field_${endTable.name}_${col.name}_${idx}`;
    return fieldId === relationship.endFieldId || relationship.endFieldId.includes(col.name);
  });
  
  if (!startField) {
    errors.push({
      type: 'error',
      message: `Relationship references non-existent column in table "${startTable.name}"`,
      relationship: relationship.id,
      table: startTable.name,
    });
  }
  
  if (!endField) {
    errors.push({
      type: 'error',
      message: `Relationship references non-existent column in table "${endTable.name}"`,
      relationship: relationship.id,
      table: endTable.name,
    });
  }
  
  if (!startField || !endField) {
    return errors;
  }
  
  // Validate foreign key: referenced column should be primary key or unique
  if (!endField.primaryKey) {
    errors.push({
      type: 'warning',
      message: `Foreign key references non-primary key column "${endField.name}" in table "${endTable.name}"`,
      relationship: relationship.id,
      table: endTable.name,
      column: endField.name,
    });
  }
  
  // Validate type compatibility (simplified - just check if types match)
  // In real PostgreSQL, types should be compatible, not necessarily identical
  if (startField.type !== endField.type) {
    errors.push({
      type: 'warning',
      message: `Type mismatch: "${startField.name}" (${startField.type}) references "${endField.name}" (${endField.type})`,
      relationship: relationship.id,
      table: startTable.name,
      column: startField.name,
    });
  }
  
  // Self-referencing relationships are valid, but warn
  if (startTable.name === endTable.name && startTable.schema === endTable.schema) {
    // This is valid (self-referencing foreign key)
  }
  
  return errors;
}

/**
 * Validate entire schema
 */
export function validateSchema(
  tables: PostgreSQLTable[],
  relationships: DrawDBRelationship[] = []
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  
  // Check for duplicate table names (within same schema)
  const tableMap = new Map<string, PostgreSQLTable>();
  tables.forEach((table) => {
    const key = `${table.schema}.${table.name}`;
    if (tableMap.has(key)) {
      errors.push({
        type: 'error',
        message: `Duplicate table name: "${table.name}" in schema "${table.schema}"`,
        table: table.name,
      });
    }
    tableMap.set(key, table);
  });
  
  // Validate each table
  tables.forEach((table) => {
    const tableErrors = validateTable(table);
    tableErrors.forEach((err) => {
      if (err.type === 'error') {
        errors.push(err);
      } else {
        warnings.push(err);
      }
    });
  });
  
  // Validate relationships
  relationships.forEach((rel) => {
    const relErrors = validateRelationship(rel, tables);
    relErrors.forEach((err) => {
      if (err.type === 'error') {
        errors.push(err);
      } else {
        warnings.push(err);
      }
    });
  });
  
  // Check for circular dependencies (warn only)
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  
  function hasCycle(tableId: string): boolean {
    if (recursionStack.has(tableId)) {
      return true; // Circular dependency detected
    }
    
    if (visited.has(tableId)) {
      return false;
    }
    
    visited.add(tableId);
    recursionStack.add(tableId);
    
    const outgoingRels = relationships.filter((r) => r.startTableId === tableId);
    for (const rel of outgoingRels) {
      if (hasCycle(rel.endTableId)) {
        return true;
      }
    }
    
    recursionStack.delete(tableId);
    return false;
  }
  
  relationships.forEach((rel) => {
    if (hasCycle(rel.startTableId)) {
      warnings.push({
        type: 'warning',
        message: `Circular dependency detected in relationships involving table ${rel.startTableId}`,
        relationship: rel.id,
      });
    }
  });
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

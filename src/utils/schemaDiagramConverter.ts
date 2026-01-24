/**
 * Utilities for converting PostgreSQL schema data to drawdb format
 */

import { PostgreSQLTable, PostgreSQLColumn } from '@/core/postgresql/types';

export interface DrawDBTable {
  id: string;
  name: string;
  x: number;
  y: number;
  locked: boolean;
  fields: DrawDBField[];
  comment: string;
  indices: any[];
  color: string;
  hidden?: boolean;
}

export interface DrawDBField {
  name: string;
  type: string;
  default: string;
  check: string;
  primary: boolean;
  unique: boolean;
  notNull: boolean;
  increment: boolean;
  comment: string;
  id: string;
}

export interface DrawDBRelationship {
  id: string;
  startTableId: string;
  startFieldId: string;
  endTableId: string;
  endFieldId: string;
  cardinality: 'one_to_one' | 'one_to_many' | 'many_to_one';
  constraint: 'No action' | 'Restrict' | 'Cascade' | 'Set null' | 'Set default';
  manyLabel?: string;
}

export interface ForeignKeyConstraint {
  name?: string;
  table: string;
  columns: string[];
  referencedTable: string;
  referencedColumns: string[];
  onDelete?: string;
  onUpdate?: string;
}

/**
 * Parse foreign key constraint from string
 * Examples:
 * - "FOREIGN KEY (user_id) REFERENCES users(id)"
 * - "CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE"
 * - "FOREIGN KEY (user_id) REFERENCES public.users(id)"
 * - "FOREIGN KEY (order_id, item_id) REFERENCES order_items(id, item_id)"
 */
export function parseForeignKeyConstraint(constraint: string): ForeignKeyConstraint | null {
  if (!constraint) return null;

  // More flexible regex to handle schema-qualified table names and multiple columns
  const fkMatch = constraint.match(/FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+(?:(\w+)\.)?(\w+)\s*\(([^)]+)\)/i);
  if (!fkMatch) return null;

  const columns = fkMatch[1].split(',').map(c => c.trim().replace(/["`]/g, ''));
  const schema = fkMatch[2]?.trim();
  const referencedTable = fkMatch[3].trim();
  const referencedColumns = fkMatch[4].split(',').map(c => c.trim().replace(/["`]/g, ''));

  const onDeleteMatch = constraint.match(/ON\s+DELETE\s+(CASCADE|SET\s+NULL|SET\s+DEFAULT|RESTRICT|NO\s+ACTION)/i);
  const onUpdateMatch = constraint.match(/ON\s+UPDATE\s+(CASCADE|SET\s+NULL|SET\s+DEFAULT|RESTRICT|NO\s+ACTION)/i);

  const nameMatch = constraint.match(/CONSTRAINT\s+(\w+)/i);

  return {
    name: nameMatch ? nameMatch[1] : undefined,
    table: '', // Will be set by caller
    columns,
    referencedTable: schema ? `${schema}.${referencedTable}` : referencedTable,
    referencedColumns,
    onDelete: onDeleteMatch ? onDeleteMatch[1].toUpperCase() : undefined,
    onUpdate: onUpdateMatch ? onUpdateMatch[1].toUpperCase() : undefined,
  };
}

/**
 * Convert PostgreSQL table to drawdb table format
 */
export function convertTableToDrawDB(
  table: PostgreSQLTable,
  index: number,
  tableWidth: number = 220,
  tableHeight: number = 50,
  savedPosition?: { x: number; y: number }
): DrawDBTable {
  // Use saved position if available, otherwise calculate grid layout
  let x: number;
  let y: number;
  
  if (savedPosition) {
    x = savedPosition.x;
    y = savedPosition.y;
  } else {
    const spacing = 300;
    const cols = Math.floor(Math.sqrt(table.name.length) || 1);
    x = (index % cols) * spacing + 100;
    y = Math.floor(index / cols) * spacing + 100;
  }

  const fields: DrawDBField[] = table.columns.map((col, colIndex) => ({
    name: col.name,
    type: col.type,
    default: col.default || '',
    check: '',
    primary: col.primaryKey || false,
    unique: false, // Can be enhanced to parse from constraints
    notNull: !col.nullable,
    increment: col.type.toUpperCase().includes('SERIAL') || col.type.toUpperCase().includes('IDENTITY'),
    comment: '',
    id: `field_${table.name}_${col.name}_${colIndex}`,
  }));

  return {
    id: `table_${table.schema}_${table.name}`,
    name: table.schema !== 'public' ? `${table.schema}.${table.name}` : table.name,
    x,
    y,
    locked: false,
    fields,
    comment: '',
    indices: [],
    color: '#175e7a', // defaultBlue from drawdb
    hidden: false,
  };
}

/**
 * Convert PostgreSQL tables to drawdb format
 */
export function convertTablesToDrawDB(
  tables: PostgreSQLTable[],
  tablePositions?: Record<string, { x: number; y: number }>
): DrawDBTable[] {
  return tables.map((table, index) => {
    const tableKey = `${table.schema}.${table.name}`;
    const savedPosition = tablePositions?.[tableKey];
    return convertTableToDrawDB(table, index, 220, 50, savedPosition);
  });
}

/**
 * Extract relationships from tables based on foreign key constraints
 */
export function extractRelationships(
  tables: PostgreSQLTable[],
  drawDBTables: DrawDBTable[]
): DrawDBRelationship[] {
  const relationships: DrawDBRelationship[] = [];
  const tableMap = new Map<string, { table: PostgreSQLTable; drawDB: DrawDBTable }>();

  // Create map for quick lookup
  tables.forEach((table, index) => {
    tableMap.set(`${table.schema}.${table.name}`, {
      table,
      drawDB: drawDBTables[index],
    });
  });

  tables.forEach((table) => {
    const tableKey = `${table.schema}.${table.name}`;
    const tableData = tableMap.get(tableKey);
    if (!tableData) return;

    // Parse constraints to find foreign keys
    table.constraints.forEach((constraint) => {
      const fk = parseForeignKeyConstraint(constraint);
      if (!fk) return;

      // Find referenced table
      const refTableKey = fk.referencedTable;
      const refTableData = Array.from(tableMap.values()).find(
        (t) => t.table.name === refTableKey || `${t.table.schema}.${t.table.name}` === refTableKey
      );

      if (!refTableData) return;

      // Find matching fields
      const startField = tableData.drawDB.fields.find((f) => fk.columns.includes(f.name));
      const endField = refTableData.drawDB.fields.find((f) => fk.referencedColumns.includes(f.name));

      if (!startField || !endField) return;

      // Determine cardinality (simplified: assume one_to_many)
      const cardinality: 'one_to_one' | 'one_to_many' | 'many_to_one' = 'one_to_many';

      // Map constraint action
      const constraintAction = fk.onDelete || 'No action';
      let constraintValue: 'No action' | 'Restrict' | 'Cascade' | 'Set null' | 'Set default' = 'No action';
      if (constraintAction.includes('CASCADE')) constraintValue = 'Cascade';
      else if (constraintAction.includes('SET NULL')) constraintValue = 'Set null';
      else if (constraintAction.includes('SET DEFAULT')) constraintValue = 'Set default';
      else if (constraintAction.includes('RESTRICT')) constraintValue = 'Restrict';

      relationships.push({
        id: `rel_${tableData.drawDB.id}_${refTableData.drawDB.id}_${startField.id}`,
        startTableId: tableData.drawDB.id,
        startFieldId: startField.id,
        endTableId: refTableData.drawDB.id,
        endFieldId: endField.id,
        cardinality,
        constraint: constraintValue,
      });
    });
  });

  return relationships;
}

/**
 * Convert drawdb table back to PostgreSQL format
 */
export function convertDrawDBToTable(drawDBTable: DrawDBTable, schema: string = 'public'): PostgreSQLTable {
  const tableName = drawDBTable.name.includes('.') 
    ? drawDBTable.name.split('.')[1] 
    : drawDBTable.name;

  const columns: PostgreSQLColumn[] = drawDBTable.fields.map((field) => ({
    name: field.name,
    type: field.type,
    nullable: !field.notNull,
    default: field.default || undefined,
    primaryKey: field.primary,
  }));

  return {
    name: tableName,
    schema,
    columns,
    indexes: [],
    constraints: [],
    data: [],
  };
}

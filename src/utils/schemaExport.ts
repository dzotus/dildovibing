/**
 * Schema Export Utilities
 * Export PostgreSQL schema to various formats (SQL, Mermaid, DBML, Documentation)
 * Adapted from drawdb.io
 */

import { PostgreSQLTable, PostgreSQLColumn } from '@/core/postgresql/types';
import { DrawDBRelationship } from './schemaDiagramConverter';

/**
 * Escape quotes in SQL strings
 */
function escapeQuotes(str: string): string {
  if (!str) return '';
  return str.replace(/'/g, "''");
}

/**
 * Parse default value for SQL
 */
function parseDefault(field: PostgreSQLColumn, defaultValue?: string): string {
  if (!defaultValue) return '';
  
  // Check if it's a function call
  if (defaultValue.includes('(') && defaultValue.includes(')')) {
    return defaultValue;
  }
  
  // Check if it's a keyword
  const upperDefault = defaultValue.toUpperCase();
  if (['NULL', 'CURRENT_TIMESTAMP', 'CURRENT_DATE', 'NOW()'].includes(upperDefault)) {
    return defaultValue;
  }
  
  // String types need quotes
  const stringTypes = ['VARCHAR', 'TEXT', 'CHAR', 'CHARACTER'];
  const isStringType = stringTypes.some(type => field.type.toUpperCase().includes(type));
  
  if (isStringType) {
    return `'${escapeQuotes(defaultValue)}'`;
  }
  
  return defaultValue;
}

/**
 * Export PostgreSQL schema to SQL
 */
export function exportPostgreSQLSchema(
  tables: PostgreSQLTable[],
  relationships: DrawDBRelationship[] = []
): string {
  const statements: string[] = [];

  // Generate CREATE TABLE statements
  tables.forEach((table) => {
    const fieldDefinitions = table.columns
      .map((field) => {
        let definition = `\t"${field.name}" ${field.type}`;
        
        // Add NOT NULL
        if (!field.nullable) {
          definition += ' NOT NULL';
        }
        
        // Add DEFAULT
        if (field.default) {
          definition += ` DEFAULT ${parseDefault(field, field.default)}`;
        }
        
        return definition;
      })
      .join(',\n');

    // Primary key clause
    const primaryKeyFields = table.columns.filter((f) => f.primaryKey);
    const primaryKeyClause =
      primaryKeyFields.length > 0
        ? `,\n\tPRIMARY KEY(${primaryKeyFields.map((f) => `"${f.name}"`).join(', ')})`
        : '';

    // Table comment (if we add comment support later)
    const tableComment = ''; // TODO: Add comment support

    // Index statements
    const indexStatements = table.indexes
      .map((indexName) => {
        // TODO: Parse index details from indexName or add index structure
        return `-- Index: ${indexName}`;
      })
      .join('\n');

    const createTable = `CREATE TABLE IF NOT EXISTS "${table.schema}"."${table.name}" (\n${fieldDefinitions}${primaryKeyClause}\n);`;

    statements.push(createTable);
    
    if (indexStatements) {
      statements.push(indexStatements);
    }
  });

  // Generate ALTER TABLE for foreign keys
  const foreignKeyStatements = relationships.map((rel) => {
    // Extract table key from ID (format: table_schema_name)
    const startTableKey = rel.startTableId.replace(/^table_/, '').replace(/_/g, '.');
    const endTableKey = rel.endTableId.replace(/^table_/, '').replace(/_/g, '.');
    
    const startTable = tables.find((t) => {
      const tableKey = `${t.schema}.${t.name}`;
      return rel.startTableId === `table_${t.schema}_${t.name}` || startTableKey === tableKey;
    });
    const endTable = tables.find((t) => {
      const tableKey = `${t.schema}.${t.name}`;
      return rel.endTableId === `table_${t.schema}_${t.name}` || endTableKey === tableKey;
    });

    if (!startTable || !endTable) return '';

    // Find field names by matching field ID pattern
    const startField = startTable.columns.find((col, idx) => {
      const fieldId = `field_${startTable.name}_${col.name}_${idx}`;
      return rel.startFieldId === fieldId || rel.startFieldId.includes(col.name);
    });
    const endField = endTable.columns.find((col, idx) => {
      const fieldId = `field_${endTable.name}_${col.name}_${idx}`;
      return rel.endFieldId === fieldId || rel.endFieldId.includes(col.name);
    });

    if (!startField || !endField) return '';

    // Map constraint actions
    const deleteAction = rel.constraint === 'Cascade' ? 'CASCADE' :
                         rel.constraint === 'Restrict' ? 'RESTRICT' :
                         rel.constraint === 'Set null' ? 'SET NULL' :
                         rel.constraint === 'Set default' ? 'SET DEFAULT' :
                         'NO ACTION';
    
    const updateAction = deleteAction; // Use same for both for now

    return `ALTER TABLE "${startTable.schema}"."${startTable.name}"\nADD FOREIGN KEY("${startField.name}") REFERENCES "${endTable.schema}"."${endTable.name}"("${endField.name}")\nON UPDATE ${updateAction} ON DELETE ${deleteAction};`;
  }).filter(Boolean);

  statements.push(...foreignKeyStatements);

  return statements.join('\n\n');
}

/**
 * Export schema to Mermaid ER diagram format
 */
export function exportMermaidSchema(
  tables: PostgreSQLTable[],
  relationships: DrawDBRelationship[] = []
): string {
  const entities = tables
    .map((table) => {
      const fields = table.columns
        .map((field) => {
          const fieldType = field.type;
          return `\t\t${fieldType} ${field.name}${field.primaryKey ? ' PK' : ''}${!field.nullable ? ' "not null"' : ''}`;
        })
        .join('\n');
      return `\t${table.schema !== 'public' ? `${table.schema}_` : ''}${table.name} {\n${fields}\n\t}`;
    })
    .join('\n\n');

  const mermaidRelationships = relationships
    .map((rel) => {
      const startTable = tables.find((t) => {
        return rel.startTableId === `table_${t.schema}_${t.name}`;
      });
      const endTable = tables.find((t) => {
        return rel.endTableId === `table_${t.schema}_${t.name}`;
      });

      if (!startTable || !endTable) return '';

      const startTableName = startTable.schema !== 'public' ? `${startTable.schema}_${startTable.name}` : startTable.name;
      const endTableName = endTable.schema !== 'public' ? `${endTable.schema}_${endTable.name}` : endTable.name;

      // Map cardinality to Mermaid notation
      let relationshipSymbol = '||--o{'; // Default one-to-many
      if (rel.cardinality === 'one_to_one') {
        relationshipSymbol = '||--||';
      } else if (rel.cardinality === 'many_to_one') {
        relationshipSymbol = '}o--||';
      }

      return `\t${startTableName} ${relationshipSymbol} ${endTableName} : references`;
    })
    .filter(Boolean)
    .join('\n');

  return `erDiagram\n${mermaidRelationships ? `${mermaidRelationships}\n\n` : ''}${entities}`;
}

/**
 * Export schema to DBML format (for dbdiagram.io)
 */
export function exportDBMLSchema(
  tables: PostgreSQLTable[],
  relationships: DrawDBRelationship[] = []
): string {
  const tableDefinitions = tables
    .map((table) => {
      const fields = table.columns
        .map((field) => {
          let definition = `\t${field.name} ${field.type.toLowerCase()}`;
          
          const constraints: string[] = [];
          if (field.primaryKey) constraints.push('pk');
          if (!field.nullable) constraints.push('not null');
          if (field.default) constraints.push(`default: ${field.default}`);
          
          if (constraints.length > 0) {
            definition += ` [${constraints.join(', ')}]`;
          }
          
          return definition;
        })
        .join('\n');

      return `Table "${table.schema}"."${table.name}" {\n${fields}\n}`;
    })
    .join('\n\n');

  const relationshipDefinitions = relationships
    .map((rel) => {
      const startTable = tables.find((t) => {
        return rel.startTableId === `table_${t.schema}_${t.name}`;
      });
      const endTable = tables.find((t) => {
        return rel.endTableId === `table_${t.schema}_${t.name}`;
      });

      if (!startTable || !endTable) return '';

      const startField = startTable.columns.find((col, idx) => {
        const fieldId = `field_${startTable.name}_${col.name}_${idx}`;
        return rel.startFieldId === fieldId || rel.startFieldId.includes(col.name);
      });
      const endField = endTable.columns.find((col, idx) => {
        const fieldId = `field_${endTable.name}_${col.name}_${idx}`;
        return rel.endFieldId === fieldId || rel.endFieldId.includes(col.name);
      });

      if (!startField || !endField) return '';

      // Map cardinality
      let cardinalitySymbol = '<';
      if (rel.cardinality === 'one_to_one') {
        cardinalitySymbol = '-';
      } else if (rel.cardinality === 'many_to_one') {
        cardinalitySymbol = '>';
      }

      const deleteAction = rel.constraint.toLowerCase();
      const updateAction = deleteAction;

      return `Ref "${rel.id}" {\n\t"${startTable.schema}"."${startTable.name}".${startField.name} ${cardinalitySymbol} "${endTable.schema}"."${endTable.name}".${endField.name} [delete: ${deleteAction}, update: ${updateAction}]\n}`;
    })
    .filter(Boolean)
    .join('\n\n');

  return `${tableDefinitions}${relationshipDefinitions ? `\n\n${relationshipDefinitions}` : ''}`;
}

/**
 * Export schema to Markdown documentation
 */
export function exportDocumentationSchema(
  tables: PostgreSQLTable[],
  relationships: DrawDBRelationship[] = [],
  title: string = 'Database Schema'
): string {
  const summary = tables
    .map((table) => `\t- [${table.name}](#${table.name.toLowerCase().replace(/\s+/g, '-')})`)
    .join('\n');

  const tableDocs = tables
    .map((table) => {
      const fields = table.columns
        .map((field) => {
          const settings = [
            field.primaryKey ? '🔑 PK' : '',
            !field.nullable ? 'not null' : 'null',
            field.default ? `default: ${field.default}` : '',
          ]
            .filter(Boolean)
            .join(', ');

          return `| **${field.name}** | ${field.type} | ${settings} |`;
        })
        .join('\n');

      return `### ${table.name}\n\n| Name | Type | Settings |\n|------|------|----------|\n${fields}`;
    })
    .join('\n\n');

  const relationshipDocs = relationships
    .map((rel) => {
      const startTable = tables.find((t) => {
        return rel.startTableId === `table_${t.schema}_${t.name}`;
      });
      const endTable = tables.find((t) => {
        return rel.endTableId === `table_${t.schema}_${t.name}`;
      });

      if (!startTable || !endTable) return '';

      return `- **${startTable.name}** to **${endTable.name}**: ${rel.cardinality} (${rel.constraint})`;
    })
    .filter(Boolean)
    .join('\n');

  const mermaidDiagram = exportMermaidSchema(tables, relationships);

  return `# ${title} Documentation

## Summary

${summary}

## Table Structure

${tableDocs}

## Relationships

${relationshipDocs}

## Database Diagram

\`\`\`mermaid
${mermaidDiagram}
\`\`\`
`;
}

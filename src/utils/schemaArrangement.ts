/**
 * Automatic table arrangement utilities for schema diagram
 * Adapted from drawdb.io
 */

import { DrawDBTable, DrawDBRelationship } from './schemaDiagramConverter';

const TABLE_WIDTH = 220;
const TABLE_SPACING = 300;
const MIN_DISTANCE = 250;

/**
 * Calculate table height based on number of fields
 */
function getTableHeight(table: DrawDBTable): number {
  const TABLE_HEADER_HEIGHT = 50;
  const FIELD_HEIGHT = 36;
  const COLOR_STRIP_HEIGHT = 7;
  return TABLE_HEADER_HEIGHT + COLOR_STRIP_HEIGHT + table.fields.length * FIELD_HEIGHT;
}

/**
 * Check if two tables overlap
 */
function tablesOverlap(table1: DrawDBTable, table2: DrawDBTable): boolean {
  const height1 = getTableHeight(table1);
  const height2 = getTableHeight(table2);
  
  const horizontalOverlap = 
    (table1.x < table2.x + TABLE_WIDTH && table1.x + TABLE_WIDTH > table2.x);
  const verticalOverlap = 
    (table1.y < table2.y + height2 && table1.y + height1 > table2.y);
  
  return horizontalOverlap && verticalOverlap;
}

/**
 * Calculate distance between two tables
 */
function tableDistance(table1: DrawDBTable, table2: DrawDBTable): number {
  const centerX1 = table1.x + TABLE_WIDTH / 2;
  const centerY1 = table1.y + getTableHeight(table1) / 2;
  const centerX2 = table2.x + TABLE_WIDTH / 2;
  const centerY2 = table2.y + getTableHeight(table2) / 2;
  
  return Math.sqrt(Math.pow(centerX2 - centerX1, 2) + Math.pow(centerY2 - centerY1, 2));
}

/**
 * Grid-based arrangement: arrange tables in a grid layout
 */
export function arrangeTablesGrid(
  tables: DrawDBTable[],
  startX: number = 100,
  startY: number = 100
): DrawDBTable[] {
  if (tables.length === 0) return tables;
  
  const cols = Math.ceil(Math.sqrt(tables.length));
  const spacing = TABLE_SPACING;
  
  return tables.map((table, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    
    return {
      ...table,
      x: startX + col * spacing,
      y: startY + row * spacing,
    };
  });
}

/**
 * Force-directed arrangement: arrange tables using force-directed algorithm
 * This creates a more natural layout based on relationships
 */
export function arrangeTablesForceDirected(
  tables: DrawDBTable[],
  relationships: DrawDBRelationship[],
  iterations: number = 50
): DrawDBTable[] {
  if (tables.length === 0) return tables;
  
  // Initialize positions randomly or in a circle
  const centerX = 500;
  const centerY = 400;
  const radius = Math.max(200, tables.length * 30);
  
  let arrangedTables = tables.map((table, index) => {
    if (table.x === 0 && table.y === 0) {
      // Only reposition if table hasn't been positioned yet
      const angle = (2 * Math.PI * index) / tables.length;
      return {
        ...table,
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      };
    }
    return table;
  });
  
  // Create relationship map
  const relationshipMap = new Map<string, string[]>();
  relationships.forEach((rel) => {
    if (!relationshipMap.has(rel.startTableId)) {
      relationshipMap.set(rel.startTableId, []);
    }
    if (!relationshipMap.has(rel.endTableId)) {
      relationshipMap.set(rel.endTableId, []);
    }
    relationshipMap.get(rel.startTableId)!.push(rel.endTableId);
    relationshipMap.get(rel.endTableId)!.push(rel.startTableId);
  });
  
  // Force-directed algorithm
  for (let iter = 0; iter < iterations; iter++) {
    const forces = arrangedTables.map(() => ({ x: 0, y: 0 }));
    
    // Repulsion: push all tables apart
    for (let i = 0; i < arrangedTables.length; i++) {
      for (let j = i + 1; j < arrangedTables.length; j++) {
        const table1 = arrangedTables[i];
        const table2 = arrangedTables[j];
        const dist = tableDistance(table1, table2);
        
        if (dist < MIN_DISTANCE) {
          const angle = Math.atan2(
            table2.y - table1.y,
            table2.x - table1.x
          );
          const force = (MIN_DISTANCE - dist) * 0.1;
          
          forces[i].x -= Math.cos(angle) * force;
          forces[i].y -= Math.sin(angle) * force;
          forces[j].x += Math.cos(angle) * force;
          forces[j].y += Math.sin(angle) * force;
        }
      }
    }
    
    // Attraction: pull related tables together
    relationships.forEach((rel) => {
      const startIdx = arrangedTables.findIndex((t) => t.id === rel.startTableId);
      const endIdx = arrangedTables.findIndex((t) => t.id === rel.endTableId);
      
      if (startIdx === -1 || endIdx === -1) return;
      
      const table1 = arrangedTables[startIdx];
      const table2 = arrangedTables[endIdx];
      const dist = tableDistance(table1, table2);
      const idealDist = TABLE_SPACING;
      
      if (dist > idealDist) {
        const angle = Math.atan2(
          table2.y - table1.y,
          table2.x - table1.x
        );
        const force = (dist - idealDist) * 0.05;
        
        forces[startIdx].x += Math.cos(angle) * force;
        forces[startIdx].y += Math.sin(angle) * force;
        forces[endIdx].x -= Math.cos(angle) * force;
        forces[endIdx].y -= Math.sin(angle) * force;
      }
    });
    
    // Apply forces with damping
    const damping = 0.8;
    arrangedTables = arrangedTables.map((table, idx) => {
      const newX = table.x + forces[idx].x * damping;
      const newY = table.y + forces[idx].y * damping;
      
      // Keep tables within reasonable bounds
      return {
        ...table,
        x: Math.max(50, Math.min(newX, 2000)),
        y: Math.max(50, Math.min(newY, 2000)),
      };
    });
  }
  
  return arrangedTables;
}

/**
 * Hierarchical arrangement: arrange tables in layers based on relationships
 */
export function arrangeTablesHierarchical(
  tables: DrawDBTable[],
  relationships: DrawDBRelationship[]
): DrawDBTable[] {
  if (tables.length === 0) return tables;
  
  // Build dependency graph
  const dependencies = new Map<string, Set<string>>();
  tables.forEach((table) => {
    dependencies.set(table.id, new Set());
  });
  
  relationships.forEach((rel) => {
    // endTable depends on startTable (foreign key relationship)
    dependencies.get(rel.endTableId)?.add(rel.startTableId);
  });
  
  // Topological sort to determine layers
  const layers: string[][] = [];
  const visited = new Set<string>();
  const inProgress = new Set<string>();
  
  function visit(tableId: string, currentLayer: number) {
    if (inProgress.has(tableId)) {
      // Circular dependency, place in current layer
      return currentLayer;
    }
    
    if (visited.has(tableId)) {
      return currentLayer;
    }
    
    inProgress.add(tableId);
    
    let maxDepLayer = currentLayer;
    dependencies.get(tableId)?.forEach((depId) => {
      const depLayer = visit(depId, currentLayer);
      maxDepLayer = Math.max(maxDepLayer, depLayer + 1);
    });
    
    inProgress.delete(tableId);
    visited.add(tableId);
    
    while (layers.length <= maxDepLayer) {
      layers.push([]);
    }
    layers[maxDepLayer].push(tableId);
    
    return maxDepLayer;
  }
  
  tables.forEach((table) => {
    if (!visited.has(table.id)) {
      visit(table.id, 0);
    }
  });
  
  // Arrange tables in layers
  const tableMap = new Map(tables.map((t) => [t.id, t]));
  const arranged: DrawDBTable[] = [];
  const layerSpacing = 400;
  const tableSpacing = 300;
  
  layers.forEach((layer, layerIdx) => {
    layer.forEach((tableId, tableIdx) => {
      const table = tableMap.get(tableId);
      if (!table) return;
      
      arranged.push({
        ...table,
        x: 100 + tableIdx * tableSpacing,
        y: 100 + layerIdx * layerSpacing,
      });
    });
  });
  
  // Add tables that weren't in any layer (no relationships)
  tables.forEach((table) => {
    if (!arranged.find((t) => t.id === table.id)) {
      arranged.push({
        ...table,
        x: 100 + arranged.length * tableSpacing,
        y: 100,
      });
    }
  });
  
  return arranged;
}

/**
 * Main arrangement function - uses hierarchical layout by default
 */
export function arrangeTables(
  tables: DrawDBTable[],
  relationships: DrawDBRelationship[],
  method: 'grid' | 'force' | 'hierarchical' = 'hierarchical'
): DrawDBTable[] {
  if (tables.length === 0) return tables;
  
  switch (method) {
    case 'grid':
      return arrangeTablesGrid(tables);
    case 'force':
      return arrangeTablesForceDirected(tables, relationships);
    case 'hierarchical':
    default:
      return arrangeTablesHierarchical(tables, relationships);
  }
}

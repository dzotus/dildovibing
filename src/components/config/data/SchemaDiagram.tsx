/**
 * Schema Diagram Component - Visual representation of PostgreSQL database schema
 * Adapted from drawdb.io
 */

import { useRef, useState, useEffect, useMemo } from 'react';
import { PostgreSQLTable } from '@/core/postgresql/types';
import {
  convertTableToDrawDB,
  extractRelationships,
  DrawDBTable,
  DrawDBRelationship,
} from '@/utils/schemaDiagramConverter';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, RotateCcw, Maximize2, Upload, LayoutGrid } from 'lucide-react';
import { arrangeTables } from '@/utils/schemaArrangement';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface SchemaDiagramProps {
  tables: PostgreSQLTable[];
  tablePositions?: Record<string, { x: number; y: number }>;
  onTableUpdate?: (tableId: string, updates: Partial<DrawDBTable>) => void;
  onRelationshipAdd?: (relationship: DrawDBRelationship) => void;
  onRelationshipDelete?: (relationshipId: string) => void;
  onRelationshipsChange?: (relationships: DrawDBRelationship[]) => void;
  onAutoArrange?: (positions: Record<string, { x: number; y: number }>) => void;
}

const TABLE_WIDTH = 220;
const TABLE_HEADER_HEIGHT = 50;
const FIELD_HEIGHT = 36;
const COLOR_STRIP_HEIGHT = 7;

function getTableHeight(table: DrawDBTable): number {
  return TABLE_HEADER_HEIGHT + COLOR_STRIP_HEIGHT + table.fields.length * FIELD_HEIGHT;
}

/**
 * Calculate relationship path between two tables
 * Adapted from drawdb calcPath utility
 */
function calculateRelationshipPath(
  startTable: DrawDBTable,
  endTable: DrawDBTable,
  startFieldIndex: number,
  endFieldIndex: number
): string {
  const tableWidth = TABLE_WIDTH;
  const zoom = 1;

  let x1 = startTable.x;
  let y1 =
    startTable.y +
    startFieldIndex * FIELD_HEIGHT +
    TABLE_HEADER_HEIGHT +
    COLOR_STRIP_HEIGHT +
    FIELD_HEIGHT / 2;
  let x2 = endTable.x;
  let y2 =
    endTable.y +
    endFieldIndex * FIELD_HEIGHT +
    TABLE_HEADER_HEIGHT +
    COLOR_STRIP_HEIGHT +
    FIELD_HEIGHT / 2;

  let radius = 10 * zoom;
  const midX = (x2 + x1 + tableWidth) / 2;
  const endX = x2 + tableWidth < x1 ? x2 + tableWidth : x2;

  // Handle very close fields
  if (Math.abs(y1 - y2) <= 36 * zoom) {
    radius = Math.abs(y2 - y1) / 3;
    if (radius <= 2) {
      if (x1 + tableWidth <= x2) return `M ${x1 + tableWidth} ${y1} L ${x2} ${y2 + 0.1}`;
      else if (x2 + tableWidth < x1)
        return `M ${x1} ${y1} L ${x2 + tableWidth} ${y2 + 0.1}`;
    }
  }

  // Calculate path based on relative positions
  if (y1 <= y2) {
    if (x1 + tableWidth <= x2) {
      // Start table is to the left of end table
      return `M ${x1 + tableWidth} ${y1} L ${
        midX - radius
      } ${y1} A ${radius} ${radius} 0 0 1 ${midX} ${y1 + radius} L ${midX} ${
        y2 - radius
      } A ${radius} ${radius} 0 0 0 ${midX + radius} ${y2} L ${endX} ${y2}`;
    } else if (x2 <= x1 + tableWidth && x1 <= x2) {
      // Tables overlap horizontally
      return `M ${x1 + tableWidth} ${y1} L ${
        x2 + tableWidth
      } ${y1} A ${radius} ${radius} 0 0 1 ${x2 + tableWidth + radius} ${
        y1 + radius
      } L ${x2 + tableWidth + radius} ${y2 - radius} A ${radius} ${radius} 0 0 1 ${
        x2 + tableWidth
      } ${y2} L ${x2 + tableWidth} ${y2}`;
    } else if (x2 + tableWidth >= x1 && x2 + tableWidth <= x1 + tableWidth) {
      // End table overlaps start table
      return `M ${x1} ${y1} L ${
        x2 - radius
      } ${y1} A ${radius} ${radius} 0 0 0 ${x2 - radius - radius} ${
        y1 + radius
      } L ${x2 - radius - radius} ${y2 - radius} A ${radius} ${radius} 0 0 0 ${
        x2 - radius
      } ${y2} L ${x2} ${y2}`;
    } else {
      // Start table is to the right of end table
      return `M ${x1} ${y1} L ${
        midX + radius
      } ${y1} A ${radius} ${radius} 0 0 0 ${midX} ${y1 + radius} L ${midX} ${
        y2 - radius
      } A ${radius} ${radius} 0 0 1 ${midX - radius} ${y2} L ${endX} ${y2}`;
    }
  } else {
    // y1 > y2 (start table is below end table)
    if (x1 + tableWidth <= x2) {
      return `M ${x1 + tableWidth} ${y1} L ${
        midX - radius
      } ${y1} A ${radius} ${radius} 0 0 0 ${midX} ${y1 - radius} L ${midX} ${
        y2 + radius
      } A ${radius} ${radius} 0 0 1 ${midX + radius} ${y2} L ${endX} ${y2}`;
    } else if (x1 + tableWidth >= x2 && x1 + tableWidth <= x2 + tableWidth) {
      return `M ${x1} ${y1} L ${
        x1 - radius - radius
      } ${y1} A ${radius} ${radius} 0 0 1 ${x1 - radius - radius - radius} ${
        y1 - radius
      } L ${x1 - radius - radius - radius} ${
        y2 + radius
      } A ${radius} ${radius} 0 0 1 ${
        x1 - radius - radius
      } ${y2} L ${endX} ${y2}`;
    } else if (x1 >= x2 && x1 <= x2 + tableWidth) {
      return `M ${x1 + tableWidth} ${y1} L ${
        x1 + tableWidth + radius
      } ${y1} A ${radius} ${radius} 0 0 0 ${x1 + tableWidth + radius + radius} ${
        y1 - radius
      } L ${x1 + tableWidth + radius + radius} ${
        y2 + radius
      } A ${radius} ${radius} 0 0 0 ${x1 + tableWidth + radius} ${y2} L ${endX} ${y2}`;
    } else {
      return `M ${x1} ${y1} L ${
        midX + radius
      } ${y1} A ${radius} ${radius} 0 0 1 ${midX} ${y1 - radius} L ${midX} ${
        y2 + radius
      } A ${radius} ${radius} 0 0 0 ${midX - radius} ${y2} L ${endX} ${y2}`;
    }
  }
}

export function SchemaDiagram({
  tables,
  tablePositions = {},
  onTableUpdate,
  onRelationshipAdd,
  onRelationshipDelete,
  onRelationshipsChange,
  onAutoArrange,
}: SchemaDiagramProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [dragging, setDragging] = useState<{ id: string; offset: { x: number; y: number } } | null>(null);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<{ tableId: string; fieldId: string; x: number; y: number } | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [deleteRelationshipId, setDeleteRelationshipId] = useState<string | null>(null);

  // Convert tables to drawdb format with saved positions
  const drawDBTables = useMemo(() => {
    return tables.map((table, index) => {
      const tableKey = `${table.schema}.${table.name}`;
      const savedPosition = tablePositions[tableKey];
      return convertTableToDrawDB(table, index, 220, 50, savedPosition);
    });
  }, [tables, tablePositions]);
  const relationships = useMemo(
    () => extractRelationships(tables, drawDBTables),
    [tables, drawDBTables]
  );

  // Notify parent about relationships changes
  useEffect(() => {
    onRelationshipsChange?.(relationships);
  }, [relationships, onRelationshipsChange]);

  // Calculate viewBox based on table positions
  const viewBox = useMemo(() => {
    if (drawDBTables.length === 0) {
      return { x: 0, y: 0, width: 1000, height: 1000 };
    }

    const minX = Math.min(...drawDBTables.map((t) => t.x)) - 200;
    const minY = Math.min(...drawDBTables.map((t) => t.y)) - 200;
    const maxX = Math.max(...drawDBTables.map((t) => t.x + TABLE_WIDTH)) + 200;
    const maxY = Math.max(...drawDBTables.map((t) => t.y + getTableHeight(t))) + 200;

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }, [drawDBTables]);

  // Handle panning
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left mouse button
    if ((e.target as HTMLElement).closest('.table-box')) return; // Don't pan when clicking on tables
    if (connecting) return; // Don't pan when connecting

    const startX = e.clientX;
    const startY = e.clientY;
    const startTransformX = transform.x;
    const startTransformY = transform.y;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = (e.clientX - startX) / transform.scale;
      const deltaY = (e.clientY - startY) / transform.scale;
      setTransform({
        ...transform,
        x: startTransformX + deltaX,
        y: startTransformY + deltaY,
      });
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Handle table dragging
  const handleTableMouseDown = (e: React.MouseEvent, tableId: string, isHeader: boolean = false) => {
    // Only allow dragging from header or if not connecting
    if (!isHeader && connecting) {
      return; // Don't start dragging if we're in connection mode
    }
    
    e.stopPropagation();
    const table = drawDBTables.find((t) => t.id === tableId);
    if (!table) return;

    const svg = svgRef.current;
    if (!svg) return;

    const svgRect = svg.getBoundingClientRect();
    const viewBox = svg.viewBox.baseVal;
    
    // Convert mouse position to SVG coordinates (in viewBox space)
    const mouseX = ((e.clientX - svgRect.left) / svgRect.width) * viewBox.width + viewBox.x;
    const mouseY = ((e.clientY - svgRect.top) / svgRect.height) * viewBox.height + viewBox.y;
    
    // Convert from viewBox space to transformed space (accounting for transform group)
    // Transform group applies: translate(x/scale, y/scale) scale(scale)
    // So to get coordinates in table space, we need to reverse this
    const transformedMouseX = (mouseX - transform.x / transform.scale) / transform.scale;
    const transformedMouseY = (mouseY - transform.y / transform.scale) / transform.scale;
    
    // Calculate offset from mouse to table top-left corner
    const offsetX = transformedMouseX - table.x;
    const offsetY = transformedMouseY - table.y;

    setDragging({ id: tableId, offset: { x: offsetX, y: offsetY } });
    setSelectedTable(tableId);

    const handleMouseMove = (e: MouseEvent) => {
      const svg = svgRef.current;
      if (!svg) return;

      const svgRect = svg.getBoundingClientRect();
      const viewBox = svg.viewBox.baseVal;
      
      // Convert mouse position to SVG coordinates (in viewBox space)
      const newMouseX = ((e.clientX - svgRect.left) / svgRect.width) * viewBox.width + viewBox.x;
      const newMouseY = ((e.clientY - svgRect.top) / svgRect.height) * viewBox.height + viewBox.y;
      
      // Convert from viewBox space to transformed space
      const transformedNewMouseX = (newMouseX - transform.x / transform.scale) / transform.scale;
      const transformedNewMouseY = (newMouseY - transform.y / transform.scale) / transform.scale;
      
      // Calculate new table position
      const newX = transformedNewMouseX - offsetX;
      const newY = transformedNewMouseY - offsetY;

      onTableUpdate?.(tableId, { x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setDragging(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Handle field click for creating relationships
  const handleFieldClick = (e: React.MouseEvent, tableId: string, fieldId: string, fieldIndex: number) => {
    e.stopPropagation();
    
    if (connecting) {
      // Complete the connection
      if (connecting.tableId !== tableId && connecting.fieldId !== fieldId) {
        const startTable = drawDBTables.find((t) => t.id === connecting.tableId);
        const endTable = drawDBTables.find((t) => t.id === tableId);
        
        if (startTable && endTable) {
          const relationship: DrawDBRelationship = {
            id: `rel_${connecting.tableId}_${tableId}_${connecting.fieldId}`,
            startTableId: connecting.tableId,
            startFieldId: connecting.fieldId,
            endTableId: tableId,
            endFieldId: fieldId,
            cardinality: 'one_to_many',
            constraint: 'No action',
          };
          
          onRelationshipAdd?.(relationship);
        }
      }
      setConnecting(null);
      setMousePos(null);
    } else {
      // Start connection
      const table = drawDBTables.find((t) => t.id === tableId);
      if (!table) return;
      
      const fieldY = table.y + TABLE_HEADER_HEIGHT + COLOR_STRIP_HEIGHT + (fieldIndex + 0.5) * FIELD_HEIGHT;
      const fieldX = table.x + TABLE_WIDTH / 2;
      
      setConnecting({ tableId, fieldId, x: fieldX, y: fieldY });
    }
  };

  // Track mouse position for connection line
  const handleMouseMove = (e: React.MouseEvent) => {
    if (connecting && svgRef.current) {
      const svg = svgRef.current;
      const svgRect = svg.getBoundingClientRect();
      const viewBox = svg.viewBox.baseVal;
      
      const x = ((e.clientX - svgRect.left) / svgRect.width) * viewBox.width + viewBox.x;
      const y = ((e.clientY - svgRect.top) / svgRect.height) * viewBox.height + viewBox.y;
      
      setMousePos({ x, y });
    }
  };

  // Zoom controls
  const handleZoomIn = () => {
    setTransform({ ...transform, scale: Math.min(transform.scale * 1.2, 3) });
  };

  const handleZoomOut = () => {
    setTransform({ ...transform, scale: Math.max(transform.scale / 1.2, 0.3) });
  };

  const handleReset = () => {
    setTransform({ x: 0, y: 0, scale: 1 });
  };

  const handleFitToScreen = () => {
    // Reset transform - viewBox already handles fitting to screen
    setTransform({ x: 0, y: 0, scale: 1 });
  };

  const handleExport = () => {
    if (!svgRef.current) return;

    const svg = svgRef.current.cloneNode(true) as SVGSVGElement;
    svg.setAttribute('width', viewBox.width.toString());
    svg.setAttribute('height', viewBox.height.toString());
    svg.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`);

    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);

    const downloadLink = document.createElement('a');
    downloadLink.href = svgUrl;
    downloadLink.download = 'schema-diagram.svg';
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(svgUrl);
  };

  const handleAutoArrange = () => {
    if (drawDBTables.length === 0) return;

    const arranged = arrangeTables(drawDBTables, relationships, 'hierarchical');
    const newPositions: Record<string, { x: number; y: number }> = {};
    
    arranged.forEach((table) => {
      // Extract table key from table.id (format: table_schema_name)
      const tableKey = table.id.replace(/^table_/, '').replace(/_/g, '.');
      newPositions[tableKey] = { x: table.x, y: table.y };
    });

    onAutoArrange?.(newPositions);
  };

  if (tables.length === 0) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px] border rounded-lg bg-muted/50">
        <div className="text-center text-muted-foreground">
          <p className="text-lg font-medium mb-2">No tables to display</p>
          <p className="text-sm">Add tables in the Tables tab to see the schema diagram</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full h-full border rounded-lg bg-background overflow-hidden">
      {/* Controls */}
      <div className="absolute top-2 right-2 z-10 flex gap-2 bg-background/80 backdrop-blur-sm border rounded-lg p-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleZoomIn}
          title="Zoom In"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleZoomOut}
          title="Zoom Out"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
          title="Reset View"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleFitToScreen}
          title="Fit to Screen"
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleExport}
          title="Export SVG"
        >
          <Upload className="h-4 w-4" />
        </Button>
        {onAutoArrange && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleAutoArrange}
            title="Auto Arrange Tables"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* SVG Canvas */}
      <svg
        ref={svgRef}
        className={`w-full h-full ${dragging ? 'cursor-grabbing' : connecting ? 'cursor-crosshair' : 'cursor-grab'}`}
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
        preserveAspectRatio="xMidYMid meet"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => {
          if (connecting) {
            setConnecting(null);
            setMousePos(null);
          }
        }}
      >
        {/* Transform group for zoom and pan */}
        <g
          transform={`translate(${transform.x / transform.scale}, ${transform.y / transform.scale}) scale(${transform.scale})`}
        >
        {/* Grid background */}
        <defs>
          <pattern
            id="grid"
            width="24"
            height="24"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="12" cy="12" r="0.85" fill="currentColor" className="text-muted-foreground/20" />
          </pattern>
        </defs>
        <rect
          x={viewBox.x}
          y={viewBox.y}
          width={viewBox.width}
          height={viewBox.height}
          fill="url(#grid)"
        />

        {/* Temporary connection line while creating relationship */}
        {connecting && mousePos && (
          <path
            d={`M ${connecting.x} ${connecting.y} L ${mousePos.x} ${mousePos.y}`}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="2"
            strokeDasharray="5,5"
            opacity="0.7"
            pointerEvents="none"
          />
        )}

        {/* Relationships */}
        {relationships.map((rel) => {
          const startTable = drawDBTables.find((t) => t.id === rel.startTableId);
          const endTable = drawDBTables.find((t) => t.id === rel.endTableId);
          if (!startTable || !endTable) return null;

          const startFieldIndex = startTable.fields.findIndex((f) => f.id === rel.startFieldId);
          const endFieldIndex = endTable.fields.findIndex((f) => f.id === rel.endFieldId);
          if (startFieldIndex === -1 || endFieldIndex === -1) return null;

          const path = calculateRelationshipPath(startTable, endTable, startFieldIndex, endFieldIndex);
          
          // Get field names for labels
          const startField = startTable.fields[startFieldIndex];
          const endField = endTable.fields[endFieldIndex];
          
          // Calculate approximate positions based on table positions
          const startX = startTable.x + TABLE_WIDTH / 2;
          const startY = startTable.y + TABLE_HEADER_HEIGHT + COLOR_STRIP_HEIGHT + (startFieldIndex + 0.5) * FIELD_HEIGHT;
          const endX = endTable.x + TABLE_WIDTH / 2;
          const endY = endTable.y + TABLE_HEADER_HEIGHT + COLOR_STRIP_HEIGHT + (endFieldIndex + 0.5) * FIELD_HEIGHT;
          
          // Midpoint for label
          const midX = (startX + endX) / 2;
          const midY = (startY + endY) / 2;
          
          // Determine cardinality labels
          let cardinalityStart = '1';
          let cardinalityEnd = '1';
          switch (rel.cardinality) {
            case 'one_to_many':
              cardinalityStart = '1';
              cardinalityEnd = 'n';
              break;
            case 'many_to_one':
              cardinalityStart = 'n';
              cardinalityEnd = '1';
              break;
            case 'one_to_one':
              cardinalityStart = '1';
              cardinalityEnd = '1';
              break;
          }
          
          // Approximate cardinality positions (near table edges)
          const offset = 20;
          const startCardX = startX < endX ? startX + offset : startX - offset;
          const startCardY = startY;
          const endCardX = endX > startX ? endX - offset : endX + offset;
          const endCardY = endY;

          return (
            <g key={rel.id} className="relationship-group">
              {/* Relationship path */}
              <path
                d={path}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-muted-foreground/60 hover:text-primary/60 transition-colors cursor-pointer"
                markerEnd="url(#arrowhead)"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteRelationshipId(rel.id);
                }}
              />
              
              {/* Cardinality labels */}
              <text
                x={startCardX}
                y={startCardY}
                fill="currentColor"
                fontSize="14"
                fontWeight="bold"
                textAnchor="middle"
                className="text-foreground pointer-events-none"
                style={{ userSelect: 'none' }}
              >
                {cardinalityStart}
              </text>
              <text
                x={endCardX}
                y={endCardY}
                fill="currentColor"
                fontSize="14"
                fontWeight="bold"
                textAnchor="middle"
                className="text-foreground pointer-events-none"
                style={{ userSelect: 'none' }}
              >
                {cardinalityEnd}
              </text>
              
              {/* Constraint action indicator (small badge) */}
              {rel.constraint !== 'No action' && (
                <g>
                  <circle
                    cx={midX + 45}
                    cy={midY - 10}
                    r="8"
                    fill="hsl(var(--primary))"
                    style={{ pointerEvents: 'none' }}
                  />
                  <text
                    x={midX + 45}
                    y={midY - 6}
                    fill="white"
                    fontSize="8"
                    fontWeight="bold"
                    textAnchor="middle"
                    style={{ userSelect: 'none', pointerEvents: 'none' }}
                  >
                    {rel.constraint === 'Cascade' ? 'C' : rel.constraint === 'Restrict' ? 'R' : rel.constraint === 'Set null' ? 'N' : 'D'}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* Arrow marker */}
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
          >
            <polygon
              points="0 0, 10 3, 0 6"
              fill="currentColor"
              className="text-muted-foreground/60"
            />
          </marker>
        </defs>

        {/* Tables */}
        {drawDBTables.map((table) => {
          const height = getTableHeight(table);
          const isSelected = selectedTable === table.id;

          return (
            <g key={table.id} className="table-box">
              <foreignObject
                x={table.x}
                y={table.y}
                width={TABLE_WIDTH}
                height={height}
              >
                <div
                  className={`border-2 rounded-lg transition-all ${
                    isSelected
                      ? 'border-primary shadow-lg'
                      : 'border-border hover:border-primary/50'
                  } bg-card text-card-foreground`}
                >
                  {/* Color strip */}
                  <div
                    className="h-[7px] rounded-t-lg"
                    style={{ backgroundColor: table.color }}
                  />

                  {/* Header - draggable area */}
                  <div 
                    className="px-3 py-2 font-semibold text-sm border-b bg-muted/50 cursor-move select-none"
                    onMouseDown={(e) => handleTableMouseDown(e, table.id, true)}
                    title="Перетащите для перемещения таблицы"
                  >
                    {table.name}
                  </div>

                  {/* Fields */}
                  <div className="divide-y">
                    {table.fields.map((field, index) => (
                      <div
                        key={field.id}
                        className={`px-3 py-1.5 text-xs flex items-center gap-2 min-h-[36px] cursor-pointer transition-colors ${
                          connecting?.fieldId === field.id
                            ? 'bg-primary/20 border-l-2 border-primary'
                            : 'hover:bg-muted/50'
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFieldClick(e, table.id, field.id, index);
                        }}
                        onMouseDown={(e) => {
                          // Prevent dragging when clicking on fields
                          e.stopPropagation();
                        }}
                        title={connecting ? 'Кликните на поле в другой таблице для создания связи' : 'Кликните для создания связи'}
                      >
                        <div className="flex-1">
                          <span className="font-medium">{field.name}</span>
                          <span className="text-muted-foreground ml-2">{field.type}</span>
                        </div>
                        <div className="flex gap-1">
                          {field.primary && (
                            <span className="text-primary" title="Primary Key">🔑</span>
                          )}
                          {field.notNull && (
                            <span className="text-muted-foreground" title="NOT NULL">*</span>
                          )}
                          {field.unique && (
                            <span className="text-muted-foreground" title="UNIQUE">U</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </foreignObject>
            </g>
          );
        })}
        </g>
      </svg>

      {/* Delete Relationship Confirmation Dialog */}
      <AlertDialog open={!!deleteRelationshipId} onOpenChange={(open) => !open && setDeleteRelationshipId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить связь?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить эту связь? Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteRelationshipId) {
                  onRelationshipDelete?.(deleteRelationshipId);
                  setDeleteRelationshipId(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

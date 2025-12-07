import { useMemo } from 'react';
import { CanvasNode, ComponentGroup } from '@/types';

const GRID_SQUARE_SIZE = 20;
const DEFAULT_NODE_WIDTH = 140;
const DEFAULT_NODE_HEIGHT = 100;
const LABEL_HEIGHT = 18;
const LABEL_PADDING = 6;
const TOP_PADDING = LABEL_HEIGHT + LABEL_PADDING * 2;

export interface GroupBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Хук для расчета границ группы на основе узлов и их размеров
 */
export function useGroupBounds(
  group: ComponentGroup,
  nodes: CanvasNode[],
  nodeDimensions: Record<string, { width: number; height: number }>,
  zoom: number
): GroupBounds | null {
  return useMemo(() => {
    const groupNodes = nodes.filter((node) => group.nodeIds.includes(node.id));
    if (groupNodes.length === 0) {
      return null;
    }
    
    const sidePadding = GRID_SQUARE_SIZE;
    const bottomPadding = GRID_SQUARE_SIZE;
    const topPadding = (group.showName !== false) ? TOP_PADDING : GRID_SQUARE_SIZE;
    
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    
    groupNodes.forEach((node) => {
      const dims = nodeDimensions[node.id] || {
        width: DEFAULT_NODE_WIDTH,
        height: DEFAULT_NODE_HEIGHT,
      };
      
      const nodeLeft = node.position.x;
      const nodeTop = node.position.y;
      const nodeRight = nodeLeft + dims.width;
      const nodeBottom = nodeTop + dims.height;
      
      minX = Math.min(minX, nodeLeft);
      minY = Math.min(minY, nodeTop);
      maxX = Math.max(maxX, nodeRight);
      maxY = Math.max(maxY, nodeBottom);
    });
    
    return {
      x: minX - sidePadding,
      y: minY - topPadding,
      width: maxX - minX + sidePadding * 2,
      height: maxY - minY + topPadding + bottomPadding,
    };
  }, [nodes, group.nodeIds, nodeDimensions, zoom, group.showName]);
}

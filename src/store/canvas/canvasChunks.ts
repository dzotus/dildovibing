import { CanvasNode, CanvasConnection } from '@/types';

export interface CanvasBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface CanvasChunk {
  x: number; // Grid X coordinate
  y: number; // Grid Y coordinate
}

const CHUNK_SIZE = 2000; // Fixed size of each canvas chunk
const NODE_SIZE = 140;
const CANVAS_PADDING = 200;

// Helper to get chunk coordinates from world coordinates
const getChunkCoords = (worldX: number, worldY: number): CanvasChunk => {
  return {
    x: Math.floor(worldX / CHUNK_SIZE),
    y: Math.floor(worldY / CHUNK_SIZE),
  };
};

// Helper to check if a rectangle intersects with a chunk
const doesNodeIntersectChunk = (
  nodeX: number,
  nodeY: number,
  nodeWidth: number,
  nodeHeight: number,
  chunkX: number,
  chunkY: number
): boolean => {
  const chunkLeft = chunkX * CHUNK_SIZE;
  const chunkRight = (chunkX + 1) * CHUNK_SIZE;
  const chunkTop = chunkY * CHUNK_SIZE;
  const chunkBottom = (chunkY + 1) * CHUNK_SIZE;
  
  const nodeLeft = nodeX;
  const nodeRight = nodeX + nodeWidth;
  const nodeTop = nodeY;
  const nodeBottom = nodeY + nodeHeight;
  
  // Check if rectangle intersects chunk (including boundaries)
  return !(nodeRight < chunkLeft || nodeLeft > chunkRight || nodeBottom < chunkTop || nodeTop > chunkBottom);
};

// Helper to get all chunks that a node intersects with
const getNodeChunks = (node: CanvasNode): Set<string> => {
  const chunks = new Set<string>();
  
  // Use actual node dimensions with padding to ensure node has canvas under it
  const nodeWidth = NODE_SIZE + CANVAS_PADDING;
  const nodeHeight = NODE_SIZE + CANVAS_PADDING;
  
  // Calculate node boundaries
  const nodeLeft = node.position.x;
  const nodeRight = nodeLeft + nodeWidth;
  const nodeTop = node.position.y;
  const nodeBottom = nodeTop + nodeHeight;
  
  // Find the bounding box of chunks that could intersect this node
  const minChunkX = getChunkCoords(nodeLeft, nodeTop).x;
  const maxChunkX = getChunkCoords(nodeRight, nodeBottom).x;
  const minChunkY = getChunkCoords(nodeLeft, nodeTop).y;
  const maxChunkY = getChunkCoords(nodeRight, nodeBottom).y;
  
  // Check all chunks in the bounding box for intersection
  for (let x = minChunkX; x <= maxChunkX; x++) {
    for (let y = minChunkY; y <= maxChunkY; y++) {
      if (doesNodeIntersectChunk(nodeLeft, nodeTop, nodeWidth, nodeHeight, x, y)) {
        chunks.add(`${x},${y}`);
      }
    }
  }
  
  return chunks;
};

/**
 * Calculate required canvas chunks from nodes and connections
 * Rules:
 * 1. Every node must have canvas chunks under it
 * 2. If no nodes intersect a chunk, that chunk should be removed (unattached)
 * 3. If a node intersects any chunk boundary, that chunk should be attached
 * 4. Connected nodes ensure both nodes' chunks are included
 */
export const calculateCanvasChunks = (
  nodes: CanvasNode[],
  connections: CanvasConnection[] = []
): CanvasChunk[] => {
  // If no nodes, return empty array (no canvas chunks)
  if (nodes.length === 0) {
    return [];
  }

  const chunks = new Set<string>();
  const nodeMap = new Map(nodes.map(node => [node.id, node]));
  
  // Rule 1 & 3: Add chunks for all nodes that intersect them (by any boundary)
  nodes.forEach(node => {
    const nodeChunks = getNodeChunks(node);
    nodeChunks.forEach(chunkKey => chunks.add(chunkKey));
  });

  // Rule 4: Add chunks for connected nodes to ensure connections are visible
  connections.forEach(connection => {
    const sourceNode = nodeMap.get(connection.source);
    const targetNode = nodeMap.get(connection.target);
    
    if (sourceNode) {
      const nodeChunks = getNodeChunks(sourceNode);
      nodeChunks.forEach(chunkKey => chunks.add(chunkKey));
    }
    
    if (targetNode) {
      const nodeChunks = getNodeChunks(targetNode);
      nodeChunks.forEach(chunkKey => chunks.add(chunkKey));
    }
  });

  // Rule 2: Only return chunks that are actually intersected by nodes
  return Array.from(chunks).map(key => {
    const [x, y] = key.split(',').map(Number);
    return { x, y };
  });
};

/**
 * Calculate canvas bounds from chunks
 */
export const calculateCanvasBounds = (chunks: CanvasChunk[]): CanvasBounds => {
  if (chunks.length === 0) {
    return {
      minX: 0,
      minY: 0,
      maxX: CHUNK_SIZE,
      maxY: CHUNK_SIZE,
    };
  }

  const xs = chunks.map(c => c.x);
  const ys = chunks.map(c => c.y);
  const minChunkX = Math.min(...xs);
  const minChunkY = Math.min(...ys);
  const maxChunkX = Math.max(...xs);
  const maxChunkY = Math.max(...ys);

  return {
    minX: minChunkX * CHUNK_SIZE,
    minY: minChunkY * CHUNK_SIZE,
    maxX: (maxChunkX + 1) * CHUNK_SIZE,
    maxY: (maxChunkY + 1) * CHUNK_SIZE,
  };
};

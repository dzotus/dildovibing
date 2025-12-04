// Calculate connection points around node perimeter (like draw.io)
// Returns array of {x, y} positions for connection points

export interface ConnectionPoint {
  x: number;
  y: number;
  index: number;
}

export function getConnectionPoints(
  nodeX: number,
  nodeY: number,
  nodeWidth: number = 140,
  nodeHeight: number = 100,
  count: number = 16
): ConnectionPoint[] {
  const points: ConnectionPoint[] = [];
  const halfWidth = nodeWidth / 2;
  const halfHeight = nodeHeight / 2;
  const centerX = nodeX + halfWidth;
  const centerY = nodeY + halfHeight;

  // Distribute points evenly around perimeter
  // Start from top-center, go clockwise
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * 2 * Math.PI - Math.PI / 2; // Start from top
    let x: number, y: number;

    // Determine which edge the point is on
    const normalizedAngle = ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    
    if (normalizedAngle >= 0 && normalizedAngle < Math.PI / 2) {
      // Right edge
      const t = normalizedAngle / (Math.PI / 2);
      x = centerX + halfWidth;
      y = centerY - halfHeight + (t * nodeHeight);
    } else if (normalizedAngle >= Math.PI / 2 && normalizedAngle < Math.PI) {
      // Bottom edge
      const t = (normalizedAngle - Math.PI / 2) / (Math.PI / 2);
      x = centerX + halfWidth - (t * nodeWidth);
      y = centerY + halfHeight;
    } else if (normalizedAngle >= Math.PI && normalizedAngle < 3 * Math.PI / 2) {
      // Left edge
      const t = (normalizedAngle - Math.PI) / (Math.PI / 2);
      x = centerX - halfWidth;
      y = centerY + halfHeight - (t * nodeHeight);
    } else {
      // Top edge
      const t = (normalizedAngle - 3 * Math.PI / 2) / (Math.PI / 2);
      x = centerX - halfWidth + (t * nodeWidth);
      y = centerY - halfHeight;
    }

    points.push({ x, y, index: i });
  }

  return points;
}

// Find nearest connection point to a given position
export function findNearestConnectionPoint(
  points: ConnectionPoint[],
  targetX: number,
  targetY: number
): number {
  let minDistance = Infinity;
  let nearestIndex = 0;

  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    const distance = Math.sqrt(
      Math.pow(targetX - point.x, 2) + Math.pow(targetY - point.y, 2)
    );
    if (distance < minDistance) {
      minDistance = distance;
      nearestIndex = i;
    }
  }

  return nearestIndex;
}

// Find best connection point for a connection, avoiding conflicts with existing connections
export function findBestConnectionPoint(
  nodeId: string,
  targetNodeId: string,
  targetX: number,
  targetY: number,
  existingConnections: Array<{ source: string; target: string; sourcePort?: number; targetPort?: number }>,
  nodeX: number,
  nodeY: number,
  nodeWidth: number = 140,
  nodeHeight: number = 100
): number {
  const points = getConnectionPoints(nodeX, nodeY, nodeWidth, nodeHeight);
  
  // Find nearest point
  const nearestIndex = findNearestConnectionPoint(points, targetX, targetY);
  
  // Check if this point is already used by a connection to the same target
  const conflictingConnections = existingConnections.filter(
    conn => (conn.source === nodeId && conn.target === targetNodeId && conn.sourcePort === nearestIndex) ||
            (conn.target === nodeId && conn.source === targetNodeId && conn.targetPort === nearestIndex)
  );
  
  if (conflictingConnections.length === 0) {
    return nearestIndex;
  }
  
  // Find next available point
  for (let offset = 1; offset < points.length; offset++) {
    const nextIndex = (nearestIndex + offset) % points.length;
    const prevIndex = (nearestIndex - offset + points.length) % points.length;
    
    // Try next point
    const nextConflicts = existingConnections.filter(
      conn => (conn.source === nodeId && conn.target === targetNodeId && conn.sourcePort === nextIndex) ||
              (conn.target === nodeId && conn.source === targetNodeId && conn.targetPort === nextIndex)
    );
    if (nextConflicts.length === 0) {
      return nextIndex;
    }
    
    // Try previous point
    const prevConflicts = existingConnections.filter(
      conn => (conn.source === nodeId && conn.target === targetNodeId && conn.sourcePort === prevIndex) ||
              (conn.target === nodeId && conn.source === targetNodeId && conn.targetPort === prevIndex)
    );
    if (prevConflicts.length === 0) {
      return prevIndex;
    }
  }
  
  // If all points are taken, return nearest anyway
  return nearestIndex;
}


import { useEffect, useState } from 'react';
import { useCanvasStore } from '@/store/useCanvasStore';
import { useEmulationStore } from '@/store/useEmulationStore';
import { useDataFlowStore } from '@/store/useDataFlowStore';
import { CanvasNode, CanvasConnection } from '@/types';

interface DataPathVisualizationProps {
  selectedNodeId?: string | null;
  highlightPath?: boolean;
}

export function DataPathVisualization({ 
  selectedNodeId, 
  highlightPath = true 
}: DataPathVisualizationProps) {
  const { nodes, connections } = useCanvasStore();
  const { isRunning } = useEmulationStore();
  const { getConnectionMessages } = useDataFlowStore();
  const [highlightedPaths, setHighlightedPaths] = useState<Set<string>>(new Set());
  const [pathTraces, setPathTraces] = useState<Map<string, string[]>>(new Map());

  // Calculate paths from selected node
  useEffect(() => {
    if (!selectedNodeId || !highlightPath || !isRunning) {
      setHighlightedPaths(new Set());
      setPathTraces(new Map());
      return;
    }

    // Find all paths from selected node (BFS)
    const visited = new Set<string>();
    const paths = new Map<string, string[]>(); // connectionId -> path of nodeIds
    const queue: Array<{ nodeId: string; path: string[] }> = [{ nodeId: selectedNodeId, path: [selectedNodeId] }];

    while (queue.length > 0) {
      const { nodeId, path } = queue.shift()!;
      
      if (visited.has(nodeId)) continue;
      visited.add(nodeId);

      // Find outgoing connections
      const outgoing = connections.filter(conn => conn.source === nodeId);
      
      for (const conn of outgoing) {
        const targetId = conn.target;
        const newPath = [...path, targetId];
        
        // Store path for this connection
        paths.set(conn.id, newPath);
        
        // Continue BFS
        if (!visited.has(targetId)) {
          queue.push({ nodeId: targetId, path: newPath });
        }
      }
    }

    setPathTraces(paths);
    setHighlightedPaths(new Set(paths.keys()));
  }, [selectedNodeId, connections, highlightPath, isRunning]);

  // Find all paths to selected node (reverse BFS)
  useEffect(() => {
    if (!selectedNodeId || !highlightPath || !isRunning) {
      return;
    }

    const visited = new Set<string>();
    const queue: Array<{ nodeId: string; path: string[] }> = [{ nodeId: selectedNodeId, path: [selectedNodeId] }];

    while (queue.length > 0) {
      const { nodeId, path } = queue.shift()!;
      
      if (visited.has(nodeId)) continue;
      visited.add(nodeId);

      // Find incoming connections
      const incoming = connections.filter(conn => conn.target === nodeId);
      
      for (const conn of incoming) {
        const sourceId = conn.source;
        const newPath = [sourceId, ...path];
        
        // Store path for this connection
        const existingPath = pathTraces.get(conn.id) || [];
        if (existingPath.length === 0 || newPath.length < existingPath.length) {
          pathTraces.set(conn.id, newPath);
          setPathTraces(new Map(pathTraces));
        }
        
        // Continue reverse BFS
        if (!visited.has(sourceId)) {
          queue.push({ nodeId: sourceId, path: newPath });
        }
      }
    }

    setHighlightedPaths(new Set(pathTraces.keys()));
  }, [selectedNodeId, connections, highlightPath, isRunning]);

  // This component doesn't render anything directly
  // It provides data to ConnectionLine and CanvasNode via context or store
  return null;
}

// Hook to check if a connection is part of a highlighted path
export function useIsPathHighlighted(connectionId: string): boolean {
  const { selectedNodeId } = useCanvasStore();
  const { isRunning } = useEmulationStore();
  const [isHighlighted, setIsHighlighted] = useState(false);

  useEffect(() => {
    if (!selectedNodeId || !isRunning) {
      setIsHighlighted(false);
      return;
    }

    // Check if this connection is part of a path from/to selected node
    const { nodes, connections } = useCanvasStore.getState();
    const selectedNode = nodes.find(n => n.id === selectedNodeId);
    if (!selectedNode) {
      setIsHighlighted(false);
      return;
    }

    // Simple check: is this connection connected to selected node?
    const conn = connections.find(c => c.id === connectionId);
    if (conn && (conn.source === selectedNodeId || conn.target === selectedNodeId)) {
      setIsHighlighted(true);
    } else {
      setIsHighlighted(false);
    }
  }, [selectedNodeId, connectionId, isRunning]);

  return isHighlighted;
}

// Hook to get path depth for a connection
export function usePathDepth(connectionId: string): number {
  const { selectedNodeId } = useCanvasStore();
  const { isRunning } = useEmulationStore();
  const [depth, setDepth] = useState(0);

  useEffect(() => {
    if (!selectedNodeId || !isRunning) {
      setDepth(0);
      return;
    }

    const { connections } = useCanvasStore.getState();
    const conn = connections.find(c => c.id === connectionId);
    if (!conn) {
      setDepth(0);
      return;
    }

    // Calculate depth using BFS
    const visited = new Set<string>();
    const queue: Array<{ nodeId: string; depth: number }> = [{ nodeId: selectedNodeId, depth: 0 }];

    while (queue.length > 0) {
      const { nodeId, depth: currentDepth } = queue.shift()!;
      
      if (visited.has(nodeId)) continue;
      visited.add(nodeId);

      if (nodeId === conn.source || nodeId === conn.target) {
        setDepth(currentDepth);
        return;
      }

      const outgoing = connections.filter(c => c.source === nodeId);
      for (const c of outgoing) {
        if (!visited.has(c.target)) {
          queue.push({ nodeId: c.target, depth: currentDepth + 1 });
        }
      }
    }

    setDepth(0);
  }, [selectedNodeId, connectionId, isRunning]);

  return depth;
}


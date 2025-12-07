import { create } from 'zustand';
import { CanvasNode, CanvasConnection, DiagramState, ComponentGroup } from '@/types';
import { saveDiagramToStorage, loadDiagramFromStorage } from '@/utils/persistence';
import { useHistoryStore } from './useHistoryStore';
import { getConnectionHandler } from '@/services/connection/connectionHandlerInstance';
import { calculateCanvasChunks, calculateCanvasBounds, CanvasBounds, CanvasChunk } from './canvas/canvasChunks';

interface CanvasStore extends DiagramState {
  selectedNodeId: string | null;
  selectedConnectionId: string | null;
  selectedGroupId: string | null;
  diagramName: string;
  viewportWidth: number;
  viewportHeight: number;
  canvasBounds: CanvasBounds;
  canvasChunks: CanvasChunk[];
  updateCanvasBounds: () => void;
  addNode: (node: CanvasNode) => void;
  updateNode: (id: string, updates: Partial<CanvasNode>, skipHistory?: boolean) => void;
  updateNodes: (updates: Array<{ id: string; updates: Partial<CanvasNode> }>, skipHistory?: boolean) => void;
  deleteNode: (id: string) => void;
  selectNode: (id: string | null, multiSelect?: boolean) => void;
  selectNodesByIds: (ids: string[]) => void;
  addConnection: (connection: CanvasConnection) => void;
  updateConnection: (id: string, updates: Partial<CanvasConnection>) => void;
  deleteConnection: (id: string) => void;
  selectConnection: (id: string | null) => void;
  // Groups
  addGroup: (group: ComponentGroup) => void;
  updateGroup: (id: string, updates: Partial<ComponentGroup>) => void;
  deleteGroup: (id: string) => void;
  addNodeToGroup: (groupId: string, nodeId: string) => void;
  removeNodeFromGroup: (groupId: string, nodeId: string) => void;
  selectGroup: (id: string | null) => void;
  createGroupFromSelection: (name: string) => void;
  autoGroupByConnections: () => void;
  setZoom: (zoom: number) => void;
  setPan: (pan: { x: number; y: number }) => void;
  setViewportSize: (size: { width: number; height: number }) => void;
  resetCanvas: () => void;
  setDiagramName: (name: string) => void;
  loadDiagramState: (state: DiagramState, skipHistory?: boolean) => void;
  saveDiagram: () => void;
  undo: () => void;
  redo: () => void;
  getDiagramState: () => DiagramState;
  startDragOperation: (nodeId: string) => void;
  endDragOperation: () => void;
  setGroupDragging: (value: boolean) => void;
  getIsGroupDragging: () => boolean;
  // Z-index management
  bringToFront: (nodeId: string) => void;
  sendToBack: (nodeId: string) => void;
  bringForward: (nodeId: string) => void;
  sendBackward: (nodeId: string) => void;
}

const initialState: DiagramState = {
  nodes: [],
  connections: [],
  groups: [],
  zoom: 1,
  pan: { x: 0, y: 0 },
};

// Chunks и bounds логика вынесена в отдельный модуль canvasChunks.ts

export const useCanvasStore = create<CanvasStore>((set, get) => {
  // Load initial state from localStorage
  const savedDiagram = loadDiagramFromStorage();
  const initialDiagram = savedDiagram 
    ? { ...initialState, ...savedDiagram, groups: savedDiagram.groups || [] }
    : initialState;

  // Track drag operation state
  let isDragging = false;
  let isGroupDragging = false; // Флаг для перетаскивания группы
  let draggedNodeInitialState: CanvasNode | null = null;

  // Helper to get current diagram state
  const getDiagramState = (): DiagramState => {
    const state = get();
    return {
      nodes: state.nodes,
      connections: state.connections,
      groups: state.groups || [],
      zoom: state.zoom,
      pan: state.pan,
    };
  };

  // Helper to save state to history
  const saveToHistory = () => {
    useHistoryStore.getState().pushState(getDiagramState());
  };

  const initialChunks = calculateCanvasChunks(initialDiagram.nodes, initialDiagram.connections || []);
  const initialBounds = calculateCanvasBounds(initialChunks);

  return {
    ...initialDiagram,
    selectedNodeId: null,
    selectedConnectionId: null,
    diagramName: savedDiagram?.name || 'Untitled Diagram',
    viewportWidth: 0,
    viewportHeight: 0,
    canvasBounds: initialBounds,
    canvasChunks: initialChunks,

    getDiagramState,

    updateCanvasBounds: () =>
      set((state) => {
        const chunks = calculateCanvasChunks(state.nodes, state.connections);
        return {
          canvasChunks: chunks,
          canvasBounds: calculateCanvasBounds(chunks),
        };
      }),

    addNode: (node) =>
      set((state) => {
        saveToHistory();
        const newNodes = [...state.nodes, node];
        const chunks = calculateCanvasChunks(newNodes, state.connections);
        const newState = {
          nodes: newNodes,
          canvasChunks: chunks,
          canvasBounds: calculateCanvasBounds(chunks),
        };
        saveDiagramToStorage({ ...state, ...newState }, state.diagramName);
        return newState;
      }),

    updateNode: (id, updates, skipHistory = false) =>
      set((state) => {
        // Only save to history if not dragging or explicitly requested
        if (!skipHistory && !isDragging) {
          saveToHistory();
        }
        const newNodes = state.nodes.map((node) =>
          node.id === id ? { ...node, ...updates } : node
        );
        
        // Always recalculate chunks based on new node positions
        // Chunks should update in real-time, even during drag, to ensure proper attachment/detachment
        const chunks = calculateCanvasChunks(newNodes, state.connections);
        
        const newState = {
          nodes: newNodes,
          canvasChunks: chunks,
          canvasBounds: calculateCanvasBounds(chunks),
        };
        
        // Only save to storage if not dragging (for performance during drag)
        if (!isDragging || !skipHistory) {
          saveDiagramToStorage({ ...state, ...newState }, state.diagramName);
        }
        
        return newState;
      }),

    updateNodes: (updates, skipHistory = false) =>
      set((state) => {
        // Only save to history if not dragging or explicitly requested
        if (!skipHistory && !isDragging && !isGroupDragging) {
          saveToHistory();
        }
        
        // Create a map for quick lookup
        const updatesMap = new Map(updates.map(u => [u.id, u.updates]));
        
        const newNodes = state.nodes.map((node) => {
          const nodeUpdates = updatesMap.get(node.id);
          return nodeUpdates ? { ...node, ...nodeUpdates } : node;
        });
        
        // Always recalculate chunks based on new node positions
        // Chunks should update in real-time to ensure proper attachment/detachment
        // For group dragging, we still recalculate but don't save to storage for performance
        const chunks = calculateCanvasChunks(newNodes, state.connections);
        
        const newState = {
          nodes: newNodes,
          canvasChunks: chunks,
          canvasBounds: calculateCanvasBounds(chunks),
        };
        
        // Only save to storage if not dragging (for performance during drag)
        if (!isGroupDragging || !skipHistory) {
          saveDiagramToStorage({ ...state, ...newState }, state.diagramName);
        }
        
        return newState;
      }),

    deleteNode: (id) =>
      set((state) => {
        saveToHistory();
        const newNodes = state.nodes.filter((node) => node.id !== id);
        const newConnections = state.connections.filter(
          (conn) => conn.source !== id && conn.target !== id
        );
        const chunks = calculateCanvasChunks(newNodes, newConnections);
        const newState = {
          nodes: newNodes,
          connections: newConnections,
          selectedNodeId: state.selectedNodeId === id ? null : state.selectedNodeId,
          canvasChunks: chunks,
          canvasBounds: calculateCanvasBounds(chunks),
        };
        saveDiagramToStorage({ ...state, ...newState }, state.diagramName);
        return newState;
      }),

    selectNode: (id, multiSelect = false) =>
      set((state) => {
        if (multiSelect && id) {
          // Multi-select: toggle selection
          const node = state.nodes.find((n) => n.id === id);
          if (node) {
            return {
              selectedNodeId: id,
              nodes: state.nodes.map((n) => ({
                ...n,
                selected: n.id === id ? !n.selected : (n.selected || false),
              })),
            };
          }
        }
        // Single select
        return {
          selectedNodeId: id,
          nodes: state.nodes.map((node) => ({
            ...node,
            selected: node.id === id,
          })),
        };
      }),

    selectNodesByIds: (ids) =>
      set((state) => ({
        selectedNodeId: ids.length > 0 ? ids[0] : null,
        nodes: state.nodes.map((node) => ({
          ...node,
          selected: ids.includes(node.id),
        })),
      })),

    addConnection: (connection) =>
      set((state) => {
        saveToHistory();
        // Ensure connection has a type field (default to 'async')
        const fullConnection = {
          ...connection,
          type: connection.type || 'async',
        };
        
        // Найти source и target nodes
        const sourceNode = state.nodes.find(n => n.id === fullConnection.source);
        const targetNode = state.nodes.find(n => n.id === fullConnection.target);
        
        // Обновить конфиги через ConnectionHandler
        let updatedNodes = [...state.nodes];
        if (sourceNode && targetNode) {
          const handler = getConnectionHandler();
          
          // Создаем функцию для обновления узла
          const updateNodeInState = (id: string, updates: Partial<CanvasNode>) => {
            const nodeIndex = updatedNodes.findIndex(n => n.id === id);
            if (nodeIndex !== -1) {
              updatedNodes[nodeIndex] = { ...updatedNodes[nodeIndex], ...updates };
            }
          };
          
          // Обработать создание связи
          handler.handleConnectionCreated(
            sourceNode,
            targetNode,
            fullConnection,
            updateNodeInState
          );
        }
        
        const newConnections = [...state.connections, fullConnection];
        const chunks = calculateCanvasChunks(updatedNodes, newConnections);
        const newState = {
          nodes: updatedNodes,
          connections: newConnections,
          canvasChunks: chunks,
          canvasBounds: calculateCanvasBounds(chunks),
        };
        saveDiagramToStorage({ ...state, ...newState }, state.diagramName);
        return newState;
      }),

    updateConnection: (id, updates) =>
      set((state) => {
        saveToHistory();
        const newState = {
          connections: state.connections.map((conn) =>
            conn.id === id ? { ...conn, ...updates } : conn
          ),
        };
        saveDiagramToStorage({ ...state, ...newState }, state.diagramName);
        return newState;
      }),

    deleteConnection: (id) =>
      set((state) => {
        saveToHistory();
        
        // Найти connection перед удалением
        const connectionToDelete = state.connections.find(c => c.id === id);
        
        // Обновить конфиги через ConnectionHandler (если нужно cleanup)
        let updatedNodes = [...state.nodes];
        if (connectionToDelete) {
          const sourceNode = state.nodes.find(n => n.id === connectionToDelete.source);
          const targetNode = state.nodes.find(n => n.id === connectionToDelete.target);
          
          if (sourceNode && targetNode) {
            const handler = getConnectionHandler();
            
            const updateNodeInState = (id: string, updates: Partial<CanvasNode>) => {
              const nodeIndex = updatedNodes.findIndex(n => n.id === id);
              if (nodeIndex !== -1) {
                updatedNodes[nodeIndex] = { ...updatedNodes[nodeIndex], ...updates };
              }
            };
            
            // Обработать удаление связи (cleanup)
            handler.handleConnectionDeleted(
              sourceNode,
              targetNode,
              connectionToDelete,
              updateNodeInState
            );
          }
        }
        
        const newConnections = state.connections.filter((conn) => conn.id !== id);
        const chunks = calculateCanvasChunks(updatedNodes, newConnections);
        const newState = {
          nodes: updatedNodes,
          connections: newConnections,
          selectedConnectionId: state.selectedConnectionId === id ? null : state.selectedConnectionId,
          canvasChunks: chunks,
          canvasBounds: calculateCanvasBounds(chunks),
        };
        saveDiagramToStorage({ ...state, ...newState }, state.diagramName);
        return newState;
      }),

    selectConnection: (id) =>
      set((state) => ({
        selectedConnectionId: id,
        selectedNodeId: null,
        selectedGroupId: null,
        connections: state.connections.map((conn) => ({
          ...conn,
          selected: conn.id === id,
        })),
      })),

    // Groups
    addGroup: (group) =>
      set((state) => {
        saveToHistory();
        const newState = {
          groups: [...state.groups, group],
        };
        saveDiagramToStorage({ ...state, ...newState }, state.diagramName);
        return newState;
      }),

    updateGroup: (id, updates) =>
      set((state) => {
        saveToHistory();
        const newState = {
          groups: state.groups.map((group) =>
            group.id === id ? { ...group, ...updates } : group
          ),
        };
        saveDiagramToStorage({ ...state, ...newState }, state.diagramName);
        return newState;
      }),

    deleteGroup: (id) =>
      set((state) => {
        saveToHistory();
        const newState = {
          groups: state.groups.filter((group) => group.id !== id),
        };
        saveDiagramToStorage({ ...state, ...newState }, state.diagramName);
        return newState;
      }),

    addNodeToGroup: (groupId, nodeId) =>
      set((state) => {
        saveToHistory();
        const newState = {
          groups: state.groups.map((group) =>
            group.id === groupId && !group.nodeIds.includes(nodeId)
              ? { ...group, nodeIds: [...group.nodeIds, nodeId] }
              : group
          ),
        };
        saveDiagramToStorage({ ...state, ...newState }, state.diagramName);
        return newState;
      }),

    removeNodeFromGroup: (groupId, nodeId) =>
      set((state) => {
        saveToHistory();
        const newState = {
          groups: state.groups.map((group) =>
            group.id === groupId
              ? { ...group, nodeIds: group.nodeIds.filter((id) => id !== nodeId) }
              : group
          ),
        };
        saveDiagramToStorage({ ...state, ...newState }, state.diagramName);
        return newState;
      }),

    selectGroup: (id) =>
      set((state) => ({
        selectedGroupId: id,
        selectedNodeId: null,
        selectedConnectionId: null,
      })),

    createGroupFromSelection: (name) =>
      set((state) => {
        saveToHistory();
        const newNodeIds = state.nodes
          .filter((node) => node.selected || node.id === state.selectedNodeId)
          .map((node) => node.id);
        
        if (newNodeIds.length === 0) return state;

        const newGroup: ComponentGroup = {
          id: `group-${Date.now()}`,
          name,
          nodeIds: newNodeIds,
          color: `hsl(${Math.random() * 360}, 70%, 50%)`,
        };

        const newState = {
          groups: [...state.groups, newGroup],
          nodes: state.nodes.map((node) => ({
            ...node,
            selected: false,
          })),
          selectedNodeId: null,
        };
        saveDiagramToStorage({ ...state, ...newState }, state.diagramName);
        return newState;
      }),

    autoGroupByConnections: () =>
      set((state) => {
        saveToHistory();
        
        // Get nodes that are already in groups
        const nodesInGroups = new Set<string>();
        state.groups.forEach((group) => {
          group.nodeIds.forEach((nodeId) => nodesInGroups.add(nodeId));
        });

        // Find connected components using Union-Find algorithm (only for nodes not in groups)
        const parent = new Map<string, string>();
        const find = (id: string): string => {
          if (!parent.has(id)) parent.set(id, id);
          const currentParent = parent.get(id);
          if (currentParent !== undefined && currentParent !== id) {
            const root = find(currentParent);
            parent.set(id, root);
            return root;
          }
          return currentParent ?? id;
        };
        const union = (a: string, b: string) => {
          const rootA = find(a);
          const rootB = find(b);
          if (rootA !== rootB) {
            parent.set(rootA, rootB);
          }
        };

        // Union all connected nodes (only if both are not in groups)
        state.connections.forEach((conn) => {
          if (!nodesInGroups.has(conn.source) && !nodesInGroups.has(conn.target)) {
            union(conn.source, conn.target);
          }
        });

        // Group nodes by their root
        const groupsMap = new Map<string, string[]>();
        state.nodes.forEach((node) => {
          if (!nodesInGroups.has(node.id)) {
            const root = find(node.id);
            if (!groupsMap.has(root)) {
              groupsMap.set(root, []);
            }
            const group = groupsMap.get(root);
            if (group) {
              group.push(node.id);
            }
          }
        });

        // Create groups for components with 2+ nodes
        const newGroups: ComponentGroup[] = [];
        let groupCounter = state.groups.length + 1;
        groupsMap.forEach((nodeIds, root) => {
          if (nodeIds.length >= 2) {
            newGroups.push({
              id: `group-${Date.now()}-${newGroups.length}`,
              name: `Group ${groupCounter++}`,
              nodeIds,
              color: `hsl(${Math.random() * 360}, 70%, 50%)`,
            });
          }
        });

        const newState = {
          groups: [...state.groups, ...newGroups],
        };
        saveDiagramToStorage({ ...state, ...newState }, state.diagramName);
        return newState;
      }),

    setZoom: (zoom) =>
      set((state) => {
        saveDiagramToStorage({ ...state, zoom }, state.diagramName);
        return { zoom };
      }),

    setPan: (pan) =>
      set((state) => {
        saveDiagramToStorage({ ...state, pan }, state.diagramName);
        return { pan };
      }),

    setViewportSize: (size) =>
      set(() => ({
        viewportWidth: size.width,
        viewportHeight: size.height,
      })),

    setDiagramName: (name) =>
      set((state) => {
        saveDiagramToStorage(state, name);
        return { diagramName: name };
      }),

    loadDiagramState: (state, skipHistory = false) =>
      set(() => {
        if (!skipHistory) {
          saveToHistory();
        }
        const chunks = calculateCanvasChunks(state.nodes || [], state.connections || []);
        const newState = {
          ...state,
          canvasChunks: chunks,
          canvasBounds: calculateCanvasBounds(chunks),
        };
        saveDiagramToStorage(newState, get().diagramName);
        return newState;
      }),

    saveDiagram: () => {
      const state = get();
      saveDiagramToStorage(state, state.diagramName);
    },

    resetCanvas: () => {
      saveToHistory();
      const chunks = calculateCanvasChunks([], []);
      set({
        ...initialState,
        canvasChunks: chunks,
        canvasBounds: calculateCanvasBounds(chunks),
      });
    },

    undo: () => {
      const previousState = useHistoryStore.getState().undo();
      if (previousState) {
        set(() => {
          const chunks = calculateCanvasChunks(previousState.nodes || [], previousState.connections || []);
          const newState = {
            ...previousState,
            canvasChunks: chunks,
            canvasBounds: calculateCanvasBounds(chunks),
          };
          saveDiagramToStorage(newState, get().diagramName);
          return newState;
        });
      }
    },

    redo: () => {
      const nextState = useHistoryStore.getState().redo();
      if (nextState) {
        set(() => {
          const chunks = calculateCanvasChunks(nextState.nodes || [], nextState.connections || []);
          const newState = {
            ...nextState,
            canvasChunks: chunks,
            canvasBounds: calculateCanvasBounds(chunks),
          };
          saveDiagramToStorage(newState, get().diagramName);
          return newState;
        });
      }
    },

    startDragOperation: (nodeId) => {
      const state = get();
      isDragging = true;
      draggedNodeInitialState = state.nodes.find((n) => n.id === nodeId) || null;
      // Save history entry with the state BEFORE drag starts
      saveToHistory();
    },

    endDragOperation: () => {
      isDragging = false;
      draggedNodeInitialState = null;
      // Chunks are already recalculated in updateNode during drag
      // Just ensure final state is saved to storage
      const state = get();
      saveDiagramToStorage(state, state.diagramName);
      // No need to save history here - it was saved at the start
    },

    setGroupDragging: (value: boolean) => {
      isGroupDragging = value;
    },

    getIsGroupDragging: () => {
      return isGroupDragging;
    },

    bringToFront: (nodeId) =>
      set((state) => {
        saveToHistory();
        const nodeIndex = state.nodes.findIndex((n) => n.id === nodeId);
        if (nodeIndex === -1) return state;

        const nodes = [...state.nodes];
        const [node] = nodes.splice(nodeIndex, 1);
        nodes.push(node);

        const newState = { nodes };
        saveDiagramToStorage({ ...state, ...newState }, state.diagramName);
        return newState;
      }),

    sendToBack: (nodeId) =>
      set((state) => {
        saveToHistory();
        const nodeIndex = state.nodes.findIndex((n) => n.id === nodeId);
        if (nodeIndex === -1) return state;

        const nodes = [...state.nodes];
        const [node] = nodes.splice(nodeIndex, 1);
        nodes.unshift(node);

        const newState = { nodes };
        saveDiagramToStorage({ ...state, ...newState }, state.diagramName);
        return newState;
      }),

    bringForward: (nodeId) =>
      set((state) => {
        saveToHistory();
        const nodeIndex = state.nodes.findIndex((n) => n.id === nodeId);
        if (nodeIndex === -1 || nodeIndex === state.nodes.length - 1) return state;

        const nodes = [...state.nodes];
        [nodes[nodeIndex], nodes[nodeIndex + 1]] = [nodes[nodeIndex + 1], nodes[nodeIndex]];

        const newState = { nodes };
        saveDiagramToStorage({ ...state, ...newState }, state.diagramName);
        return newState;
      }),

    sendBackward: (nodeId) =>
      set((state) => {
        saveToHistory();
        const nodeIndex = state.nodes.findIndex((n) => n.id === nodeId);
        if (nodeIndex === -1 || nodeIndex === 0) return state;

        const nodes = [...state.nodes];
        [nodes[nodeIndex], nodes[nodeIndex - 1]] = [nodes[nodeIndex - 1], nodes[nodeIndex]];

        const newState = { nodes };
        saveDiagramToStorage({ ...state, ...newState }, state.diagramName);
        return newState;
      }),
  };
});

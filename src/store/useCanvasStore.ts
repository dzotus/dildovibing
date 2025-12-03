import { create } from 'zustand';
import { CanvasNode, CanvasConnection, DiagramState, ComponentGroup } from '@/types';
import { saveDiagramToStorage, loadDiagramFromStorage } from '@/utils/persistence';
import { useHistoryStore } from './useHistoryStore';

interface CanvasStore extends DiagramState {
  selectedNodeId: string | null;
  selectedConnectionId: string | null;
  selectedGroupId: string | null;
  diagramName: string;
  viewportWidth: number;
  viewportHeight: number;
  addNode: (node: CanvasNode) => void;
  updateNode: (id: string, updates: Partial<CanvasNode>, skipHistory?: boolean) => void;
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
}

const initialState: DiagramState = {
  nodes: [],
  connections: [],
  groups: [],
  zoom: 1,
  pan: { x: 0, y: 0 },
};

export const useCanvasStore = create<CanvasStore>((set, get) => {
  // Load initial state from localStorage
  const savedDiagram = loadDiagramFromStorage();
  const initialDiagram = savedDiagram 
    ? { ...initialState, ...savedDiagram, groups: savedDiagram.groups || [] }
    : initialState;

  // Track drag operation state
  let isDragging = false;
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

  return {
    ...initialDiagram,
    selectedNodeId: null,
    selectedConnectionId: null,
    diagramName: savedDiagram?.name || 'Untitled Diagram',
    viewportWidth: 0,
    viewportHeight: 0,

    getDiagramState,

    addNode: (node) =>
      set((state) => {
        saveToHistory();
        const newState = {
          nodes: [...state.nodes, node],
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
        const newState = {
          nodes: state.nodes.map((node) =>
            node.id === id ? { ...node, ...updates } : node
          ),
        };
        saveDiagramToStorage({ ...state, ...newState }, state.diagramName);
        return newState;
      }),

    deleteNode: (id) =>
      set((state) => {
        saveToHistory();
        const newState = {
          nodes: state.nodes.filter((node) => node.id !== id),
          connections: state.connections.filter(
            (conn) => conn.source !== id && conn.target !== id
          ),
          selectedNodeId: state.selectedNodeId === id ? null : state.selectedNodeId,
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
        const newState = {
          connections: [...state.connections, fullConnection],
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
        const newState = {
          connections: state.connections.filter((conn) => conn.id !== id),
          selectedConnectionId: state.selectedConnectionId === id ? null : state.selectedConnectionId,
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
          if (parent.get(id) !== id) {
            parent.set(id, find(parent.get(id)!));
          }
          return parent.get(id)!;
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
            groupsMap.get(root)!.push(node.id);
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
        saveDiagramToStorage(state, get().diagramName);
        return state;
      }),

    saveDiagram: () => {
      const state = get();
      saveDiagramToStorage(state, state.diagramName);
    },

    resetCanvas: () => {
      saveToHistory();
      set(initialState);
    },

    undo: () => {
      const previousState = useHistoryStore.getState().undo();
      if (previousState) {
        set(() => {
          saveDiagramToStorage(previousState, get().diagramName);
          return previousState;
        });
      }
    },

    redo: () => {
      const nextState = useHistoryStore.getState().redo();
      if (nextState) {
        set(() => {
          saveDiagramToStorage(nextState, get().diagramName);
          return nextState;
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
      // No need to save history here - it was saved at the start
    },
  };
});

import { create } from 'zustand';
import { CanvasNode, CanvasConnection, DiagramState } from '@/types';
import { saveDiagramToStorage, loadDiagramFromStorage } from '@/utils/persistence';
import { useHistoryStore } from './useHistoryStore';

interface CanvasStore extends DiagramState {
  selectedNodeId: string | null;
  selectedConnectionId: string | null;
  diagramName: string;
  addNode: (node: CanvasNode) => void;
  updateNode: (id: string, updates: Partial<CanvasNode>, skipHistory?: boolean) => void;
  deleteNode: (id: string) => void;
  selectNode: (id: string | null) => void;
  addConnection: (connection: CanvasConnection) => void;
  updateConnection: (id: string, updates: Partial<CanvasConnection>) => void;
  deleteConnection: (id: string) => void;
  selectConnection: (id: string | null) => void;
  setZoom: (zoom: number) => void;
  setPan: (pan: { x: number; y: number }) => void;
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
  zoom: 1,
  pan: { x: 0, y: 0 },
};

export const useCanvasStore = create<CanvasStore>((set, get) => {
  // Load initial state from localStorage
  const savedDiagram = loadDiagramFromStorage();
  const initialDiagram = savedDiagram || initialState;

  // Track drag operation state
  let isDragging = false;
  let draggedNodeInitialState: CanvasNode | null = null;

  // Helper to get current diagram state
  const getDiagramState = (): DiagramState => {
    const state = get();
    return {
      nodes: state.nodes,
      connections: state.connections,
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

    selectNode: (id) =>
      set((state) => ({
        selectedNodeId: id,
        nodes: state.nodes.map((node) => ({
          ...node,
          selected: node.id === id,
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
        connections: state.connections.map((conn) => ({
          ...conn,
          selected: conn.id === id,
        })),
      })),

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

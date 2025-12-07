import { create } from 'zustand';
import { dataFlowEngine, DataMessage } from '@/core/DataFlowEngine';
import { CanvasNode, CanvasConnection } from '@/types';
import { useCanvasStore } from './useCanvasStore';

interface DataFlowStore {
  // State
  isRunning: boolean;
  messages: Map<string, DataMessage[]>; // connectionId -> messages
  messageHistory: DataMessage[];
  
  // Actions
  initialize: (nodes: CanvasNode[], connections: CanvasConnection[]) => void;
  start: () => void;
  stop: () => void;
  updateMessages: (nodes: CanvasNode[], connections: CanvasConnection[]) => void;
  
  // Getters
  getConnectionMessages: (connectionId: string) => DataMessage[];
  getComponentMessages: (nodeId: string) => DataMessage[];
  getMessageHistory: (limit?: number) => DataMessage[];
}

export const useDataFlowStore = create<DataFlowStore>((set, get) => ({
  isRunning: false,
  messages: new Map(),
  messageHistory: [],

  initialize: (nodes, connections) => {
    // Initialize data flow engine with current nodes and connections
    dataFlowEngine.initialize(nodes, connections);
    get().updateMessages(nodes, connections);
  },

  start: () => {
    dataFlowEngine.start();
    set({ isRunning: true });
    
    // Setup polling for message updates
    // Note: nodes and connections will be passed from useEmulationStore
    const pollInterval = setInterval(() => {
      // Get current nodes and connections from canvas store
      const { nodes, connections } = useCanvasStore.getState();
      get().updateMessages(nodes, connections);
    }, 200); // Update every 200ms
    
    (dataFlowEngine as any)._pollInterval = pollInterval;
  },

  stop: () => {
    dataFlowEngine.stop();
    const pollInterval = (dataFlowEngine as any)._pollInterval;
    if (pollInterval) {
      clearInterval(pollInterval);
    }
    set({ isRunning: false });
  },

  updateMessages: (nodes, connections) => {
    // Update data flow engine with current nodes and connections
    dataFlowEngine.updateNodesAndConnections(nodes, connections);
    
    // Get messages for all connections
    const newMessages = new Map<string, DataMessage[]>();
    for (const conn of connections) {
      newMessages.set(conn.id, dataFlowEngine.getConnectionMessages(conn.id));
    }
    
    // Update message history
    const history = dataFlowEngine.getMessageHistory(100);
    
    set({
      messages: newMessages,
      messageHistory: history,
    });
  },

  getConnectionMessages: (connectionId) => {
    return dataFlowEngine.getConnectionMessages(connectionId);
  },

  getComponentMessages: (nodeId) => {
    return dataFlowEngine.getComponentMessages(nodeId);
  },

  getMessageHistory: (limit) => {
    return dataFlowEngine.getMessageHistory(limit);
  },
}));


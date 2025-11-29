import { create } from 'zustand';
import { emulationEngine, ComponentMetrics, ConnectionMetrics } from '@/core/EmulationEngine';
import { CanvasNode, CanvasConnection } from '@/types';

interface EmulationStore {
  isRunning: boolean;
  simulationTime: number;
  updateInterval: number;
  componentMetrics: Map<string, ComponentMetrics>;
  connectionMetrics: Map<string, ConnectionMetrics>;
  
  // Actions
  initialize: (nodes: CanvasNode[], connections: CanvasConnection[]) => void;
  start: () => void;
  stop: () => void;
  reset: () => void;
  setUpdateInterval: (interval: number) => void;
  updateMetrics: () => void;
  
  // Getters
  getComponentMetrics: (nodeId: string) => ComponentMetrics | undefined;
  getConnectionMetrics: (connectionId: string) => ConnectionMetrics | undefined;
}

export const useEmulationStore = create<EmulationStore>((set, get) => ({
  isRunning: false,
  simulationTime: 0,
  updateInterval: 100,
  componentMetrics: new Map(),
  connectionMetrics: new Map(),

  initialize: (nodes, connections) => {
    emulationEngine.initialize(nodes, connections);
    set({ 
      componentMetrics: new Map(emulationEngine.getAllComponentMetrics().map(m => [m.id, m])),
      connectionMetrics: new Map(emulationEngine.getAllConnectionMetrics().map(m => [m.id, m])),
    });
  },

  start: () => {
    emulationEngine.start();
    set({ isRunning: true });
    
    // Setup polling for metrics updates
    const pollInterval = setInterval(() => {
      get().updateMetrics();
    }, get().updateInterval);
    
    // Store interval ID for cleanup (we'll need to handle this in stop)
    (emulationEngine as any)._pollInterval = pollInterval;
  },

  stop: () => {
    emulationEngine.stop();
    const pollInterval = (emulationEngine as any)._pollInterval;
    if (pollInterval) {
      clearInterval(pollInterval);
    }
    set({ isRunning: false });
  },

  reset: () => {
    emulationEngine.stop();
    const pollInterval = (emulationEngine as any)._pollInterval;
    if (pollInterval) {
      clearInterval(pollInterval);
    }
    set({ 
      isRunning: false, 
      simulationTime: 0,
      componentMetrics: new Map(),
      connectionMetrics: new Map(),
    });
  },

  setUpdateInterval: (interval) => {
    set({ updateInterval: interval });
  },

  updateMetrics: () => {
    set(state => ({
      simulationTime: emulationEngine.getSimulationTime(),
      componentMetrics: new Map(
        emulationEngine.getAllComponentMetrics().map(m => [m.id, m])
      ),
      connectionMetrics: new Map(
        emulationEngine.getAllConnectionMetrics().map(m => [m.id, m])
      ),
    }));
  },

  getComponentMetrics: (nodeId) => {
    return get().componentMetrics.get(nodeId);
  },

  getConnectionMetrics: (connectionId) => {
    return get().connectionMetrics.get(connectionId);
  },
}));

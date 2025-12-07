import { create } from 'zustand';
import { dependencyGraphEngine, ComponentStatus, SystemAnalysis } from '@/core/DependencyGraphEngine';
import { useEmulationStore } from './useEmulationStore';
import { useCanvasStore } from './useCanvasStore';

interface DependencyStore {
  // State
  componentStatuses: Map<string, ComponentStatus>;
  systemAnalysis: SystemAnalysis | null;
  
  // Actions
  updateAnalysis: () => void;
  
  // Getters
  getComponentStatus: (nodeId: string) => ComponentStatus | undefined;
  getAllComponentStatuses: () => ComponentStatus[];
  getSystemAnalysis: () => SystemAnalysis | null;
}

export const useDependencyStore = create<DependencyStore>((set, get) => ({
  componentStatuses: new Map(),
  systemAnalysis: null,

  updateAnalysis: () => {
    const { nodes, connections } = useCanvasStore.getState();
    const { componentMetrics, connectionMetrics } = useEmulationStore.getState();
    
    // Update dependency graph engine
    dependencyGraphEngine.update(nodes, connections, componentMetrics, connectionMetrics);
    
    // Get analysis
    const analysis = dependencyGraphEngine.analyzeSystem();
    const statuses = new Map(
      dependencyGraphEngine.getAllComponentStatuses().map(s => [s.nodeId, s])
    );
    
    set({
      componentStatuses: statuses,
      systemAnalysis: analysis,
    });
  },

  getComponentStatus: (nodeId) => {
    return get().componentStatuses.get(nodeId);
  },

  getAllComponentStatuses: () => {
    return Array.from(get().componentStatuses.values());
  },

  getSystemAnalysis: () => {
    return get().systemAnalysis;
  },
}));


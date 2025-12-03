import { create } from 'zustand';
import { componentStateEngine, ComponentState, ComponentStateConfig } from '@/core/ComponentStateEngine';

interface ComponentStateStore {
  // State
  componentStates: Map<string, ComponentStateConfig>;
  
  // Actions
  setComponentState: (
    nodeId: string,
    state: ComponentState,
    options?: {
      degradedLevel?: number;
      failureRate?: number;
      latencyMultiplier?: number;
      throughputMultiplier?: number;
    }
  ) => void;
  resetComponent: (nodeId: string) => void;
  resetAll: () => void;
  
  // Getters
  getComponentState: (nodeId: string) => ComponentStateConfig | undefined;
  isEnabled: (nodeId: string) => boolean;
  getAllStates: () => ComponentStateConfig[];
}

export const useComponentStateStore = create<ComponentStateStore>((set, get) => ({
  componentStates: new Map(),

  setComponentState: (nodeId, state, options) => {
    componentStateEngine.setComponentState(nodeId, state, options);
    
    const stateConfig = componentStateEngine.getComponentState(nodeId);
    if (stateConfig) {
      set(state => ({
        componentStates: new Map(state.componentStates).set(nodeId, stateConfig),
      }));
    }
  },

  resetComponent: (nodeId) => {
    componentStateEngine.resetComponent(nodeId);
    set(state => {
      const newStates = new Map(state.componentStates);
      newStates.delete(nodeId);
      return { componentStates: newStates };
    });
  },

  resetAll: () => {
    componentStateEngine.reset();
    set({ componentStates: new Map() });
  },

  getComponentState: (nodeId) => {
    return get().componentStates.get(nodeId);
  },

  isEnabled: (nodeId) => {
    return componentStateEngine.isEnabled(nodeId);
  },

  getAllStates: () => {
    return Array.from(get().componentStates.values());
  },
}));


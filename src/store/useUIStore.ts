import { create } from 'zustand';

interface UIStore {
  showMinimap: boolean;
  setShowMinimap: (show: boolean) => void;
  toggleMinimap: () => void;
  showHeatMapLegend: boolean;
  setShowHeatMapLegend: (show: boolean) => void;
  toggleHeatMapLegend: () => void;
  autoCenterOnSelect: boolean;
  setAutoCenterOnSelect: (enabled: boolean) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  highlightedNodeId: string | null;
  setHighlightedNodeId: (id: string | null) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  showMinimap: true,
  setShowMinimap: (show) => set({ showMinimap: show }),
  toggleMinimap: () => set((state) => ({ showMinimap: !state.showMinimap })),
  showHeatMapLegend: true,
  setShowHeatMapLegend: (show) => set({ showHeatMapLegend: show }),
  toggleHeatMapLegend: () => set((state) => ({ showHeatMapLegend: !state.showHeatMapLegend })),
  autoCenterOnSelect: true,
  setAutoCenterOnSelect: (enabled) => set({ autoCenterOnSelect: enabled }),
  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),
  highlightedNodeId: null,
  setHighlightedNodeId: (id) => set({ highlightedNodeId: id }),
}));


import { create } from 'zustand';
import { Tab } from '@/types';

interface TabStore {
  tabs: Tab[];
  addTab: (tab: Omit<Tab, 'id' | 'active'>) => void;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateTab: (id: string, updates: Partial<Tab>) => void;
}

export const useTabStore = create<TabStore>((set) => ({
  tabs: [
    {
      id: 'diagram-1',
      title: 'Untitled Diagram',
      type: 'diagram',
      active: true,
    },
  ],

  addTab: (tab) =>
    set((state) => {
      // Check if tab for this component already exists
      if (tab.componentId) {
        const existingTab = state.tabs.find((t) => t.componentId === tab.componentId);
        if (existingTab) {
          // Just activate the existing tab
          return {
            tabs: state.tabs.map((t) => ({
              ...t,
              active: t.id === existingTab.id,
            })),
          };
        }
      }

      const newTab: Tab = {
        ...tab,
        id: `${tab.type}-${Date.now()}`,
        active: true,
      };
      return {
        tabs: [
          ...state.tabs.map((t) => ({ ...t, active: false })),
          newTab,
        ],
      };
    }),

  closeTab: (id) =>
    set((state) => {
      const newTabs = state.tabs.filter((t) => t.id !== id);
      if (newTabs.length === 0) {
        return {
          tabs: [
            {
              id: 'diagram-1',
              title: 'Untitled Diagram',
              type: 'diagram' as const,
              active: true,
            },
          ],
        };
      }
      
      const closedTabIndex = state.tabs.findIndex((t) => t.id === id);
      const wasActive = state.tabs[closedTabIndex]?.active;
      
      if (wasActive && newTabs.length > 0) {
        const newActiveIndex = Math.min(closedTabIndex, newTabs.length - 1);
        newTabs[newActiveIndex].active = true;
      }
      
      return { tabs: newTabs };
    }),

  setActiveTab: (id) =>
    set((state) => ({
      tabs: state.tabs.map((t) => ({
        ...t,
        active: t.id === id,
      })),
    })),

  updateTab: (id, updates) =>
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === id ? { ...t, ...updates } : t
      ),
    })),
}));
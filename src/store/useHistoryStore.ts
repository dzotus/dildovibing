import { create } from 'zustand';
import { DiagramState } from '@/types';

interface HistoryState {
  past: DiagramState[];
  future: DiagramState[];
  canUndo: boolean;
  canRedo: boolean;
}

interface HistoryStore extends HistoryState {
  pushState: (state: DiagramState) => void;
  undo: () => DiagramState | null;
  redo: () => DiagramState | null;
  clearHistory: () => void;
}

const MAX_HISTORY_SIZE = 50;

export const useHistoryStore = create<HistoryStore>((set, get) => ({
  past: [],
  future: [],
  canUndo: false,
  canRedo: false,

  pushState: (state: DiagramState) => {
    set((prev) => {
      const newPast = [...prev.past, state];
      // Limit history size
      if (newPast.length > MAX_HISTORY_SIZE) {
        newPast.shift();
      }
      return {
        past: newPast,
        future: [], // Clear future when new action is performed
        canUndo: true,
        canRedo: false,
      };
    });
  },

  undo: () => {
    const { past, future } = get();
    if (past.length === 0) return null;

    const previous = past[past.length - 1];
    const newPast = past.slice(0, -1);

    set({
      past: newPast,
      future: [previous, ...future],
      canUndo: newPast.length > 0,
      canRedo: true,
    });

    return previous;
  },

  redo: () => {
    const { past, future } = get();
    if (future.length === 0) return null;

    const next = future[0];
    const newFuture = future.slice(1);

    set({
      past: [...past, next],
      future: newFuture,
      canUndo: true,
      canRedo: newFuture.length > 0,
    });

    return next;
  },

  clearHistory: () => {
    set({
      past: [],
      future: [],
      canUndo: false,
      canRedo: false,
    });
  },
}));

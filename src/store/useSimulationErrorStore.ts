import { create } from 'zustand';
import { errorCollector, SimulationError, ErrorSeverity, ErrorSource } from '@/core/ErrorCollector';

interface SimulationErrorStore {
  errors: SimulationError[];
  updateErrors: () => void;
  clearErrors: () => void;
  clearErrorsByFilter: (filter: (error: SimulationError) => boolean) => void;
  removeError: (errorId: string) => void;
  getErrorsBySeverity: (severity: ErrorSeverity) => SimulationError[];
  getErrorsBySource: (source: ErrorSource) => SimulationError[];
  getErrorsByComponent: (componentId: string) => SimulationError[];
  getCriticalErrors: () => SimulationError[];
  getErrorCount: (severity?: ErrorSeverity) => number;
  getStats: () => {
    total: number;
    critical: number;
    warning: number;
    info: number;
    bySource: Record<ErrorSource, number>;
  };
}

export const useSimulationErrorStore = create<SimulationErrorStore>((set, get) => {
  // Подписываемся на новые ошибки
  const unsubscribe = errorCollector.onError(() => {
    // Обновляем store при появлении новой ошибки
    get().updateErrors();
  });

  return {
    errors: [],

    updateErrors: () => {
      const errors = errorCollector.getErrors();
      set({ errors });
    },

    clearErrors: () => {
      errorCollector.clear();
      set({ errors: [] });
    },

    clearErrorsByFilter: (filter) => {
      errorCollector.clearByFilter(filter);
      get().updateErrors();
    },

    removeError: (errorId) => {
      errorCollector.removeError(errorId);
      get().updateErrors();
    },

    getErrorsBySeverity: (severity) => {
      return errorCollector.getErrorsBySeverity(severity);
    },

    getErrorsBySource: (source) => {
      return errorCollector.getErrorsBySource(source);
    },

    getErrorsByComponent: (componentId) => {
      return errorCollector.getErrorsByComponent(componentId);
    },

    getCriticalErrors: () => {
      return errorCollector.getCriticalErrors();
    },

    getErrorCount: (severity) => {
      return errorCollector.getErrorCount(severity);
    },

    getStats: () => {
      return errorCollector.getStats();
    },
  };
});



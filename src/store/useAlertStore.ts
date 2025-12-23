import { create } from 'zustand';
import { alertSystem, Alert } from '@/core/AlertSystem';
import { useEmulationStore } from './useEmulationStore';
import { useCanvasStore } from './useCanvasStore';
import { useDependencyStore } from './useDependencyStore';

interface AlertStore {
  alerts: Alert[];
  updateAlerts: () => void;
  acknowledgeAlert: (alertId: string) => void;
  clearAlerts: () => void;
  getCriticalAlerts: () => Alert[];
  getWarningAlerts: () => Alert[];
}

export const useAlertStore = create<AlertStore>((set, get) => {
  // НЕ регистрируем callback здесь, чтобы избежать бесконечной рекурсии
  // updateAlerts будет вызываться напрямую из EmulationEngine.simulate()

  return {
    alerts: [],

    updateAlerts: () => {
      try {
        const { nodes, connections } = useCanvasStore.getState();
        const { componentMetrics, connectionMetrics } = useEmulationStore.getState();
        const componentStatuses = useDependencyStore.getState().getAllComponentStatuses();

        alertSystem.analyze(nodes, componentMetrics, connectionMetrics, componentStatuses);
        const alerts = alertSystem.getAlerts();
        set({ alerts });
      } catch (error) {
        // Ошибки в AlertSystem обрабатываются через ErrorCollector в EmulationEngine
        console.error('Error in updateAlerts:', error);
      }
    },

    acknowledgeAlert: (alertId) => {
      alertSystem.acknowledge(alertId);
      const alerts = alertSystem.getAlerts();
      set({ alerts });
    },

    clearAlerts: () => {
      alertSystem.clear();
      set({ alerts: [] });
    },

    getCriticalAlerts: () => {
      return get().alerts.filter(a => a.type === 'critical');
    },

    getWarningAlerts: () => {
      return get().alerts.filter(a => a.type === 'warning');
    },
  };
});


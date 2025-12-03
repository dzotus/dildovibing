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
  // Setup alert callback
  alertSystem.onAlert((alert) => {
    // Update store when new alert is generated
    get().updateAlerts();
  });

  return {
    alerts: [],

    updateAlerts: () => {
      const { nodes, connections } = useCanvasStore.getState();
      const { componentMetrics, connectionMetrics } = useEmulationStore.getState();
      const componentStatuses = useDependencyStore.getState().getAllComponentStatuses();

      alertSystem.analyze(nodes, componentMetrics, connectionMetrics, componentStatuses);
      const alerts = alertSystem.getAlerts();
      set({ alerts });
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


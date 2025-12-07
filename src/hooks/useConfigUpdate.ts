import { useCallback } from 'react';
import { showSaveSuccess, showSaveError } from '@/utils/toast';

/**
 * Хук для обновления конфига с toast-уведомлениями
 */
export function useConfigUpdate<T>(
  updateConfig: (updates: Partial<T>) => void,
  showSuccessToast: boolean = true
) {
  return useCallback(
    (updates: Partial<T>, options?: { showToast?: boolean }) => {
      try {
        updateConfig(updates);
        
        const shouldShowToast = options?.showToast !== false && showSuccessToast;
        if (shouldShowToast) {
          showSaveSuccess();
        }
      } catch (error) {
        showSaveError(error instanceof Error ? error.message : undefined);
      }
    },
    [updateConfig, showSuccessToast]
  );
}

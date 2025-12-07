import toast from 'react-hot-toast';

/**
 * Утилиты для toast-уведомлений
 */

/**
 * Показать успешное уведомление
 */
export function showSuccess(message: string) {
  toast.success(message, {
    duration: 3000,
    position: 'top-right',
  });
}

/**
 * Показать уведомление об ошибке
 */
export function showError(message: string) {
  toast.error(message, {
    duration: 4000,
    position: 'top-right',
  });
}

/**
 * Показать информационное уведомление
 */
export function showInfo(message: string) {
  toast(message, {
    duration: 3000,
    position: 'top-right',
    icon: 'ℹ️',
  });
}

/**
 * Показать предупреждение
 */
export function showWarning(message: string) {
  toast(message, {
    duration: 4000,
    position: 'top-right',
    icon: '⚠️',
  });
}

/**
 * Показать уведомление о сохранении
 */
export function showSaveSuccess() {
  showSuccess('Настройки успешно сохранены');
}

/**
 * Показать уведомление об ошибке сохранения
 */
export function showSaveError(error?: string) {
  showError(error || 'Ошибка при сохранении настроек');
}

/**
 * Показать уведомление об ошибке валидации
 */
export function showValidationError(message: string) {
  showError(`Ошибка валидации: ${message}`);
}

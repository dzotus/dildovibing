import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { ComponentConfig } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Безопасно получает config из node с типизацией
 * @param config - ComponentConfig или undefined
 * @param defaultValue - значение по умолчанию
 * @returns Типизированный config или defaultValue
 */
export function getTypedConfig<T extends ComponentConfig>(
  config: ComponentConfig | undefined,
  defaultValue: T
): T {
  if (!config) {
    return defaultValue;
  }
  // Безопасное приведение типа с проверкой структуры
  return { ...defaultValue, ...config } as T;
} 
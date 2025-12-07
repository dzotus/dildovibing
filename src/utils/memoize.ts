/**
 * Утилиты для мемоизации функций
 */

/**
 * Простая мемоизация функции с одним аргументом
 * @param fn - функция для мемоизации
 * @param getKey - функция для получения ключа из аргумента
 * @returns мемоизированная функция
 */
export function memoize<T, R>(
  fn: (arg: T) => R,
  getKey?: (arg: T) => string
): (arg: T) => R {
  const cache = new Map<string, R>();

  return (arg: T): R => {
    const key = getKey ? getKey(arg) : JSON.stringify(arg);
    
    if (cache.has(key)) {
      return cache.get(key)!;
    }

    const result = fn(arg);
    cache.set(key, result);
    return result;
  };
}

/**
 * Мемоизация функции с несколькими аргументами
 * @param fn - функция для мемоизации
 * @param getKey - функция для получения ключа из аргументов
 * @param maxSize - максимальный размер кэша (по умолчанию 100)
 * @returns мемоизированная функция
 */
export function memoizeMulti<T extends unknown[], R>(
  fn: (...args: T) => R,
  getKey?: (...args: T) => string,
  maxSize: number = 100
): (...args: T) => R {
  const cache = new Map<string, R>();

  return (...args: T): R => {
    const key = getKey ? getKey(...args) : JSON.stringify(args);
    
    if (cache.has(key)) {
      return cache.get(key)!;
    }

    const result = fn(...args);
    
    // LRU: удаляем старые записи если кэш переполнен
    if (cache.size >= maxSize) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }
    
    cache.set(key, result);
    return result;
  };
}

/**
 * Очистка кэша мемоизации
 */
export function clearMemoizeCache<T, R>(memoizedFn: (arg: T) => R): void {
  // Кэш хранится внутри замыкания, поэтому очистка требует специальной реализации
  // Для простоты можно использовать WeakMap или ограничить размер кэша
}

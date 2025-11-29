const globalScope = globalThis as typeof globalThis & {
  structuredClone?: <T>(value: T) => T;
};

export function deepClone<T>(value: T): T {
  try {
    if (typeof globalScope.structuredClone === 'function') {
      return globalScope.structuredClone(value);
    }
  } catch (_) {
    // ignore and fallback
  }

  return JSON.parse(JSON.stringify(value));
}


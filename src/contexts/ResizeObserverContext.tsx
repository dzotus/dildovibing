import React, { createContext, useContext, useRef, useCallback, ReactNode, useEffect } from 'react';

/**
 * Контекст для единого ResizeObserver на весь канвас
 * Вместо создания множества observers, используем один глобальный
 */
interface ResizeObserverContextValue {
  observe: (element: HTMLElement, callback: () => void) => () => void;
}

const ResizeObserverContext = createContext<ResizeObserverContextValue | null>(null);

/**
 * Провайдер контекста для единого ResizeObserver
 */
export function ResizeObserverProvider({ children }: { children: ReactNode }) {
  const observerRef = useRef<ResizeObserver | null>(null);
  const callbacksRef = useRef<WeakMap<HTMLElement, () => void>>(new WeakMap());

  useEffect(() => {
    // Создаем единый ResizeObserver для всего приложения
    observerRef.current = new ResizeObserver((entries) => {
      entries.forEach((entry) => {
        const callback = callbacksRef.current.get(entry.target as HTMLElement);
        if (callback) {
          callback();
        }
      });
    });

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, []);

  const observe = useCallback((element: HTMLElement, callback: () => void): (() => void) => {
    if (!observerRef.current) {
      return () => {}; // No-op если observer не создан
    }

    callbacksRef.current.set(element, callback);
    observerRef.current.observe(element);

    // Возвращаем функцию для отписки
    return () => {
      if (observerRef.current) {
        observerRef.current.unobserve(element);
        callbacksRef.current.delete(element);
      }
    };
  }, []);

  const value: ResizeObserverContextValue = {
    observe,
  };

  return (
    <ResizeObserverContext.Provider value={value}>
      {children}
    </ResizeObserverContext.Provider>
  );
}

/**
 * Хук для использования единого ResizeObserver
 */
export function useResizeObserver(): ResizeObserverContextValue {
  const context = useContext(ResizeObserverContext);
  if (!context) {
    throw new Error('useResizeObserver must be used within ResizeObserverProvider');
  }
  return context;
}

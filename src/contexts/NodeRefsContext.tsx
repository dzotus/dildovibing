import React, { createContext, useContext, useRef, useCallback, ReactNode } from 'react';

/**
 * Контекст для хранения refs DOM элементов узлов
 * Позволяет избежать использования querySelector для поиска элементов
 */
interface NodeRefsContextValue {
  registerNodeRef: (nodeId: string, element: HTMLElement | null) => void;
  getNodeRef: (nodeId: string) => HTMLElement | null;
  unregisterNodeRef: (nodeId: string) => void;
}

const NodeRefsContext = createContext<NodeRefsContextValue | null>(null);

/**
 * Провайдер контекста для refs узлов
 */
export function NodeRefsProvider({ children }: { children: ReactNode }) {
  const nodeRefsRef = useRef<Map<string, HTMLElement>>(new Map());

  const registerNodeRef = useCallback((nodeId: string, element: HTMLElement | null): void => {
    if (element) {
      nodeRefsRef.current.set(nodeId, element);
    } else {
      nodeRefsRef.current.delete(nodeId);
    }
  }, []);

  const getNodeRef = useCallback((nodeId: string): HTMLElement | null => {
    return nodeRefsRef.current.get(nodeId) || null;
  }, []);

  const unregisterNodeRef = useCallback((nodeId: string): void => {
    nodeRefsRef.current.delete(nodeId);
  }, []);

  const value: NodeRefsContextValue = {
    registerNodeRef,
    getNodeRef,
    unregisterNodeRef,
  };

  return (
    <NodeRefsContext.Provider value={value}>
      {children}
    </NodeRefsContext.Provider>
  );
}

/**
 * Хук для использования контекста refs узлов
 */
export function useNodeRefs(): NodeRefsContextValue {
  const context = useContext(NodeRefsContext);
  if (!context) {
    throw new Error('useNodeRefs must be used within NodeRefsProvider');
  }
  return context;
}

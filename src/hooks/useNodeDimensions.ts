import { useEffect, useState, useCallback } from 'react';
import { CanvasNode } from '@/types';
import { useNodeRefs } from '@/contexts/NodeRefsContext';
import { useResizeObserver } from '@/contexts/ResizeObserverContext';

const DEFAULT_NODE_WIDTH = 140;
const DEFAULT_NODE_HEIGHT = 100;

/**
 * Получает реальные размеры компонента из DOM через refs
 * @param nodeId - ID компонента
 * @param zoom - Текущий уровень зума канваса
 * @param getNodeRef - функция для получения ref узла
 * @returns Объект с width и height в координатах канваса, или null если элемент не найден
 */
function getNodeDimensions(
  nodeId: string,
  zoom: number,
  getNodeRef: (nodeId: string) => HTMLElement | null
): { width: number; height: number } | null {
  const nodeElement = getNodeRef(nodeId);
  
  if (!nodeElement) {
    return { width: DEFAULT_NODE_WIDTH, height: DEFAULT_NODE_HEIGHT };
  }

  const innerElement = nodeElement.querySelector('.bg-card') as HTMLElement | null;
  const targetElement = innerElement || nodeElement;
  
  const rect = targetElement.getBoundingClientRect();
  return {
    width: rect.width / zoom,
    height: rect.height / zoom,
  };
}

/**
 * Хук для получения и отслеживания размеров узлов
 */
export function useNodeDimensions(
  nodeIds: string[],
  zoom: number
): Record<string, { width: number; height: number }> {
  const { getNodeRef } = useNodeRefs();
  const { observe } = useResizeObserver();
  const [dimensions, setDimensions] = useState<Record<string, { width: number; height: number }>>({});

  const updateDimensions = useCallback(() => {
    const newDimensions: Record<string, { width: number; height: number }> = {};
    
    nodeIds.forEach((nodeId) => {
      const dims = getNodeDimensions(nodeId, zoom, getNodeRef);
      if (dims) {
        newDimensions[nodeId] = dims;
      }
    });
    
    setDimensions((prev) => ({ ...prev, ...newDimensions }));
  }, [nodeIds, zoom, getNodeRef]);

  useEffect(() => {
    if (nodeIds.length === 0) {
      return;
    }

    // Инициализируем размеры сразу
    updateDimensions();

    // Используем единый ResizeObserver через контекст
    const unobserveCallbacks: Array<() => void> = [];

    nodeIds.forEach((nodeId) => {
      const nodeElement = getNodeRef(nodeId);
      if (nodeElement) {
        const innerElement = nodeElement.querySelector('.bg-card') as HTMLElement | null;
        const targetElement = innerElement || nodeElement;
        
        if (targetElement) {
          const unobserve = observe(targetElement, updateDimensions);
          unobserveCallbacks.push(unobserve);
        }
      }
    });

    return () => {
      // Отписываемся от всех наблюдений
      unobserveCallbacks.forEach((unobserve) => unobserve());
    };
  }, [nodeIds, zoom, updateDimensions, getNodeRef, observe]);

  return dimensions;
}

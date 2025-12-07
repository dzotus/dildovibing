import { useState, useEffect } from 'react';
import { CanvasNode } from '@/types';
import { 
  validatePort, 
  validateHost, 
  checkPortConflict,
  getPortValidationError,
  getHostValidationError 
} from '@/utils/validation';

/**
 * Хук для валидации портов и хостов в компонентах
 */
export function usePortValidation(
  nodes: CanvasNode[],
  componentId: string,
  host: string,
  port: number | undefined
) {
  const [portError, setPortError] = useState<string | null>(null);
  const [hostError, setHostError] = useState<string | null>(null);
  const [portConflict, setPortConflict] = useState<{ 
    hasConflict: boolean; 
    conflictingNode?: CanvasNode;
    endpoint?: string;
  }>({ hasConflict: false });

  // Валидация порта
  useEffect(() => {
    const portErr = getPortValidationError(port);
    setPortError(portErr);
    
    if (!portErr && port && validateHost(host)) {
      const conflict = checkPortConflict(nodes, componentId, host, port);
      setPortConflict(conflict);
    } else {
      setPortConflict({ hasConflict: false });
    }
  }, [port, host, nodes, componentId]);

  // Валидация хоста
  useEffect(() => {
    const hostErr = getHostValidationError(host);
    setHostError(hostErr);
    
    if (!hostErr && port && validatePort(port)) {
      const conflict = checkPortConflict(nodes, componentId, host, port);
      setPortConflict(conflict);
    }
  }, [host, port, nodes, componentId]);

  return {
    portError,
    hostError,
    portConflict,
    isValid: !portError && !hostError && !portConflict.hasConflict,
  };
}

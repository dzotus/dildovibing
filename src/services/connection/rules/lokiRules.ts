import { ConnectionRule, ConnectionMetadata } from '../types';
import { ServiceDiscovery } from '../ServiceDiscovery';
import { CanvasNode, CanvasConnection } from '@/types';

/**
 * Правило для Component -> Loki
 * Любой компонент может отправлять логи в Loki
 * При создании connection логи отправляются автоматически через DataFlowEngine
 */
export function createLokiRule(discovery: ServiceDiscovery): ConnectionRule {
  return {
    sourceType: '*', // Любой компонент может отправлять логи
    targetTypes: ['loki'],
    priority: 5,
    
    // Не нужно обновлять конфиг источника
    // Логи отправляются автоматически через DataFlowEngine
    updateSourceConfig: () => null,
    
    updateTargetConfig: (source, loki, connection, metadata) => {
      // Можно добавить автоматическую настройку streams в Loki
      // Но это не обязательно, т.к. streams создаются автоматически при ingestion
      // В реальности Loki не требует предварительной настройки streams
      return null;
    },
    
    extractMetadata: (source, loki, connection) => {
      return discovery.getConnectionMetadata(source, loki, connection);
    },
    
    validateConnection: (source, target, connection) => {
      // Валидация: Loki может принимать логи от любых компонентов
      if (!source?.data || !target?.data) {
        return { valid: false, error: 'Source or target node missing data' };
      }
      
      if (target.type !== 'loki') {
        return { valid: false, error: 'Target must be Loki component' };
      }
      
      return { valid: true };
    },
  };
}

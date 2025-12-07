import { CanvasNode, CanvasConnection } from '@/types';
import { ConnectionRule, ConnectionMetadata } from './types';
import { ConnectionRuleRegistry } from './ConnectionRuleRegistry';
import { ServiceDiscovery } from './ServiceDiscovery';
import { logError } from '@/utils/logger';

/**
 * Обработчик связей между компонентами
 * Автоматически обновляет конфиги при создании/удалении связей
 */
export class ConnectionHandler {
  private registry: ConnectionRuleRegistry;
  private discovery: ServiceDiscovery;

  constructor() {
    this.registry = new ConnectionRuleRegistry();
    this.discovery = new ServiceDiscovery();
  }

  /**
   * Инициализировать правила по умолчанию
   * Вызывается после регистрации всех правил
   */
  initialize(rules: ConnectionRule[]): void {
    this.registry.registerMany(rules);
  }

  /**
   * Обработать создание связи
   */
  handleConnectionCreated(
    source: CanvasNode,
    target: CanvasNode,
    connection: CanvasConnection,
    updateNode: (id: string, updates: Partial<CanvasNode>) => void
  ): { sourceUpdated: boolean; targetUpdated: boolean } {
    const rules = this.registry.findRules(source.type, target.type);
    
    if (rules.length === 0) {
      return { sourceUpdated: false, targetUpdated: false };
    }

    let sourceUpdated = false;
    let targetUpdated = false;

    // Получаем метаданные для связи
    const metadata = this.discovery.getConnectionMetadata(source, target, connection);

    for (const rule of rules) {
      try {
        // Обновить конфиг источника
        const sourceUpdates = rule.updateSourceConfig(source, target, connection, metadata);
        if (sourceUpdates && Object.keys(sourceUpdates).length > 0) {
          updateNode(source.id, {
            data: {
              ...source.data,
              config: {
                ...source.data.config,
                ...sourceUpdates,
              },
            },
          });
          sourceUpdated = true;
        }

        // Обновить конфиг цели (если есть правило)
        if (rule.updateTargetConfig) {
          const targetUpdates = rule.updateTargetConfig(source, target, connection, metadata);
          if (targetUpdates && Object.keys(targetUpdates).length > 0) {
            updateNode(target.id, {
              data: {
                ...target.data,
                config: {
                  ...target.data.config,
                  ...targetUpdates,
                },
              },
            });
            targetUpdated = true;
          }
        }
      } catch (error) {
        logError(
          `Error applying rule for ${source.type} -> ${target.type}`,
          error instanceof Error ? error : new Error(String(error)),
          { sourceType: source.type, targetType: target.type }
        );
      }
    }

    return { sourceUpdated, targetUpdated };
  }

  /**
   * Обработать удаление связи
   * Выполняет cleanup при удалении связи (удаляет scrape targets из Prometheus и т.д.)
   */
  handleConnectionDeleted(
    source: CanvasNode,
    target: CanvasNode,
    connection: CanvasConnection,
    updateNode: (id: string, updates: Partial<CanvasNode>) => void
  ): { sourceUpdated: boolean; targetUpdated: boolean } {
    const rules = this.registry.findRules(source.type, target.type);
    
    if (rules.length === 0) {
      return { sourceUpdated: false, targetUpdated: false };
    }

    let sourceUpdated = false;
    let targetUpdated = false;

    // Получаем метаданные для связи
    const metadata = this.discovery.getConnectionMetadata(source, target, connection);

    for (const rule of rules) {
      try {
        // Cleanup для источника (если есть правило)
        if (rule.cleanupSourceConfig) {
          const sourceUpdates = rule.cleanupSourceConfig(source, target, connection, metadata);
          if (sourceUpdates && Object.keys(sourceUpdates).length > 0) {
            updateNode(source.id, {
              data: {
                ...source.data,
                config: {
                  ...source.data.config,
                  ...sourceUpdates,
                },
              },
            });
            sourceUpdated = true;
          }
        }

        // Cleanup для цели (например, удаление scrape target из Prometheus)
        if (rule.cleanupTargetConfig) {
          const targetUpdates = rule.cleanupTargetConfig(source, target, connection, metadata);
          if (targetUpdates && Object.keys(targetUpdates).length > 0) {
            updateNode(target.id, {
              data: {
                ...target.data,
                config: {
                  ...target.data.config,
                  ...targetUpdates,
                },
              },
            });
            targetUpdated = true;
          }
        }
      } catch (error) {
        logError(
          `Error cleaning up rule for ${source.type} -> ${target.type}`,
          error instanceof Error ? error : new Error(String(error)),
          { sourceType: source.type, targetType: target.type }
        );
      }
    }

    return { sourceUpdated, targetUpdated };
  }

  /**
   * Получить ServiceDiscovery (для использования в правилах)
   */
  getDiscovery(): ServiceDiscovery {
    return this.discovery;
  }

  /**
   * Получить реестр правил
   */
  getRegistry(): ConnectionRuleRegistry {
    return this.registry;
  }
}

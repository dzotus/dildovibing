import { ConnectionHandler } from './ConnectionHandler';
import { ServiceDiscovery } from './ServiceDiscovery';
import { initializeConnectionRules } from './rules';

/**
 * Singleton instance ConnectionHandler
 * Инициализируется один раз при первом использовании
 */
let connectionHandlerInstance: ConnectionHandler | null = null;

/**
 * Получить или создать instance ConnectionHandler
 */
export function getConnectionHandler(): ConnectionHandler {
  if (!connectionHandlerInstance) {
    const discovery = new ServiceDiscovery();
    const handler = new ConnectionHandler();
    const rules = initializeConnectionRules(discovery);
    handler.initialize(rules);
    connectionHandlerInstance = handler;
  }
  return connectionHandlerInstance;
}

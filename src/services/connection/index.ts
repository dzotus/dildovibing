/**
 * Connection System - Умная система автоматического обновления конфигов компонентов
 * 
 * Эта система автоматически обновляет конфиги компонентов при создании связей между ними,
 * избегая необходимости вручную настраивать каждый компонент.
 * 
 * Основные компоненты:
 * - ConnectionHandler: главный обработчик связей
 * - ServiceDiscovery: автоматическое разрешение имен и портов
 * - ConnectionRuleRegistry: реестр правил подключения
 * - Rules: набор правил для разных типов компонентов
 * 
 * Использование:
 * Система автоматически активируется при создании/удалении связей через useCanvasStore.
 * Правила определяют, как обновлять конфиги для каждой пары компонентов.
 */

export { ConnectionHandler } from './ConnectionHandler';
export { ServiceDiscovery } from './ServiceDiscovery';
export { ConnectionRuleRegistry } from './ConnectionRuleRegistry';
export { getConnectionHandler } from './connectionHandlerInstance';
export type { ConnectionRule, ConnectionMetadata, ConnectionContext, ComponentCapabilities } from './types';

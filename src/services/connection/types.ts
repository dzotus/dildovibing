import { CanvasNode, CanvasConnection, ComponentConfig } from '@/types';

/**
 * Метаданные для связи между компонентами
 */
export interface ConnectionMetadata {
  protocol?: 'rest' | 'graphql' | 'soap' | 'grpc' | 'websocket' | 'webhook' | 'http' | 'tcp' | 'udp' | 'kafka' | 'rabbitmq' | 'async' | 'sync';
  sourcePort?: number;
  targetPort?: number;
  sourceHost?: string;
  targetHost?: string;
  path?: string;
  endpoint?: string; // Полный endpoint (host:port)
}

/**
 * Контекст для обновления конфига
 */
export interface ConnectionContext {
  sourceNode: CanvasNode;
  targetNode: CanvasNode;
  connection: CanvasConnection;
  metadata: ConnectionMetadata;
}

/**
 * Правило подключения компонентов
 */
export interface ConnectionRule {
  // Тип компонента, который может быть источником
  sourceType: string | '*';
  
  // Типы компонентов, которые могут быть целями (или '*' для любых)
  targetTypes: string[] | '*';
  
  // Функция обновления конфига источника
  updateSourceConfig: (
    source: CanvasNode,
    target: CanvasNode,
    connection: CanvasConnection,
    metadata: ConnectionMetadata
  ) => Partial<ComponentConfig> | null;
  
  // Функция обновления конфига цели (опционально)
  updateTargetConfig?: (
    source: CanvasNode,
    target: CanvasNode,
    connection: CanvasConnection,
    metadata: ConnectionMetadata
  ) => Partial<ComponentConfig> | null;
  
  // Функция cleanup для источника при удалении связи (опционально)
  cleanupSourceConfig?: (
    source: CanvasNode,
    target: CanvasNode,
    connection: CanvasConnection,
    metadata: ConnectionMetadata
  ) => Partial<ComponentConfig> | null;
  
  // Функция cleanup для цели при удалении связи (опционально)
  cleanupTargetConfig?: (
    source: CanvasNode,
    target: CanvasNode,
    connection: CanvasConnection,
    metadata: ConnectionMetadata
  ) => Partial<ComponentConfig> | null;
  
  // Функция извлечения метаданных для связи
  extractMetadata?: (
    source: CanvasNode,
    target: CanvasNode,
    connection: CanvasConnection
  ) => ConnectionMetadata;
  
  // Приоритет правила (если несколько правил подходят)
  priority?: number;
}

/**
 * Возможности компонента
 */
export interface ComponentCapabilities {
  // Основной порт для подключения
  defaultPort?: number;
  
  // Порты для метрик
  metricsPort?: number;
  metricsPath?: string;
  
  // Админ порт
  adminPort?: number;
  
  // Протоколы, которые поддерживает
  protocols?: ('http' | 'grpc' | 'tcp' | 'udp' | 'websocket' | 'kafka' | 'rabbitmq')[];
  
  // Функция для получения хоста компонента
  getHost?: (node: CanvasNode) => string;
  
  // Функция для получения порта компонента
  getPort?: (node: CanvasNode, purpose: 'main' | 'metrics' | 'admin') => number | undefined;
}

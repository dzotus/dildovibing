import { CanvasNode, CanvasConnection } from '@/types';
import { ConnectionRule, ConnectionMetadata } from '../types';
import { ServiceDiscovery } from '../ServiceDiscovery';

/**
 * Map component type to MuleSoft connector type
 */
function getConnectorType(componentType: string): 'database' | 'api' | 'file' | 'messaging' | 'custom' {
  const databaseTypes = ['postgres', 'mongodb', 'redis', 'cassandra', 'clickhouse', 'snowflake', 'elasticsearch'];
  const apiTypes = ['rest', 'grpc', 'graphql', 'soap', 'websocket', 'webhook'];
  const messagingTypes = ['kafka', 'rabbitmq', 'activemq', 'aws-sqs', 'azure-service-bus', 'gcp-pubsub'];
  const fileTypes = ['s3-datalake'];
  const businessTypes = ['crm', 'erp', 'payment-gateway'];
  
  if (databaseTypes.includes(componentType)) {
    return 'database';
  }
  if (apiTypes.includes(componentType)) {
    return 'api';
  }
  if (messagingTypes.includes(componentType)) {
    return 'messaging';
  }
  if (fileTypes.includes(componentType)) {
    return 'file';
  }
  if (businessTypes.includes(componentType)) {
    return 'api'; // Business apps use API connectors
  }
  
  return 'custom';
}

/**
 * Generate connector name from component
 */
function generateConnectorName(source: CanvasNode, target: CanvasNode, isSource: boolean): string {
  const componentName = isSource ? source.label || source.type : target.label || target.type;
  const componentId = isSource ? source.id.slice(0, 8) : target.id.slice(0, 8);
  return `${componentName}-${componentId}`.toLowerCase().replace(/\s+/g, '-');
}

/**
 * Правило для Component -> MuleSoft
 * Создает коннектор в MuleSoft при подключении компонента
 */
export function createMuleSoftTargetRule(discovery: ServiceDiscovery): ConnectionRule {
  return {
    sourceType: '*', // Любой компонент может подключаться к MuleSoft
    targetTypes: ['mulesoft'],
    priority: 5,
    
    updateTargetConfig: (source, mulesoft, connection, metadata) => {
      const mulesoftConfig = mulesoft.data.config || {};
      const connectors = mulesoftConfig.connectors || [];
      
      // Check if connector already exists for this source
      const existingConnector = connectors.find((conn: any) => 
        conn.targetComponentId === source.id || 
        conn.name === generateConnectorName(source, mulesoft, true)
      );
      
      if (existingConnector) {
        return null; // Connector already exists
      }
      
      // Create new connector
      const connectorType = getConnectorType(source.type);
      const connectorName = generateConnectorName(source, mulesoft, true);
      
      const newConnector = {
        name: connectorName,
        type: connectorType,
        enabled: true,
        config: {},
        targetComponentType: source.type,
        targetComponentId: source.id,
      };
      
      // Add connector-specific config based on component type
      if (connectorType === 'database' && metadata.targetHost && metadata.targetPort) {
        newConnector.config = {
          host: metadata.targetHost,
          port: metadata.targetPort,
        };
      } else if (connectorType === 'api' && metadata.targetHost && metadata.targetPort) {
        newConnector.config = {
          baseUrl: `http://${metadata.targetHost}:${metadata.targetPort}`,
        };
      } else if (connectorType === 'messaging') {
        newConnector.config = {
          broker: metadata.targetHost && metadata.targetPort 
            ? `${metadata.targetHost}:${metadata.targetPort}`
            : undefined,
        };
      }
      
      return {
        connectors: [...connectors, newConnector],
      };
    },
    
    extractMetadata: (source, mulesoft, connection) => {
      return discovery.getConnectionMetadata(source, mulesoft, connection);
    },
  };
}

/**
 * Правило для MuleSoft -> Component
 * Создает или использует коннектор в MuleSoft для подключения к компоненту
 */
export function createMuleSoftSourceRule(discovery: ServiceDiscovery): ConnectionRule {
  return {
    sourceType: 'mulesoft',
    targetTypes: '*', // MuleSoft может подключаться к любому компоненту
    priority: 5,
    
    updateSourceConfig: (mulesoft, target, connection, metadata) => {
      const mulesoftConfig = mulesoft.data.config || {};
      const connectors = mulesoftConfig.connectors || [];
      
      // Check if connector already exists for this target
      const existingConnector = connectors.find((conn: any) => 
        conn.targetComponentId === target.id || 
        conn.name === generateConnectorName(mulesoft, target, false)
      );
      
      if (existingConnector) {
        return null; // Connector already exists
      }
      
      // Create new connector
      const connectorType = getConnectorType(target.type);
      const connectorName = generateConnectorName(mulesoft, target, false);
      
      const newConnector = {
        name: connectorName,
        type: connectorType,
        enabled: true,
        config: {},
        targetComponentType: target.type,
        targetComponentId: target.id,
      };
      
      // Add connector-specific config based on target component type
      if (connectorType === 'database' && metadata.targetHost && metadata.targetPort) {
        newConnector.config = {
          host: metadata.targetHost,
          port: metadata.targetPort,
        };
      } else if (connectorType === 'api' && metadata.targetHost && metadata.targetPort) {
        newConnector.config = {
          baseUrl: `http://${metadata.targetHost}:${metadata.targetPort}`,
        };
      } else if (connectorType === 'messaging' && metadata.targetHost && metadata.targetPort) {
        newConnector.config = {
          broker: `${metadata.targetHost}:${metadata.targetPort}`,
        };
      }
      
      return {
        connectors: [...connectors, newConnector],
      };
    },
    
    extractMetadata: (mulesoft, target, connection) => {
      return discovery.getConnectionMetadata(mulesoft, target, connection);
    },
  };
}


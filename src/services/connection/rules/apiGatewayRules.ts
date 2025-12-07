import { CanvasNode, CanvasConnection } from '@/types';
import { ConnectionRule, ConnectionMetadata } from '../types';
import { ServiceDiscovery } from '../ServiceDiscovery';

/**
 * Правило для API Gateway -> Backend Service
 * Автоматически создает API endpoint в конфиге API Gateway
 */
export function createAPIGatewayRule(discovery: ServiceDiscovery): ConnectionRule {
  return {
    sourceType: 'api-gateway',
    targetTypes: ['rest', 'grpc', 'graphql', 'websocket', 'soap', 'webhook'],
    priority: 10,
    
    updateSourceConfig: (gateway, target, connection, metadata) => {
      if (!metadata.targetHost || !metadata.targetPort) {
        return null;
      }

      const config = gateway.data.config || {};
      const apis = config.apis || [];
      
      // Проверяем, есть ли уже API для этого компонента
      const existingAPI = apis.find((api: any) => 
        api.backendUrl === `http://${metadata.targetHost}:${metadata.targetPort}` ||
        api.backendUrl === `https://${metadata.targetHost}:${metadata.targetPort}`
      );

      if (existingAPI) {
        return null; // API уже существует
      }

      // Создаем новый API endpoint
      const targetLabel = target.data.label || target.type;
      const apiName = `${targetLabel}-api`;
      const apiPath = `/api/${target.type}`;
      
      // Определяем метод на основе типа компонента
      let method = 'GET';
      if (target.type === 'grpc') {
        method = 'POST'; // gRPC обычно через POST
      } else if (target.type === 'websocket') {
        method = 'GET'; // WebSocket upgrade
      }

      // Определяем протокол
      const protocol = metadata.protocol === 'grpc' ? 'http' : 'http';
      const backendUrl = `${protocol}://${metadata.targetHost}:${metadata.targetPort}`;

      const newAPI = {
        name: apiName,
        path: apiPath,
        method: method,
        backendUrl: backendUrl,
        enabled: true,
        requests: 0,
        errors: 0,
      };

      return {
        apis: [...apis, newAPI],
      };
    },
    
    extractMetadata: (gateway, target, connection) => {
      return discovery.getConnectionMetadata(gateway, target, connection);
    },
  };
}

import { CanvasNode, CanvasConnection } from '@/types';
import { ConnectionRule, ConnectionMetadata } from '../types';
import { ServiceDiscovery } from '../ServiceDiscovery';
import type { API } from '@/core/api-gateway/types';

/**
 * Правило для API Gateway -> Backend Service
 * Автоматически создает API endpoint в конфиге API Gateway
 */
export function createAPIGatewayRule(discovery: ServiceDiscovery): ConnectionRule {
  return {
    sourceType: 'api-gateway',
    targetTypes: '*', // API Gateway can connect to any service, protocol is determined from connection
    priority: 10,
    
    updateSourceConfig: (gateway, target, connection, metadata) => {
      if (!metadata.targetHost || !metadata.targetPort) {
        return null;
      }

      const config = gateway.data.config || {};
      const apis: API[] = (config.apis || []) as API[];
      
      // Determine protocol from connection (not from target type)
      const connectionProtocol = connection.type || connection.data?.protocol || metadata.protocol || 'http';
      const protocol = (connectionProtocol === 'grpc' || connectionProtocol === 'gRPC') ? 'http' : 'http';
      const backendUrl = `${protocol}://${metadata.targetHost}:${metadata.targetPort}`;
      const backendUrlHttps = `https://${metadata.targetHost}:${metadata.targetPort}`;
      
      // Check if API already exists for this component (support both formats: backendUrl and backend)
      const existingAPI = apis.find((api: any) => 
        api.backendUrl === backendUrl ||
        api.backendUrl === backendUrlHttps ||
        api.backend === backendUrl || // Backward compatibility
        api.backend === backendUrlHttps
      );

      if (existingAPI) {
        return null; // API already exists
      }

      // Create new API endpoint
      const targetLabel = target.data.label || target.type;
      const apiName = `${targetLabel}-api`;
      const apiPath = `/api/${target.type}`;
      
      // Determine method based on connection protocol (not target type)
      let method: API['method'] = 'GET';
      if (connectionProtocol === 'grpc' || connectionProtocol === 'gRPC') {
        method = 'POST'; // gRPC usually via POST
      } else if (connectionProtocol === 'websocket' || connectionProtocol === 'WebSocket') {
        method = 'GET'; // WebSocket upgrade
      }

      const newAPI: API = {
        id: `api-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: apiName,
        path: apiPath,
        method: method,
        backendUrl: backendUrl,
        enabled: true,
        requests: 0,
        errors: 0,
        providerMetadata: {},
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

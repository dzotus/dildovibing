import { CanvasNode, CanvasConnection } from '@/types';
import { ConnectionRule, ConnectionMetadata } from '../types';
import { ServiceDiscovery } from '../ServiceDiscovery';

/**
 * Правило для Kong Gateway -> Backend Service
 * Автоматически создает Service и Route в конфиге Kong Gateway
 */
export function createKongRule(discovery: ServiceDiscovery): ConnectionRule {
  return {
    sourceType: 'kong',
    targetTypes: '*', // Kong can connect to any service, protocol is determined from connection
    priority: 10,
    
    updateSourceConfig: (kong, target, connection, metadata) => {
      if (!metadata.targetHost || !metadata.targetPort) {
        return null;
      }

      const config = kong.data.config || {};
      const services = config.services || [];
      const routes = config.routes || [];
      
      // Determine protocol from connection (not from target type)
      const connectionProtocol = connection.type || connection.data?.protocol || metadata.protocol || 'http';
      const protocol = (connectionProtocol === 'grpc' || connectionProtocol === 'gRPC') ? 'http' : 'http';
      const targetUrl = `${protocol}://${metadata.targetHost}:${metadata.targetPort}`;
      
      // Check if Service already exists for this component
      const targetLabel = target.data.label || target.type;
      const serviceName = `${targetLabel}-service`;
      
      let existingService = services.find((s: any) => 
        s.name === serviceName || s.url === targetUrl
      );

      if (!existingService) {
        // Create new Service
        existingService = {
          id: String(services.length + 1),
          name: serviceName,
          url: targetUrl,
          routes: 0,
          enabled: true,
        };
        services.push(existingService);
      }

      // Check if Route already exists for this connection
      const routePath = `/api/${target.type}`;
      const existingRoute = routes.find((r: any) => 
        r.service === existingService.name && 
        r.path === routePath
      );

      if (existingRoute) {
        return null; // Route already exists
      }

      // Determine method based on connection protocol (not target type)
      let method = 'GET';
      if (connectionProtocol === 'grpc' || connectionProtocol === 'gRPC') {
        method = 'POST'; // gRPC usually via POST
      } else if (connectionProtocol === 'websocket' || connectionProtocol === 'WebSocket') {
        method = 'GET'; // WebSocket upgrade
      } else if (connectionProtocol === 'rest' || connectionProtocol === 'graphql' || connectionProtocol === 'http') {
        method = 'GET'; // Default for REST/GraphQL
      }

      // Создаем новый Route
      const newRoute = {
        id: String(routes.length + 1),
        path: routePath,
        method: method,
        service: existingService.name,
        stripPath: true,
        protocols: ['http', 'https'],
      };

      // Обновляем счетчик routes в service
      existingService.routes = (existingService.routes || 0) + 1;

      return {
        services: services,
        routes: [...routes, newRoute],
      };
    },
    
    extractMetadata: (kong, target, connection) => {
      return discovery.getConnectionMetadata(kong, target, connection);
    },
  };
}


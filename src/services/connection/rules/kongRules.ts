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
    targetTypes: ['rest', 'grpc', 'graphql', 'websocket', 'soap', 'webhook'],
    priority: 10,
    
    updateSourceConfig: (kong, target, connection, metadata) => {
      if (!metadata.targetHost || !metadata.targetPort) {
        return null;
      }

      const config = kong.data.config || {};
      const services = config.services || [];
      const routes = config.routes || [];
      
      // Определяем URL целевого сервиса
      const protocol = metadata.protocol === 'grpc' ? 'http' : 'http';
      const targetUrl = `${protocol}://${metadata.targetHost}:${metadata.targetPort}`;
      
      // Проверяем, есть ли уже Service для этого компонента
      const targetLabel = target.data.label || target.type;
      const serviceName = `${targetLabel}-service`;
      
      let existingService = services.find((s: any) => 
        s.name === serviceName || s.url === targetUrl
      );

      if (!existingService) {
        // Создаем новый Service
        existingService = {
          id: String(services.length + 1),
          name: serviceName,
          url: targetUrl,
          routes: 0,
          enabled: true,
        };
        services.push(existingService);
      }

      // Проверяем, есть ли уже Route для этого соединения
      const routePath = `/api/${target.type}`;
      const existingRoute = routes.find((r: any) => 
        r.service === existingService.name && 
        r.path === routePath
      );

      if (existingRoute) {
        return null; // Route уже существует
      }

      // Определяем метод на основе типа компонента
      let method = 'GET';
      if (target.type === 'grpc') {
        method = 'POST'; // gRPC обычно через POST
      } else if (target.type === 'websocket') {
        method = 'GET'; // WebSocket upgrade
      } else if (target.type === 'rest' || target.type === 'graphql') {
        method = 'GET'; // Default для REST/GraphQL
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


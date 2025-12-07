import { CanvasNode, CanvasConnection } from '@/types';
import { ConnectionRule, ConnectionMetadata } from '../types';
import { ServiceDiscovery } from '../ServiceDiscovery';

/**
 * Правило для Service Mesh -> Service
 * Автоматически добавляет сервис в mesh
 */
export function createServiceMeshRule(discovery: ServiceDiscovery): ConnectionRule {
  return {
    sourceType: 'service-mesh',
    targetTypes: '*', // Service Mesh может подключать любые сервисы
    priority: 10,
    
    updateSourceConfig: (mesh, target, connection, metadata) => {
      if (!metadata.targetHost || !metadata.targetPort) {
        return null;
      }

      const config = mesh.data.config || {};
      const services = config.services || [];
      
      // Проверяем, есть ли уже сервис в mesh
      const existingService = services.find((service: any) => 
        service.host === metadata.targetHost && service.port === metadata.targetPort
      );

      if (existingService) {
        return null; // Сервис уже в mesh
      }

      // Добавляем сервис в mesh
      const targetLabel = target.data.label || target.type;
      const serviceName = targetLabel.toLowerCase().replace(/\s+/g, '-');
      
      // Определяем протокол
      let protocol = 'http';
      if (metadata.protocol === 'grpc') {
        protocol = 'grpc';
      } else if (target.type === 'postgres' || target.type === 'mongodb' || target.type === 'redis') {
        protocol = 'tcp';
      }

      const newService = {
        name: serviceName,
        namespace: 'default',
        host: metadata.targetHost,
        port: metadata.targetPort,
        protocol: protocol,
        enabled: true,
      };

      return {
        services: [...services, newService],
      };
    },
    
    extractMetadata: (mesh, target, connection) => {
      return discovery.getConnectionMetadata(mesh, target, connection);
    },
  };
}

/**
 * Правило для Istio -> Service (аналогично Service Mesh)
 */
export function createIstioRule(discovery: ServiceDiscovery): ConnectionRule {
  return {
    sourceType: 'istio',
    targetTypes: '*',
    priority: 10,
    
    updateSourceConfig: (istio, target, connection, metadata) => {
      if (!metadata.targetHost || !metadata.targetPort) {
        return null;
      }

      const config = istio.data.config || {};
      const services = config.services || [];
      
      const existingService = services.find((service: any) => 
        service.host === metadata.targetHost && service.port === metadata.targetPort
      );

      if (existingService) {
        return null;
      }

      const targetLabel = target.data.label || target.type;
      const serviceName = targetLabel.toLowerCase().replace(/\s+/g, '-');
      
      let protocol = 'http';
      if (metadata.protocol === 'grpc') {
        protocol = 'grpc';
      } else if (target.type === 'postgres' || target.type === 'mongodb' || target.type === 'redis') {
        protocol = 'tcp';
      }

      const newService = {
        name: serviceName,
        namespace: 'default',
        host: metadata.targetHost,
        port: metadata.targetPort,
        protocol: protocol,
        enabled: true,
      };

      return {
        services: [...services, newService],
      };
    },
    
    extractMetadata: (istio, target, connection) => {
      return discovery.getConnectionMetadata(istio, target, connection);
    },
  };
}

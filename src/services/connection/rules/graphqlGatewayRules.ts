import { CanvasNode, CanvasConnection } from '@/types';
import { ConnectionRule, ConnectionMetadata } from '../types';
import { ServiceDiscovery } from '../ServiceDiscovery';

/**
 * Rule: GraphQL Gateway -> GraphQL Service
 * Automatically registers backend service in gateway config when connected.
 */
export function createGraphQLGatewayRule(discovery: ServiceDiscovery): ConnectionRule {
  return {
    sourceType: 'graphql-gateway',
    targetTypes: ['graphql'],
    priority: 10,

    updateSourceConfig: (gateway: CanvasNode, target: CanvasNode, _connection: CanvasConnection, metadata: ConnectionMetadata) => {
      if (!metadata.targetHost || !metadata.targetPort) return null;

      const config = gateway.data.config || {};
      const services = config.services || [];

      const endpoint = `http://${metadata.targetHost}:${metadata.targetPort}/graphql`;
      const existing = services.find((svc: any) => svc.endpoint === endpoint || svc.name === target.data.label);
      if (existing) return null;

      const serviceName = target.data.label || target.type;
      const newService = {
        id: `svc-${services.length + 1}`,
        name: serviceName,
        endpoint,
        status: 'connected',
        requests: 0,
        errors: 0,
      };

      return { services: [...services, newService] };
    },

    extractMetadata: (gateway, target, connection) => {
      return discovery.getConnectionMetadata(gateway, target, connection);
    },
  };
}


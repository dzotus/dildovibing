import { CanvasNode, CanvasConnection } from '@/types';
import { ConnectionRule, ConnectionMetadata } from '../types';
import { ServiceDiscovery } from '../ServiceDiscovery';

/**
 * Rule: BFF Service -> Backend Service
 * Automatically adds backend to BFF config when connected.
 */
export function createBFFRule(discovery: ServiceDiscovery): ConnectionRule {
  return {
    sourceType: 'bff-service',
    targetTypes: '*', // BFF can connect to any service, protocol is determined from connection
    priority: 10,

    updateSourceConfig: (bff: CanvasNode, target: CanvasNode, connection: CanvasConnection, metadata: ConnectionMetadata) => {
      if (!metadata.targetHost || !metadata.targetPort) return null;

      const config = bff.data.config || {};
      const backends = config.backends || [];

      // Check if backend already exists
      const targetLabel = target.data.label || target.type;
      const existing = backends.find((b: any) => 
        b.name === targetLabel || 
        b.endpoint === `http://${metadata.targetHost}:${metadata.targetPort}` ||
        b.id === target.id
      );
      
      if (existing) return null;

      // Determine protocol from connection (not from target type)
      // Priority: connection.type > connection.data.protocol > metadata.protocol > 'http'
      let protocol: 'http' | 'grpc' | 'graphql' = 'http';
      const connectionProtocol = connection.type || connection.data?.protocol || metadata.protocol;
      
      if (connectionProtocol === 'grpc' || connectionProtocol === 'gRPC') {
        protocol = 'grpc';
      } else if (connectionProtocol === 'graphql' || connectionProtocol === 'GraphQL') {
        protocol = 'graphql';
      } else if (connectionProtocol === 'rest' || connectionProtocol === 'http') {
        protocol = 'http';
      }

      // Create new backend
      const newBackend = {
        id: target.id || `backend-${Date.now()}`,
        name: targetLabel,
        endpoint: `http://${metadata.targetHost}:${metadata.targetPort}`,
        protocol,
        status: 'connected' as const,
        timeout: 5000,
        retries: 3,
        retryBackoff: 'exponential' as const,
        circuitBreaker: {
          enabled: true,
          failureThreshold: 5,
          successThreshold: 2,
          timeout: 60000,
        },
      };

      return { backends: [...backends, newBackend] };
    },

    extractMetadata: (bff, target, connection) => {
      return discovery.getConnectionMetadata(bff, target, connection);
    },
  };
}


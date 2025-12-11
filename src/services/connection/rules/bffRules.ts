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
    targetTypes: ['rest', 'grpc', 'graphql', 'websocket', 'soap', 'webhook'],
    priority: 10,

    updateSourceConfig: (bff: CanvasNode, target: CanvasNode, _connection: CanvasConnection, metadata: ConnectionMetadata) => {
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

      // Determine protocol based on target type
      let protocol: 'http' | 'grpc' | 'graphql' = 'http';
      if (target.type === 'grpc') {
        protocol = 'grpc';
      } else if (target.type === 'graphql') {
        protocol = 'graphql';
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


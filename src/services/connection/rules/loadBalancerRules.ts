import { CanvasNode, CanvasConnection } from '@/types';
import { ConnectionRule, ConnectionMetadata } from '../types';
import { ServiceDiscovery } from '../ServiceDiscovery';

/**
 * Правило для NGINX -> Backend
 * Автоматически добавляет upstream server в конфиг NGINX
 */
export function createNginxRule(discovery: ServiceDiscovery): ConnectionRule {
  return {
    sourceType: 'nginx',
    targetTypes: [
      'rest', 'grpc', 'graphql', 'websocket',
      'postgres', 'mongodb', 'redis',
      'crm', 'erp', 'payment-gateway',
    ],
    priority: 10,
    
    updateSourceConfig: (nginx, target, connection, metadata) => {
      if (!metadata.targetHost || !metadata.targetPort) {
        return null;
      }

      const config = nginx.data.config || {};
      const upstreams = config.upstreams || [];
      
      // Создаем имя upstream на основе типа целевого компонента
      const upstreamName = `${target.type}-upstream`;
      
      // Ищем существующий upstream
      let existingUpstream = upstreams.find((up: any) => up.name === upstreamName);
      
      if (existingUpstream) {
        // Проверяем, есть ли уже такой server
        const serverExists = existingUpstream.servers?.some((server: any) => 
          (server.host === metadata.targetHost || server.address === `${metadata.targetHost}:${metadata.targetPort}`) &&
          (server.port === metadata.targetPort || server.address?.includes(`:${metadata.targetPort}`))
        );
        
        if (serverExists) {
          return null; // Server уже есть
        }
        
        // Добавляем server в существующий upstream
        return {
          upstreams: upstreams.map((up: any) => 
            up.name === upstreamName
              ? {
                  ...up,
                  servers: [
                    ...(up.servers || []),
                    { host: metadata.targetHost, port: metadata.targetPort },
                  ],
                }
              : up
          ),
        };
      }

      // Создаем новый upstream
      const newUpstream = {
        name: upstreamName,
        servers: [
          { host: metadata.targetHost, port: metadata.targetPort },
        ],
        loadBalancing: 'round-robin',
      };

      return {
        upstreams: [...upstreams, newUpstream],
      };
    },
    
    extractMetadata: (nginx, target, connection) => {
      return discovery.getConnectionMetadata(nginx, target, connection);
    },
  };
}

/**
 * Правило для HAProxy -> Backend
 * Автоматически добавляет backend server в конфиг HAProxy
 */
export function createHAProxyRule(discovery: ServiceDiscovery): ConnectionRule {
  return {
    sourceType: 'haproxy',
    targetTypes: [
      'rest', 'grpc', 'graphql', 'websocket',
      'postgres', 'mongodb', 'redis',
      'crm', 'erp', 'payment-gateway',
    ],
    priority: 10,
    
    updateSourceConfig: (haproxy, target, connection, metadata) => {
      if (!metadata.targetHost || !metadata.targetPort) {
        return null;
      }

      const config = haproxy.data.config || {};
      const backends = config.backends || [];
      
      const backendName = `${target.type}-backend`;
      
      let existingBackend = backends.find((be: any) => be.name === backendName);
      
      if (existingBackend) {
        const serverExists = existingBackend.servers?.some((server: any) => 
          (server.host === metadata.targetHost || server.address === `${metadata.targetHost}:${metadata.targetPort}`) &&
          (server.port === metadata.targetPort || server.address?.includes(`:${metadata.targetPort}`))
        );
        
        if (serverExists) {
          return null;
        }
        
        return {
          backends: backends.map((be: any) => 
            be.name === backendName
              ? {
                  ...be,
                  servers: [
                    ...(be.servers || []),
                    { host: metadata.targetHost, port: metadata.targetPort },
                  ],
                }
              : be
          ),
        };
      }

      const newBackend = {
        name: backendName,
        servers: [
          { host: metadata.targetHost, port: metadata.targetPort },
        ],
        balance: 'roundrobin',
      };

      return {
        backends: [...backends, newBackend],
      };
    },
    
    extractMetadata: (haproxy, target, connection) => {
      return discovery.getConnectionMetadata(haproxy, target, connection);
    },
  };
}

/**
 * Правило для Traefik -> Backend
 * Автоматически добавляет service в конфиг Traefik
 */
export function createTraefikRule(discovery: ServiceDiscovery): ConnectionRule {
  return {
    sourceType: 'traefik',
    targetTypes: [
      'rest', 'grpc', 'graphql', 'websocket',
      'postgres', 'mongodb', 'redis',
      'crm', 'erp', 'payment-gateway',
    ],
    priority: 10,
    
    updateSourceConfig: (traefik, target, connection, metadata) => {
      if (!metadata.targetHost || !metadata.targetPort) {
        return null;
      }

      const config = traefik.data.config || {};
      const services = config.services || {};
      const routers = config.routers || {};
      
      const serviceName = `${target.type}-service`;
      const routerName = `${target.type}-router`;
      
      // Проверяем, есть ли уже service
      if (services[serviceName]) {
        const serverExists = services[serviceName].servers?.some((server: any) => 
          server.url === `http://${metadata.targetHost}:${metadata.targetPort}`
        );
        
        if (serverExists) {
          return null;
        }
        
        // Добавляем server в существующий service
        return {
          services: {
            ...services,
            [serviceName]: {
              ...services[serviceName],
              servers: [
                ...(services[serviceName].servers || []),
                { url: `http://${metadata.targetHost}:${metadata.targetPort}` },
              ],
            },
          },
        };
      }

      // Создаем новый service и router
      const targetLabel = target.data.label || target.type;
      const rule = `Host(\`${targetLabel.toLowerCase()}.local\`)`;

      return {
        services: {
          ...services,
          [serviceName]: {
            loadBalancer: {
              servers: [
                { url: `http://${metadata.targetHost}:${metadata.targetPort}` },
              ],
            },
          },
        },
        routers: {
          ...routers,
          [routerName]: {
            rule: rule,
            service: serviceName,
          },
        },
      };
    },
    
    extractMetadata: (traefik, target, connection) => {
      return discovery.getConnectionMetadata(traefik, target, connection);
    },
  };
}

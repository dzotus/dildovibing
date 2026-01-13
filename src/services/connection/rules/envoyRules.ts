import { CanvasNode, CanvasConnection } from '@/types';
import { ConnectionRule, ConnectionMetadata } from '../types';
import { ServiceDiscovery } from '../ServiceDiscovery';

/**
 * Правило для Envoy Proxy -> Backend Service
 * Автоматически добавляет cluster в конфиг Envoy при подключении к сервису
 */
export function createEnvoyRule(discovery: ServiceDiscovery): ConnectionRule {
  return {
    sourceType: 'envoy',
    targetTypes: [
      'rest', 'grpc', 'graphql', 'websocket', 'soap', 'webhook',
      'postgres', 'mongodb', 'redis', 'cassandra', 'clickhouse',
      'crm', 'erp', 'payment-gateway',
    ],
    priority: 10,
    
    updateSourceConfig: (envoy, target, connection, metadata) => {
      if (!metadata.targetHost || !metadata.targetPort) {
        return null;
      }

      const config = envoy.data.config || {};
      const clusters = config.clusters || [];
      
      // Проверяем, есть ли уже cluster для этого компонента
      const existingCluster = clusters.find((cluster: any) => {
        if (!cluster.hosts || !Array.isArray(cluster.hosts)) return false;
        return cluster.hosts.some((host: any) => 
          host.address === metadata.targetHost && host.port === metadata.targetPort
        );
      });

      if (existingCluster) {
        // Обновляем существующий cluster - добавляем хост, если его еще нет
        const hostExists = existingCluster.hosts.some((host: any) => 
          host.address === metadata.targetHost && host.port === metadata.targetPort
        );
        
        if (!hostExists) {
          return {
            clusters: clusters.map((cluster: any) => 
              cluster === existingCluster
                ? {
                    ...cluster,
                    hosts: [
                      ...(cluster.hosts || []),
                      { address: metadata.targetHost, port: metadata.targetPort },
                    ],
                  }
                : cluster
            ),
          };
        }
        return null; // Хост уже есть, ничего не обновляем
      }

      // Создаем новый cluster
      const targetLabel = target.data.label || target.type;
      const clusterName = `${target.type}-${target.id.slice(0, 8)}-cluster`;
      
      // Определяем тип cluster на основе протокола
      let clusterType = 'STRICT_DNS';
      if (metadata.protocol === 'grpc') {
        clusterType = 'STRICT_DNS';
      } else if (target.type === 'postgres' || target.type === 'mongodb' || target.type === 'redis') {
        clusterType = 'STATIC_DNS';
      }

      const newCluster = {
        name: clusterName,
        type: clusterType,
        hosts: [{ address: metadata.targetHost, port: metadata.targetPort }],
        healthChecks: true,
        connectTimeout: 5000,
        requests: 0,
        errors: 0,
      };

      return {
        clusters: [...clusters, newCluster],
        totalClusters: clusters.length + 1,
      };
    },
    
    extractMetadata: (envoy, target, connection) => {
      return discovery.getConnectionMetadata(envoy, target, connection);
    },
  };
}

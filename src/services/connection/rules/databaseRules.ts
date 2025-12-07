import { CanvasNode, CanvasConnection } from '@/types';
import { ConnectionRule, ConnectionMetadata } from '../types';
import { ServiceDiscovery } from '../ServiceDiscovery';

/**
 * Правило для Database Client -> Database
 * Обновляет connection string в клиенте при подключении к БД
 */
export function createDatabaseClientRule(discovery: ServiceDiscovery): ConnectionRule {
  return {
    sourceType: '*', // Любой компонент может подключаться к БД
    targetTypes: ['postgres', 'mongodb', 'redis', 'cassandra', 'clickhouse', 'elasticsearch'],
    priority: 5,
    
    updateSourceConfig: (client, database, connection, metadata) => {
      if (!metadata.targetHost || !metadata.targetPort) {
        return null;
      }

      const config = client.data.config || {};
      
      // Обновляем connection string в зависимости от типа БД
      const dbType = database.type;
      let connectionConfig: any = {};
      
      switch (dbType) {
        case 'postgres':
          connectionConfig = {
            database: {
              host: metadata.targetHost,
              port: metadata.targetPort,
              database: config.database?.database || 'postgres',
              username: config.database?.username || 'postgres',
              password: config.database?.password || '',
            },
          };
          break;
        
        case 'mongodb':
          connectionConfig = {
            database: {
              connectionString: `mongodb://${metadata.targetHost}:${metadata.targetPort}`,
              database: config.database?.database || 'admin',
            },
          };
          break;
        
        case 'redis':
          connectionConfig = {
            database: {
              host: metadata.targetHost,
              port: metadata.targetPort,
              password: config.database?.password || '',
            },
          };
          break;
        
        case 'cassandra':
          connectionConfig = {
            database: {
              hosts: [`${metadata.targetHost}:${metadata.targetPort}`],
              keyspace: config.database?.keyspace || 'system',
            },
          };
          break;
        
        case 'clickhouse':
          connectionConfig = {
            database: {
              host: metadata.targetHost,
              port: metadata.targetPort,
              database: config.database?.database || 'default',
            },
          };
          break;
        
        case 'elasticsearch':
          connectionConfig = {
            database: {
              hosts: [`http://${metadata.targetHost}:${metadata.targetPort}`],
            },
          };
          break;
        
        default:
          return null;
      }
      
      return connectionConfig;
    },
    
    extractMetadata: (client, database, connection) => {
      return discovery.getConnectionMetadata(client, database, connection);
    },
  };
}

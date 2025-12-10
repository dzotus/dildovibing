import { CanvasNode, CanvasConnection } from '@/types';
import { ConnectionRule, ConnectionMetadata } from '../types';
import { ServiceDiscovery } from '../ServiceDiscovery';

/**
 * Правило для Messaging Producer -> Message Queue
 * Обновляет broker/topic конфиг в producer при подключении к очереди
 */
export function createMessagingProducerRule(discovery: ServiceDiscovery): ConnectionRule {
  return {
    sourceType: '*', // Любой компонент может отправлять сообщения
    targetTypes: ['kafka', 'rabbitmq', 'activemq', 'aws-sqs', 'azure-service-bus', 'gcp-pubsub'],
    priority: 5,
    
    updateSourceConfig: (producer, queue, connection, metadata) => {
      if (!metadata.targetHost || !metadata.targetPort) {
        return null;
      }

      const config = producer.data.config || {};
      const queueType = queue.type;
      
      let messagingConfig: any = {};
      
      switch (queueType) {
        case 'kafka':
          messagingConfig = {
            messaging: {
              broker: `${metadata.targetHost}:${metadata.targetPort}`,
              topic: config.messaging?.topic || queue.data.config?.defaultTopic || 'default-topic',
              producerId: config.messaging?.producerId || producer.id.slice(0, 8),
            },
          };
          break;
        
        case 'rabbitmq':
          messagingConfig = {
            messaging: {
              broker: `${metadata.targetHost}:${metadata.targetPort}`,
              exchange: config.messaging?.exchange || queue.data.config?.defaultExchange || 'amq.topic',
              routingKey: config.messaging?.routingKey || 'default',
            },
          };
          break;
        
        case 'activemq':
          // Get first queue from ActiveMQ config if available, otherwise use default
          const activeMQQueues = queue.data.config?.queues || [];
          const defaultQueueName = activeMQQueues.length > 0 && typeof activeMQQueues[0] === 'object' 
            ? activeMQQueues[0].name 
            : (activeMQQueues.length > 0 ? activeMQQueues[0] : null);
          
          messagingConfig = {
            messaging: {
              broker: `${metadata.targetHost}:${metadata.targetPort}`,
              queue: config.messaging?.queue || defaultQueueName || 'default-queue',
            },
          };
          break;
        
        case 'aws-sqs': {
          // Get first queue from SQS config if available, otherwise use default
          const sqsQueues = queue.data.config?.queues || [];
          const sqsQueueName = sqsQueues.length > 0 && typeof sqsQueues[0] === 'object' 
            ? sqsQueues[0].name 
            : (sqsQueues.length > 0 ? sqsQueues[0] : null);
          const queueRegion = sqsQueues.length > 0 && typeof sqsQueues[0] === 'object'
            ? sqsQueues[0].region
            : (queue.data.config?.defaultRegion || 'us-east-1');
          
          messagingConfig = {
            messaging: {
              queueUrl: `https://sqs.${queueRegion}.amazonaws.com/account/${sqsQueueName || 'default-queue'}`,
              queueName: sqsQueueName || 'default-queue',
              region: config.messaging?.region || queueRegion,
            },
          };
          break;
        }
        
        case 'azure-service-bus': {
          // Get Azure Service Bus configuration
          const serviceBusConfig = queue.data.config || {};
          const namespace = serviceBusConfig.namespace || 'archiphoenix.servicebus.windows.net';
          const connectionString = serviceBusConfig.connectionString || 
            `Endpoint=sb://${namespace}/;SharedAccessKeyName=RootManageSharedAccessKey;SharedAccessKey=...`;
          
          // Determine entity type (queue or topic)
          const entityType = config.messaging?.entityType || 
                           serviceBusConfig.entityType || 
                           'queue';
          
          const entityName = config.messaging?.entityName || 
                            config.messaging?.queue || 
                            config.messaging?.topic ||
                            serviceBusConfig.entityName || 
                            (entityType === 'queue' ? 'events' : 'events-topic');
          
          const subscriptionName = config.messaging?.subscriptionName || 
                                  serviceBusConfig.subscriptionName;
          
          // Build connection string from namespace if not provided
          const finalConnectionString = serviceBusConfig.connectionString || 
            `Endpoint=sb://${namespace}/;SharedAccessKeyName=RootManageSharedAccessKey;SharedAccessKey=...`;
          
          messagingConfig = {
            messaging: {
              connectionString: finalConnectionString,
              namespace: namespace,
              entityType: entityType,
              queue: entityType === 'queue' ? entityName : undefined,
              topic: entityType === 'topic' ? entityName : undefined,
              subscriptionName: entityType === 'topic' && subscriptionName ? subscriptionName : undefined,
            },
          };
          break;
        }
        
        case 'gcp-pubsub':
          messagingConfig = {
            messaging: {
              projectId: config.messaging?.projectId || 'default-project',
              topic: config.messaging?.topic || queue.data.config?.defaultTopic || 'default-topic',
            },
          };
          break;
        
        default:
          return null;
      }
      
      return messagingConfig;
    },
    
    extractMetadata: (producer, queue, connection) => {
      return discovery.getConnectionMetadata(producer, queue, connection);
    },
  };
}

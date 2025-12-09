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
        
        case 'aws-sqs':
          messagingConfig = {
            messaging: {
              queueUrl: `https://sqs.region.amazonaws.com/account/${queue.data.config?.queueName || 'default-queue'}`,
              region: config.messaging?.region || 'us-east-1',
            },
          };
          break;
        
        case 'azure-service-bus':
          messagingConfig = {
            messaging: {
              connectionString: `Endpoint=sb://${metadata.targetHost}/;SharedAccessKeyName=...`,
              topic: config.messaging?.topic || queue.data.config?.defaultTopic || 'default-topic',
            },
          };
          break;
        
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

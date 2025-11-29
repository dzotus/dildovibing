import { KafkaConfig } from './KafkaConfig';
import { RabbitMQConfig } from './RabbitMQConfig';
import { DatabaseConfig } from './DatabaseConfig';
import { NginxConfig } from './NginxConfig';
import { ApiConfig } from './ApiConfig';
import { InfrastructureConfig } from './InfrastructureConfig';
import { MessagingConfig } from './messaging/MessagingConfig';
import { IntegrationConfig } from './integration/IntegrationConfig';
import type { ComponentType } from '@/types';

interface ComponentConfigRendererProps {
  componentId: string;
  componentType: ComponentType['type'];
}

export function ComponentConfigRenderer({ componentId, componentType }: ComponentConfigRendererProps) {
  switch (componentType) {
    case 'kafka':
      return <KafkaConfig componentId={componentId} />;
    case 'rabbitmq':
      return <RabbitMQConfig componentId={componentId} />;
    case 'postgres':
    case 'mongodb':
    case 'redis':
      return <DatabaseConfig componentId={componentId} />;
    case 'nginx':
      return <NginxConfig componentId={componentId} />;
    case 'rest':
    case 'grpc':
    case 'websocket':
      return <ApiConfig componentId={componentId} />;
    case 'docker':
    case 'kubernetes':
      return <InfrastructureConfig componentId={componentId} />;
    case 'activemq':
    case 'aws-sqs':
    case 'azure-service-bus':
    case 'gcp-pubsub':
      return <MessagingConfig componentId={componentId} componentType={componentType} />;
    case 'kong':
    case 'apigee':
    case 'mulesoft':
    case 'graphql-gateway':
    case 'bff-service':
    case 'webhook-relay':
      return <IntegrationConfig componentId={componentId} componentType={componentType} />;
    default:
      return (
        <div className="p-6 text-center text-muted-foreground">
          Configuration panel not available for this component type
        </div>
      );
  }
}

import { KafkaConfig } from './KafkaConfig';
import { RabbitMQConfig } from './RabbitMQConfig';
import { DatabaseConfig } from './DatabaseConfig';
import { ApiConfig } from './api/ApiConfig';
import { MessagingConfig } from './messaging/MessagingConfig';
import { IntegrationConfig } from './integration/IntegrationConfig';
import { DataConfig } from './data/DataConfig';
import { ObservabilityConfig } from './observability/ObservabilityConfig';
import { SecurityConfig } from './security/SecurityConfig';
import { DevopsConfig } from './devops/DevopsConfig';
import { InfrastructureConfig } from './infrastructure/InfrastructureConfig';
import { EdgeConfig } from './edge/EdgeConfig';
import { MLConfig } from './ml/MLConfig';
import { BusinessConfig } from './business/BusinessConfig';
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
    case 'cassandra':
    case 'clickhouse':
    case 'snowflake':
    case 'elasticsearch':
    case 's3-datalake':
      return <DataConfig componentId={componentId} componentType={componentType} />;
    case 'rest':
    case 'grpc':
    case 'graphql':
    case 'soap':
    case 'websocket':
    case 'webhook':
      return <ApiConfig componentId={componentId} componentType={componentType} />;
    case 'nginx':
    case 'docker':
    case 'kubernetes':
    case 'haproxy':
    case 'envoy':
    case 'traefik':
      return <InfrastructureConfig componentId={componentId} componentType={componentType} />;
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
    case 'prometheus':
    case 'grafana':
    case 'loki':
    case 'jaeger':
    case 'otel-collector':
    case 'pagerduty':
      return <ObservabilityConfig componentId={componentId} componentType={componentType} />;
    case 'keycloak':
    case 'waf':
    case 'firewall':
    case 'secrets-vault':
    case 'ids-ips':
      return <SecurityConfig componentId={componentId} componentType={componentType} />;
    case 'jenkins':
    case 'gitlab-ci':
    case 'argo-cd':
    case 'terraform':
    case 'ansible':
    case 'harbor':
      return <DevopsConfig componentId={componentId} componentType={componentType} />;
    case 'istio':
    case 'service-mesh':
    case 'api-gateway':
    case 'vpn':
    case 'cdn':
      return <EdgeConfig componentId={componentId} componentType={componentType} />;
    case 'spark':
    case 'tensorflow-serving':
    case 'pytorch-serve':
    case 'mlflow':
    case 'feature-store':
      return <MLConfig componentId={componentId} componentType={componentType} />;
    case 'crm':
    case 'erp':
    case 'payment-gateway':
    case 'bpmn-engine':
    case 'rpa-bot':
      return <BusinessConfig componentId={componentId} componentType={componentType} />;
    default:
      return (
        <div className="p-6 text-center text-muted-foreground">
          Configuration panel not available for this component type
        </div>
      );
  }
}

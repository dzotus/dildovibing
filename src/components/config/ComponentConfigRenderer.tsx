// Advanced configs - включены по одному для проверки
import { KafkaConfigAdvanced } from './KafkaConfigAdvanced';
import { RabbitMQConfigAdvanced } from './RabbitMQConfigAdvanced';
import { ActiveMQConfigAdvanced } from './messaging/ActiveMQConfigAdvanced';
import { AWSSQSConfigAdvanced } from './messaging/AWSSQSConfigAdvanced';
import { AzureServiceBusConfigAdvanced } from './messaging/AzureServiceBusConfigAdvanced';
import { GCPPubSubConfigAdvanced } from './messaging/GCPPubSubConfigAdvanced';
import { DatabaseConfigAdvanced } from './DatabaseConfigAdvanced';
import { PostgreSQLConfigAdvanced } from './data/PostgreSQLConfigAdvanced';
import { MongoDBConfigAdvanced } from './data/MongoDBConfigAdvanced';
import { RedisConfigAdvanced } from './data/RedisConfigAdvanced';
import { NginxConfigAdvanced } from './NginxConfigAdvanced';
import { DockerK8sConfigAdvanced } from './infrastructure/DockerK8sConfigAdvanced';
import { KongConfigAdvanced } from './integration/KongConfigAdvanced';
import { ApigeeConfigAdvanced } from './integration/ApigeeConfigAdvanced';
import { MuleSoftConfigAdvanced } from './integration/MuleSoftConfigAdvanced';
import { GraphQLGatewayConfigAdvanced } from './integration/GraphQLGatewayConfigAdvanced';
import { BFFServiceConfigAdvanced } from './integration/BFFServiceConfigAdvanced';
import { WebhookRelayConfigAdvanced } from './integration/WebhookRelayConfigAdvanced';
import { ElasticsearchConfigAdvanced } from './data/ElasticsearchConfigAdvanced';
import { CassandraConfigAdvanced } from './data/CassandraConfigAdvanced';
import { ClickHouseConfigAdvanced } from './data/ClickHouseConfigAdvanced';
import { SnowflakeConfigAdvanced } from './data/SnowflakeConfigAdvanced';
import { S3DataLakeConfigAdvanced } from './data/S3DataLakeConfigAdvanced';
import { GrafanaConfigAdvanced } from './observability/GrafanaConfigAdvanced';
import { PrometheusConfigAdvanced } from './observability/PrometheusConfigAdvanced';
import { LokiConfigAdvanced } from './observability/LokiConfigAdvanced';
import { JaegerConfigAdvanced } from './observability/JaegerConfigAdvanced';
import { OpenTelemetryCollectorConfigAdvanced } from './observability/OpenTelemetryCollectorConfigAdvanced';
import { PagerDutyConfigAdvanced } from './observability/PagerDutyConfigAdvanced';
import { KeycloakConfigAdvanced } from './security/KeycloakConfigAdvanced';
import { WAFConfigAdvanced } from './security/WAFConfigAdvanced';
import { SecretsVaultConfigAdvanced } from './security/SecretsVaultConfigAdvanced';
import { IDSIPSConfigAdvanced } from './security/IDSIPSConfigAdvanced';
import { FirewallConfigAdvanced } from './security/FirewallConfigAdvanced';
import { JenkinsConfigAdvanced } from './devops/JenkinsConfigAdvanced';
import { GitLabCIConfigAdvanced } from './devops/GitLabCIConfigAdvanced';
import { ArgoCDConfigAdvanced } from './devops/ArgoCDConfigAdvanced';
import { HarborConfigAdvanced } from './devops/HarborConfigAdvanced';
import { TerraformConfigAdvanced } from './devops/TerraformConfigAdvanced';
import { AnsibleConfigAdvanced } from './devops/AnsibleConfigAdvanced';
import { MLflowConfigAdvanced } from './ml/MLflowConfigAdvanced';
import { SparkConfigAdvanced } from './ml/SparkConfigAdvanced';
import { TensorFlowServingConfigAdvanced } from './ml/TensorFlowServingConfigAdvanced';
import { PyTorchServeConfigAdvanced } from './ml/PyTorchServeConfigAdvanced';
import { FeatureStoreConfigAdvanced } from './ml/FeatureStoreConfigAdvanced';

// Basic configs
import { RabbitMQConfig } from './RabbitMQConfig';
import { DatabaseConfig } from './DatabaseConfig';
import { NginxConfig } from './NginxConfig';
import { ApiConfig } from './ApiConfig';
import { RestApiConfigAdvanced } from './api/RestApiConfigAdvanced';
import { GraphQLConfigAdvanced } from './api/GraphQLConfigAdvanced';
import { GRPCConfigAdvanced } from './api/GRPCConfigAdvanced';
import { WebSocketConfigAdvanced } from './api/WebSocketConfigAdvanced';
import { SOAPConfigAdvanced } from './api/SOAPConfigAdvanced';
import { WebhookConfigAdvanced } from './api/WebhookConfigAdvanced';
import { InfrastructureConfig } from './InfrastructureConfig';
import { MessagingConfig } from './messaging/MessagingConfig';
import { IntegrationConfig } from './integration/IntegrationConfig';
import { DataConfig } from './data/DataConfig';
import { ObservabilityConfig } from './observability/ObservabilityConfig';
import { SecurityConfig } from './security/SecurityConfig';
import { DevopsConfig } from './devops/DevopsConfig';
import { InfrastructureConfigExtended } from './infrastructure/InfrastructureConfigExtended';
import { HAProxyConfigAdvanced } from './infrastructure/HAProxyConfigAdvanced';
import { TraefikConfigAdvanced } from './infrastructure/TraefikConfigAdvanced';
import { EnvoyConfigAdvanced } from './infrastructure/EnvoyConfigAdvanced';
import { EdgeConfig } from './edge/EdgeConfig';
import { IstioConfigAdvanced } from './edge/IstioConfigAdvanced';
import { ServiceMeshConfigAdvanced } from './edge/ServiceMeshConfigAdvanced';
import { APIGatewayConfigAdvanced } from './edge/APIGatewayConfigAdvanced';
import { VPNConfigAdvanced } from './edge/VPNConfigAdvanced';
import { CDNConfigAdvanced } from './edge/CDNConfigAdvanced';
import { ApiConfigExtended } from './api/ApiConfigExtended';
import { MLConfig } from './ml/MLConfig';
import { BusinessConfig } from './business/BusinessConfig';
import { PaymentGatewayConfigAdvanced } from './business/PaymentGatewayConfigAdvanced';
import { BPMNEngineConfigAdvanced } from './business/BPMNEngineConfigAdvanced';
import { CRMConfigAdvanced } from './business/CRMConfigAdvanced';
import { ERPConfigAdvanced } from './business/ERPConfigAdvanced';
import { RPABotConfigAdvanced } from './business/RPABotConfigAdvanced';
import type { ComponentType } from '@/types';

interface ComponentConfigRendererProps {
  componentId: string;
  componentType: ComponentType['type'];
}

export function ComponentConfigRenderer({ componentId, componentType }: ComponentConfigRendererProps) {
  switch (componentType) {
    case 'kafka':
      return <KafkaConfigAdvanced componentId={componentId} />;
    case 'rabbitmq':
      return <RabbitMQConfigAdvanced componentId={componentId} />;
    case 'postgres':
      return <PostgreSQLConfigAdvanced componentId={componentId} />;
    case 'mongodb':
      return <MongoDBConfigAdvanced componentId={componentId} />;
    case 'redis':
      return <RedisConfigAdvanced componentId={componentId} />;
    case 'elasticsearch':
      return <ElasticsearchConfigAdvanced componentId={componentId} />;
    case 'cassandra':
      return <CassandraConfigAdvanced componentId={componentId} />;
    case 'clickhouse':
      return <ClickHouseConfigAdvanced componentId={componentId} />;
    case 'snowflake':
      return <SnowflakeConfigAdvanced componentId={componentId} />;
    case 's3-datalake':
      return <S3DataLakeConfigAdvanced componentId={componentId} />;
    case 'nginx':
      return <NginxConfigAdvanced componentId={componentId} />;
    case 'rest':
      return <RestApiConfigAdvanced componentId={componentId} />;
    case 'grpc':
      return <GRPCConfigAdvanced componentId={componentId} />;
    case 'websocket':
      return <WebSocketConfigAdvanced componentId={componentId} />;
    case 'graphql':
      return <GraphQLConfigAdvanced componentId={componentId} />;
    case 'soap':
      return <SOAPConfigAdvanced componentId={componentId} />;
    case 'webhook':
      return <WebhookConfigAdvanced componentId={componentId} />;
    case 'docker':
    case 'kubernetes':
      return <DockerK8sConfigAdvanced componentId={componentId} />;
    case 'haproxy':
      return <HAProxyConfigAdvanced componentId={componentId} />;
    case 'traefik':
      return <TraefikConfigAdvanced componentId={componentId} />;
    case 'envoy':
      return <EnvoyConfigAdvanced componentId={componentId} />;
    case 'activemq':
      return <ActiveMQConfigAdvanced componentId={componentId} />;
    case 'aws-sqs':
      return <AWSSQSConfigAdvanced componentId={componentId} />;
    case 'azure-service-bus':
      return <AzureServiceBusConfigAdvanced componentId={componentId} />;
    case 'gcp-pubsub':
      return <GCPPubSubConfigAdvanced componentId={componentId} />;
    case 'kong':
      return <KongConfigAdvanced componentId={componentId} />;
    case 'apigee':
      return <ApigeeConfigAdvanced componentId={componentId} />;
    case 'mulesoft':
      return <MuleSoftConfigAdvanced componentId={componentId} />;
    case 'graphql-gateway':
      return <GraphQLGatewayConfigAdvanced componentId={componentId} />;
    case 'bff-service':
      return <BFFServiceConfigAdvanced componentId={componentId} />;
    case 'webhook-relay':
      return <WebhookRelayConfigAdvanced componentId={componentId} />;
    case 'prometheus':
      return <PrometheusConfigAdvanced componentId={componentId} />;
    case 'grafana':
      return <GrafanaConfigAdvanced componentId={componentId} />;
    case 'loki':
      return <LokiConfigAdvanced componentId={componentId} />;
    case 'jaeger':
      return <JaegerConfigAdvanced componentId={componentId} />;
    case 'otel-collector':
      return <OpenTelemetryCollectorConfigAdvanced componentId={componentId} />;
    case 'pagerduty':
      return <PagerDutyConfigAdvanced componentId={componentId} />;
    case 'keycloak':
      return <KeycloakConfigAdvanced componentId={componentId} />;
    case 'waf':
      return <WAFConfigAdvanced componentId={componentId} />;
    case 'firewall':
      return <FirewallConfigAdvanced componentId={componentId} />;
    case 'secrets-vault':
      return <SecretsVaultConfigAdvanced componentId={componentId} />;
    case 'ids-ips':
      return <IDSIPSConfigAdvanced componentId={componentId} />;
    case 'jenkins':
      return <JenkinsConfigAdvanced componentId={componentId} />;
    case 'gitlab-ci':
      return <GitLabCIConfigAdvanced componentId={componentId} />;
    case 'argo-cd':
      return <ArgoCDConfigAdvanced componentId={componentId} />;
    case 'terraform':
      return <TerraformConfigAdvanced componentId={componentId} />;
    case 'ansible':
      return <AnsibleConfigAdvanced componentId={componentId} />;
    case 'harbor':
      return <HarborConfigAdvanced componentId={componentId} />;
    case 'istio':
      return <IstioConfigAdvanced componentId={componentId} />;
    case 'service-mesh':
      return <ServiceMeshConfigAdvanced componentId={componentId} />;
    case 'api-gateway':
      return <APIGatewayConfigAdvanced componentId={componentId} />;
    case 'vpn':
      return <VPNConfigAdvanced componentId={componentId} />;
    case 'cdn':
      return <CDNConfigAdvanced componentId={componentId} />;
    case 'spark':
      return <SparkConfigAdvanced componentId={componentId} />;
    case 'tensorflow-serving':
      return <TensorFlowServingConfigAdvanced componentId={componentId} />;
    case 'pytorch-serve':
      return <PyTorchServeConfigAdvanced componentId={componentId} />;
    case 'feature-store':
      return <FeatureStoreConfigAdvanced componentId={componentId} />;
    case 'mlflow':
      return <MLflowConfigAdvanced componentId={componentId} />;
    case 'crm':
      return <CRMConfigAdvanced componentId={componentId} />;
    case 'erp':
      return <ERPConfigAdvanced componentId={componentId} />;
    case 'rpa-bot':
      return <RPABotConfigAdvanced componentId={componentId} />;
    case 'bpmn-engine':
      return <BPMNEngineConfigAdvanced componentId={componentId} />;
    case 'payment-gateway':
      return <PaymentGatewayConfigAdvanced componentId={componentId} />;
    default:
      return (
        <div className="p-6 text-center text-muted-foreground">
          Configuration panel not available for this component type
        </div>
      );
  }
}

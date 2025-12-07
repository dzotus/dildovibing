import { lazy, Suspense } from 'react';
import type { ComponentType } from '@/types';

// Lazy loading для больших компонентов конфигурации - уменьшает начальный bundle size
const KafkaConfigAdvanced = lazy(() => import('./KafkaConfigAdvanced').then(m => ({ default: m.KafkaConfigAdvanced })));
const RabbitMQConfigAdvanced = lazy(() => import('./RabbitMQConfigAdvanced').then(m => ({ default: m.RabbitMQConfigAdvanced })));
const PostgreSQLConfigAdvanced = lazy(() => import('./data/PostgreSQLConfigAdvanced').then(m => ({ default: m.PostgreSQLConfigAdvanced })));
const MongoDBConfigAdvanced = lazy(() => import('./data/MongoDBConfigAdvanced').then(m => ({ default: m.MongoDBConfigAdvanced })));
const RedisConfigAdvanced = lazy(() => import('./data/RedisConfigAdvanced').then(m => ({ default: m.RedisConfigAdvanced })));
const ElasticsearchConfigAdvanced = lazy(() => import('./data/ElasticsearchConfigAdvanced').then(m => ({ default: m.ElasticsearchConfigAdvanced })));
const CassandraConfigAdvanced = lazy(() => import('./data/CassandraConfigAdvanced').then(m => ({ default: m.CassandraConfigAdvanced })));
const ClickHouseConfigAdvanced = lazy(() => import('./data/ClickHouseConfigAdvanced').then(m => ({ default: m.ClickHouseConfigAdvanced })));
const SnowflakeConfigAdvanced = lazy(() => import('./data/SnowflakeConfigAdvanced').then(m => ({ default: m.SnowflakeConfigAdvanced })));
const S3DataLakeConfigAdvanced = lazy(() => import('./data/S3DataLakeConfigAdvanced').then(m => ({ default: m.S3DataLakeConfigAdvanced })));
const NginxConfigAdvanced = lazy(() => import('./NginxConfigAdvanced').then(m => ({ default: m.NginxConfigAdvanced })));
const RestApiConfigAdvanced = lazy(() => import('./api/RestApiConfigAdvanced').then(m => ({ default: m.RestApiConfigAdvanced })));
const GRPCConfigAdvanced = lazy(() => import('./api/GRPCConfigAdvanced').then(m => ({ default: m.GRPCConfigAdvanced })));
const WebSocketConfigAdvanced = lazy(() => import('./api/WebSocketConfigAdvanced').then(m => ({ default: m.WebSocketConfigAdvanced })));
const GraphQLConfigAdvanced = lazy(() => import('./api/GraphQLConfigAdvanced').then(m => ({ default: m.GraphQLConfigAdvanced })));
const SOAPConfigAdvanced = lazy(() => import('./api/SOAPConfigAdvanced').then(m => ({ default: m.SOAPConfigAdvanced })));
const WebhookConfigAdvanced = lazy(() => import('./api/WebhookConfigAdvanced').then(m => ({ default: m.WebhookConfigAdvanced })));
const DockerK8sConfigAdvanced = lazy(() => import('./infrastructure/DockerK8sConfigAdvanced').then(m => ({ default: m.DockerK8sConfigAdvanced })));
const HAProxyConfigAdvanced = lazy(() => import('./infrastructure/HAProxyConfigAdvanced').then(m => ({ default: m.HAProxyConfigAdvanced })));
const TraefikConfigAdvanced = lazy(() => import('./infrastructure/TraefikConfigAdvanced').then(m => ({ default: m.TraefikConfigAdvanced })));
const EnvoyConfigAdvanced = lazy(() => import('./infrastructure/EnvoyConfigAdvanced').then(m => ({ default: m.EnvoyConfigAdvanced })));
const ActiveMQConfigAdvanced = lazy(() => import('./messaging/ActiveMQConfigAdvanced').then(m => ({ default: m.ActiveMQConfigAdvanced })));
const AWSSQSConfigAdvanced = lazy(() => import('./messaging/AWSSQSConfigAdvanced').then(m => ({ default: m.AWSSQSConfigAdvanced })));
const AzureServiceBusConfigAdvanced = lazy(() => import('./messaging/AzureServiceBusConfigAdvanced').then(m => ({ default: m.AzureServiceBusConfigAdvanced })));
const GCPPubSubConfigAdvanced = lazy(() => import('./messaging/GCPPubSubConfigAdvanced').then(m => ({ default: m.GCPPubSubConfigAdvanced })));
const KongConfigAdvanced = lazy(() => import('./integration/KongConfigAdvanced').then(m => ({ default: m.KongConfigAdvanced })));
const ApigeeConfigAdvanced = lazy(() => import('./integration/ApigeeConfigAdvanced').then(m => ({ default: m.ApigeeConfigAdvanced })));
const MuleSoftConfigAdvanced = lazy(() => import('./integration/MuleSoftConfigAdvanced').then(m => ({ default: m.MuleSoftConfigAdvanced })));
const GraphQLGatewayConfigAdvanced = lazy(() => import('./integration/GraphQLGatewayConfigAdvanced').then(m => ({ default: m.GraphQLGatewayConfigAdvanced })));
const BFFServiceConfigAdvanced = lazy(() => import('./integration/BFFServiceConfigAdvanced').then(m => ({ default: m.BFFServiceConfigAdvanced })));
const WebhookRelayConfigAdvanced = lazy(() => import('./integration/WebhookRelayConfigAdvanced').then(m => ({ default: m.WebhookRelayConfigAdvanced })));
const PrometheusConfigAdvanced = lazy(() => import('./observability/PrometheusConfigAdvanced').then(m => ({ default: m.PrometheusConfigAdvanced })));
const GrafanaConfigAdvanced = lazy(() => import('./observability/GrafanaConfigAdvanced').then(m => ({ default: m.GrafanaConfigAdvanced })));
const LokiConfigAdvanced = lazy(() => import('./observability/LokiConfigAdvanced').then(m => ({ default: m.LokiConfigAdvanced })));
const JaegerConfigAdvanced = lazy(() => import('./observability/JaegerConfigAdvanced').then(m => ({ default: m.JaegerConfigAdvanced })));
const OpenTelemetryCollectorConfigAdvanced = lazy(() => import('./observability/OpenTelemetryCollectorConfigAdvanced').then(m => ({ default: m.OpenTelemetryCollectorConfigAdvanced })));
const PagerDutyConfigAdvanced = lazy(() => import('./observability/PagerDutyConfigAdvanced').then(m => ({ default: m.PagerDutyConfigAdvanced })));
const KeycloakConfigAdvanced = lazy(() => import('./security/KeycloakConfigAdvanced').then(m => ({ default: m.KeycloakConfigAdvanced })));
const WAFConfigAdvanced = lazy(() => import('./security/WAFConfigAdvanced').then(m => ({ default: m.WAFConfigAdvanced })));
const SecretsVaultConfigAdvanced = lazy(() => import('./security/SecretsVaultConfigAdvanced').then(m => ({ default: m.SecretsVaultConfigAdvanced })));
const IDSIPSConfigAdvanced = lazy(() => import('./security/IDSIPSConfigAdvanced').then(m => ({ default: m.IDSIPSConfigAdvanced })));
const FirewallConfigAdvanced = lazy(() => import('./security/FirewallConfigAdvanced').then(m => ({ default: m.FirewallConfigAdvanced })));
const JenkinsConfigAdvanced = lazy(() => import('./devops/JenkinsConfigAdvanced').then(m => ({ default: m.JenkinsConfigAdvanced })));
const GitLabCIConfigAdvanced = lazy(() => import('./devops/GitLabCIConfigAdvanced').then(m => ({ default: m.GitLabCIConfigAdvanced })));
const ArgoCDConfigAdvanced = lazy(() => import('./devops/ArgoCDConfigAdvanced').then(m => ({ default: m.ArgoCDConfigAdvanced })));
const HarborConfigAdvanced = lazy(() => import('./devops/HarborConfigAdvanced').then(m => ({ default: m.HarborConfigAdvanced })));
const TerraformConfigAdvanced = lazy(() => import('./devops/TerraformConfigAdvanced').then(m => ({ default: m.TerraformConfigAdvanced })));
const AnsibleConfigAdvanced = lazy(() => import('./devops/AnsibleConfigAdvanced').then(m => ({ default: m.AnsibleConfigAdvanced })));
const IstioConfigAdvanced = lazy(() => import('./edge/IstioConfigAdvanced').then(m => ({ default: m.IstioConfigAdvanced })));
const ServiceMeshConfigAdvanced = lazy(() => import('./edge/ServiceMeshConfigAdvanced').then(m => ({ default: m.ServiceMeshConfigAdvanced })));
const APIGatewayConfigAdvanced = lazy(() => import('./edge/APIGatewayConfigAdvanced').then(m => ({ default: m.APIGatewayConfigAdvanced })));
const VPNConfigAdvanced = lazy(() => import('./edge/VPNConfigAdvanced').then(m => ({ default: m.VPNConfigAdvanced })));
const CDNConfigAdvanced = lazy(() => import('./edge/CDNConfigAdvanced').then(m => ({ default: m.CDNConfigAdvanced })));
const SparkConfigAdvanced = lazy(() => import('./ml/SparkConfigAdvanced').then(m => ({ default: m.SparkConfigAdvanced })));
const TensorFlowServingConfigAdvanced = lazy(() => import('./ml/TensorFlowServingConfigAdvanced').then(m => ({ default: m.TensorFlowServingConfigAdvanced })));
const PyTorchServeConfigAdvanced = lazy(() => import('./ml/PyTorchServeConfigAdvanced').then(m => ({ default: m.PyTorchServeConfigAdvanced })));
const FeatureStoreConfigAdvanced = lazy(() => import('./ml/FeatureStoreConfigAdvanced').then(m => ({ default: m.FeatureStoreConfigAdvanced })));
const MLflowConfigAdvanced = lazy(() => import('./ml/MLflowConfigAdvanced').then(m => ({ default: m.MLflowConfigAdvanced })));
const CRMConfigAdvanced = lazy(() => import('./business/CRMConfigAdvanced').then(m => ({ default: m.CRMConfigAdvanced })));
const ERPConfigAdvanced = lazy(() => import('./business/ERPConfigAdvanced').then(m => ({ default: m.ERPConfigAdvanced })));
const RPABotConfigAdvanced = lazy(() => import('./business/RPABotConfigAdvanced').then(m => ({ default: m.RPABotConfigAdvanced })));
const BPMNEngineConfigAdvanced = lazy(() => import('./business/BPMNEngineConfigAdvanced').then(m => ({ default: m.BPMNEngineConfigAdvanced })));
const PaymentGatewayConfigAdvanced = lazy(() => import('./business/PaymentGatewayConfigAdvanced').then(m => ({ default: m.PaymentGatewayConfigAdvanced })));

// Fallback компонент для загрузки
const LoadingFallback = () => (
  <div className="flex items-center justify-center h-full">
    <div className="text-muted-foreground">Loading configuration...</div>
  </div>
);

interface ComponentConfigRendererProps {
  componentId: string;
  componentType: ComponentType['type'];
}

export function ComponentConfigRenderer({ componentId, componentType }: ComponentConfigRendererProps) {
  const renderConfig = () => {
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
  };

  return (
    <Suspense fallback={<LoadingFallback />}>
      {renderConfig()}
    </Suspense>
  );
}

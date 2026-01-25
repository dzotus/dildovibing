import { ConnectionRule } from '../types';
import { ServiceDiscovery } from '../ServiceDiscovery';
import { createEnvoyRule } from './envoyRules';
import { createAPIGatewayRule } from './apiGatewayRules';
import { createKongRule } from './kongRules';
import { createServiceMeshRule, createIstioRule } from './serviceMeshRules';
import { createNginxRule, createHAProxyRule, createTraefikRule } from './loadBalancerRules';
import { createDatabaseClientRule } from './databaseRules';
import { createMessagingProducerRule } from './messagingRules';
import { createPrometheusRule } from './prometheusRules';
import { createGrafanaRule } from './grafanaRules';
import { createLokiRule } from './lokiRules';
import { createJaegerRule } from './jaegerRules';
import { createOTelCollectorReceiverRule, createOTelCollectorExporterRule } from './otelCollectorRules';
import { createMuleSoftTargetRule, createMuleSoftSourceRule } from './mulesoftRules';
import { createGraphQLGatewayRule } from './graphqlGatewayRules';
import { createBFFRule } from './bffRules';

/**
 * Инициализировать все правила подключения
 */
export function initializeConnectionRules(discovery: ServiceDiscovery): ConnectionRule[] {
  return [
    // Infrastructure & Proxy
    createEnvoyRule(discovery),
    createNginxRule(discovery),
    createHAProxyRule(discovery),
    createTraefikRule(discovery),
    
    // Edge & Gateway
    createAPIGatewayRule(discovery),
    createKongRule(discovery),
    createGraphQLGatewayRule(discovery),
    createBFFRule(discovery),
    createServiceMeshRule(discovery),
    createIstioRule(discovery),
    
    // Database & Messaging
    createDatabaseClientRule(discovery),
    createMessagingProducerRule(discovery),
    
    // Observability
    createPrometheusRule(discovery),
    createGrafanaRule(discovery),
    createLokiRule(discovery),
    createJaegerRule(discovery),
    createOTelCollectorReceiverRule(discovery),
    createOTelCollectorExporterRule(discovery),
    
    // Integration - MuleSoft
    createMuleSoftTargetRule(discovery),
    createMuleSoftSourceRule(discovery),
  ];
}

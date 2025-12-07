import { ConnectionRule } from '../types';
import { ServiceDiscovery } from '../ServiceDiscovery';
import { createEnvoyRule } from './envoyRules';
import { createAPIGatewayRule } from './apiGatewayRules';
import { createServiceMeshRule, createIstioRule } from './serviceMeshRules';
import { createNginxRule, createHAProxyRule, createTraefikRule } from './loadBalancerRules';
import { createDatabaseClientRule } from './databaseRules';
import { createMessagingProducerRule } from './messagingRules';
import { createPrometheusRule } from './prometheusRules';

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
    createServiceMeshRule(discovery),
    createIstioRule(discovery),
    
    // Database & Messaging
    createDatabaseClientRule(discovery),
    createMessagingProducerRule(discovery),
    
    // Observability
    createPrometheusRule(discovery),
  ];
}

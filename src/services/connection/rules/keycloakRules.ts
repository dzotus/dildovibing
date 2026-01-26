import { CanvasNode, CanvasConnection } from '@/types';
import { ConnectionRule, ConnectionMetadata } from '../types';
import { ServiceDiscovery } from '../ServiceDiscovery';

/**
 * Правило для Application/API Gateway -> Keycloak
 * Обновляет конфигурацию источника с параметрами Keycloak (keycloakUrl, realm, clientId)
 */
export function createKeycloakRule(discovery: ServiceDiscovery): ConnectionRule {
  return {
    sourceType: '*', // Любое приложение может подключаться к Keycloak
    targetTypes: ['keycloak'],
    priority: 10,
    
    updateSourceConfig: (source, keycloak, connection, metadata) => {
      // Валидация входных данных
      if (!source?.data || !keycloak?.data) {
        return null;
      }
      
      if (!metadata?.targetHost || !metadata?.targetPort) {
        return null;
      }

      const sourceConfig = source.data.config || {};
      const keycloakConfig = keycloak.data.config || {};
      
      // Получаем realm из конфигурации Keycloak
      const realm = keycloakConfig.realm || 'archiphoenix';
      
      // Формируем keycloakUrl
      const protocol = keycloakConfig.enableSSL ? 'https' : 'http';
      const keycloakUrl = `${protocol}://${metadata.targetHost}:${metadata.targetPort}`;
      
      // Определяем clientId из конфигурации источника или используем первый клиент из Keycloak
      let clientId: string | undefined = sourceConfig.keycloak?.clientId || sourceConfig.clientId;
      
      // Если clientId не указан, пытаемся найти подходящего клиента
      if (!clientId) {
        const clients = Array.isArray(keycloakConfig.clients) ? keycloakConfig.clients : [];
        const enabledClients = clients.filter((c: any) => c.enabled !== false);
        if (enabledClients.length > 0) {
          // Используем clientId или id первого включенного клиента
          clientId = enabledClients[0].clientId || enabledClients[0].id;
        }
      }
      
      // Обновляем конфигурацию в зависимости от типа источника
      const sourceType = source.type;
      const updateConfig: any = {};
      
      // Для REST API, GraphQL, gRPC, WebSocket, Webhook
      if (['rest-api', 'graphql-api', 'grpc-api', 'websocket-api', 'webhook'].includes(sourceType)) {
        updateConfig.keycloak = {
          keycloakUrl,
          realm,
          clientId: clientId || '',
          ...(sourceConfig.keycloak || {}),
        };
      }
      
      // Для API Gateway - настраиваем OAuth2/OIDC авторизацию
      if (sourceType === 'api-gateway') {
        const gatewayConfig = sourceConfig as any;
        const authConfig = gatewayConfig.auth || {};
        
        updateConfig.auth = {
          ...authConfig,
          type: 'oauth2',
          provider: 'keycloak',
          keycloakUrl,
          realm,
          clientId: clientId || '',
          // Если есть clientSecret в конфигурации Keycloak, используем его
          ...(keycloakConfig.clients && Array.isArray(keycloakConfig.clients) 
            ? (() => {
                const client = keycloakConfig.clients.find((c: any) => 
                  (c.clientId || c.id) === clientId
                );
                return client?.clientSecret ? { clientSecret: client.clientSecret } : {};
              })()
            : {}),
        };
      }
      
      // Для Kong Gateway
      if (sourceType === 'kong-gateway') {
        const kongConfig = sourceConfig as any;
        const plugins = Array.isArray(kongConfig.plugins) ? [...kongConfig.plugins] : [];
        
        // Ищем существующий OIDC plugin или создаем новый
        let oidcPlugin = plugins.find((p: any) => p.name === 'oidc');
        
        if (!oidcPlugin) {
          oidcPlugin = {
            name: 'oidc',
            enabled: true,
            config: {},
          };
          plugins.push(oidcPlugin);
        }
        
        // Обновляем конфигурацию OIDC plugin
        oidcPlugin.config = {
          ...oidcPlugin.config,
          discovery: `${keycloakUrl}/realms/${realm}/.well-known/openid-configuration`,
          client_id: clientId || '',
          client_secret: (() => {
            if (keycloakConfig.clients && Array.isArray(keycloakConfig.clients)) {
              const client = keycloakConfig.clients.find((c: any) => 
                (c.clientId || c.id) === clientId
              );
              return client?.clientSecret || '';
            }
            return '';
          })(),
        };
        
        updateConfig.plugins = plugins;
      }
      
      // Для других типов компонентов - просто добавляем keycloak конфигурацию
      if (Object.keys(updateConfig).length === 0) {
        updateConfig.keycloak = {
          keycloakUrl,
          realm,
          clientId: clientId || '',
        };
      }
      
      return updateConfig;
    },
    
    updateTargetConfig: (source, keycloak, connection, metadata) => {
      // Keycloak не требует предварительной настройки для приема запросов
      // Клиенты регистрируются вручную через UI или автоматически (опционально)
      return null;
    },
    
    extractMetadata: (source, keycloak, connection) => {
      // Извлекаем metadata для подключения к Keycloak
      const targetHost = discovery.getHost(keycloak);
      const keycloakConfig = (keycloak.data.config || {}) as any;
      
      // Определяем порт на основе конфигурации
      let targetPort: number | undefined = discovery.getPort(keycloak, 'main');
      
      // Если в конфигурации указан adminUrl, пытаемся извлечь порт
      if (keycloakConfig.adminUrl) {
        const urlMatch = String(keycloakConfig.adminUrl).match(/:(\d+)/);
        if (urlMatch) {
          targetPort = parseInt(urlMatch[1], 10);
        }
      }
      
      // Если порт не найден, используем дефолтный порт Keycloak
      if (!targetPort) {
        targetPort = discovery.getPort(keycloak, 'main') || 8080;
      }
      
      // Определяем endpoint на основе конфигурации
      const protocol = keycloakConfig.enableSSL ? 'https' : 'http';
      const realm = keycloakConfig.realm || 'archiphoenix';
      const endpoint = `${protocol}://${targetHost}:${targetPort}/realms/${realm}`;
      
      return {
        protocol: 'http',
        sourceHost: discovery.getHost(source),
        targetHost,
        sourcePort: discovery.getPort(source, 'main'),
        targetPort,
        endpoint,
        path: `/realms/${realm}`,
      };
    },
    
    validateConnection: (source, target, connection) => {
      // Валидация: Keycloak может принимать запросы от любых компонентов
      if (!source?.data || !target?.data) {
        return { valid: false, error: 'Source or target node missing data' };
      }
      
      if (target.type !== 'keycloak') {
        return { valid: false, error: 'Target must be Keycloak component' };
      }
      
      // Проверяем что Keycloak engine инициализирован
      // (это проверяется в EmulationEngine)
      
      return { valid: true };
    },
  };
}

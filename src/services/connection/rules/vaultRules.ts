import { CanvasNode, CanvasConnection } from '@/types';
import { ConnectionRule, ConnectionMetadata } from '../types';
import { ServiceDiscovery } from '../ServiceDiscovery';

/**
 * Правило для подключения к Vault (Secrets Management)
 * Автоматически настраивает компоненты для работы с Vault
 */
export function createVaultRule(discovery: ServiceDiscovery): ConnectionRule {
  return {
    sourceType: '*', // Любой компонент может подключаться к Vault
    targetTypes: ['secrets-vault'],
    priority: 10, // Высокий приоритет для security компонентов
    
    updateSourceConfig: (source, vault, connection, metadata) => {
      // Валидация входных данных
      if (!source?.data || !vault?.data) {
        return null;
      }
      
      if (!metadata?.targetHost || !metadata?.targetPort) {
        return null;
      }

      const sourceConfig = source.data.config || {};
      const vaultConfig = vault.data.config || {};
      
      // Получаем адрес Vault из конфигурации или metadata
      const protocol = vaultConfig.enableTLS ? 'https' : 'http';
      const vaultAddress = vaultConfig.address || `${protocol}://${metadata.targetHost}:${metadata.targetPort}`;
      
      // Обновляем конфигурацию в зависимости от типа источника
      const sourceType = source.type;
      const updateConfig: any = {};
      
      // Для REST API, GraphQL, gRPC, WebSocket, Webhook
      if (['rest-api', 'graphql-api', 'grpc-api', 'websocket-api', 'webhook'].includes(sourceType)) {
        updateConfig.vault = {
          vaultAddress,
          ...(sourceConfig.vault || {}),
        };
      }
      
      // Для API Gateway - настраиваем интеграцию с Vault
      if (sourceType === 'api-gateway') {
        const gatewayConfig = sourceConfig as any;
        const secretsConfig = gatewayConfig.secrets || {};
        
        updateConfig.secrets = {
          ...secretsConfig,
          provider: 'vault',
          vaultAddress,
          // Если есть токен в конфигурации Vault или источника, используем его
          token: sourceConfig.vault?.token || secretsConfig.token || undefined,
        };
      }
      
      // Для Kong Gateway - настраиваем Vault plugin
      if (sourceType === 'kong-gateway') {
        const kongConfig = sourceConfig as any;
        const plugins = Array.isArray(kongConfig.plugins) ? [...kongConfig.plugins] : [];
        
        // Ищем существующий Vault plugin или создаем новый
        let vaultPlugin = plugins.find((p: any) => p.name === 'vault');
        
        if (!vaultPlugin) {
          vaultPlugin = {
            name: 'vault',
            enabled: true,
            config: {},
          };
          plugins.push(vaultPlugin);
        }
        
        // Обновляем конфигурацию Vault plugin
        vaultPlugin.config = {
          ...vaultPlugin.config,
          vault_address: vaultAddress,
          token: sourceConfig.vault?.token || vaultPlugin.config.token || undefined,
        };
        
        updateConfig.plugins = plugins;
      }
      
      // Для баз данных - настраиваем получение credentials из Vault
      if (['postgres', 'mongodb', 'redis', 'cassandra', 'clickhouse', 'elasticsearch'].includes(sourceType)) {
        const dbConfig = sourceConfig as any;
        updateConfig.vault = {
          vaultAddress,
          // Путь к секретам для БД (например, secret/database/postgres)
          secretsPath: dbConfig.vault?.secretsPath || `secret/database/${sourceType}`,
          token: sourceConfig.vault?.token || dbConfig.vault?.token || undefined,
        };
      }
      
      // Для других типов компонентов - просто добавляем vault конфигурацию
      if (Object.keys(updateConfig).length === 0) {
        updateConfig.vault = {
          vaultAddress,
          token: sourceConfig.vault?.token || undefined,
        };
      }
      
      return updateConfig;
    },
    
    updateTargetConfig: (source, vault, connection, metadata) => {
      // Vault не требует предварительной настройки для приема запросов
      // Компоненты могут подключаться к Vault без предварительной регистрации
      return null;
    },
    
    extractMetadata: (source, vault, connection) => {
      // Извлекаем metadata для подключения к Vault
      const targetHost = discovery.getHost(vault);
      const vaultConfig = (vault.data.config || {}) as any;
      
      // Определяем порт на основе конфигурации
      let targetPort: number | undefined = discovery.getPort(vault, 'main');
      
      // Если в конфигурации указан address, пытаемся извлечь порт
      if (vaultConfig.address) {
        const urlMatch = String(vaultConfig.address).match(/:(\d+)/);
        if (urlMatch) {
          targetPort = parseInt(urlMatch[1], 10);
        }
      }
      
      // Если порт не найден, используем дефолтный порт Vault
      if (!targetPort) {
        targetPort = discovery.getPort(vault, 'main') || 8200;
      }
      
      // Определяем endpoint на основе конфигурации
      const protocol = vaultConfig.enableTLS ? 'https' : 'http';
      const endpoint = `${protocol}://${targetHost}:${targetPort}`;
      
      return {
        protocol: 'http',
        sourceHost: discovery.getHost(source),
        targetHost,
        sourcePort: discovery.getPort(source, 'main'),
        targetPort,
        endpoint,
        path: '/v1',
      };
    },
    
    validateConnection: (source, target, connection) => {
      // Валидация: Vault может принимать запросы от любых компонентов
      if (!source?.data || !target?.data) {
        return { valid: false, error: 'Source or target node missing data' };
      }
      
      if (target.type !== 'secrets-vault') {
        return { valid: false, error: 'Target must be Vault component' };
      }
      
      // Проверяем что Vault engine инициализирован
      // (это проверяется в EmulationEngine)
      
      return { valid: true };
    },
  };
}

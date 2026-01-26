import { CanvasNode, CanvasConnection } from '@/types';
import { ConnectionRule, ConnectionMetadata } from '../types';
import { ServiceDiscovery } from '../ServiceDiscovery';

/**
 * Правило для подключения к WAF
 * Автоматически настраивает WAF для защиты компонентов
 */
export function createWAFRule(discovery: ServiceDiscovery): ConnectionRule {
  return {
    sourceType: '*', // WAF может принимать запросы от любых компонентов
    targetTypes: ['*'], // WAF может защищать любые компоненты
    priority: 5,
    
    updateSourceConfig: (source, waf, connection, metadata) => {
      // Валидация входных данных
      if (!source?.data || !waf?.data) {
        return null;
      }
      
      if (!metadata?.targetHost || !metadata?.targetPort) {
        return null;
      }

      const sourceConfig = source.data.config || {};
      const wafConfig = waf.data.config || {};
      
      // Для API Gateway - настройка WAF URL
      if (source.type === 'api-gateway') {
        const protocol = wafConfig.enableSSL ? 'https' : 'http';
        const wafUrl = `${protocol}://${metadata.targetHost}:${metadata.targetPort}`;
        
        return {
          wafUrl,
          wafEnabled: true,
        };
      }
      
      // Для Load Balancer - настройка WAF перед backend
      if (source.type === 'load-balancer' || source.type === 'nginx' || source.type === 'haproxy' || source.type === 'traefik') {
        const protocol = wafConfig.enableSSL ? 'https' : 'http';
        const wafUrl = `${protocol}://${metadata.targetHost}:${metadata.targetPort}`;
        
        return {
          upstream: {
            ...(sourceConfig.upstream || {}),
            wafUrl,
          },
        };
      }
      
      // Для CDN - настройка WAF для защиты origin
      if (source.type === 'cdn') {
        const protocol = wafConfig.enableSSL ? 'https' : 'http';
        const wafUrl = `${protocol}://${metadata.targetHost}:${metadata.targetPort}`;
        
        return {
          origin: {
            ...(sourceConfig.origin || {}),
            wafUrl,
          },
        };
      }
      
      return null;
    },
    
    updateTargetConfig: (waf, target, connection, metadata) => {
      // Валидация входных данных
      if (!waf?.data || !target?.data) {
        return null;
      }
      
      if (!metadata?.sourceHost || !metadata?.sourcePort) {
        return null;
      }

      const wafConfig = waf.data.config || {};
      const targetConfig = target.data.config || {};
      
      // Настройка WAF для защиты целевого компонента
      const updateConfig: any = {};
      
      // Для REST API, GraphQL, gRPC - автоматически добавляем правила для защиты endpoints
      if (['rest-api', 'graphql-api', 'grpc-api'].includes(target.type)) {
        // Автоматически включаем OWASP правила если они еще не включены
        if (wafConfig.enableOWASP === undefined) {
          updateConfig.enableOWASP = true;
        }
        
        // Автоматически включаем rate limiting если он еще не включен
        if (wafConfig.enableRateLimiting === undefined) {
          updateConfig.enableRateLimiting = true;
          updateConfig.rateLimitPerMinute = updateConfig.rateLimitPerMinute || 1000;
        }
        
        // Для GraphQL - автоматически включаем GraphQL protection
        if (target.type === 'graphql-api' && !wafConfig.graphQLProtection) {
          updateConfig.graphQLProtection = {
            enabled: true,
            maxDepth: 10,
            maxComplexity: 100,
            maxAliases: 10,
            blockIntrospection: false,
          };
        }
      }
      
      // Для API Gateway - настройка WAF для защиты API endpoints
      if (target.type === 'api-gateway') {
        const apis = Array.isArray(targetConfig.apis) ? targetConfig.apis : [];
        
        // Автоматически включаем защиту для всех API endpoints
        if (wafConfig.enableOWASP === undefined) {
          updateConfig.enableOWASP = true;
        }
        
        // Автоматически включаем rate limiting
        if (wafConfig.enableRateLimiting === undefined) {
          updateConfig.enableRateLimiting = true;
          updateConfig.rateLimitPerMinute = updateConfig.rateLimitPerMinute || 1000;
        }
        
        // Если есть API endpoints, можно автоматически создать правила для их защиты
        if (apis.length > 0 && Array.isArray(wafConfig.rules)) {
          const existingRules = wafConfig.rules || [];
          const newRules = apis
            .filter((api: any) => api.path && !existingRules.some((r: any) => r.name === `Protect ${api.path}`))
            .map((api: any) => ({
              id: `auto-rule-${api.id || Date.now()}-${Math.random()}`,
              name: `Protect ${api.path}`,
              description: `Auto-generated rule for protecting ${api.path}`,
              enabled: true,
              action: 'block' as const,
              priority: 100,
              conditions: [
                { type: 'uri' as const, operator: 'startsWith' as const, value: api.path },
              ],
            }));
          
          if (newRules.length > 0) {
            updateConfig.rules = [...existingRules, ...newRules];
          }
        }
      }
      
      // Для Backend сервисов - базовая защита
      if (['backend-service', 'microservice'].includes(target.type)) {
        if (wafConfig.enableOWASP === undefined) {
          updateConfig.enableOWASP = true;
        }
        
        if (wafConfig.enableDDoSProtection === undefined) {
          updateConfig.enableDDoSProtection = true;
          updateConfig.ddosThreshold = updateConfig.ddosThreshold || 1000;
        }
      }
      
      return Object.keys(updateConfig).length > 0 ? updateConfig : null;
    },
    
    extractMetadata: (source, waf, connection) => {
      // Извлекаем metadata для подключения к WAF
      const targetHost = discovery.getHost(waf);
      const wafConfig = (waf.data.config || {}) as any;
      
      // Определяем порт на основе конфигурации
      let targetPort: number | undefined = discovery.getPort(waf, 'main');
      
      // Если порт не найден, используем дефолтный порт WAF
      if (!targetPort) {
        targetPort = discovery.getPort(waf, 'main') || 80;
      }
      
      // Определяем endpoint на основе конфигурации
      const protocol = wafConfig.enableSSL ? 'https' : 'http';
      const endpoint = `${protocol}://${targetHost}:${targetPort}`;
      
      return {
        protocol: 'http',
        sourceHost: discovery.getHost(source),
        targetHost,
        sourcePort: discovery.getPort(source, 'main'),
        targetPort,
        endpoint,
        path: '/',
      };
    },
    
    validateConnection: (source, target, connection) => {
      // Валидация: WAF может принимать запросы от любых компонентов и защищать любые компоненты
      if (!source?.data || !target?.data) {
        return { valid: false, error: 'Source or target node missing data' };
      }
      
      // WAF может быть как источником, так и целью
      const isWAFSource = source.type === 'waf';
      const isWAFTarget = target.type === 'waf';
      
      if (!isWAFSource && !isWAFTarget) {
        return { valid: false, error: 'At least one node must be WAF' };
      }
      
      return { valid: true };
    },
  };
}

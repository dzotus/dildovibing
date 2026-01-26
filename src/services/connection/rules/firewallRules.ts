import { CanvasNode, CanvasConnection } from '@/types';
import { ConnectionRule, ConnectionMetadata } from '../types';
import { ServiceDiscovery } from '../ServiceDiscovery';

/**
 * Правило для подключения через Firewall
 * Автоматически настраивает Firewall для фильтрации трафика между компонентами
 */
export function createFirewallRule(discovery: ServiceDiscovery): ConnectionRule {
  return {
    sourceType: '*', // Любой компонент может отправлять через Firewall
    targetTypes: ['*'], // Firewall может защищать любые компоненты
    priority: 10, // Высокий приоритет для security компонентов
    
    updateSourceConfig: (source, firewall, connection, metadata) => {
      // Валидация входных данных
      if (!source?.data || !firewall?.data) {
        return null;
      }
      
      if (!metadata?.targetHost || !metadata?.targetPort) {
        return null;
      }

      const sourceConfig = source.data.config || {};
      const firewallConfig = firewall.data.config || {};
      
      // Для Load Balancer - настройка маршрутизации через Firewall
      if (source.type === 'load-balancer' || source.type === 'nginx' || source.type === 'haproxy' || source.type === 'traefik') {
        const protocol = firewallConfig.enableSSL ? 'https' : 'http';
        const firewallHost = metadata.targetHost;
        const firewallPort = metadata.targetPort;
        
        return {
          upstream: {
            ...(sourceConfig.upstream || {}),
            firewallHost,
            firewallPort,
            firewallProtocol: protocol,
          },
        };
      }
      
      // Для API Gateway - настройка маршрутизации через Firewall
      if (source.type === 'api-gateway') {
        const protocol = firewallConfig.enableSSL ? 'https' : 'http';
        const firewallHost = metadata.targetHost;
        const firewallPort = metadata.targetPort;
        
        return {
          firewallHost,
          firewallPort,
          firewallProtocol: protocol,
          firewallEnabled: true,
        };
      }
      
      // Для CDN - настройка Firewall перед origin
      if (source.type === 'cdn') {
        const protocol = firewallConfig.enableSSL ? 'https' : 'http';
        const firewallHost = metadata.targetHost;
        const firewallPort = metadata.targetPort;
        
        return {
          origin: {
            ...(sourceConfig.origin || {}),
            firewallHost,
            firewallPort,
            firewallProtocol: protocol,
          },
        };
      }
      
      // Для других компонентов - базовая настройка
      return {
        firewallHost: metadata.targetHost,
        firewallPort: metadata.targetPort,
        firewallEnabled: true,
      };
    },
    
    updateTargetConfig: (firewall, target, connection, metadata) => {
      // Валидация входных данных
      if (!firewall?.data || !target?.data) {
        return null;
      }
      
      if (!metadata?.sourceHost || !metadata?.sourcePort) {
        return null;
      }

      const firewallConfig = firewall.data.config || {};
      const targetConfig = target.data.config || {};
      
      // Настройка Firewall для защиты целевого компонента
      const updateConfig: any = {};
      
      // Автоматически создаем правило allow для целевого компонента, если его еще нет
      if (Array.isArray(firewallConfig.rules)) {
        const targetHost = discovery.getHost(target);
        const targetPort = discovery.getPort(target, 'main');
        
        // Проверяем, есть ли уже правило для этого компонента
        const existingRule = firewallConfig.rules.find((r: any) => 
          r.destination === targetHost || 
          (r.destination && targetHost && r.destination.includes(targetHost))
        );
        
        if (!existingRule && targetHost && targetPort) {
          const newRule = {
            id: `auto-allow-${target.id}-${Date.now()}`,
            name: `Allow traffic to ${target.data.label || target.type}`,
            action: 'allow' as const,
            protocol: 'all' as const,
            destination: targetHost,
            port: targetPort,
            enabled: true,
            priority: 50, // Средний приоритет для автоматических правил
          };
          
          updateConfig.rules = [...firewallConfig.rules, newRule];
        }
      }
      
      // Для REST API, GraphQL, gRPC - настройка правил для защиты endpoints
      if (['rest-api', 'graphql-api', 'grpc-api'].includes(target.type)) {
        // Автоматически включаем stateful inspection если он еще не включен
        if (firewallConfig.enableStatefulInspection === undefined) {
          updateConfig.enableStatefulInspection = true;
        }
        
        // Автоматически включаем логирование если оно еще не включено
        if (firewallConfig.enableLogging === undefined) {
          updateConfig.enableLogging = true;
        }
      }
      
      // Для API Gateway - настройка Firewall для защиты API endpoints
      if (target.type === 'api-gateway') {
        if (firewallConfig.enableStatefulInspection === undefined) {
          updateConfig.enableStatefulInspection = true;
        }
        
        if (firewallConfig.enableLogging === undefined) {
          updateConfig.enableLogging = true;
        }
      }
      
      // Для Backend сервисов - базовая защита
      if (['backend-service', 'microservice'].includes(target.type)) {
        if (firewallConfig.enableStatefulInspection === undefined) {
          updateConfig.enableStatefulInspection = true;
        }
        
        if (firewallConfig.defaultPolicy === undefined) {
          updateConfig.defaultPolicy = 'deny'; // Deny by default для безопасности
        }
      }
      
      // Для баз данных - строгая защита
      if (['postgresql', 'mongodb', 'redis', 'mysql', 'cassandra', 'clickhouse', 'elasticsearch'].includes(target.type)) {
        if (firewallConfig.defaultPolicy === undefined) {
          updateConfig.defaultPolicy = 'deny'; // Deny by default для баз данных
        }
        
        // Создаем правило только для конкретного порта базы данных
        if (Array.isArray(firewallConfig.rules)) {
          const targetHost = discovery.getHost(target);
          const targetPort = discovery.getPort(target, 'main');
          
          const existingRule = firewallConfig.rules.find((r: any) => 
            r.destination === targetHost && r.port === targetPort
          );
          
          if (!existingRule && targetHost && targetPort) {
            const newRule = {
              id: `auto-allow-db-${target.id}-${Date.now()}`,
              name: `Allow database access to ${target.data.label || target.type}`,
              action: 'allow' as const,
              protocol: 'tcp' as const,
              destination: targetHost,
              port: targetPort,
              enabled: true,
              priority: 60, // Высокий приоритет для баз данных
            };
            
            updateConfig.rules = [...(updateConfig.rules || firewallConfig.rules), newRule];
          }
        }
      }
      
      return Object.keys(updateConfig).length > 0 ? updateConfig : null;
    },
    
    extractMetadata: (source, firewall, connection) => {
      // Извлекаем metadata для подключения через Firewall
      const firewallHost = discovery.getHost(firewall);
      const firewallConfig = (firewall.data.config || {}) as any;
      
      // Определяем порт на основе конфигурации
      let firewallPort: number | undefined = discovery.getPort(firewall, 'main');
      
      // Если порт не найден, используем дефолтный порт Firewall
      if (!firewallPort) {
        firewallPort = 80; // Дефолтный порт для Firewall
      }
      
      // Определяем протокол на основе конфигурации
      const protocol = firewallConfig.enableSSL ? 'https' : 'http';
      
      return {
        protocol: 'tcp', // Firewall работает на сетевом уровне
        sourceHost: discovery.getHost(source),
        targetHost: firewallHost,
        sourcePort: discovery.getPort(source, 'main'),
        targetPort: firewallPort,
        endpoint: `${protocol}://${firewallHost}:${firewallPort}`,
      };
    },
    
    validateConnection: (source, target, connection) => {
      // Валидация: Firewall может быть транзитным компонентом между любыми компонентами
      if (!source?.data || !target?.data) {
        return { valid: false, error: 'Source or target node missing data' };
      }
      
      // Firewall может быть как источником, так и целью
      const isFirewallSource = source.type === 'firewall';
      const isFirewallTarget = target.type === 'firewall';
      
      // Если Firewall - это источник, то цель должна быть защищаемым компонентом
      if (isFirewallSource && !isFirewallTarget) {
        return { valid: true };
      }
      
      // Если Firewall - это цель, то источник может быть любым компонентом
      if (isFirewallTarget && !isFirewallSource) {
        return { valid: true };
      }
      
      // Если оба компонента - не Firewall, то это обычное соединение
      if (!isFirewallSource && !isFirewallTarget) {
        return { valid: false, error: 'At least one node must be Firewall for firewall rule' };
      }
      
      // Firewall не может быть соединен сам с собой (но это не критично)
      if (isFirewallSource && isFirewallTarget) {
        return { valid: false, error: 'Firewall cannot be connected to itself' };
      }
      
      return { valid: true };
    },
  };
}

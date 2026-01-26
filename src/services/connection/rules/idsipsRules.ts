import { CanvasNode, CanvasConnection } from '@/types';
import { ConnectionRule, ConnectionMetadata } from '../types';
import { ServiceDiscovery } from '../ServiceDiscovery';

/**
 * Правило для подключения через IDS/IPS
 * Автоматически настраивает IDS/IPS для мониторинга и защиты трафика между компонентами
 */
export function createIDSIPSRule(discovery: ServiceDiscovery): ConnectionRule {
  return {
    sourceType: '*', // Любой компонент может отправлять через IDS/IPS
    targetTypes: ['*'], // IDS/IPS может мониторить/защищать любые компоненты
    priority: 10, // Высокий приоритет для security компонентов
    
    updateSourceConfig: (source, idsips, connection, metadata) => {
      // Валидация входных данных
      if (!source?.data || !idsips?.data) {
        return null;
      }
      
      if (!metadata?.targetHost || !metadata?.targetPort) {
        return null;
      }

      const sourceConfig = source.data.config || {};
      const idsipsConfig = idsips.data.config || {};
      
      // Для Load Balancer - настройка маршрутизации через IDS/IPS
      if (source.type === 'load-balancer' || source.type === 'nginx' || source.type === 'haproxy' || source.type === 'traefik') {
        const idsipsHost = metadata.targetHost;
        const idsipsPort = metadata.targetPort;
        
        return {
          upstream: {
            ...(sourceConfig.upstream || {}),
            idsipsHost,
            idsipsPort,
            idsipsEnabled: true,
          },
        };
      }
      
      // Для API Gateway - настройка маршрутизации через IDS/IPS
      if (source.type === 'api-gateway') {
        const idsipsHost = metadata.targetHost;
        const idsipsPort = metadata.targetPort;
        
        return {
          idsipsHost,
          idsipsPort,
          idsipsEnabled: true,
        };
      }
      
      // Для CDN - настройка IDS/IPS перед origin
      if (source.type === 'cdn') {
        const idsipsHost = metadata.targetHost;
        const idsipsPort = metadata.targetPort;
        
        return {
          origin: {
            ...(sourceConfig.origin || {}),
            idsipsHost,
            idsipsPort,
            idsipsEnabled: true,
          },
        };
      }
      
      // Для других компонентов - базовая настройка
      return {
        idsipsHost: metadata.targetHost,
        idsipsPort: metadata.targetPort,
        idsipsEnabled: true,
      };
    },
    
    updateTargetConfig: (idsips, target, connection, metadata) => {
      // Валидация входных данных
      if (!idsips?.data || !target?.data) {
        return null;
      }
      
      if (!metadata?.sourceHost || !metadata?.sourcePort) {
        return null;
      }

      const idsipsConfig = idsips.data.config || {};
      const targetConfig = target.data.config || {};
      
      // Настройка IDS/IPS для мониторинга/защиты целевого компонента
      const updateConfig: any = {};
      
      // Автоматически создаем сигнатуру для мониторинга целевого компонента, если его еще нет
      if (Array.isArray(idsipsConfig.signatures)) {
        const targetHost = discovery.getHost(target);
        const targetPort = discovery.getPort(target, 'main');
        
        // Проверяем, есть ли уже сигнатура для этого компонента
        const existingSignature = idsipsConfig.signatures.find((s: any) => 
          s.destinationIP === targetHost || 
          (s.destinationIP && targetHost && s.destinationIP.includes(targetHost))
        );
        
        if (!existingSignature && targetHost && targetPort) {
          const newSignature = {
            id: `auto-monitor-${target.id}-${Date.now()}`,
            name: `Monitor traffic to ${target.data.label || target.type}`,
            description: `Auto-generated signature for monitoring traffic to ${target.data.label || target.type}`,
            enabled: true,
            severity: 'low' as const,
            pattern: '', // No pattern - IP/port based monitoring
            action: 'alert' as const,
            protocol: 'all' as const,
            destinationIP: targetHost,
            port: targetPort,
          };
          
          updateConfig.signatures = [...idsipsConfig.signatures, newSignature];
        }
      }
      
      // Для REST API, GraphQL, gRPC - автоматически включаем обнаружение
      if (['rest-api', 'graphql-api', 'grpc-api'].includes(target.type)) {
        // Автоматически включаем signature detection если он еще не включен
        if (idsipsConfig.enableSignatureDetection === undefined) {
          updateConfig.enableSignatureDetection = true;
        }
        
        // Автоматически включаем anomaly detection если он еще не включен
        if (idsipsConfig.enableAnomalyDetection === undefined) {
          updateConfig.enableAnomalyDetection = true;
        }
        
        // Автоматически включаем логирование если оно еще не включено
        if (idsipsConfig.enableLogging === undefined) {
          updateConfig.enableLogging = true;
        }
      }
      
      // Для API Gateway - настройка IDS/IPS для защиты API endpoints
      if (target.type === 'api-gateway') {
        if (idsipsConfig.enableSignatureDetection === undefined) {
          updateConfig.enableSignatureDetection = true;
        }
        
        if (idsipsConfig.enableAnomalyDetection === undefined) {
          updateConfig.enableAnomalyDetection = true;
        }
        
        if (idsipsConfig.enableLogging === undefined) {
          updateConfig.enableLogging = true;
        }
      }
      
      // Для Backend сервисов - базовая защита
      if (['backend-service', 'microservice'].includes(target.type)) {
        if (idsipsConfig.enableSignatureDetection === undefined) {
          updateConfig.enableSignatureDetection = true;
        }
        
        if (idsipsConfig.enableBehavioralAnalysis === undefined) {
          updateConfig.enableBehavioralAnalysis = true;
        }
      }
      
      // Для баз данных - строгая защита
      if (['postgresql', 'mongodb', 'redis', 'mysql', 'cassandra', 'clickhouse', 'elasticsearch'].includes(target.type)) {
        if (idsipsConfig.enableSignatureDetection === undefined) {
          updateConfig.enableSignatureDetection = true;
        }
        
        if (idsipsConfig.enableAnomalyDetection === undefined) {
          updateConfig.enableAnomalyDetection = true;
        }
        
        if (idsipsConfig.enableBehavioralAnalysis === undefined) {
          updateConfig.enableBehavioralAnalysis = true;
        }
        
        // Для баз данных - автоматически включаем IPS режим (prevention)
        if (idsipsConfig.mode === undefined) {
          updateConfig.mode = 'ips';
        }
        
        // Автоматически включаем auto-block для баз данных
        if (idsipsConfig.enableAutoBlock === undefined) {
          updateConfig.enableAutoBlock = true;
        }
      }
      
      return Object.keys(updateConfig).length > 0 ? updateConfig : null;
    },
    
    extractMetadata: (source, idsips, connection) => {
      // Извлекаем metadata для подключения через IDS/IPS
      const idsipsHost = discovery.getHost(idsips);
      const idsipsConfig = (idsips.data.config || {}) as any;
      
      // Определяем порт на основе конфигурации
      let idsipsPort: number | undefined = discovery.getPort(idsips, 'main');
      
      // Если порт не найден, используем дефолтный порт IDS/IPS
      if (!idsipsPort) {
        idsipsPort = 80; // Дефолтный порт для IDS/IPS
      }
      
      // Определяем протокол на основе конфигурации
      const protocol = idsipsConfig.enableSSL ? 'https' : 'http';
      
      return {
        protocol: 'tcp', // IDS/IPS работает на сетевом уровне
        sourceHost: discovery.getHost(source),
        targetHost: idsipsHost,
        sourcePort: discovery.getPort(source, 'main'),
        targetPort: idsipsPort,
        endpoint: `${protocol}://${idsipsHost}:${idsipsPort}`,
      };
    },
    
    validateConnection: (source, target, connection) => {
      // Валидация: IDS/IPS может быть транзитным компонентом между любыми компонентами
      if (!source?.data || !target?.data) {
        return { valid: false, error: 'Source or target node missing data' };
      }
      
      // IDS/IPS может быть как источником, так и целью
      const isIDSIPSSource = source.type === 'ids-ips';
      const isIDSIPSTarget = target.type === 'ids-ips';
      
      // Если IDS/IPS - это источник, то цель должна быть защищаемым компонентом
      if (isIDSIPSSource && !isIDSIPSTarget) {
        return { valid: true };
      }
      
      // Если IDS/IPS - это цель, то источник может быть любым компонентом
      if (isIDSIPSTarget && !isIDSIPSSource) {
        return { valid: true };
      }
      
      // Если оба компонента - не IDS/IPS, то это обычное соединение
      if (!isIDSIPSSource && !isIDSIPSTarget) {
        return { valid: false, error: 'At least one node must be IDS/IPS for idsips rule' };
      }
      
      // IDS/IPS не может быть соединен сам с собой (но это не критично)
      if (isIDSIPSSource && isIDSIPSTarget) {
        return { valid: false, error: 'IDS/IPS cannot be connected to itself' };
      }
      
      return { valid: true };
    },
  };
}

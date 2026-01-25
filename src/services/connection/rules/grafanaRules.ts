import { CanvasNode, CanvasConnection } from '@/types';
import { ConnectionRule, ConnectionMetadata } from '../types';
import { ServiceDiscovery } from '../ServiceDiscovery';

/**
 * Правило для Grafana -> Prometheus/Jaeger
 * Автоматически обновляет datasource URL при создании связи
 */
export function createGrafanaRule(discovery: ServiceDiscovery): ConnectionRule {
  return {
    sourceType: 'grafana',
    targetTypes: ['prometheus', 'jaeger'],
    priority: 10,
    
    updateSourceConfig: (grafana, target, connection, metadata) => {
      // Обновляем конфиг Grafana (source)
      const config = grafana.data.config || {};
      let datasources = config.datasources || [];
      
      // Определяем тип datasource на основе типа целевого компонента
      const datasourceType = target.type === 'jaeger' ? 'jaeger' : 'prometheus';
      
      // Конвертируем старый формат (массив строк) в новый формат
      if (datasources.length > 0 && typeof datasources[0] === 'string') {
        datasources = datasources.map((ds: string) => ({
          name: ds,
          type: 'prometheus' as const,
          url: 'http://localhost:9090',
          access: 'proxy' as const,
          isDefault: ds === datasources[0]
        }));
      }
      
      // Получаем URL целевого компонента через ServiceDiscovery
      const targetUrl = discovery.getURL(target, 'main');
      const targetHost = metadata.targetHost || discovery.getHost(target);
      
      // Определяем порт в зависимости от типа компонента
      let targetPort: number;
      if (datasourceType === 'jaeger') {
        // Для Jaeger используем Query endpoint (16686)
        const jaegerConfig = (target.data.config || {}) as any;
        if (jaegerConfig.queryEndpoint) {
          const urlMatch = jaegerConfig.queryEndpoint.match(/:(\d+)/);
          targetPort = urlMatch ? parseInt(urlMatch[1], 10) : 16686;
        } else {
          targetPort = metadata.targetPort || discovery.getPort(target, 'main') || 16686;
        }
      } else {
        // Для Prometheus используем стандартный порт 9090
        targetPort = metadata.targetPort || discovery.getPort(target, 'main') || 9090;
      }
      
      // Формируем URL
      const datasourceUrl = targetUrl || `http://${targetHost}:${targetPort}`;
      
      // Ищем существующий datasource того же типа
      const existingIndex = datasources.findIndex((ds: any) => 
        ds && typeof ds === 'object' && 
        (ds.type === datasourceType || 
         (datasourceType === 'prometheus' && ds.name?.toLowerCase().includes('prometheus')) ||
         (datasourceType === 'jaeger' && ds.name?.toLowerCase().includes('jaeger')))
      );
      
      if (existingIndex >= 0) {
        // Обновляем существующий datasource
        const updatedDatasources = [...datasources];
        updatedDatasources[existingIndex] = {
          ...updatedDatasources[existingIndex],
          url: datasourceUrl,
          type: datasourceType,
          isDefault: updatedDatasources[existingIndex].isDefault ?? (datasources.length === 1),
        };
        
        return { datasources: updatedDatasources };
      } else {
        // Создаем новый datasource
        const targetLabel = target.data.label || target.type;
        const datasourceName = datasourceType === 'jaeger' ? 'Jaeger' : 'Prometheus';
        const newDatasource = {
          name: datasourceName,
          type: datasourceType,
          url: datasourceUrl,
          access: 'proxy' as const,
          isDefault: datasources.length === 0,
        };
        
        return { datasources: [...datasources, newDatasource] };
      }
    },
    
    extractMetadata: (grafana, target, connection) => {
      return discovery.getConnectionMetadata(grafana, target, connection);
    },
    
    // Cleanup: при удалении связи можно оставить datasource, но пометить как неактивный
    // Или удалить, если он был создан автоматически
    cleanupSourceConfig: (grafana, target, connection, metadata) => {
      const config = grafana.data.config || {};
      let datasources = config.datasources || [];
      
      // Конвертируем старый формат если нужно
      if (datasources.length > 0 && typeof datasources[0] === 'string') {
        return null; // Старый формат, не трогаем
      }
      
      // Определяем тип datasource
      const datasourceType = target.type === 'jaeger' ? 'jaeger' : 'prometheus';
      
      // Находим datasource по URL целевого компонента
      const targetUrl = discovery.getURL(target, 'main');
      const targetHost = metadata.targetHost || discovery.getHost(target);
      let targetPort: number;
      if (datasourceType === 'jaeger') {
        targetPort = metadata.targetPort || discovery.getPort(target, 'main') || 16686;
      } else {
        targetPort = metadata.targetPort || discovery.getPort(target, 'main') || 9090;
      }
      const datasourceUrl = targetUrl || `http://${targetHost}:${targetPort}`;
      
      // Удаляем datasource, если URL совпадает
      const filteredDatasources = datasources.filter((ds: any) => 
        !(ds && typeof ds === 'object' && ds.url === datasourceUrl && ds.type === datasourceType)
      );
      
      // Если удалили все datasources, оставляем пустой массив
      if (filteredDatasources.length !== datasources.length) {
        return { datasources: filteredDatasources };
      }
      
      return null;
    },
  };
}


import { CanvasNode, CanvasConnection } from '@/types';
import { ConnectionRule, ConnectionMetadata } from '../types';
import { ServiceDiscovery } from '../ServiceDiscovery';

/**
 * Правило для Grafana -> Prometheus
 * Автоматически обновляет datasource URL при создании связи
 */
export function createGrafanaRule(discovery: ServiceDiscovery): ConnectionRule {
  return {
    sourceType: 'grafana',
    targetTypes: ['prometheus'],
    priority: 10,
    
    updateSourceConfig: (grafana, prometheus, connection, metadata) => {
      // Обновляем конфиг Grafana (source)
      const config = grafana.data.config || {};
      let datasources = config.datasources || [];
      
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
      
      // Получаем URL Prometheus через ServiceDiscovery
      const prometheusUrl = discovery.getURL(prometheus, 'main');
      const prometheusHost = metadata.targetHost || discovery.getHost(prometheus);
      const prometheusPort = metadata.targetPort || discovery.getPort(prometheus, 'main') || 9090;
      
      // Формируем URL
      const datasourceUrl = prometheusPort === 9090 
        ? `http://${prometheusHost}:${prometheusPort}`
        : prometheusUrl;
      
      // Ищем существующий Prometheus datasource
      const existingIndex = datasources.findIndex((ds: any) => 
        ds && typeof ds === 'object' && 
        (ds.type === 'prometheus' || ds.name?.toLowerCase().includes('prometheus'))
      );
      
      if (existingIndex >= 0) {
        // Обновляем существующий datasource
        const updatedDatasources = [...datasources];
        updatedDatasources[existingIndex] = {
          ...updatedDatasources[existingIndex],
          url: datasourceUrl,
          type: 'prometheus' as const,
          isDefault: updatedDatasources[existingIndex].isDefault ?? true,
        };
        
        return { datasources: updatedDatasources };
      } else {
        // Создаем новый Prometheus datasource
        const newDatasource = {
          name: 'Prometheus',
          type: 'prometheus' as const,
          url: datasourceUrl,
          access: 'proxy' as const,
          isDefault: datasources.length === 0,
        };
        
        return { datasources: [...datasources, newDatasource] };
      }
    },
    
    extractMetadata: (grafana, prometheus, connection) => {
      return discovery.getConnectionMetadata(grafana, prometheus, connection);
    },
    
    // Cleanup: при удалении связи можно оставить datasource, но пометить как неактивный
    // Или удалить, если он был создан автоматически
    cleanupSourceConfig: (grafana, prometheus, connection, metadata) => {
      const config = grafana.data.config || {};
      let datasources = config.datasources || [];
      
      // Конвертируем старый формат если нужно
      if (datasources.length > 0 && typeof datasources[0] === 'string') {
        return null; // Старый формат, не трогаем
      }
      
      // Находим datasource по URL Prometheus
      const prometheusUrl = discovery.getURL(prometheus, 'main');
      const prometheusHost = metadata.targetHost || discovery.getHost(prometheus);
      const prometheusPort = metadata.targetPort || discovery.getPort(prometheus, 'main') || 9090;
      const datasourceUrl = prometheusPort === 9090 
        ? `http://${prometheusHost}:${prometheusPort}`
        : prometheusUrl;
      
      // Удаляем datasource, если URL совпадает
      const filteredDatasources = datasources.filter((ds: any) => 
        !(ds && typeof ds === 'object' && ds.url === datasourceUrl && ds.type === 'prometheus')
      );
      
      // Если удалили все datasources, оставляем пустой массив
      if (filteredDatasources.length !== datasources.length) {
        return { datasources: filteredDatasources };
      }
      
      return null;
    },
  };
}


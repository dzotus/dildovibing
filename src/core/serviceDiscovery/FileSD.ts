import { CanvasNode } from '@/types';
import { ServiceDiscovery } from '@/services/connection/ServiceDiscovery';

/**
 * File Service Discovery Target
 * Соответствует формату Prometheus file_sd_configs
 * Формат файла: JSON массив объектов с targets и labels
 */
export interface FileSDTarget {
  // Targets из файла
  __address__?: string;
  __metrics_path__?: string;
  __scheme__?: string;
  
  // Labels из файла (любые дополнительные метки)
  [key: string]: string | undefined;
}

/**
 * File Service Discovery Configuration
 * Соответствует формату Prometheus file_sd_configs
 */
export interface FileSDConfig {
  files: string[]; // Пути к файлам с targets (JSON или YAML)
  refresh_interval?: string; // Интервал обновления (по умолчанию 5m)
  // Дополнительные настройки для симуляции
  // В симуляторе файлы могут быть виртуальными (храниться в конфиге компонента)
  virtual_files?: Array<{
    path: string;
    content: Array<{
      targets: string[];
      labels?: Record<string, string>;
    }>;
  }>;
}

/**
 * File Service Discovery
 * Симулирует работу Prometheus File Service Discovery
 * Периодически читает файлы с targets (симуляция file watcher)
 */
export class FileSD {
  private config: FileSDConfig | null = null;
  private allNodes: CanvasNode[] = [];
  private discovery: ServiceDiscovery;
  
  // Кэш для targets
  private cachedTargets: FileSDTarget[] = [];
  private lastDiscoveryTime: number = 0;
  private discoveryInterval: number = 300000; // 5 минут (по умолчанию в Prometheus)
  
  // Метрики
  private metrics = {
    targetsDiscovered: 0,
    lastDiscoveryDuration: 0,
    discoveryErrors: 0,
    filesRead: 0,
  };

  constructor(discovery: ServiceDiscovery) {
    this.discovery = discovery;
  }

  /**
   * Инициализирует File Service Discovery
   */
  initialize(
    config: FileSDConfig,
    allNodes: CanvasNode[]
  ): void {
    this.config = config;
    this.allNodes = allNodes;
    this.lastDiscoveryTime = 0;
    
    // Парсим refresh_interval
    if (config.refresh_interval) {
      this.discoveryInterval = this.parseDuration(config.refresh_interval);
    }
    
    // Выполняем первичное discovery
    this.discoverTargets();
  }

  /**
   * Обновляет список nodes (вызывается при изменении canvas)
   */
  updateNodes(allNodes: CanvasNode[]): void {
    this.allNodes = allNodes;
    // File SD не зависит от nodes напрямую, но может использовать их для разрешения имен
  }

  /**
   * Парсит duration строку (например, "5m", "30s") в миллисекунды
   */
  private parseDuration(duration: string): number {
    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) {
      return 300000; // 5 минут по умолчанию
    }
    
    const value = parseInt(match[1], 10);
    const unit = match[2];
    
    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return 300000;
    }
  }

  /**
   * Выполняет discovery targets из файлов
   * Симулирует чтение файлов и file watcher
   */
  discoverTargets(): FileSDTarget[] {
    if (!this.config) {
      return [];
    }

    const startTime = performance.now();
    
    try {
      const targets: FileSDTarget[] = [];
      this.metrics.filesRead = 0;
      
      // В реальном Prometheus файлы читаются с диска
      // В симуляторе используем virtual_files из конфига или ищем компоненты
      
      // Если есть virtual_files в конфиге - используем их
      if (this.config.virtual_files && Array.isArray(this.config.virtual_files)) {
        for (const virtualFile of this.config.virtual_files) {
          if (!virtualFile.content || !Array.isArray(virtualFile.content)) {
            continue;
          }
          
          for (const group of virtualFile.content) {
            if (!group.targets || !Array.isArray(group.targets)) {
              continue;
            }
            
            for (const targetStr of group.targets) {
              // Парсим target (может быть host:port или URL)
              const address = this.parseTarget(targetStr);
              if (!address) {
                continue;
              }
              
              const target: FileSDTarget = {
                __address__: address,
                __metrics_path__: '/metrics',
                __scheme__: 'http',
                ...(group.labels || {}),
              };
              
              targets.push(target);
            }
          }
          
          this.metrics.filesRead++;
        }
      }
      
      // Если есть files в конфиге, но нет virtual_files - пытаемся найти компоненты
      // Это симуляция - в реальности Prometheus читает файлы с диска
      if (this.config.files && this.config.files.length > 0 && targets.length === 0) {
        // Симулируем чтение файлов через поиск компонентов на canvas
        // В реальности это было бы чтение JSON/YAML файлов
        for (const filePath of this.config.files) {
          // В симуляторе можем использовать filePath как фильтр или просто игнорировать
          // Ищем компоненты, которые могут экспортировать метрики
          for (const node of this.allNodes) {
            if (node.type === 'prometheus') {
              continue;
            }

            const metricsPort = this.discovery.getPort(node, 'metrics');
            const mainPort = this.discovery.getPort(node, 'main');
            
            if (!metricsPort && !mainPort) {
              continue;
            }

            const host = this.discovery.getHost(node);
            const port = metricsPort || mainPort || 8080;
            
            const target: FileSDTarget = {
              __address__: `${host}:${port}`,
              __metrics_path__: (node.data.config?.metrics?.path || node.data.config?.metricsPath || '/metrics') as string,
              __scheme__: (node.data.config?.metrics?.scheme || 'http') as string,
              job: node.data.label || node.type,
              instance: `${host}:${port}`,
            };
            
            targets.push(target);
          }
          
          this.metrics.filesRead++;
        }
      }

      this.cachedTargets = targets;
      this.lastDiscoveryTime = Date.now();
      this.metrics.targetsDiscovered = targets.length;
      this.metrics.lastDiscoveryDuration = performance.now() - startTime;

      return targets;
    } catch (error) {
      this.metrics.discoveryErrors++;
      console.error('File SD discovery error:', error);
      return [];
    }
  }

  /**
   * Парсит target строку (host:port или URL) в host:port
   */
  private parseTarget(targetStr: string): string | null {
    if (!targetStr || typeof targetStr !== 'string') {
      return null;
    }
    
    // Если это URL - извлекаем host:port
    try {
      const url = new URL(targetStr);
      const port = url.port || (url.protocol === 'https:' ? '443' : '80');
      return `${url.hostname}:${port}`;
    } catch {
      // Если не URL - предполагаем что это уже host:port
      if (targetStr.includes(':')) {
        return targetStr;
      }
      // Если нет порта - добавляем дефолтный
      return `${targetStr}:8080`;
    }
  }

  /**
   * Получает кэшированные targets (если прошло меньше discoveryInterval)
   */
  getTargets(forceRefresh: boolean = false): FileSDTarget[] {
    const now = Date.now();
    
    if (forceRefresh || now - this.lastDiscoveryTime >= this.discoveryInterval) {
      return this.discoverTargets();
    }
    
    return this.cachedTargets;
  }

  /**
   * Получает метрики discovery
   */
  getMetrics() {
    return { ...this.metrics };
  }
}

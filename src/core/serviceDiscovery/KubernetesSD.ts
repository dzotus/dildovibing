import { CanvasNode } from '@/types';
import { KubernetesEmulationEngine, KubernetesPod } from '../KubernetesEmulationEngine';
import { ServiceDiscovery } from '@/services/connection/ServiceDiscovery';

/**
 * Kubernetes Service Discovery Target
 * Соответствует формату Prometheus kubernetes_sd_configs
 */
export interface KubernetesSDTarget {
  __meta_kubernetes_pod_name?: string;
  __meta_kubernetes_pod_ip?: string;
  __meta_kubernetes_pod_container_name?: string;
  __meta_kubernetes_pod_container_port_name?: string;
  __meta_kubernetes_pod_container_port_number?: string;
  __meta_kubernetes_pod_container_port_protocol?: string;
  __meta_kubernetes_namespace?: string;
  __meta_kubernetes_pod_node_name?: string;
  __meta_kubernetes_pod_host_ip?: string;
  __meta_kubernetes_pod_uid?: string;
  __meta_kubernetes_pod_controller_name?: string;
  __meta_kubernetes_pod_controller_kind?: string;
  
  // Service discovery
  __meta_kubernetes_service_name?: string;
  __meta_kubernetes_service_port_name?: string;
  __meta_kubernetes_service_port_number?: string;
  __meta_kubernetes_service_port_protocol?: string;
  
  // Endpoints
  __meta_kubernetes_endpoints_name?: string;
  __meta_kubernetes_endpoint_ready?: string;
  __meta_kubernetes_endpoint_port_name?: string;
  __meta_kubernetes_endpoint_port_number?: string;
  __meta_kubernetes_endpoint_port_protocol?: string;
  
  // Ingress
  __meta_kubernetes_ingress_name?: string;
  
  // Node
  __meta_kubernetes_node_name?: string;
  
  // Final target (host:port)
  __address__?: string;
  __metrics_path__?: string;
  __scheme__?: string;
  
  // Dynamic labels, annotations, and addresses (using index signature)
  // Format: __meta_kubernetes_pod_label_<key>, __meta_kubernetes_pod_annotation_<key>, etc.
  [key: string]: string | undefined;
}

/**
 * Kubernetes Service Discovery Configuration
 * Соответствует формату Prometheus kubernetes_sd_configs
 */
export interface KubernetesSDConfig {
  role: 'pod' | 'service' | 'endpoints' | 'endpointslice' | 'ingress' | 'node';
  api_server?: string;
  kubeconfig_file?: string;
  bearer_token?: string;
  bearer_token_file?: string;
  tls_config?: {
    ca_file?: string;
    cert_file?: string;
    key_file?: string;
    insecure_skip_verify?: boolean;
  };
  namespaces?: {
    names?: string[];
  };
  selectors?: Array<{
    role: string;
    label?: string;
    field?: string;
  }>;
  // Дополнительные настройки для симуляции
  kubernetes_node_id?: string; // ID компонента Kubernetes на canvas
}

/**
 * Kubernetes Service Discovery
 * Симулирует работу Prometheus Kubernetes Service Discovery
 * Периодически опрашивает Kubernetes API для получения списка ресурсов
 */
export class KubernetesSD {
  private config: KubernetesSDConfig | null = null;
  private kubernetesEngine: KubernetesEmulationEngine | null = null;
  private kubernetesNode: CanvasNode | null = null;
  private allNodes: CanvasNode[] = [];
  private discovery: ServiceDiscovery;
  
  // Кэш для targets
  private cachedTargets: KubernetesSDTarget[] = [];
  private lastDiscoveryTime: number = 0;
  private discoveryInterval: number = 30000; // 30 секунд (как в реальном Prometheus)
  
  // Метрики
  private metrics = {
    targetsDiscovered: 0,
    lastDiscoveryDuration: 0,
    discoveryErrors: 0,
  };

  constructor(discovery: ServiceDiscovery) {
    this.discovery = discovery;
  }

  /**
   * Инициализирует Kubernetes Service Discovery
   */
  initialize(
    config: KubernetesSDConfig,
    allNodes: CanvasNode[],
    kubernetesEngine?: KubernetesEmulationEngine,
    kubernetesNode?: CanvasNode
  ): void {
    this.config = config;
    this.allNodes = allNodes;
    this.kubernetesEngine = kubernetesEngine || null;
    this.kubernetesNode = kubernetesNode || null;
    this.lastDiscoveryTime = 0;
    
    // Выполняем первичное discovery
    this.discoverTargets();
  }

  /**
   * Обновляет список nodes (вызывается при изменении canvas)
   */
  updateNodes(allNodes: CanvasNode[]): void {
    this.allNodes = allNodes;
    
    // Находим Kubernetes компонент если он есть
    if (this.config?.kubernetes_node_id) {
      this.kubernetesNode = allNodes.find(n => n.id === this.config!.kubernetes_node_id) || null;
    } else {
      // Ищем первый Kubernetes компонент
      this.kubernetesNode = allNodes.find(n => n.type === 'kubernetes') || null;
    }
    
    // Если есть Kubernetes engine, обновляем его
    if (this.kubernetesNode && this.kubernetesNode.data.config) {
      // Kubernetes engine должен быть получен из EmulationEngine
      // Здесь мы только обновляем ссылку на node
    }
  }

  /**
   * Обновляет Kubernetes engine (вызывается из EmulationEngine)
   */
  updateKubernetesEngine(engine: KubernetesEmulationEngine | null): void {
    this.kubernetesEngine = engine;
  }

  /**
   * Выполняет discovery targets
   * Симулирует опрос Kubernetes API
   */
  discoverTargets(): KubernetesSDTarget[] {
    if (!this.config) {
      return [];
    }

    const startTime = performance.now();
    
    try {
      const role = this.config.role;
      let targets: KubernetesSDTarget[] = [];

      switch (role) {
        case 'pod':
          targets = this.discoverPods();
          break;
        case 'service':
          targets = this.discoverServices();
          break;
        case 'endpoints':
          targets = this.discoverEndpoints();
          break;
        case 'ingress':
          targets = this.discoverIngresses();
          break;
        case 'node':
          targets = this.discoverNodes();
          break;
        default:
          console.warn(`Unsupported Kubernetes SD role: ${role}`);
      }

      // Применяем фильтры по namespace
      if (this.config.namespaces?.names && this.config.namespaces.names.length > 0) {
        targets = targets.filter(target => {
          const namespace = target.__meta_kubernetes_namespace;
          return namespace && this.config!.namespaces!.names!.includes(namespace);
        });
      }

      // Применяем selectors если есть
      if (this.config.selectors && this.config.selectors.length > 0) {
        targets = this.filterBySelectors(targets);
      }

      this.cachedTargets = targets;
      this.lastDiscoveryTime = Date.now();
      this.metrics.targetsDiscovered = targets.length;
      this.metrics.lastDiscoveryDuration = performance.now() - startTime;

      return targets;
    } catch (error) {
      this.metrics.discoveryErrors++;
      console.error('Kubernetes SD discovery error:', error);
      return [];
    }
  }

  /**
   * Обнаруживает Pods
   */
  private discoverPods(): KubernetesSDTarget[] {
    if (!this.kubernetesEngine) {
      return [];
    }

    const targets: KubernetesSDTarget[] = [];
    const pods = this.kubernetesEngine.getPods();

    for (const pod of pods) {
      // Проверяем annotation prometheus.io/scrape=true
      const scrapeAnnotation = pod.annotations?.['prometheus.io/scrape'];
      if (scrapeAnnotation !== 'true' && scrapeAnnotation !== true) {
        // Если нет annotation, пропускаем (опционально можно включить все поды)
        continue;
      }

      // Получаем порт из annotation или используем дефолтный
      const portAnnotation = pod.annotations?.['prometheus.io/port'];
      const pathAnnotation = pod.annotations?.['prometheus.io/path'] || '/metrics';
      const schemeAnnotation = pod.annotations?.['prometheus.io/scheme'] || 'http';

      const metricsPort = portAnnotation 
        ? parseInt(String(portAnnotation), 10)
        : this.getDefaultMetricsPort(pod);

      if (!metricsPort) {
        continue;
      }

      // Создаем target для каждого контейнера с метриками
      for (const container of pod.containers || []) {
        const target: KubernetesSDTarget = {
          __meta_kubernetes_pod_name: pod.name,
          __meta_kubernetes_pod_ip: pod.podIP,
          __meta_kubernetes_pod_container_name: container.name,
          __meta_kubernetes_namespace: pod.namespace,
          __meta_kubernetes_pod_node_name: pod.nodeName,
          __meta_kubernetes_pod_host_ip: pod.hostIP,
          __meta_kubernetes_pod_uid: pod.uid,
          __address__: `${pod.podIP || pod.hostIP || 'localhost'}:${metricsPort}`,
          __metrics_path__: pathAnnotation,
          __scheme__: schemeAnnotation,
        };

        // Добавляем labels
        if (pod.labels) {
          for (const [key, value] of Object.entries(pod.labels)) {
            target[`__meta_kubernetes_pod_label_${key.replace(/[^a-zA-Z0-9_]/g, '_')}` as keyof KubernetesSDTarget] = String(value);
          }
        }

        // Добавляем annotations
        if (pod.annotations) {
          for (const [key, value] of Object.entries(pod.annotations)) {
            if (!key.startsWith('prometheus.io/')) {
              target[`__meta_kubernetes_pod_annotation_${key.replace(/[^a-zA-Z0-9_]/g, '_')}` as keyof KubernetesSDTarget] = String(value);
            }
          }
        }

        // Определяем controller
        if (pod.labels) {
          const controllerName = pod.labels['app'] || pod.labels['app.kubernetes.io/name'];
          const controllerKind = 'Deployment'; // Упрощение, в реальности нужно проверять ownerReferences
          if (controllerName) {
            target.__meta_kubernetes_pod_controller_name = controllerName;
            target.__meta_kubernetes_pod_controller_kind = controllerKind;
          }
        }

        targets.push(target);
      }
    }

    return targets;
  }

  /**
   * Обнаруживает Services
   */
  private discoverServices(): KubernetesSDTarget[] {
    if (!this.kubernetesEngine) {
      return [];
    }

    const targets: KubernetesSDTarget[] = [];
    const services = this.kubernetesEngine.getServices();

    for (const service of services) {
      // Проверяем annotation prometheus.io/scrape=true
      const scrapeAnnotation = service.annotations?.['prometheus.io/scrape'];
      if (scrapeAnnotation !== 'true' && scrapeAnnotation !== true) {
        continue;
      }

      const portAnnotation = service.annotations?.['prometheus.io/port'];
      const pathAnnotation = service.annotations?.['prometheus.io/path'] || '/metrics';
      const schemeAnnotation = service.annotations?.['prometheus.io/scheme'] || 'http';

      // Используем порты сервиса
      for (const port of service.ports || []) {
        const metricsPort = portAnnotation 
          ? parseInt(String(portAnnotation), 10)
          : (typeof port.targetPort === 'number' ? port.targetPort : port.port);

        if (!metricsPort) {
          continue;
        }

        const target: KubernetesSDTarget = {
          __meta_kubernetes_service_name: service.name,
          __meta_kubernetes_namespace: service.namespace,
          __meta_kubernetes_service_port_name: port.name,
          __meta_kubernetes_service_port_number: String(port.port),
          __meta_kubernetes_service_port_protocol: port.protocol || 'TCP',
          __address__: `${service.clusterIP || 'localhost'}:${metricsPort}`,
          __metrics_path__: pathAnnotation,
          __scheme__: schemeAnnotation,
        };

        // Добавляем labels
        if (service.labels) {
          for (const [key, value] of Object.entries(service.labels)) {
            target[`__meta_kubernetes_service_label_${key.replace(/[^a-zA-Z0-9_]/g, '_')}` as keyof KubernetesSDTarget] = String(value);
          }
        }

        // Добавляем annotations
        if (service.annotations) {
          for (const [key, value] of Object.entries(service.annotations)) {
            if (!key.startsWith('prometheus.io/')) {
              target[`__meta_kubernetes_service_annotation_${key.replace(/[^a-zA-Z0-9_]/g, '_')}` as keyof KubernetesSDTarget] = String(value);
            }
          }
        }

        targets.push(target);
      }
    }

    return targets;
  }

  /**
   * Обнаруживает Endpoints
   */
  private discoverEndpoints(): KubernetesSDTarget[] {
    if (!this.kubernetesEngine) {
      return [];
    }

    const targets: KubernetesSDTarget[] = [];
    const services = this.kubernetesEngine.getAllServices();

    for (const service of services) {
      // Для endpoints используем endpoints сервиса
      if (service.endpoints) {
        for (const endpoint of service.endpoints) {
          for (const port of endpoint.ports || []) {
            for (const address of endpoint.addresses || []) {
              const target: KubernetesSDTarget = {
                __meta_kubernetes_endpoints_name: service.name,
                __meta_kubernetes_namespace: service.namespace,
                __meta_kubernetes_endpoint_ready: 'true', // Упрощение
                __meta_kubernetes_endpoint_port_name: port.name,
                __meta_kubernetes_endpoint_port_number: String(port.port),
                __meta_kubernetes_endpoint_port_protocol: port.protocol || 'TCP',
                __address__: `${address}:${port.port}`,
                __metrics_path__: '/metrics',
                __scheme__: 'http',
              };

              targets.push(target);
            }
          }
        }
      }
    }

    return targets;
  }

  /**
   * Обнаруживает Ingresses
   */
  private discoverIngresses(): KubernetesSDTarget[] {
    // Упрощенная реализация - в реальности нужно получать ingress ресурсы
    // Для симуляции возвращаем пустой массив
    return [];
  }

  /**
   * Обнаруживает Nodes
   */
  private discoverNodes(): KubernetesSDTarget[] {
    if (!this.kubernetesEngine) {
      return [];
    }

    const targets: KubernetesSDTarget[] = [];
    const nodes = this.kubernetesEngine.getNodes();

    for (const node of nodes) {
      // Для node discovery обычно используется node-exporter на порту 9100
      const target: KubernetesSDTarget = {
        __meta_kubernetes_node_name: node.name,
        __meta_kubernetes_node_address_InternalIP: node.internalIP,
        __meta_kubernetes_node_address_ExternalIP: node.externalIP,
        __address__: `${node.internalIP || node.externalIP || 'localhost'}:9100`,
        __metrics_path__: '/metrics',
        __scheme__: 'http',
      };

      // Добавляем labels
      if (node.labels) {
        for (const [key, value] of Object.entries(node.labels)) {
          target[`__meta_kubernetes_node_label_${key.replace(/[^a-zA-Z0-9_]/g, '_')}` as keyof KubernetesSDTarget] = String(value);
        }
      }

      targets.push(target);
    }

    return targets;
  }

  /**
   * Фильтрует targets по selectors
   */
  private filterBySelectors(targets: KubernetesSDTarget[]): KubernetesSDTarget[] {
    if (!this.config?.selectors) {
      return targets;
    }

    return targets.filter(target => {
      return this.config!.selectors!.every(selector => {
        // Упрощенная реализация - в реальности нужна более сложная логика
        // Проверяем label selector
        if (selector.label) {
          const [key, value] = selector.label.split('=');
          const labelKey = `__meta_kubernetes_pod_label_${key}`;
          return target[labelKey as keyof KubernetesSDTarget] === value;
        }
        return true;
      });
    });
  }

  /**
   * Получает дефолтный порт метрик для pod
   */
  private getDefaultMetricsPort(pod: KubernetesPod): number | null {
    // Проверяем контейнеры на наличие портов метрик
    for (const container of pod.containers || []) {
      // В реальности нужно проверять порты контейнера
      // Для симуляции используем дефолтный порт 9100 или 9187
      return 9100;
    }
    return null;
  }

  /**
   * Получает кэшированные targets (если прошло меньше discoveryInterval)
   */
  getTargets(forceRefresh: boolean = false): KubernetesSDTarget[] {
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

import { CanvasNode } from '@/types';

/**
 * Валидация порта
 * @param port - порт для проверки
 * @returns true если порт валидный (1-65535)
 */
export function validatePort(port: number | string | undefined | null): boolean {
  if (port === undefined || port === null || port === '') {
    return false;
  }
  
  const portNum = typeof port === 'string' ? parseInt(port, 10) : port;
  
  if (isNaN(portNum)) {
    return false;
  }
  
  return portNum >= 1 && portNum <= 65535;
}

/**
 * Валидация хоста
 * @param host - хост для проверки
 * @returns true если хост валидный
 */
export function validateHost(host: string | undefined | null): boolean {
  if (!host || host.trim() === '') {
    return false;
  }
  
  // Базовые правила для hostname:
  // - Не пустой
  // - Не содержит пробелы
  // - Может содержать буквы, цифры, дефисы, точки
  // - Не начинается и не заканчивается дефисом или точкой
  
  const trimmed = host.trim();
  
  if (trimmed.length === 0 || trimmed.length > 253) {
    return false;
  }
  
  // Проверка на пробелы
  if (/\s/.test(trimmed)) {
    return false;
  }
  
  // Проверка формата hostname (RFC 1123)
  // Разрешаем: буквы, цифры, дефисы, точки
  const hostnameRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i;
  
  return hostnameRegex.test(trimmed);
}

/**
 * Валидация формата host:port
 * @param hostPort - строка в формате host:port
 * @returns объект с результатом валидации
 */
export function validateHostPort(hostPort: string): {
  valid: boolean;
  host?: string;
  port?: number;
  error?: string;
} {
  if (!hostPort || hostPort.trim() === '') {
    return { valid: false, error: 'Host:port не может быть пустым' };
  }
  
  const parts = hostPort.split(':');
  
  if (parts.length !== 2) {
    return { valid: false, error: 'Неверный формат. Ожидается host:port' };
  }
  
  const [host, portStr] = parts;
  
  if (!validateHost(host)) {
    return { valid: false, error: 'Неверный формат хоста' };
  }
  
  const port = parseInt(portStr, 10);
  
  if (!validatePort(port)) {
    return { valid: false, error: 'Неверный формат порта (должен быть 1-65535)' };
  }
  
  return { valid: true, host: host.trim(), port };
}

/**
 * Проверка конфликта портов между компонентами
 * @param nodes - все узлы на canvas
 * @param currentNodeId - ID текущего узла (для исключения из проверки)
 * @param host - хост для проверки
 * @param port - порт для проверки
 * @returns объект с информацией о конфликте
 */
export function checkPortConflict(
  nodes: CanvasNode[],
  currentNodeId: string,
  host: string,
  port: number
): {
  hasConflict: boolean;
  conflictingNode?: CanvasNode;
  endpoint?: string;
} {
  // Нормализуем хост (как в ServiceDiscovery)
  const normalizedHost = host
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
  
  const endpoint = `${normalizedHost}:${port}`;
  
  // Проверяем все узлы кроме текущего
  for (const node of nodes) {
    if (node.id === currentNodeId) {
      continue;
    }
    
    const nodeConfig = node.data.config || {};
    const nodeHost = nodeConfig.host || 
                     (node.data.label 
                       ? node.data.label.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
                       : node.id.slice(0, 8));
    const nodePort = nodeConfig.port || getDefaultPort(node.type);
    
    if (nodePort && nodeHost === normalizedHost && nodePort === port) {
      return {
        hasConflict: true,
        conflictingNode: node,
        endpoint,
      };
    }
  }
  
  return { hasConflict: false };
}

/**
 * Получить дефолтный порт для типа компонента
 */
function getDefaultPort(componentType: string): number | undefined {
  const DEFAULT_PORTS: Record<string, number> = {
    postgres: 5432,
    mongodb: 27017,
    redis: 6379,
    cassandra: 9042,
    clickhouse: 8123,
    elasticsearch: 9200,
    rest: 8080,
    grpc: 50051,
    graphql: 4000,
    websocket: 8080,
    webhook: 8080,
    soap: 8080,
    nginx: 80,
    envoy: 80,
    haproxy: 80,
    traefik: 80,
    docker: 2375,
    kubernetes: 6443,
    kafka: 9092,
    rabbitmq: 5672,
    activemq: 61616,
    'aws-sqs': 9324,
    prometheus: 9090,
    grafana: 3000,
    loki: 3100,
    jaeger: 16686,
    keycloak: 8080,
    'secrets-vault': 8200,
    crm: 8080,
    erp: 8080,
    'payment-gateway': 443,
  };
  
  return DEFAULT_PORTS[componentType];
}

/**
 * Получить сообщение об ошибке валидации порта
 */
export function getPortValidationError(port: number | string | undefined | null): string | null {
  if (port === undefined || port === null || port === '') {
    return 'Порт обязателен';
  }
  
  const portNum = typeof port === 'string' ? parseInt(port, 10) : port;
  
  if (isNaN(portNum)) {
    return 'Порт должен быть числом';
  }
  
  if (portNum < 1) {
    return 'Порт должен быть больше 0';
  }
  
  if (portNum > 65535) {
    return 'Порт должен быть меньше или равен 65535';
  }
  
  return null;
}

/**
 * Получить сообщение об ошибке валидации хоста
 */
export function getHostValidationError(host: string | undefined | null): string | null {
  if (!host || host.trim() === '') {
    return 'Хост обязателен';
  }
  
  const trimmed = host.trim();
  
  if (trimmed.length > 253) {
    return 'Хост слишком длинный (максимум 253 символа)';
  }
  
  if (/\s/.test(trimmed)) {
    return 'Хост не может содержать пробелы';
  }
  
  const hostnameRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i;
  
  if (!hostnameRegex.test(trimmed)) {
    return 'Неверный формат хоста (разрешены буквы, цифры, дефисы, точки)';
  }
  
  return null;
}

/**
 * Валидация имени очереди SQS
 * @param name - имя очереди для проверки
 * @param isFifo - является ли очередь FIFO
 * @returns объект с результатом валидации
 */
export function validateSQSQueueName(name: string, isFifo: boolean = false): {
  valid: boolean;
  error?: string;
} {
  if (!name || name.length === 0) {
    return { valid: false, error: 'Queue name is required' };
  }
  
  if (name.length > 80) {
    return { valid: false, error: 'Queue name must be 1-80 characters' };
  }
  
  // SQS queue name: alphanumeric, hyphens, underscores
  const queueNameRegex = /^[a-zA-Z0-9_-]+$/;
  if (!queueNameRegex.test(name)) {
    return { valid: false, error: 'Queue name can only contain alphanumeric characters, hyphens, and underscores' };
  }
  
  // FIFO queues must end with .fifo
  if (isFifo && !name.endsWith('.fifo')) {
    return { valid: false, error: 'FIFO queue name must end with .fifo' };
  }
  
  return { valid: true };
}

/**
 * Валидация AWS региона
 * @param region - регион для проверки
 * @returns объект с результатом валидации
 */
export function validateAWSRegion(region: string): {
  valid: boolean;
  error?: string;
} {
  const validRegions = [
    'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
    'eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-central-1',
    'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1', 'ap-northeast-2',
    'ap-south-1', 'sa-east-1', 'ca-central-1',
  ];
  
  if (!region || !validRegions.includes(region)) {
    return { valid: false, error: 'Invalid AWS region' };
  }
  
  return { valid: true };
}

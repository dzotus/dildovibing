/**
 * Генерирует уникальные значения по умолчанию для Snowflake компонентов
 * Без хардкода, с учетом реальных ограничений Snowflake
 */

export interface SnowflakeDefaultValues {
  account: string;
  region: string;
  cloud: 'aws' | 'azure' | 'gcp';
  warehouse: string;
  database: string;
  schema: string;
  username: string;
  role: string;
}

/**
 * Генерирует account identifier на основе node ID или timestamp
 * Формат: [a-z0-9-] (Snowflake requirements)
 */
export function generateAccountIdentifier(nodeId?: string): string {
  if (nodeId) {
    // Используем часть node ID, очищенную от спецсимволов
    const cleanId = nodeId.replace(/[^a-z0-9-]/gi, '').toLowerCase().substring(0, 20);
    if (cleanId && cleanId.length > 0) {
      return cleanId;
    }
  }
  return `account-${Date.now().toString(36)}`;
}

/**
 * Генерирует warehouse name на основе контекста
 */
export function generateWarehouseName(index: number = 0): string {
  if (index === 0) {
    return 'COMPUTE_WH'; // Стандартное имя первого warehouse
  }
  return `WAREHOUSE_${index}`;
}

/**
 * Генерирует database name
 */
export function generateDatabaseName(nodeId?: string): string {
  if (nodeId) {
    const cleanId = nodeId.replace(/[^a-zA-Z0-9_]/g, '_').toUpperCase().substring(0, 20);
    if (cleanId && cleanId.length > 0) {
      return cleanId;
    }
  }
  return `DB_${Date.now().toString(36).toUpperCase()}`;
}

/**
 * Валидирует и нормализует account identifier согласно Snowflake правилам
 */
export function validateAccountIdentifier(account: string): string | null {
  // Snowflake account identifier: alphanumeric, hyphens, underscores
  // Length: 1-255 characters
  if (!account || account.length === 0 || account.length > 255) {
    return null;
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(account)) {
    return null;
  }
  return account;
}

/**
 * Валидирует region согласно Snowflake поддерживаемым регионам
 */
export function validateRegion(region: string): boolean {
  // Список реальных Snowflake регионов
  const validRegions = [
    'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
    'eu-west-1', 'eu-west-2', 'eu-central-1',
    'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1',
    'ca-central-1', 'sa-east-1',
    // Azure regions
    'east-us-2', 'west-us-2', 'west-europe', 'southeast-asia',
    // GCP regions
    'us-central1', 'europe-west1', 'asia-east1'
  ];
  return validRegions.includes(region.toLowerCase());
}

/**
 * Генерирует полный account URL в формате Snowflake
 */
export function formatAccountUrl(account: string, region: string, cloud: 'aws' | 'azure' | 'gcp'): string {
  // Если account уже содержит точку, значит это полный формат
  if (account.includes('.')) {
    return account;
  }
  
  // Формируем полный формат: account.region.cloud
  return `${account}.${region}.${cloud}`;
}

/**
 * Получает значения по умолчанию для нового Snowflake компонента
 */
export function getSnowflakeDefaults(nodeId: string): SnowflakeDefaultValues {
  const account = generateAccountIdentifier(nodeId);
  const region = 'us-east-1'; // Можно сделать случайный выбор из валидных
  const cloud = 'aws'; // Можно сделать случайный выбор
  
  return {
    account,
    region,
    cloud,
    warehouse: generateWarehouseName(0),
    database: generateDatabaseName(nodeId),
    schema: 'PUBLIC', // Стандартная схема в Snowflake
    username: 'admin', // Можно генерировать на основе nodeId
    role: 'ACCOUNTADMIN', // Стандартная роль
  };
}

/**
 * Cloud API Gateway - Multi-Provider Types
 * 
 * Поддержка AWS API Gateway, Azure API Management, GCP Cloud Endpoints
 */

export type GatewayProvider = 'aws' | 'azure' | 'gcp';

// ============================================================================
// Общие типы (работают для всех провайдеров)
// ============================================================================

/**
 * Универсальный API endpoint
 */
export interface API {
  id: string;
  name: string;
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'ALL';
  backendUrl: string; // Единое поле вместо backend/backendUrl
  
  // Общие настройки
  enabled: boolean;
  rateLimit?: number; // per-API rate limit (requests per minute)
  timeout?: number; // Request timeout in seconds
  
  // Caching (общее для всех)
  caching?: {
    enabled: boolean;
    ttl?: number; // Cache TTL in seconds
    cacheKey?: string[]; // Cache key parameters
  };
  
  // Auth requirements (общее)
  authRequired?: boolean;
  authScopes?: string[]; // OAuth scopes или IAM permissions
  
  // Метрики (общие)
  requests?: number;
  errors?: number;
  latency?: {
    avg?: number;
    p95?: number;
    p99?: number;
  };
  
  // Провайдер-специфичные данные (опционально)
  providerMetadata?: {
    aws?: AWSAPIMetadata;
    azure?: AzureAPIMetadata;
    gcp?: GCPAPIMetadata;
  };
}

/**
 * Универсальный API Key
 */
export interface APIKey {
  id: string;
  name: string;
  key: string; // Маскированный ключ (например, "ak_live_***")
  enabled: boolean;
  
  // Привязка к API
  apiIds: string[]; // Список ID API, к которым имеет доступ
  
  // Rate limiting per key
  rateLimit?: number; // requests per minute
  quota?: {
    limit: number;
    period: 'day' | 'week' | 'month';
  };
  
  // Метрики использования
  usage?: {
    requests?: number;
    lastUsed?: string; // ISO timestamp
  };
  
  // Провайдер-специфичные данные
  providerMetadata?: {
    aws?: AWSAPIKeyMetadata;
    azure?: AzureAPIKeyMetadata;
    gcp?: GCPAPIKeyMetadata;
  };
}

/**
 * Базовая конфигурация API Gateway (общая для всех провайдеров)
 */
export interface BaseAPIGatewayConfig {
  // Провайдер
  provider: GatewayProvider;
  region: string;
  name: string;
  
  // API Routes (универсальные)
  apis?: API[];
  
  // Authentication (универсальные)
  enableAuthentication?: boolean;
  authType?: 'api-key' | 'oauth2' | 'jwt' | 'iam';
  keys?: APIKey[];
  
  // Rate Limiting (универсальные)
  enableRateLimiting?: boolean;
  defaultRateLimit?: number; // requests per minute
  
  // Throttling (универсальные)
  enableThrottling?: boolean;
  throttlingBurst?: number; // Burst capacity
  
  // Caching (универсальные)
  enableCaching?: boolean;
  cacheTTL?: number; // seconds
  
  // Observability (универсальные)
  enableLogging?: boolean;
  enableRequestLogging?: boolean;
  enableMetrics?: boolean;
  metrics?: {
    enabled?: boolean;
    port?: number;
    path?: string;
  };
  
  // Request timeout
  requestTimeout?: number; // seconds
  
  // Провайдер-специфичные настройки (текущий активный провайдер)
  providerConfig?: AWSGatewayConfig | AzureGatewayConfig | GCPGatewayConfig;
  
  // Сохраненные конфиги всех провайдеров (для переключения без потери данных)
  awsConfig?: AWSGatewayConfig;
  azureConfig?: AzureGatewayConfig;
  gcpConfig?: GCPGatewayConfig;
  
  // Статистика (вычисляемые)
  totalAPIs?: number;
  totalKeys?: number;
  totalRequests?: number;
  successRate?: number;
}

// ============================================================================
// AWS API Gateway - специфичные типы
// ============================================================================

export interface AWSGatewayConfig {
  provider: 'aws';
  
  // AWS-специфичные концепции
  restApiId?: string;
  stages?: AWSStage[];
  deployments?: AWSDeployment[];
  usagePlans?: AWSUsagePlan[];
  
  // AWS-специфичные настройки
  endpointType?: 'REGIONAL' | 'EDGE' | 'PRIVATE';
  enableXRay?: boolean;
  enableCloudWatchLogs?: boolean;
  logRetentionDays?: number;
  
  // Lambda Authorizers
  authorizers?: AWSAuthorizer[];
  
  // Request/Response трансформации
  enableRequestTransformation?: boolean;
  enableResponseTransformation?: boolean;
}

export interface AWSStage {
  id: string;
  name: string; // dev, stage, prod
  deploymentId?: string;
  cacheClusterEnabled?: boolean;
  cacheClusterSize?: '0.5' | '1.6' | '6.1' | '13.5' | '28.4' | '58.2' | '118' | '237';
  throttlingBurstLimit?: number;
  throttlingRateLimit?: number;
  variables?: Record<string, string>; // Stage variables
  description?: string;
}

export interface AWSDeployment {
  id: string;
  stageName: string;
  description?: string;
  createdDate?: string;
}

export interface AWSUsagePlan {
  id: string;
  name: string;
  description?: string;
  quota?: {
    limit: number;
    period: 'DAY' | 'WEEK' | 'MONTH';
  };
  throttle?: {
    burstLimit: number;
    rateLimit: number;
  };
  apiStages?: Array<{
    apiId: string;
    stage: string;
  }>;
  apiKeyIds?: string[];
}

export interface AWSAuthorizer {
  id: string;
  name: string;
  type: 'TOKEN' | 'REQUEST' | 'COGNITO_USER_POOLS';
  authorizerUri?: string; // Lambda ARN
  identitySource?: string;
  authorizerResultTtlInSeconds?: number;
  providerARNs?: string[]; // Cognito User Pool ARNs
}

export interface AWSAPIMetadata {
  resourceId?: string;
  integrationType?: 'HTTP' | 'AWS_PROXY' | 'AWS' | 'MOCK';
  integrationUri?: string;
  stage?: string;
}

export interface AWSAPIKeyMetadata {
  usagePlanId?: string;
  value?: string; // Полный ключ (для внутреннего использования)
}

// ============================================================================
// Azure API Management - специфичные типы
// ============================================================================

export interface AzureGatewayConfig {
  provider: 'azure';
  
  // Azure-специфичные концепции
  serviceName: string;
  resourceGroup?: string;
  sku?: 'Consumption' | 'Developer' | 'Basic' | 'Standard' | 'Premium';
  
  // Products & Subscriptions (Azure-специфичные)
  products?: AzureProduct[];
  subscriptions?: AzureSubscription[];
  
  // Policies (Azure-специфичные)
  policies?: AzurePolicy[];
  namedValues?: AzureNamedValue[];
  
  // Backends (Azure-специфичные)
  backends?: AzureBackend[];
  
  // Certificates (Azure-специфичные)
  certificates?: AzureCertificate[];
  
  // Portal settings
  enableDeveloperPortal?: boolean;
  enableManagementApi?: boolean;
  
  // Azure-специфичные настройки
  enableApplicationInsights?: boolean;
  applicationInsightsInstrumentationKey?: string;
}

export interface AzureProduct {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  state?: 'published' | 'notPublished';
  subscriptionRequired?: boolean;
  approvalRequired?: boolean;
  subscriptionsLimit?: number;
  terms?: string;
  apis?: string[]; // API IDs
}

export interface AzureSubscription {
  id: string;
  name: string;
  displayName: string;
  state?: 'active' | 'cancelled' | 'expired' | 'rejected' | 'submitted' | 'suspended';
  primaryKey: string;
  secondaryKey: string;
  productId: string;
  userId?: string;
  createdDate?: string;
  expirationDate?: string;
}

export interface AzurePolicy {
  id: string;
  name: string;
  scope: 'Global' | 'Product' | 'API' | 'Operation';
  scopeId?: string;
  policyContent: string; // XML policy
}

export interface AzureNamedValue {
  id: string;
  name: string;
  value: string;
  secret?: boolean;
  tags?: string[];
}

export interface AzureBackend {
  id: string;
  name: string;
  url: string;
  protocol?: 'http' | 'soap';
  credentials?: {
    certificate?: string[];
    query?: Record<string, string>;
    header?: Record<string, string>;
  };
  proxy?: {
    url: string;
    username?: string;
    password?: string;
  };
  tls?: {
    validateCertificateChain?: boolean;
    validateCertificateName?: boolean;
  };
}

export interface AzureCertificate {
  id: string;
  name: string;
  data?: string; // Base64 encoded certificate
  password?: string;
  subject?: string;
  thumbprint?: string;
  expirationDate?: string;
}

export interface AzureAPIMetadata {
  apiId?: string;
  revision?: string;
  isCurrent?: boolean;
  displayName?: string;
  serviceUrl?: string;
}

export interface AzureAPIKeyMetadata {
  subscriptionId?: string;
  productId?: string;
  primaryKey?: string;
  secondaryKey?: string;
}

// ============================================================================
// GCP Cloud Endpoints - специфичные типы
// ============================================================================

export interface GCPGatewayConfig {
  provider: 'gcp';
  
  // GCP-специфичные концепции
  projectId: string;
  serviceName: string;
  
  // OpenAPI/Swagger spec (GCP использует OpenAPI)
  openApiSpec?: string;
  openApiSpecUrl?: string;
  
  // Service Accounts (GCP-специфичные)
  serviceAccounts?: GCPServiceAccount[];
  
  // Quotas (GCP-специфичные)
  quotas?: GCPQuota[];
  
  // Cloud IAM (GCP-специфичные)
  iamBindings?: GCPIAMBinding[];
  
  // Cloud Logging integration
  enableCloudLogging?: boolean;
  logLevel?: 'ERROR' | 'WARNING' | 'INFO' | 'DEBUG';
  
  // Cloud Monitoring integration
  enableCloudMonitoring?: boolean;
  
  // ESP (Extensible Service Proxy) settings
  espVersion?: string;
  enableCors?: boolean;
  corsAllowOrigin?: string[];
}

export interface GCPServiceAccount {
  email: string;
  displayName?: string;
  roles?: string[];
}

export interface GCPQuota {
  id: string;
  name: string;
  metric: string; // requests, cpu, memory
  limit: number;
  unit: string;
  dimensions?: Record<string, string>;
}

export interface GCPIAMBinding {
  role: string;
  members: string[]; // serviceAccount:..., user:..., etc.
}

export interface GCPAPIMetadata {
  operationId?: string;
  operationName?: string;
  serviceConfigId?: string;
}

export interface GCPAPIKeyMetadata {
  keyId?: string;
  restrictions?: {
    apiTargets?: Array<{ service: string; methods: string[] }>;
    httpReferrers?: string[];
    ipAddresses?: string[];
  };
}

// ============================================================================
// Утилиты для работы с типами
// ============================================================================

/**
 * Type guard для проверки провайдера
 */
export function isAWSConfig(config: BaseAPIGatewayConfig): config is BaseAPIGatewayConfig & { providerConfig: AWSGatewayConfig } {
  return config.provider === 'aws';
}

export function isAzureConfig(config: BaseAPIGatewayConfig): config is BaseAPIGatewayConfig & { providerConfig: AzureGatewayConfig } {
  return config.provider === 'azure';
}

export function isGCPConfig(config: BaseAPIGatewayConfig): config is BaseAPIGatewayConfig & { providerConfig: GCPGatewayConfig } {
  return config.provider === 'gcp';
}

/**
 * Получить дефолтную конфигурацию для провайдера
 */
export function getDefaultProviderConfig(provider: GatewayProvider): AWSGatewayConfig | AzureGatewayConfig | GCPGatewayConfig {
  switch (provider) {
    case 'aws':
      return {
        provider: 'aws',
        endpointType: 'REGIONAL',
        enableXRay: false,
        enableCloudWatchLogs: true,
        logRetentionDays: 7,
        stages: [],
        usagePlans: [],
        authorizers: [],
        deployments: [],
      };
    case 'azure':
      return {
        provider: 'azure',
        serviceName: 'api-gateway',
        sku: 'Consumption',
        enableDeveloperPortal: false,
        enableManagementApi: true,
        enableApplicationInsights: false,
        products: [],
        subscriptions: [],
        policies: [],
        namedValues: [],
        backends: [],
        certificates: [],
      };
    case 'gcp':
      return {
        provider: 'gcp',
        projectId: 'my-project',
        serviceName: 'api-gateway',
        enableCloudLogging: true,
        logLevel: 'INFO',
        enableCloudMonitoring: true,
        enableCors: false,
        serviceAccounts: [],
        quotas: [],
        iamBindings: [],
      };
  }
}


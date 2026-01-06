# Архитектура мультипровайдерного Cloud API Gateway

## 🎯 Цель

Реализовать Cloud API Gateway с поддержкой **трех провайдеров**: AWS API Gateway, Azure API Management, GCP Cloud Endpoints. Каждый провайдер имеет свои особенности, но общую функциональность (маршрутизация, auth, rate limiting, caching).

---

## 📐 Архитектура

### 1. Единая абстракция (Common Layer)

**Общие концепции для всех провайдеров:**

```typescript
// src/core/api-gateway/types.ts

export type GatewayProvider = 'aws' | 'azure' | 'gcp';

export interface BaseAPIGatewayConfig {
  // Общие настройки
  provider: GatewayProvider;
  region: string;
  name: string;
  
  // API Routes (универсальные)
  apis: API[];
  
  // Authentication (универсальные)
  enableAuthentication: boolean;
  authType: 'api-key' | 'oauth2' | 'jwt' | 'iam';
  keys: APIKey[];
  
  // Rate Limiting (универсальные)
  enableRateLimiting: boolean;
  defaultRateLimit?: number;
  
  // Caching (универсальные)
  enableCaching: boolean;
  cacheTTL?: number;
  
  // Observability (универсальные)
  enableLogging: boolean;
  enableMetrics: boolean;
  metrics?: {
    enabled: boolean;
    port: number;
    path: string;
  };
  
  // Провайдер-специфичные настройки
  providerConfig: AWSGatewayConfig | AzureGatewayConfig | GCPGatewayConfig;
}
```

---

### 2. Провайдер-специфичные конфигурации

#### AWS API Gateway

```typescript
export interface AWSGatewayConfig {
  provider: 'aws';
  
  // AWS-специфичные концепции
  restApiId?: string;
  stages: AWSStage[];  // dev, stage, prod
  deployments: AWSDeployment[];
  usagePlans: AWSUsagePlan[];
  
  // AWS-специфичные настройки
  endpointType: 'REGIONAL' | 'EDGE' | 'PRIVATE';
  enableXRay: boolean;
  enableCloudWatchLogs: boolean;
  logRetentionDays?: number;
  
  // Lambda Authorizers
  authorizers: AWSAuthorizer[];
  
  // API Keys (AWS-специфичный формат)
  apiKeys: AWSAPIKey[];
  
  // Request/Response трансформации
  enableRequestTransformation: boolean;
  enableResponseTransformation: boolean;
}

export interface AWSStage {
  name: string;  // dev, stage, prod
  deploymentId?: string;
  cacheClusterEnabled: boolean;
  cacheClusterSize?: '0.5' | '1.6' | '6.1' | '13.5' | '28.4' | '58.2' | '118' | '237';
  throttlingBurstLimit?: number;
  throttlingRateLimit?: number;
  variables?: Record<string, string>;
}

export interface AWSUsagePlan {
  id: string;
  name: string;
  quota?: {
    limit: number;
    period: 'DAY' | 'WEEK' | 'MONTH';
  };
  throttle?: {
    burstLimit: number;
    rateLimit: number;
  };
  apiStages: Array<{
    apiId: string;
    stage: string;
  }>;
  apiKeyIds: string[];
}

export interface AWSAuthorizer {
  id: string;
  name: string;
  type: 'TOKEN' | 'REQUEST' | 'COGNITO_USER_POOLS';
  authorizerUri?: string;  // Lambda ARN
  identitySource?: string;
  authorizerResultTtlInSeconds?: number;
}
```

#### Azure API Management

```typescript
export interface AzureGatewayConfig {
  provider: 'azure';
  
  // Azure-специфичные концепции
  serviceName: string;
  resourceGroup?: string;
  sku: 'Consumption' | 'Developer' | 'Basic' | 'Standard' | 'Premium';
  
  // Products & Subscriptions (Azure-специфичные)
  products: AzureProduct[];
  subscriptions: AzureSubscription[];
  
  // Policies (Azure-специфичные)
  policies: AzurePolicy[];
  namedValues: AzureNamedValue[];
  
  // Backends (Azure-специфичные)
  backends: AzureBackend[];
  
  // Certificates (Azure-специфичные)
  certificates: AzureCertificate[];
  
  // Portal settings
  enableDeveloperPortal: boolean;
  enableManagementApi: boolean;
  
  // Azure-специфичные настройки
  enableApplicationInsights: boolean;
  applicationInsightsInstrumentationKey?: string;
}

export interface AzureProduct {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  state: 'published' | 'notPublished';
  subscriptionRequired: boolean;
  approvalRequired: boolean;
  subscriptionsLimit?: number;
  terms?: string;
  apis: string[];  // API IDs
}

export interface AzureSubscription {
  id: string;
  name: string;
  displayName: string;
  state: 'active' | 'cancelled' | 'expired' | 'rejected' | 'submitted' | 'suspended';
  primaryKey: string;
  secondaryKey: string;
  productId: string;
  userId?: string;
  createdDate: string;
  expirationDate?: string;
}

export interface AzurePolicy {
  id: string;
  name: string;
  scope: 'Global' | 'Product' | 'API' | 'Operation';
  scopeId?: string;
  policyContent: string;  // XML policy
}

export interface AzureBackend {
  id: string;
  name: string;
  url: string;
  protocol: 'http' | 'soap';
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
    validateCertificateChain: boolean;
    validateCertificateName: boolean;
  };
}
```

#### GCP Cloud Endpoints

```typescript
export interface GCPGatewayConfig {
  provider: 'gcp';
  
  // GCP-специфичные концепции
  projectId: string;
  serviceName: string;
  
  // OpenAPI/Swagger spec (GCP использует OpenAPI)
  openApiSpec?: string;
  openApiSpecUrl?: string;
  
  // Service Accounts (GCP-специфичные)
  serviceAccounts: GCPServiceAccount[];
  
  // API Keys (GCP-специфичный формат)
  apiKeys: GCPAPIKey[];
  
  // Quotas (GCP-специфичные)
  quotas: GCPQuota[];
  
  // Cloud IAM (GCP-специфичные)
  iamBindings: GCPIAMBinding[];
  
  // Cloud Logging integration
  enableCloudLogging: boolean;
  logLevel: 'ERROR' | 'WARNING' | 'INFO' | 'DEBUG';
  
  // Cloud Monitoring integration
  enableCloudMonitoring: boolean;
  
  // ESP (Extensible Service Proxy) settings
  espVersion?: string;
  enableCors?: boolean;
  corsAllowOrigin?: string[];
}

export interface GCPServiceAccount {
  email: string;
  displayName?: string;
  roles: string[];
}

export interface GCPQuota {
  id: string;
  name: string;
  metric: string;  // requests, cpu, memory
  limit: number;
  unit: string;
  dimensions?: Record<string, string>;
}

export interface GCPIAMBinding {
  role: string;
  members: string[];  // serviceAccount:..., user:..., etc.
}
```

---

### 3. Унифицированный интерфейс API

**Общие сущности, которые работают для всех провайдеров:**

```typescript
export interface API {
  id: string;
  name: string;
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'ALL';
  backendUrl: string;  // Единое поле вместо backend/backendUrl
  
  // Общие настройки
  enabled: boolean;
  rateLimit?: number;  // per-API rate limit
  timeout?: number;
  
  // Caching (общее для всех)
  caching?: {
    enabled: boolean;
    ttl?: number;
    cacheKey?: string[];
  };
  
  // Auth requirements (общее)
  authRequired?: boolean;
  authScopes?: string[];
  
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
    aws?: {
      resourceId?: string;
      integrationType?: 'HTTP' | 'AWS_PROXY' | 'AWS';
      integrationUri?: string;
    };
    azure?: {
      apiId?: string;
      revision?: string;
      isCurrent?: boolean;
    };
    gcp?: {
      operationId?: string;
      operationName?: string;
    };
  };
}

export interface APIKey {
  id: string;
  name: string;
  key: string;  // Маскированный ключ
  enabled: boolean;
  
  // Привязка к API
  apiIds: string[];
  
  // Rate limiting per key
  rateLimit?: number;
  quota?: {
    limit: number;
    period: 'day' | 'week' | 'month';
  };
  
  // Метрики использования
  usage?: {
    requests?: number;
    lastUsed?: string;
  };
  
  // Провайдер-специфичные данные
  providerMetadata?: {
    aws?: {
      usagePlanId?: string;
    };
    azure?: {
      subscriptionId?: string;
      productId?: string;
    };
    gcp?: {
      keyId?: string;
      restrictions?: {
        apiTargets?: Array<{ service: string; methods: string[] }>;
        httpReferrers?: string[];
        ipAddresses?: string[];
      };
    };
  };
}
```

---

### 4. Emulation Engine - Мультипровайдерная симуляция

```typescript
// src/core/api-gateway/CloudAPIGatewayEmulationEngine.ts

export class CloudAPIGatewayEmulationEngine {
  private config: BaseAPIGatewayConfig;
  private providerEngine: AWSGatewayEngine | AzureGatewayEngine | GCPGatewayEngine;
  
  constructor(config: BaseAPIGatewayConfig) {
    this.config = config;
    
    // Инициализация провайдер-специфичного движка
    switch (config.provider) {
      case 'aws':
        this.providerEngine = new AWSGatewayEngine(config.providerConfig as AWSGatewayConfig);
        break;
      case 'azure':
        this.providerEngine = new AzureGatewayEngine(config.providerConfig as AzureGatewayConfig);
        break;
      case 'gcp':
        this.providerEngine = new GCPGatewayEngine(config.providerConfig as GCPGatewayConfig);
        break;
    }
  }
  
  /**
   * Обработка входящего запроса
   */
  processRequest(message: DataMessage): GatewayResponse {
    // 1. Маршрутизация (общее для всех)
    const api = this.findRoute(message);
    if (!api) {
      return this.createErrorResponse(404, 'API not found');
    }
    
    // 2. Authentication (провайдер-специфичная логика)
    const authResult = this.providerEngine.authenticate(message, api);
    if (!authResult.success) {
      return this.createErrorResponse(authResult.statusCode, authResult.error);
    }
    
    // 3. Rate Limiting (провайдер-специфичная логика)
    const rateLimitResult = this.providerEngine.checkRateLimit(message, api, authResult.key);
    if (!rateLimitResult.allowed) {
      return this.createErrorResponse(429, 'Rate limit exceeded');
    }
    
    // 4. Caching (общее, но провайдер-специфичные настройки)
    const cacheKey = this.generateCacheKey(message, api);
    const cachedResponse = this.providerEngine.getCachedResponse(cacheKey);
    if (cachedResponse) {
      return {
        ...cachedResponse,
        metadata: { ...cachedResponse.metadata, cacheHit: true }
      };
    }
    
    // 5. Добавление gateway latency (провайдер-специфичная)
    const gatewayLatency = this.providerEngine.calculateLatency(message, api);
    
    // 6. Формирование ответа
    return {
      status: 'delivered',
      latency: gatewayLatency,
      metadata: {
        gatewayProvider: this.config.provider,
        apiId: api.id,
        cacheHit: false,
        rateLimitRemaining: rateLimitResult.remaining,
      }
    };
  }
  
  /**
   * Провайдер-специфичные расчеты метрик
   */
  calculateMetrics(): GatewayMetrics {
    const baseMetrics = {
      throughput: this.calculateThroughput(),
      latency: this.calculateLatency(),
      errorRate: this.calculateErrorRate(),
      utilization: this.calculateUtilization(),
    };
    
    // Добавление провайдер-специфичных метрик
    return {
      ...baseMetrics,
      ...this.providerEngine.getProviderSpecificMetrics(),
    };
  }
}

// Провайдер-специфичные движки

class AWSGatewayEngine {
  // AWS-специфичная логика:
  // - Lambda authorizers
  // - Usage Plans & API Keys
  // - X-Ray tracing
  // - CloudWatch Logs
  // - Stage variables
  // - Edge caching
  
  authenticate(message: DataMessage, api: API): AuthResult {
    // AWS: проверка API Key через Usage Plan
    // AWS: Lambda authorizer если настроен
    // AWS: Cognito User Pools если настроен
  }
  
  calculateLatency(message: DataMessage, api: API): number {
    // AWS: базовая latency ~50-100ms
    // AWS: + Lambda authorizer latency если есть
    // AWS: + X-Ray overhead если включен
    return 50 + (api.providerMetadata?.aws?.authorizerUri ? 20 : 0);
  }
}

class AzureGatewayEngine {
  // Azure-специфичная логика:
  // - Products & Subscriptions
  // - Policies (XML-based)
  // - Named Values
  // - Backends
  // - Application Insights
  
  authenticate(message: DataMessage, api: API): AuthResult {
    // Azure: проверка Subscription Key
    // Azure: проверка Product access
    // Azure: OAuth2/JWT через Policies
  }
  
  calculateLatency(message: DataMessage, api: API): number {
    // Azure: базовая latency ~30-80ms
    // Azure: + Policy execution overhead
    // Azure: + Application Insights overhead
    return 30 + (api.providerMetadata?.azure?.policies?.length || 0) * 5;
  }
}

class GCPGatewayEngine {
  // GCP-специфичная логика:
  // - OpenAPI spec validation
  // - Service Accounts & IAM
  // - API Keys с restrictions
  // - Cloud Logging & Monitoring
  // - ESP (Extensible Service Proxy)
  
  authenticate(message: DataMessage, api: API): AuthResult {
    // GCP: проверка API Key с restrictions
    // GCP: Service Account authentication
    // GCP: Cloud IAM проверка
  }
  
  calculateLatency(message: DataMessage, api: API): number {
    // GCP: базовая latency ~40-90ms
    // GCP: + OpenAPI validation overhead
    // GCP: + ESP overhead
    return 40 + (api.providerMetadata?.gcp?.openApiSpec ? 15 : 0);
  }
}
```

---

### 5. UI - Мультипровайдерный интерфейс

**Структура UI:**

```
APIGatewayConfigAdvanced.tsx
├── Provider Selector (AWS / Azure / GCP)
├── Common Tabs (работают для всех провайдеров):
│   ├── APIs (универсальный CRUD)
│   ├── API Keys (универсальный CRUD)
│   └── Settings (общие настройки)
└── Provider-Specific Tabs (показываются в зависимости от провайдера):
    ├── AWS:
    │   ├── Stages & Deployments
    │   ├── Usage Plans
    │   └── Lambda Authorizers
    ├── Azure:
    │   ├── Products & Subscriptions
    │   ├── Policies
    │   ├── Backends
    │   └── Named Values
    └── GCP:
        ├── OpenAPI Spec
        ├── Service Accounts
        ├── Quotas
        └── IAM Bindings
```

**Пример реализации:**

```typescript
// В APIGatewayConfigAdvanced.tsx

const [provider, setProvider] = useState<GatewayProvider>(
  config.provider || 'aws'
);

// Провайдер-специфичные компоненты
const renderProviderSpecificTabs = () => {
  switch (provider) {
    case 'aws':
      return (
        <>
          <TabsTrigger value="stages">
            <Layers className="h-4 w-4 mr-2" />
            Stages & Deployments
          </TabsTrigger>
          <TabsTrigger value="usage-plans">
            <FileText className="h-4 w-4 mr-2" />
            Usage Plans
          </TabsTrigger>
          <TabsTrigger value="authorizers">
            <Shield className="h-4 w-4 mr-2" />
            Lambda Authorizers
          </TabsTrigger>
        </>
      );
    case 'azure':
      return (
        <>
          <TabsTrigger value="products">
            <Package className="h-4 w-4 mr-2" />
            Products
          </TabsTrigger>
          <TabsTrigger value="subscriptions">
            <Key className="h-4 w-4 mr-2" />
            Subscriptions
          </TabsTrigger>
          <TabsTrigger value="policies">
            <FileText className="h-4 w-4 mr-2" />
            Policies
          </TabsTrigger>
        </>
      );
    case 'gcp':
      return (
        <>
          <TabsTrigger value="openapi">
            <FileCode className="h-4 w-4 mr-2" />
            OpenAPI Spec
          </TabsTrigger>
          <TabsTrigger value="service-accounts">
            <Users className="h-4 w-4 mr-2" />
            Service Accounts
          </TabsTrigger>
          <TabsTrigger value="quotas">
            <TrendingUp className="h-4 w-4 mr-2" />
            Quotas
          </TabsTrigger>
        </>
      );
  }
};
```

---

### 6. Различия в симуляции между провайдерами

| Аспект | AWS API Gateway | Azure API Management | GCP Cloud Endpoints |
|--------|-----------------|---------------------|---------------------|
| **Базовая latency** | 50-100ms | 30-80ms | 40-90ms |
| **Auth overhead** | +20ms (Lambda authorizer) | +5ms per policy | +15ms (OpenAPI validation) |
| **Rate limiting** | Usage Plans (per key) | Subscriptions (per subscription) | Quotas (per API key) |
| **Caching** | Edge caching (CloudFront) | In-memory cache | Cloud CDN integration |
| **Error handling** | 4xx/5xx + X-Ray | 4xx/5xx + Application Insights | 4xx/5xx + Cloud Logging |
| **Tracing** | AWS X-Ray | Application Insights | Cloud Trace |
| **Logging** | CloudWatch Logs | Application Insights | Cloud Logging |
| **Метрики** | CloudWatch Metrics | Application Insights | Cloud Monitoring |

---

## 📋 План реализации

### Этап 1: Базовая инфраструктура (2-3 часа)

1. ✅ Создать типы (`src/core/api-gateway/types.ts`):
   - `BaseAPIGatewayConfig`
   - `AWSGatewayConfig`, `AzureGatewayConfig`, `GCPGatewayConfig`
   - `API`, `APIKey` с провайдер-специфичными метаданными

2. ✅ Обновить `APIGatewayConfigAdvanced.tsx`:
   - Добавить Provider Selector
   - Интегрировать `EDGE_PROFILES['api-gateway']` в UI
   - Выровнять типы (`backend` → `backendUrl`)

### Этап 2: Провайдер-специфичные UI компоненты (4-5 часов)

3. ✅ AWS UI:
   - Stages & Deployments tab
   - Usage Plans tab
   - Lambda Authorizers tab

4. ✅ Azure UI:
   - Products & Subscriptions tab
   - Policies tab (XML editor)
   - Backends tab

5. ✅ GCP UI:
   - OpenAPI Spec editor
   - Service Accounts tab
   - Quotas tab

### Этап 3: Emulation Engine (5-6 часов)

6. ✅ Создать `CloudAPIGatewayEmulationEngine`:
   - Базовый класс с общими методами
   - Провайдер-специфичные движки (AWS/Azure/GCP)
   - Интеграция с `EmulationEngine.simulate()`

7. ✅ Реализовать провайдер-специфичную логику:
   - Authentication (разные механизмы)
   - Rate limiting (разные модели)
   - Latency calculation (разные overheads)
   - Caching (разные стратегии)

### Этап 4: Интеграция с DataFlowEngine (2-3 часа)

8. ✅ Обновить `DataFlowEngine`:
   - Вызов `CloudAPIGatewayEmulationEngine.processRequest()` перед отправкой к backend
   - Обогащение `message.metadata` провайдер-специфичными данными
   - Обработка ошибок gateway (401, 403, 429, 5xx)

### Этап 5: Метрики и синхронизация (2-3 часа)

9. ✅ Синхронизация конфига с симуляцией:
   - Изменения в UI → обновление EmulationEngine
   - Метрики из EmulationEngine → отображение в UI

10. ✅ Интеграция с MetricsOverlay:
    - Показ метрик gateway в реальном времени
    - Провайдер-специфичные метрики

### Этап 6: UX улучшения (2-3 часа)

11. ✅ Toast-уведомления для всех операций
12. ✅ Валидация провайдер-специфичных полей
13. ✅ Подсказки и документация
14. ✅ Визуальные индикаторы статуса

---

## 🎯 Итоговая оценка

**После реализации:**

- **Функциональность: 10/10** ✅
  - Все три провайдера полностью реализованы
  - Все CRUD операции работают
  - Провайдер-специфичные функции реализованы

- **UI/UX: 10/10** ✅
  - Единый интерфейс для общих функций
  - Провайдер-специфичные секции для уникальных возможностей
  - Интуитивная навигация

- **Симулятивность: 10/10** ✅
  - Реалистичное поведение для каждого провайдера
  - Различия в latency, auth, rate limiting учтены
  - Метрики отражают реальное состояние

---

## 🚀 Начинаем реализацию?

Готов начать с **Этапа 1** - создание типов и базовой инфраструктуры. Это заложит фундамент для всей мультипровайдерной архитектуры.


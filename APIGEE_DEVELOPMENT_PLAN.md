# План разработки компонента Apigee API Gateway

## Анализ текущего состояния

### ✅ Что уже реализовано

1. **ApigeeRoutingEngine** - базовый движок маршрутизации
   - Поддержка прокси (proxies)
   - Базовые политики (quota, spike-arrest, oauth, jwt, verify-api-key, cors, xml-to-json)
   - Execution Flow (PreFlow, RequestFlow, PostFlow, ErrorFlow)
   - Token bucket для Spike Arrest
   - Quota tracking
   - Кэширование токенов и API ключей

2. **UI конфигурация** - ApigeeConfigAdvanced.tsx
   - Табы: Proxies, Policies, Monitoring, Settings
   - CRUD для прокси
   - CRUD для политик
   - Базовое отображение метрик

3. **Интеграция с симуляцией**
   - Инициализация в EmulationEngine
   - Обработка в DataFlowEngine
   - Расчет метрик в simulateApigee()

### ❌ Проблемы и недостающие функции

#### ✅ ИСПРАВЛЕНО: Критические проблемы симулятивности

1. ✅ **Синхронизация конфигурации** - ИСПРАВЛЕНО
   - ✅ Добавлен метод `updateApigeeRoutingEngine()` в EmulationEngine
   - ✅ Добавлен метод `updateConfig()` в ApigeeRoutingEngine
   - ✅ Изменения в UI немедленно синхронизируются с движком
   - ✅ Изменения влияют на симуляцию без перезапуска

2. ✅ **Синхронизация метрик** - ИСПРАВЛЕНО
   - ✅ Метрики прокси обновляются из ApigeeRoutingEngine каждые 2 секунды
   - ✅ UI показывает реальные значения из симуляции
   - ✅ Добавлен useEffect для синхронизации метрик из движка

3. ✅ **Валидация токенов** - УЛУЧШЕНО
   - ✅ Убрана проверка длины (хардкод)
   - ✅ Добавлена конфигурация APIKeyConfig, OAuthTokenConfig, JWTConfig
   - ✅ Валидация по списку сконфигурированных ключей/токенов
   - ✅ Проверка expiration если настроено
   - ✅ Улучшена валидация структуры JWT

4. ✅ **Response Flow** - ДОБАВЛЕНО
   - ✅ Добавлен Response Flow для обработки ответов
   - ✅ Поддержка ResponseFlow в executionFlow политик
   - ✅ Выполнение Response Flow после получения ответа от upstream

#### ✅ ИСПРАВЛЕНО: Проблемы UI/UX

5. ✅ **Toast уведомления** - ДОБАВЛЕНО
   - ✅ Уведомления при создании/удалении прокси/политик
   - ✅ Уведомления при изменении статуса прокси
   - ✅ Уведомления об ошибках валидации

6. ✅ **Валидация полей** - ДОБАВЛЕНО
   - ✅ Валидация имени прокси (не пустое, уникальное, формат)
   - ✅ Валидация basePath (начинается с /)
   - ✅ Валидация targetEndpoint (валидный URL)
   - ✅ Валидация quota/spikeArrest (положительные числа)
   - ✅ Показ ошибок валидации под полями

7. ✅ **Адаптивные табы** - ИСПРАВЛЕНО
   - ✅ Табы переносятся на новую строку при узком экране
   - ✅ Подложка расширяется при переносе табов
   - ✅ Использован flex-wrap для TabsList

8. ✅ **Поиск и фильтрация** - РЕАЛИЗОВАНО
   - ✅ Поиск прокси по имени, base path, target endpoint
   - ✅ Фильтрация прокси по environment (dev/stage/prod)
   - ✅ Фильтрация прокси по status (deployed/undeployed)
   - ✅ Поиск политик по имени, типу, condition
   - ✅ Фильтрация политик по типу (quota, spike-arrest, oauth, jwt, etc.)
   - ✅ Фильтрация политик по execution flow (PreFlow, RequestFlow, ResponseFlow, PostFlow, ErrorFlow)
   - ✅ Кнопка очистки фильтров
   - ✅ Счетчик отфильтрованных элементов

9. ✅ **Подсказки и описания** - РЕАЛИЗОВАНО
   - ✅ Tooltips для всех полей прокси (Proxy Name, Environment, Base Path, Target Endpoint, Quota, Spike Arrest, OAuth, JWT Issuer)
   - ✅ Tooltips для полей настроек (Organization, Default Environment, API Key)
   - ✅ Tooltips для полей политик (Execution Flow, Condition)
   - ✅ Подробные описания типов политик при создании
   - ✅ Описания execution flows в tooltip

#### Недостающие функции реального Apigee

10. **API Products**
    - В реальном Apigee есть концепция API Products (группировка прокси)
    - Нет управления продуктами в UI
    - Нет связи прокси с продуктами

11. **Developer Apps и API Keys**
    - Нет управления приложениями разработчиков
    - Нет управления API ключами (сейчас только поле apiKey в settings)
    - Нет связи ключей с прокси/продуктами

12. **Environment-specific конфигурации**
    - Сейчас environment только в прокси
    - Нет отдельных конфигураций для dev/stage/prod окружений

13. **Детальная конфигурация политик**
    - Упрощенная конфигурация политик (только базовые поля)
    - Нет расширенных настроек для каждой политики
    - Нет визуального редактора условий

14. **Trace и Debug**
    - Нет инструментов для отладки запросов
    - Нет trace view для просмотра выполнения политик

15. **Analytics Dashboard**
    - Базовый monitoring tab есть, но недостаточно деталей
    - Нет графиков по времени
    - Нет разбивки по прокси/политикам

## План реализации

### Этап 1: Исправление критических проблем симулятивности

#### 1.1 Добавить метод updateApigeeRoutingEngine в EmulationEngine

**Файл**: `src/core/EmulationEngine.ts`

```typescript
/**
 * Update Apigee routing engine configuration for a node
 * Called when configuration changes in UI
 */
public updateApigeeRoutingEngine(nodeId: string): void {
  const node = this.nodes.find(n => n.id === nodeId);
  if (!node || node.type !== 'apigee') {
    return;
  }

  const routingEngine = this.apigeeRoutingEngines.get(nodeId);
  if (!routingEngine) {
    // If engine doesn't exist, initialize it
    this.initializeApigeeRoutingEngine(node);
    return;
  }

  const config = (node.data.config || {}) as any;
  
  // Update configuration without full reinitialization
  routingEngine.initialize({
    organization: config.organization,
    environment: config.environment,
    proxies: config.proxies || [],
    policies: config.policies || [],
  });
}
```

#### 1.2 Добавить метод updateConfig в ApigeeRoutingEngine

**Файл**: `src/core/ApigeeRoutingEngine.ts`

Добавить метод для обновления конфигурации без полной переинициализации (сохраняя состояние кэшей и метрик).

#### 1.3 Синхронизация конфигурации в UI

**Файл**: `src/components/config/integration/ApigeeConfigAdvanced.tsx`

- Добавить useEffect для синхронизации с EmulationEngine при изменении конфигурации
- Вызывать `emulationEngine.updateApigeeRoutingEngine(componentId)` при изменениях
- Использовать useCallback для updateConfig с синхронизацией

#### 1.4 Синхронизация метрик из движка в UI

**Файл**: `src/components/config/integration/ApigeeConfigAdvanced.tsx`

- Добавить useEffect для чтения метрик из ApigeeRoutingEngine
- Обновлять метрики прокси (requestCount, errorCount, avgResponseTime) из движка
- Синхронизировать каждые 2 секунды или при изменении движка

#### 1.5 Добавить Response Flow

**Файл**: `src/core/ApigeeRoutingEngine.ts`

- Добавить поддержку Response Flow в executePolicies()
- Обновить типы: `executionFlow?: 'PreFlow' | 'RequestFlow' | 'ResponseFlow' | 'PostFlow' | 'ErrorFlow'`
- Добавить метод executeResponseFlowPolicy()
- Обновить routeRequest() для выполнения Response Flow после получения ответа

### Этап 2: Улучшение валидации и безопасности

#### 2.1 Улучшить валидацию API Keys

**Файл**: `src/core/ApigeeRoutingEngine.ts`

- Добавить конфигурацию API Keys в ApigeeConfig
- Хранить список валидных ключей с привязкой к consumer/app
- Валидировать формат ключа (не только длину)
- Добавить expiration для ключей

#### 2.2 Улучшить валидацию OAuth токенов

**Файл**: `src/core/ApigeeRoutingEngine.ts`

- Добавить конфигурацию OAuth provider
- Валидировать структуру токена (не только длину)
- Проверять expiration из payload токена
- Добавить поддержку refresh tokens

#### 2.3 Улучшить валидацию JWT токенов

**Файл**: `src/core/ApigeeRoutingEngine.ts`

- Добавить конфигурацию JWT issuers с публичными ключами
- Валидировать структуру JWT (header.payload.signature)
- Проверять issuer, audience, expiration
- Валидировать подпись (упрощенно, без реальной криптографии)

### Этап 3: Улучшение UI/UX

#### 3.1 Добавить toast уведомления

**Файл**: `src/components/config/integration/ApigeeConfigAdvanced.tsx`

- Использовать toast из `@/hooks/use-toast` или аналогичный
- Показывать уведомления при:
  - Создании/удалении прокси
  - Создании/удалении политик
  - Изменении статуса прокси (deploy/undeploy)
  - Ошибках валидации

#### 3.2 Добавить валидацию полей

**Файл**: `src/components/config/integration/ApigeeConfigAdvanced.tsx`

- Валидация имени прокси (не пустое, уникальное, формат)
- Валидация basePath (начинается с /, валидный путь)
- Валидация targetEndpoint (валидный URL)
- Валидация quota/spikeArrest (положительные числа)
- Показывать ошибки валидации под полями

#### 3.3 Сделать табы адаптивными

**Файл**: `src/components/config/integration/ApigeeConfigAdvanced.tsx`

- Использовать flex-wrap для TabsList
- Добавить адаптивные стили для узких экранов
- Расширять подложку при переносе табов

#### 3.4 Добавить поиск и фильтрацию

**Файл**: `src/components/config/integration/ApigeeConfigAdvanced.tsx`

- Добавить поле поиска для прокси
- Добавить фильтры: по environment, по status
- Добавить поиск для политик
- Фильтры по типу политики, execution flow

#### 3.5 Добавить подсказки и описания

**Файл**: `src/components/config/integration/ApigeeConfigAdvanced.tsx`

- Использовать Tooltip для полей
- Добавить описания для каждой политики
- Добавить help text под полями
- Добавить ссылки на документацию Apigee

### Этап 4: Расширение функциональности (соответствие реальному Apigee)

#### 4.1 API Products

**Файл**: `src/components/config/integration/ApigeeConfigAdvanced.tsx`
**Файл**: `src/core/ApigeeRoutingEngine.ts`

- Добавить таб "Products"
- CRUD для API Products
- Связь прокси с продуктами (many-to-many)
- Конфигурация квот на уровне продукта
- Отображение продуктов в UI

#### 4.2 Developer Apps и API Keys

**Файл**: `src/components/config/integration/ApigeeConfigAdvanced.tsx`
**Файл**: `src/core/ApigeeRoutingEngine.ts`

- Добавить таб "Developer Apps"
- CRUD для приложений разработчиков
- Управление API ключами для каждого приложения
- Связь приложений с продуктами
- Генерация ключей
- Отображение использования ключей

#### 4.3 Environment-specific конфигурации ✅ ВЫПОЛНЕНО

**Файл**: `src/components/config/integration/ApigeeConfigAdvanced.tsx`
**Файл**: `src/core/ApigeeRoutingEngine.ts`

- ✅ Добавлен переключатель environment в UI с визуальными индикаторами
- ✅ Визуальный индикатор активного environment в верхней части интерфейса
- ✅ Синхронизация с движком при переключении через updateConfig и useEffect
- ✅ Показывается активный environment с цветными индикаторами (dev/stage/prod)
- ✅ При создании нового прокси используется активный environment
- ✅ Фильтрация продуктов по активному environment
- ✅ Toast уведомления при переключении environment
- ✅ Обновлен Settings таб для ясности

#### 4.4 Детальная конфигурация политик

**Файл**: `src/components/config/integration/ApigeeConfigAdvanced.tsx`

- Добавить модальное окно для редактирования политики
- Расширенные настройки для каждой политики:
  - Quota: Allow count, Interval, TimeUnit, Distributed, Synchronized
  - Spike Arrest: Rate, TimeUnit
  - OAuth: Token endpoint, Client credentials, Scopes
  - JWT: Issuer, Audience, Public key, Algorithm
  - Verify API Key: Key name, Location (header/query)
  - CORS: Origins, Methods, Headers, Max age, Credentials
  - XML to JSON: Options, Attributes, Namespaces
- Визуальный редактор условий (condition)

#### 4.5 Trace и Debug

**Файл**: `src/components/config/integration/ApigeeConfigAdvanced.tsx`

- Добавить таб "Trace"
- Показывать последние N запросов
- Отображать выполнение политик для каждого запроса
- Показывать время выполнения каждой политики
- Фильтры по прокси, статусу, времени

#### 4.6 Analytics Dashboard

**Файл**: `src/components/config/integration/ApigeeConfigAdvanced.tsx`

- Расширить таб "Monitoring"
- Добавить графики (использовать Recharts):
  - Requests over time
  - Error rate over time
  - Latency over time (p50, p99)
  - Throughput by proxy
- Таблицы с детальной статистикой
- Фильтры по времени (1h, 24h, 7d, 30d)

### Этап 5: Оптимизация и очистка

#### 5.1 Удалить хардкод

- Убрать дефолтные значения политик из UI
- Использовать конфигурацию вместо хардкода
- Убрать магические числа

#### 5.2 Оптимизировать производительность

- Мемоизация компонентов
- Оптимизация useEffect зависимостей
- Debounce для поиска/фильтров

#### 5.3 Улучшить обработку ошибок

- Try-catch для всех операций
- Graceful degradation при ошибках
- Логирование ошибок

## Приоритеты реализации

### Критично (сначала)
1. ✅ Этап 1: Исправление критических проблем симулятивности
   - ✅ 1.1: Добавлен метод updateApigeeRoutingEngine в EmulationEngine
   - ✅ 1.2: Добавлен метод updateConfig в ApigeeRoutingEngine
   - ✅ 1.3: Синхронизация конфигурации в UI с движком
   - ✅ 1.4: Синхронизация метрик из движка в UI
   - ✅ 1.5: Добавлен Response Flow в ApigeeRoutingEngine
2. ✅ Этап 2: Улучшение валидации и безопасности
   - ✅ 2.1: Улучшена валидация API Keys (убрана проверка длины, добавлена конфигурация)
   - ✅ 2.2: Улучшена валидация OAuth токенов (убрана проверка длины, добавлена конфигурация)
   - ✅ 2.3: Улучшена валидация JWT токенов (убрана проверка длины, добавлена конфигурация)
3. ✅ Этап 3.1-3.3: Базовые улучшения UI/UX
   - ✅ 3.1: Добавлены toast уведомления для всех операций
   - ✅ 3.2: Добавлена валидация полей (имя прокси, basePath, targetEndpoint)
   - ✅ 3.3: Табы сделаны адаптивными (flex-wrap)
   - ✅ Убран хардкод дефолтных политик из UI

### Важно (затем)
4. ✅ Этап 3.4-3.5: Поиск, фильтрация, подсказки - ВЫПОЛНЕНО
   - ✅ 3.4: Поиск и фильтрация для прокси и политик
   - ✅ 3.5: Подсказки и описания (tooltips) для всех полей
5. ✅ Этап 4.1-4.3: API Products, Developer Apps, Environments - ВЫПОЛНЕНО
   - ✅ 4.1: API Products - РЕАЛИЗОВАНО
     - ✅ Добавлены типы ApigeeProduct в ApigeeRoutingEngine
     - ✅ Добавлена поддержка продуктов в движке (getProducts, getProduct, getProductsForProxy)
     - ✅ Добавлен таб "Products" в UI
     - ✅ Реализованы CRUD операции для продуктов
     - ✅ Реализована связь прокси с продуктами (many-to-many через чекбоксы)
     - ✅ Добавлена конфигурация квот на уровне продукта
     - ✅ Добавлена фильтрация по environments для продуктов
     - ✅ Добавлен поиск продуктов по имени, display name, описанию
     - ✅ Синхронизация продуктов с движком через EmulationEngine
   - ✅ 4.2: Developer Apps и API Keys - РЕАЛИЗОВАНО
     - ✅ Добавлены интерфейсы DeveloperApp и DeveloperAppKey в ApigeeRoutingEngine
     - ✅ Добавлена поддержка Developer Apps в движке (getDeveloperApps, getDeveloperApp, getDeveloperAppsForProduct)
     - ✅ Добавлена генерация API ключей (generateApiKey)
     - ✅ Добавлен трекинг использования ключей (keyUsageMetrics)
     - ✅ Добавлен таб "Developer Apps" в UI
     - ✅ Реализованы CRUD операции для приложений
     - ✅ Реализовано управление API ключами (создание, удаление, отображение)
     - ✅ Реализована связь приложений с продуктами через UI (чекбоксы)
     - ✅ Добавлено отображение метрик использования ключей (requestCount, lastUsed)
     - ✅ Синхронизация Developer Apps с движком через EmulationEngine
     - ✅ API ключи из Developer Apps автоматически добавляются в apiKeys для валидации
   - ✅ 4.3: Environment-specific конфигурации - РЕАЛИЗОВАНО
     - ✅ Добавлен визуальный индикатор активного environment в верхней части интерфейса
     - ✅ Добавлен переключатель environment с визуальными индикаторами (цветные точки для dev/stage/prod)
     - ✅ При переключении environment синхронизируется с движком через updateConfig
     - ✅ При создании нового прокси используется активный environment вместо хардкода
     - ✅ Фильтрация продуктов по активному environment (показываются только продукты, доступные в активном environment)
     - ✅ Toast уведомления при переключении environment
     - ✅ Обновлен Settings таб для ясности (переименован "Default Environment" в "Active Environment")
     - ✅ Синхронизация environment с движком при изменениях через useEffect

### Желательно (в конце)
6. ✅ Этап 4.4: Детальная конфигурация политик - ВЫПОЛНЕНО
   - ✅ Добавлено модальное окно для детальной конфигурации политик
   - ✅ Реализованы расширенные настройки для Quota (Allow count, Interval, TimeUnit, Distributed, Synchronized)
   - ✅ Реализованы расширенные настройки для Spike Arrest (Rate, TimeUnit)
   - ✅ Реализованы расширенные настройки для OAuth (Token endpoint, Client credentials, Scopes)
   - ✅ Реализованы расширенные настройки для JWT (Issuer, Audience, Public key, Algorithm)
   - ✅ Реализованы расширенные настройки для Verify API Key (Key name, Location)
   - ✅ Реализованы расширенные настройки для CORS (Origins, Methods, Headers, Max age, Credentials)
   - ✅ Реализованы расширенные настройки для XML to JSON (Options, Attributes, Namespaces)
   - ✅ Обновлен ApigeeRoutingEngine для использования детальной конфигурации (timeUnit, CORS settings, XML to JSON options)
   - ✅ Все настройки сохраняются в policy.config и влияют на симуляцию
7. ⏳ Этап 4.5-4.6: Trace и Debug, Analytics Dashboard
8. ⏳ Этап 5: Оптимизация и очистка

## Критерии качества

### Функциональность (10/10)
- [x] ✅ Все изменения конфигурации синхронизируются с симуляцией
- [x] ✅ Метрики отражают реальное состояние из движка
- [x] ✅ Валидация токенов реалистична (не только длина)
- [x] ✅ Response Flow работает корректно
- [x] ✅ Все CRUD операции работают
- [x] ✅ Валидация данных корректна

### UI/UX (10/10)
- [x] ✅ Toast уведомления для всех операций
- [x] ✅ Валидация полей с показом ошибок
- [x] ✅ Табы адаптивные
- [x] ✅ Поиск и фильтрация работают (реализовано)
- [x] ✅ Подсказки и описания помогают пользователю (реализовано)
- [x] ✅ Навигация интуитивна

### Симулятивность (10/10)
- [x] ✅ Компонент влияет на метрики системы
- [x] ✅ Метрики отражают реальное состояние
- [x] ✅ Конфигурация влияет на поведение
- [x] ✅ Интеграция с другими компонентами работает
- [x] ✅ Валидация токенов реалистична
- [x] ✅ Политики выполняются в правильном порядке

## Технические детали

### Синхронизация конфигурации

```typescript
// В ApigeeConfigAdvanced.tsx
const updateConfig = useCallback((updates: Partial<ApigeeConfig>) => {
  const newConfig = { ...config, ...updates };
  
  // Update node config first
  updateNode(componentId, {
    data: {
      ...node.data,
      config: newConfig,
    },
  });
  
  // Immediately update emulation engine
  emulationEngine.updateApigeeRoutingEngine(componentId);
}, [componentId, node, config, updateNode]);
```

### Синхронизация метрик

```typescript
// В ApigeeConfigAdvanced.tsx
useEffect(() => {
  const routingEngine = emulationEngine.getApigeeRoutingEngine(componentId);
  if (!routingEngine) return;
  
  // Update proxy metrics from engine
  const updatedProxies = proxies.map(proxy => {
    const metrics = routingEngine.getProxyMetrics(proxy.name);
    if (metrics) {
      return {
        ...proxy,
        requestCount: metrics.requestCount,
        errorCount: metrics.errorCount,
        avgResponseTime: metrics.avgResponseTime,
      };
    }
    return proxy;
  });
  
  if (JSON.stringify(updatedProxies) !== JSON.stringify(proxies)) {
    updateConfig({ proxies: updatedProxies });
  }
}, [routingEngine, componentId]);
```

### Валидация API Keys

```typescript
// В ApigeeRoutingEngine.ts
interface APIKeyConfig {
  key: string;
  consumerId: string;
  appId: string;
  products: string[];
  expiresAt?: number;
  createdAt: number;
}

private validateApiKey(apiKey: string): boolean {
  // Check cache first
  const cached = this.apiKeyCache.get(apiKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.valid;
  }

  // Check against configured API keys
  const keyConfig = this.apiKeys.find(k => k.key === apiKey);
  if (!keyConfig) {
    this.apiKeyCache.set(apiKey, {
      valid: false,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });
    return false;
  }
  
  // Check expiration
  if (keyConfig.expiresAt && keyConfig.expiresAt < Date.now()) {
    this.apiKeyCache.set(apiKey, {
      valid: false,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });
    return false;
  }
  
  this.apiKeyCache.set(apiKey, {
    valid: true,
    consumerId: keyConfig.consumerId,
    expiresAt: Date.now() + 5 * 60 * 1000,
  });
  return true;
}
```

## Заметки

- Не использовать хардкод - все значения из конфигурации
- Не делать по аналогии с другими компонентами - Apigee уникален
- Следовать реальному Apigee по функциональности и UI
- Все изменения должны влиять на симуляцию
- Метрики должны быть реальными, не статичными

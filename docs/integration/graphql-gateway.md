# GraphQL Gateway - Документация компонента

## Обзор

GraphQL Gateway - это федеративный GraphQL API Gateway, предназначенный для объединения множества GraphQL сервисов в единую точку входа. Компонент GraphQL Gateway в системе симуляции полностью эмулирует поведение реального GraphQL Gateway (например, Apollo Gateway, GraphQL Mesh), включая федерацию, кэширование, rate limiting, анализ сложности запросов, планирование выполнения и метрики производительности.

### Основные возможности

- ✅ **Federation** - Объединение нескольких GraphQL сервисов в единый суперграф (Federation v1/v2)
- ✅ **Service Registry** - Автоматическая регистрация и управление backend GraphQL сервисами
- ✅ **Query Planning** - Интеллектуальное планирование выполнения запросов с оценкой latency
- ✅ **Query Execution** - Параллельное выполнение подзапросов к различным сервисам
- ✅ **Caching** - Кэширование запросов с настраиваемым TTL и persisted queries
- ✅ **Rate Limiting** - Ограничение количества запросов в минуту (глобальный лимит)
- ✅ **Query Complexity Analysis** - Анализ глубины и сложности запросов с отклонением опасных запросов
- ✅ **Introspection** - Поддержка GraphQL introspection для разработки
- ✅ **Subscriptions** - Поддержка GraphQL subscriptions (опционально)
- ✅ **Метрики в реальном времени** - Отслеживание запросов, ошибок, latency percentiles, cache hit rate, federation statistics

---

## Основные функции

### 1. Управление Services (Backend GraphQL сервисы)

**Описание:** Services представляют backend GraphQL сервисы, которые подключены к gateway через соединения на канвасе.

**Параметры Service:**
- **id** - Уникальный идентификатор (генерируется автоматически)
- **name** - Имя сервиса (обязательно, уникальное)
- **endpoint** - URL endpoint сервиса (обязательно)
- **schema** - GraphQL схема сервиса (опционально, может быть получена через introspection)
- **status** - Статус: `connected`, `disconnected`, `error` (определяется автоматически на основе соединений)
- **requests** - Количество запросов к сервису (обновляется в реальном времени)
- **errors** - Количество ошибок (обновляется в реальном времени)
- **avgLatencyMs** - Средняя latency сервиса в миллисекундах (опционально)
- **errorRate** - Процент ошибок (опционально)

**Автоматическая регистрация:**
- Сервисы автоматически регистрируются при создании соединения от GraphQL Gateway к GraphQL ноде на канвасе
- Статус сервиса (`connected`/`disconnected`) определяется наличием активного соединения
- Метрики сервисов (requests, errors, latency) синхронизируются из `ServiceRegistry` каждые 2 секунды во время симуляции

**Пример конфигурации:**
```json
{
  "services": [
    {
      "id": "user-service-1",
      "name": "User Service",
      "endpoint": "http://user-service:4001/graphql",
      "status": "connected"
    },
    {
      "id": "order-service-1",
      "name": "Order Service",
      "endpoint": "http://order-service:4002/graphql",
      "status": "connected"
    }
  ]
}
```

### 2. Federation (Федерация)

**Описание:** Federation позволяет объединить несколько GraphQL сервисов в единый суперграф, где каждый сервис предоставляет часть общей схемы.

**Параметры Federation:**
- **enabled** - Включена ли федерация (по умолчанию: `false`)
- **services** - Список ID сервисов, участвующих в федерации (массив строк)
- **version** - Версия федерации: `'1'` или `'2'` (по умолчанию: `'2'`)
- **supergraph** - Скомпилированная суперграф-схема (генерируется автоматически)
- **supergraphVersion** - Версия суперграфа (опционально)
- **lastCompositionAt** - Время последней композиции схемы (опционально)
- **compositionStatus** - Статус композиции: `'ok'`, `'error'`, `'degraded'` (опционально)
- **compositionIssues** - Список проблем при композиции (массив строк, опционально)

**Как работает:**
- При включении федерации `FederationComposer` объединяет схемы всех указанных сервисов
- `QueryPlanner` анализирует запрос и определяет, какие сервисы нужны для его выполнения
- Запрос разбивается на подзапросы, которые выполняются параллельно к соответствующим сервисам
- Результаты объединяются в единый ответ

**Federation Overhead:**
- Федерация добавляет overhead к latency запроса (планирование, объединение результатов)
- Overhead настраивается через `variability.federationOverheadMs` (по умолчанию: 5-15ms)

**Пример конфигурации:**
```json
{
  "federation": {
    "enabled": true,
    "services": ["user-service-1", "order-service-1"],
    "version": "2",
    "compositionStatus": "ok"
  }
}
```

### 3. Query Planning и Execution

**Описание:** Gateway анализирует GraphQL запрос и планирует его выполнение, разбивая на подзапросы к различным сервисам.

**Процесс обработки запроса:**

1. **Parsing** - Парсинг GraphQL запроса (`QueryParser`)
2. **Rate Limiting** - Проверка лимитов запросов (`RateLimiter`)
3. **Cache Check** - Проверка кэша (`CacheManager`)
4. **Complexity Analysis** - Анализ сложности запроса (`QueryComplexityAnalyzer`)
5. **Query Planning** - Планирование выполнения (`QueryPlanner`)
6. **Query Execution** - Выполнение подзапросов (`QueryExecutor`)
7. **Cache Store** - Сохранение результата в кэш (если применимо)

**QueryPlan:**
- **subqueries** - Список подзапросов к сервисам
- **requiresFederation** - Требуется ли федерация для выполнения
- **estimatedLatency** - Оценка latency выполнения (мс)

**SubQuery:**
- **serviceId** - ID сервиса
- **serviceName** - Имя сервиса
- **endpoint** - Endpoint сервиса
- **query** - GraphQL подзапрос
- **fields** - Список полей, запрашиваемых из этого сервиса
- **estimatedLatency** - Оценка latency для этого подзапроса

### 4. Caching (Кэширование)

**Описание:** Gateway кэширует результаты запросов для уменьшения нагрузки на backend сервисы и улучшения latency.

**Параметры кэширования:**
- **cacheTtl** - Время жизни кэша в секундах (по умолчанию: 0, кэш отключен)
- **persistQueries** - Включить ли persisted queries (по умолчанию: `false`)

**Метрики кэша:**
- **cacheHitCount** - Количество попаданий в кэш
- **cacheMissCount** - Количество промахов кэша
- **cacheSize** - Размер кэша (количество записей)
- **cacheHitRate** - Процент попаданий в кэш (cacheHitCount / (cacheHitCount + cacheMissCount) * 100)

**Как работает:**
- При `cacheTtl > 0` результаты успешных запросов сохраняются в кэш
- Ключ кэша формируется из query и variables
- При повторном запросе с теми же query и variables возвращается результат из кэша (cache hit)
- Cache hit значительно уменьшает latency (обычно < 1ms vs 50-200ms для обычного запроса)

**Пример конфигурации:**
```json
{
  "cacheTtl": 300,
  "persistQueries": true
}
```

### 5. Rate Limiting (Ограничение скорости)

**Описание:** Gateway ограничивает количество запросов для защиты от злоупотреблений.

**Параметры:**
- **enableRateLimiting** - Включить ли rate limiting (по умолчанию: `false`)
- **globalRateLimitPerMinute** - Глобальный лимит запросов в минуту (обязательно, если rate limiting включен)

**Как работает:**
- `RateLimiter` отслеживает количество запросов по идентификатору (IP, API key, user ID из headers)
- При превышении лимита запрос отклоняется с кодом 429 (Too Many Requests)
- Лимит применяется глобально ко всем запросам через gateway

**Пример конфигурации:**
```json
{
  "enableRateLimiting": true,
  "globalRateLimitPerMinute": 1000
}
```

### 6. Query Complexity Analysis (Анализ сложности)

**Описание:** Gateway анализирует сложность и глубину GraphQL запросов для защиты от чрезмерно сложных запросов.

**Параметры:**
- **enableQueryComplexityAnalysis** - Включить ли анализ сложности (по умолчанию: `true`)
- **maxQueryDepth** - Максимальная глубина запроса (по умолчанию: 15)
- **maxQueryComplexity** - Максимальная сложность запроса (по умолчанию: 1000)

**Как работает:**
- `QueryComplexityAnalyzer` анализирует структуру запроса (количество полей, вложенность, аргументы)
- Вычисляется общая сложность запроса на основе количества полей и их вложенности
- Запросы, превышающие лимиты, отклоняются с кодом 413 (Payload Too Large)

**Пример конфигурации:**
```json
{
  "enableQueryComplexityAnalysis": true,
  "maxQueryDepth": 10,
  "maxQueryComplexity": 500
}
```

### 7. Features (Дополнительные функции)

**Параметры:**
- **enableIntrospection** - Разрешить ли GraphQL introspection (по умолчанию: `false`)
- **subscriptions** - Поддержка GraphQL subscriptions (по умолчанию: `false`)
- **enableQueryBatching** - Поддержка batch запросов (опционально)

**Introspection:**
- GraphQL introspection позволяет клиентам получать информацию о схеме
- Полезно для разработки, но может быть отключено в production для безопасности

**Subscriptions:**
- Поддержка GraphQL subscriptions для real-time обновлений
- Требует WebSocket соединения

### 8. Variability Configuration (Конфигурация вариативности)

**Описание:** Настройки для управления вариативностью поведения gateway без хардкода.

**Параметры:**
- **latencyJitterMultiplier** - Множитель джиттера latency (0 = без джиттера, по умолчанию: 1.0)
- **baseRandomErrorRate** - Базовый уровень случайных ошибок (0-1, по умолчанию: 0)
- **federationOverheadMs** - Дополнительный overhead на федерацию в миллисекундах (по умолчанию: 5-15ms)

**Пример конфигурации:**
```json
{
  "variability": {
    "latencyJitterMultiplier": 0.1,
    "baseRandomErrorRate": 0.001,
    "federationOverheadMs": 10
  }
}
```

### 9. Endpoint Configuration

**Параметры:**
- **endpoint** - Путь endpoint gateway (по умолчанию: `/graphql`)

**Пример:**
```json
{
  "endpoint": "/graphql"
}
```

---

## Руководство пользователя

### Быстрый старт

1. **Добавление компонента GraphQL Gateway:**
   - Перетащите компонент "GraphQL Gateway" из библиотеки компонентов на canvas
   - Откройте панель конфигурации компонента

2. **Подключение GraphQL сервисов:**
   - Создайте GraphQL ноды на канвасе (например, User Service, Order Service)
   - Создайте соединения от GraphQL Gateway к GraphQL нодам
   - Сервисы автоматически регистрируются в gateway

3. **Настройка федерации (опционально):**
   - Перейдите на вкладку **"Federation"**
   - Включите федерацию
   - Выберите сервисы для федерации
   - Выберите версию федерации (v1 или v2)

4. **Настройка кэширования:**
   - Перейдите на вкладку **"Performance & Cache"**
   - Установите `cacheTtl` (время жизни кэша в секундах)
   - Включите `persistQueries` при необходимости

5. **Настройка безопасности:**
   - Перейдите на вкладку **"Security & Limits"**
   - Включите rate limiting и установите `globalRateLimitPerMinute`
   - Настройте лимиты сложности запросов (`maxQueryDepth`, `maxQueryComplexity`)

### Работа с Services

#### Просмотр сервисов

1. Перейдите на вкладку **"Services"**
2. Просмотрите список всех зарегистрированных сервисов
3. Для каждого сервиса отображаются:
   - Имя и endpoint
   - Статус (connected/disconnected/error)
   - Метрики (requests, errors) в реальном времени

#### Добавление сервиса вручную

1. На вкладке **"Services"** нажмите кнопку **"Add Service"**
2. Заполните параметры:
   - **Name** - Имя сервиса
   - **Endpoint** - URL endpoint сервиса
   - **Schema** - GraphQL схема (опционально)
3. Нажмите **"Save"**

**Примечание:** Обычно сервисы добавляются автоматически при создании соединений с GraphQL нодами на канвасе.

#### Удаление сервиса

1. Выберите сервис из списка
2. Нажмите кнопку **"Delete"** (иконка корзины)
3. Подтвердите удаление

### Работа с Federation

#### Включение федерации

1. Перейдите на вкладку **"Federation"**
2. Включите переключатель **"Enable Federation"**
3. Выберите версию федерации (v1 или v2)
4. Добавьте сервисы в список federated services:
   - Нажмите **"Add Service"**
   - Выберите сервис из списка доступных
5. Суперграф-схема генерируется автоматически

#### Управление federated services

- **Добавление:** Нажмите **"Add Service"** и выберите сервис из списка
- **Удаление:** Нажмите кнопку **"X"** на badge сервиса
- **Просмотр суперграфа:** Суперграф-схема отображается в текстовом поле (можно скопировать)

### Настройка Performance & Cache

1. Перейдите на вкладку **"Performance & Cache"**
2. Настройте кэширование:
   - **Cache TTL** - Время жизни кэша в секундах (0 = отключено)
   - **Persist Queries** - Включить persisted queries
3. Просмотрите метрики кэша:
   - Cache Hit Count
   - Cache Miss Count
   - Cache Hit Rate (%)
   - Cache Size

### Настройка Security & Limits

1. Перейдите на вкладку **"Security & Limits"**
2. Настройте функции:
   - **Enable Introspection** - Разрешить GraphQL introspection
   - **Enable Query Complexity Analysis** - Включить анализ сложности
   - **Enable Rate Limiting** - Включить rate limiting
3. Настройте лимиты:
   - **Max Query Depth** - Максимальная глубина запроса (1-50)
   - **Max Query Complexity** - Максимальная сложность запроса (> 0)
   - **Global Rate Limit Per Minute** - Глобальный лимит запросов в минуту (> 0)

### Мониторинг

#### Overview Tab

На вкладке **"Overview"** отображаются:
- **Gateway Status** - Endpoint, статус федерации, количество подключенных сервисов
- **Performance Metrics** - Average Latency, P50, P99, Error Rate, Requests/sec
- **Overview Cards** - Services, Requests, Errors, Federation

#### Метрики в реальном времени

Все метрики обновляются в реальном времени во время симуляции:
- Метрики gateway (requests, errors, latency) обновляются из `EmulationEngine`
- Метрики сервисов (requests, errors, status) синхронизируются из `ServiceRegistry` каждые 2 секунды
- Метрики кэша обновляются из `CacheManager`

---

## Руководство администратора

### Рекомендации по конфигурации

#### Production Gateway

```json
{
  "endpoint": "/graphql",
  "federation": {
    "enabled": true,
    "services": ["user-service", "order-service", "product-service"],
    "version": "2"
  },
  "cacheTtl": 300,
  "persistQueries": true,
  "enableIntrospection": false,
  "enableQueryComplexityAnalysis": true,
  "maxQueryDepth": 10,
  "maxQueryComplexity": 500,
  "enableRateLimiting": true,
  "globalRateLimitPerMinute": 10000,
  "subscriptions": true
}
```

**Рекомендации:**
- Используйте Federation v2 для новых проектов
- Включите кэширование для улучшения производительности
- Отключите introspection в production
- Настройте rate limiting для защиты от злоупотреблений
- Установите разумные лимиты сложности запросов

#### Оптимизация производительности

**Кэширование:**
- Установите `cacheTtl` в зависимости от частоты обновления данных
  - Статические данные: 3600+ секунд
  - Динамические данные: 60-300 секунд
  - Real-time данные: 0 (кэш отключен)
- Мониторьте cache hit rate - высокий hit rate (> 80%) означает эффективное использование кэша

**Federation:**
- Используйте Federation v2 для лучшей производительности
- Минимизируйте количество сервисов в федерации (каждый сервис добавляет overhead)
- Оптимизируйте запросы для уменьшения количества подзапросов

**Query Planning:**
- Gateway автоматически планирует выполнение запросов для минимизации latency
- Параллельное выполнение подзапросов уменьшает общую latency

### Безопасность

#### Rate Limiting

- Установите `globalRateLimitPerMinute` в зависимости от capacity backend сервисов
- Обычно: 1000-10000 запросов в минуту для большинства случаев
- Высоконагруженные системы: 50000+ запросов в минуту

#### Query Complexity

- Установите `maxQueryDepth` в зависимости от структуры схемы
  - Обычно: 5-10 для большинства случаев
  - Сложные схемы: 10-15
- Установите `maxQueryComplexity` в зависимости от количества полей в схеме
  - Обычно: 100-500 для простых схем
  - Сложные схемы: 500-1000

#### Introspection

- Отключите introspection в production (`enableIntrospection: false`)
- Включите introspection только в development/staging окружениях

### Мониторинг и алертинг

#### Ключевые метрики

1. **Requests Total**
   - Нормальное значение: зависит от нагрузки
   - Алерт: резкое падение или превышение порога

2. **Error Rate**
   - Нормальное значение: < 1%
   - Алерт: error rate > 5%

3. **Average Latency**
   - Нормальное значение: < 200ms для большинства случаев
   - Алерт: latency > 1000ms или постоянно растущая

4. **P99 Latency**
   - Нормальное значение: < 500ms
   - Алерт: P99 > 2000ms

5. **Cache Hit Rate**
   - Нормальное значение: > 50% для кэшируемых запросов
   - Алерт: cache hit rate < 20% (возможно, cacheTtl слишком низкий)

6. **Rate Limited Total**
   - Мониторьте количество отклоненных запросов
   - Алерт: постоянные rate limit hits (возможно, лимит слишком низкий)

7. **Complexity Rejected Total**
   - Мониторьте количество отклоненных запросов по сложности
   - Алерт: много отклонений (возможно, лимиты слишком строгие или клиенты отправляют опасные запросы)

8. **Federated Request Count**
   - Мониторьте количество федеративных запросов
   - Высокий процент федеративных запросов может указывать на необходимость оптимизации

---

## Метрики и мониторинг

### Основные метрики

#### Throughput
- **Описание:** Количество запросов в секунду
- **Единица измерения:** requests/sec
- **Источник:** Рассчитывается на основе `gatewayRequestsTotal` в окне времени

#### Latency
- **Описание:** Задержка обработки запросов
- **Единица измерения:** миллисекунды (ms)
- **Percentiles:** P50, P95, P99
- **Факторы влияния:**
  - Базовая задержка gateway (parsing, planning)
  - Latency backend сервисов
  - Federation overhead
  - Cache hit (значительно уменьшает latency)

#### Error Rate
- **Описание:** Процент ошибок при обработке
- **Единица измерения:** процент (0-1)
- **Причины ошибок:**
  - Ошибки backend сервисов (502)
  - Rate limit exceeded (429)
  - Query complexity rejected (413)
  - Нет подключенных сервисов (503)
  - Ошибки парсинга запроса (400)

#### Utilization
- **Описание:** Загрузка gateway
- **Единица измерения:** процент (0-1)
- **Расчет:** На основе throughput и capacity

### Кастомные метрики

#### Gateway Metrics
- **gatewayRequestsTotal** - Общее количество запросов
- **gatewayErrorsTotal** - Общее количество ошибок
- **gatewayRateLimitedTotal** - Количество отклоненных запросов по rate limit
- **gatewayComplexityRejectedTotal** - Количество отклоненных запросов по сложности
- **gatewayFederatedRequests** - Количество федеративных запросов

#### Cache Metrics
- **gatewayCacheHitCount** - Количество попаданий в кэш
- **gatewayCacheMissCount** - Количество промахов кэша
- **gatewayCacheSize** - Размер кэша (количество записей)

#### Latency Percentiles
- **latencyP50** - 50-й перцентиль latency
- **latencyP99** - 99-й перцентиль latency

### Метрики сервисов

Для каждого сервиса доступны:
- **requests** - Количество запросов к сервису
- **errors** - Количество ошибок
- **status** - Статус сервиса (connected/disconnected/error)
- **avgLatencyMs** - Средняя latency сервиса (опционально)
- **errorRate** - Процент ошибок (опционально)

### Мониторинг в реальном времени

Все метрики обновляются в реальном времени во время симуляции:
- Метрики gateway обновляются из `EmulationEngine` через `simulateGraphQLGateway`
- Метрики сервисов синхронизируются из `ServiceRegistry` каждые 2 секунды
- Метрики кэша обновляются из `CacheManager`

---

## Примеры использования

### Пример 1: Простой Gateway без федерации

**Сценарий:** Единый GraphQL сервис за gateway

```json
{
  "endpoint": "/graphql",
  "services": [
    {
      "id": "api-service-1",
      "name": "API Service",
      "endpoint": "http://api-service:4000/graphql",
      "status": "connected"
    }
  ],
  "federation": {
    "enabled": false
  },
  "cacheTtl": 60,
  "enableIntrospection": true,
  "enableQueryComplexityAnalysis": true,
  "maxQueryDepth": 10,
  "maxQueryComplexity": 1000
}
```

### Пример 2: Федеративный Gateway с несколькими сервисами

**Сценарий:** Объединение нескольких GraphQL сервисов в единый суперграф

```json
{
  "endpoint": "/graphql",
  "services": [
    {
      "id": "user-service-1",
      "name": "User Service",
      "endpoint": "http://user-service:4001/graphql",
      "status": "connected"
    },
    {
      "id": "order-service-1",
      "name": "Order Service",
      "endpoint": "http://order-service:4002/graphql",
      "status": "connected"
    },
    {
      "id": "product-service-1",
      "name": "Product Service",
      "endpoint": "http://product-service:4003/graphql",
      "status": "connected"
    }
  ],
  "federation": {
    "enabled": true,
    "services": ["user-service-1", "order-service-1", "product-service-1"],
    "version": "2"
  },
  "cacheTtl": 300,
  "persistQueries": true,
  "enableQueryComplexityAnalysis": true,
  "maxQueryDepth": 10,
  "maxQueryComplexity": 500
}
```

### Пример 3: Production Gateway с rate limiting

**Сценарий:** Защищенный gateway с rate limiting и строгими лимитами

```json
{
  "endpoint": "/graphql",
  "services": [
    {
      "id": "api-service-1",
      "name": "API Service",
      "endpoint": "http://api-service:4000/graphql",
      "status": "connected"
    }
  ],
  "federation": {
    "enabled": false
  },
  "cacheTtl": 600,
  "persistQueries": true,
  "enableIntrospection": false,
  "enableQueryComplexityAnalysis": true,
  "maxQueryDepth": 8,
  "maxQueryComplexity": 300,
  "enableRateLimiting": true,
  "globalRateLimitPerMinute": 5000,
  "subscriptions": false
}
```

### Пример 4: Gateway с оптимизированным кэшированием

**Сценарий:** Gateway с агрессивным кэшированием для статических данных

```json
{
  "endpoint": "/graphql",
  "services": [
    {
      "id": "catalog-service-1",
      "name": "Catalog Service",
      "endpoint": "http://catalog-service:4000/graphql",
      "status": "connected"
    }
  ],
  "federation": {
    "enabled": false
  },
  "cacheTtl": 3600,
  "persistQueries": true,
  "enableQueryComplexityAnalysis": true,
  "maxQueryDepth": 5,
  "maxQueryComplexity": 200
}
```

### Пример 5: Development Gateway с introspection

**Сценарий:** Gateway для разработки с включенным introspection

```json
{
  "endpoint": "/graphql",
  "services": [
    {
      "id": "dev-service-1",
      "name": "Dev Service",
      "endpoint": "http://dev-service:4000/graphql",
      "status": "connected"
    }
  ],
  "federation": {
    "enabled": false
  },
  "cacheTtl": 0,
  "enableIntrospection": true,
  "enableQueryComplexityAnalysis": false,
  "enableRateLimiting": false
}
```

---

## Часто задаваемые вопросы (FAQ)

### Что такое GraphQL Gateway?

GraphQL Gateway - это единая точка входа для множества GraphQL сервисов. Он объединяет несколько GraphQL API в единый суперграф, обеспечивает кэширование, rate limiting, анализ сложности запросов и другие функции.

### Как работает федерация в GraphQL Gateway?

Federation позволяет объединить несколько GraphQL сервисов в единый суперграф. Каждый сервис предоставляет часть общей схемы. Gateway анализирует запрос, определяет, какие сервисы нужны, разбивает запрос на подзапросы, выполняет их параллельно и объединяет результаты.

### Как регистрируются сервисы в gateway?

Сервисы автоматически регистрируются при создании соединения от GraphQL Gateway к GraphQL ноде на канвасе. Также можно добавить сервисы вручную через UI.

### Как работает кэширование?

Gateway кэширует результаты запросов на основе query и variables. При повторном запросе с теми же параметрами возвращается результат из кэша (cache hit), что значительно уменьшает latency.

### Что такое rate limiting?

Rate limiting ограничивает количество запросов в минуту для защиты от злоупотреблений. При превышении лимита запрос отклоняется с кодом 429.

### Что такое query complexity analysis?

Query complexity analysis анализирует глубину и сложность GraphQL запросов. Запросы, превышающие лимиты (`maxQueryDepth`, `maxQueryComplexity`), отклоняются с кодом 413 для защиты от чрезмерно сложных запросов.

### Как настроить федерацию?

1. Включите федерацию на вкладке "Federation"
2. Выберите версию федерации (v1 или v2)
3. Добавьте сервисы в список federated services
4. Суперграф-схема генерируется автоматически

### Как влияет federation на latency?

Federation добавляет overhead к latency запроса (планирование, объединение результатов). Overhead настраивается через `variability.federationOverheadMs` (обычно 5-15ms).

### Что такое persisted queries?

Persisted queries - это оптимизация, при которой клиенты отправляют идентификатор запроса вместо полного query. Это уменьшает размер запроса и улучшает производительность.

### Как мониторить производительность gateway?

Используйте вкладку "Overview" для просмотра метрик в реальном времени:
- Requests, Errors, Error Rate
- Latency (Average, P50, P99)
- Cache Hit Rate
- Federation Statistics

---

## Дополнительные ресурсы

- [GraphQL Specification](https://graphql.org/learn/)
- [Apollo Federation Documentation](https://www.apollographql.com/docs/federation/)
- [GraphQL Mesh Documentation](https://the-guild.dev/graphql/mesh/docs)
- [GraphQL Best Practices](https://graphql.org/learn/best-practices/)

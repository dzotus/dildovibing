# BFF Service - Документация компонента

## Обзор

BFF (Backend for Frontend) Service - это паттерн архитектуры, при котором создается отдельный backend сервис для каждого типа клиента (mobile, web, partner). BFF агрегирует данные из множества backend сервисов, оптимизирует ответы для конкретного клиента и предоставляет единый API. Компонент BFF Service в системе симуляции полностью эмулирует поведение реального BFF, включая агрегацию данных, кэширование, circuit breaking, retry логику, метрики производительности и поддержку различных протоколов.

### Основные возможности

- ✅ **Backend Aggregation** - Агрегация данных из множества backend сервисов
- ✅ **Aggregation Strategies** - Стратегии агрегации: merge, parallel, sequential
- ✅ **Caching** - Кэширование ответов (memory, redis, off) с настраиваемым TTL
- ✅ **Circuit Breaking** - Защита от каскадных сбоев с настраиваемыми порогами
- ✅ **Retry Logic** - Автоматические повторные попытки с exponential/linear/constant backoff
- ✅ **Multi-Protocol Support** - Поддержка HTTP, gRPC, GraphQL протоколов
- ✅ **Request Batching** - Батчинг запросов для оптимизации
- ✅ **Response Compression** - Сжатие ответов для уменьшения трафика
- ✅ **Fallback Support** - Поддержка fallback компонентов при ошибках
- ✅ **Audience-Specific** - Оптимизация для mobile, web, partner клиентов
- ✅ **Метрики в реальном времени** - Отслеживание запросов, ошибок, latency, cache hit rate по backend'ам

---

## Основные функции

### 1. Управление Backends (Backend сервисы)

**Описание:** Backends представляют backend сервисы, к которым BFF отправляет запросы для агрегации данных.

**Параметры Backend:**
- **id** - Уникальный идентификатор (генерируется автоматически)
- **name** - Имя backend'а (обязательно, уникальное)
- **endpoint** - URL endpoint backend'а (обязательно, должен быть валидным URL)
- **protocol** - Протокол: `http`, `grpc`, `graphql` (обязательно)
- **status** - Статус: `connected`, `disconnected`, `error` (определяется автоматически на основе соединений)
- **timeout** - Таймаут запроса в миллисекундах (опционально, по умолчанию: 5000ms)
- **retries** - Количество повторных попыток при ошибках (0-10, по умолчанию: 3)
- **retryBackoff** - Стратегия backoff: `exponential`, `linear`, `constant` (по умолчанию: `exponential`)
- **circuitBreaker** - Конфигурация circuit breaker (опционально)

**Circuit Breaker Configuration:**
- **enabled** - Включен ли circuit breaker (по умолчанию: `true`)
- **failureThreshold** - Порог ошибок для открытия circuit breaker (по умолчанию: 5)
- **successThreshold** - Порог успешных запросов для закрытия circuit breaker (по умолчанию: 2)
- **timeout** - Время ожидания перед попыткой half-open в миллисекундах (по умолчанию: 60000ms)

**Автоматическая регистрация:**
- Backends автоматически регистрируются при создании соединения от BFF Service к другим компонентам на канвасе
- Протокол определяется из типа соединения (REST → http, gRPC → grpc, GraphQL → graphql)
- Endpoint формируется из host и port соединения

**Метрики backend'а (обновляются в реальном времени):**
- **requests** - Количество запросов к backend'у
- **avgLatency** - Средняя latency в миллисекундах

**Пример конфигурации:**
```json
{
  "backends": [
    {
      "id": "user-service-1",
      "name": "User Service",
      "endpoint": "http://user-service:8080/api",
      "protocol": "http",
      "status": "connected",
      "timeout": 5000,
      "retries": 3,
      "retryBackoff": "exponential",
      "circuitBreaker": {
        "enabled": true,
        "failureThreshold": 5,
        "successThreshold": 2,
        "timeout": 60000
      }
    }
  ]
}
```

### 2. Управление Endpoints (API endpoints)

**Описание:** Endpoints определяют API endpoints BFF Service, которые агрегируют данные из одного или нескольких backend'ов.

**Параметры Endpoint:**
- **id** - Уникальный идентификатор (генерируется автоматически)
- **path** - Путь endpoint'а (обязательно, должен начинаться с `/`)
- **method** - HTTP метод: `GET`, `POST`, `PUT`, `DELETE`, `PATCH` (обязательно)
- **backends** - Список ID backend'ов для агрегации (обязательно, массив строк)
- **aggregator** - Стратегия агрегации: `merge`, `parallel`, `sequential` (по умолчанию: `merge`)
- **cacheTtl** - Время жизни кэша в секундах (опционально, по умолчанию: используется глобальный cacheTtl)
- **timeout** - Таймаут endpoint'а в миллисекундах (опционально, по умолчанию: используется defaultTimeout)
- **cacheKey** - Кастомный ключ кэша (опционально)

**Стратегии агрегации:**

1. **merge** - Выполняет все backend'ы параллельно и объединяет результаты в один объект
   - Каждый backend возвращает данные под ключом своего имени
   - Latency = max(latency всех backend'ов)
   - Пример: `{ userService: {...}, orderService: {...} }`

2. **parallel** - Выполняет все backend'ы параллельно (аналогично merge)
   - Latency = max(latency всех backend'ов)
   - Полезно когда нужны все данные одновременно

3. **sequential** - Выполняет backend'ы последовательно, передавая данные предыдущего следующему
   - Каждый backend получает накопленные данные от предыдущих
   - Latency = sum(latency всех backend'ов)
   - Полезно когда backend'ы зависят друг от друга

**Пример конфигурации:**
```json
{
  "endpoints": [
    {
      "id": "user-profile-endpoint",
      "path": "/api/user/profile",
      "method": "GET",
      "backends": ["user-service-1", "order-service-1"],
      "aggregator": "merge",
      "cacheTtl": 60,
      "timeout": 5000
    }
  ]
}
```

### 3. Caching (Кэширование)

**Описание:** BFF кэширует ответы endpoint'ов для уменьшения нагрузки на backend сервисы и улучшения latency.

**Параметры кэширования:**
- **enableCaching** - Включить ли кэширование (по умолчанию: `true`)
- **cacheMode** - Режим кэша: `memory`, `redis`, `off` (по умолчанию: `memory`)
- **cacheTtl** - Время жизни кэша в секундах (по умолчанию: 5 секунд)

**Режимы кэша:**

1. **memory** - In-memory кэш (быстрый, но ограничен размером памяти)
   - Кэш хранится в памяти BFF Service
   - Автоматическая очистка при превышении размера (1000 записей)
   - Не сохраняется при перезапуске

2. **redis** - Redis кэш (распределенный, персистентный)
   - Требует подключения к Redis компоненту на канвасе
   - Ключи кэша имеют префикс `bff:{nodeId}:`
   - Поддерживает TTL через Redis EXPIRE

3. **off** - Кэш отключен

**Cache Key:**
- По умолчанию: `{path}:{method}:{JSON.stringify(query)}`
- Можно задать кастомный `cacheKey` для endpoint'а

**Метрики кэша:**
- **cacheHitRate** - Процент попаданий в кэш (0-1)
- **cacheHits** - Количество попаданий в кэш (по backend'ам)
- **cacheMisses** - Количество промахов кэша (по backend'ам)

**Пример конфигурации:**
```json
{
  "enableCaching": true,
  "cacheMode": "redis",
  "cacheTtl": 300
}
```

### 4. Circuit Breaking (Защита от каскадных сбоев)

**Описание:** Circuit breaker защищает BFF от каскадных сбоев при проблемах с backend сервисами.

**Как работает:**
- Circuit breaker отслеживает количество ошибок для каждого backend'а
- При достижении `failureThreshold` circuit breaker открывается (open state)
- В состоянии open все запросы к backend'у отклоняются немедленно (503)
- После `timeout` circuit breaker переходит в half-open состояние
- В half-open состоянии запросы разрешены, но отслеживаются
- При `successThreshold` успешных запросов circuit breaker закрывается (closed state)

**Состояния Circuit Breaker:**
- **closed** - Нормальная работа, запросы проходят
- **open** - Circuit breaker открыт, запросы отклоняются
- **half-open** - Тестовое состояние, ограниченные запросы разрешены

**Пример конфигурации:**
```json
{
  "circuitBreaker": {
    "enabled": true,
    "failureThreshold": 5,
    "successThreshold": 2,
    "timeout": 60000
  }
}
```

### 5. Retry Logic (Логика повторных попыток)

**Описание:** BFF автоматически повторяет запросы к backend'ам при ошибках.

**Параметры:**
- **retries** - Количество повторных попыток (0-10, по умолчанию: 3)
- **retryBackoff** - Стратегия backoff: `exponential`, `linear`, `constant` (по умолчанию: `exponential`)

**Стратегии backoff:**

1. **exponential** - Экспоненциальный backoff
   - Задержка: `min(1000 * 2^(attempt-1), 10000)` мс
   - Пример: 1s, 2s, 4s, 8s, 10s (максимум)

2. **linear** - Линейный backoff
   - Задержка: `100 * attempt` мс
   - Пример: 100ms, 200ms, 300ms, ...

3. **constant** - Постоянная задержка
   - Задержка: `100` мс
   - Пример: 100ms, 100ms, 100ms, ...

**Пример конфигурации:**
```json
{
  "retries": 3,
  "retryBackoff": "exponential"
}
```

### 6. Audience Configuration (Конфигурация для клиентов)

**Описание:** BFF может быть оптимизирован для конкретных типов клиентов.

**Параметры:**
- **audience** - Тип клиента: `mobile`, `web`, `partner` (по умолчанию: `mobile`)

**Влияние на симуляцию:**
- **mobile** - Оптимизация для мобильных приложений (меньший размер payload, сжатие)
- **web** - Оптимизация для веб-приложений (стандартный размер payload)
- **partner** - Оптимизация для партнерских интеграций (расширенные данные)

**Пример конфигурации:**
```json
{
  "audience": "mobile"
}
```

### 7. Fallback Support (Поддержка fallback)

**Описание:** BFF может использовать fallback компонент при ошибках всех backend'ов.

**Параметры:**
- **fallbackEnabled** - Включить ли fallback (по умолчанию: `true`)
- **fallbackComponent** - ID компонента для fallback (опционально)

**Как работает:**
- При ошибках всех backend'ов BFF может обратиться к fallback компоненту
- Fallback компонент может быть кэшированным ответом или статическим компонентом

**Пример конфигурации:**
```json
{
  "fallbackEnabled": true,
  "fallbackComponent": "cached-response"
}
```

### 8. Request Batching (Батчинг запросов)

**Описание:** BFF может батчить несколько запросов в один для оптимизации.

**Параметры:**
- **enableRequestBatching** - Включить ли request batching (по умолчанию: `false`)

**Как работает:**
- Несколько запросов к одному backend'у объединяются в batch
- Batch выполняется одним запросом
- Результаты разделяются обратно на отдельные ответы

**Пример конфигурации:**
```json
{
  "enableRequestBatching": true
}
```

### 9. Response Compression (Сжатие ответов)

**Описание:** BFF может сжимать ответы для уменьшения трафика.

**Параметры:**
- **enableResponseCompression** - Включить ли сжатие ответов (по умолчанию: `true`)

**Влияние на симуляцию:**
- Сжатие уменьшает размер payload
- Увеличивает CPU utilization
- Уменьшает network traffic

**Пример конфигурации:**
```json
{
  "enableResponseCompression": true
}
```

### 10. Timeout Configuration (Конфигурация таймаутов)

**Параметры:**
- **defaultTimeout** - Таймаут по умолчанию в миллисекундах (по умолчанию: 5000ms)
- **maxConcurrentRequests** - Максимальное количество одновременных запросов (по умолчанию: 100)

**Пример конфигурации:**
```json
{
  "defaultTimeout": 5000,
  "maxConcurrentRequests": 100
}
```

---

## Руководство пользователя

### Быстрый старт

1. **Добавление компонента BFF Service:**
   - Перетащите компонент "Backend For Frontend" из библиотеки компонентов на canvas
   - Откройте панель конфигурации компонента

2. **Подключение backend сервисов:**
   - Создайте соединения от BFF Service к backend сервисам (REST, gRPC, GraphQL)
   - Backends автоматически регистрируются в BFF
   - Протокол определяется из типа соединения

3. **Создание endpoints:**
   - Перейдите на вкладку **"Endpoints"**
   - Нажмите кнопку **"Add Endpoint"**
   - Заполните параметры: path, method, backends, aggregator
   - Нажмите **"Save"**

4. **Настройка кэширования:**
   - Перейдите на вкладку **"Settings"**
   - Включите кэширование (`enableCaching`)
   - Выберите режим кэша (`memory`, `redis`, `off`)
   - Установите `cacheTtl`

5. **Настройка circuit breakers:**
   - Перейдите на вкладку **"Backends"**
   - Выберите backend и нажмите **"Edit"**
   - Настройте circuit breaker: enabled, failureThreshold, successThreshold, timeout
   - Нажмите **"Save"**

### Работа с Backends

#### Просмотр backend'ов

1. Перейдите на вкладку **"Backends"**
2. Просмотрите список всех зарегистрированных backend'ов
3. Для каждого backend'а отображаются:
   - Имя, endpoint, protocol
   - Статус (connected/disconnected/error)
   - Метрики (requests, avgLatency) в реальном времени

#### Редактирование backend'а

1. Выберите backend из списка
2. Нажмите кнопку **"Edit"** (иконка карандаша)
3. Измените параметры:
   - Name, Endpoint, Protocol
   - Timeout, Retries, Retry Backoff
   - Circuit Breaker настройки
4. Нажмите **"Save"**

#### Удаление backend'а

1. Выберите backend из списка
2. Нажмите кнопку **"Delete"** (иконка корзины)
3. Подтвердите удаление
4. Backend будет удален из всех endpoint'ов автоматически

### Работа с Endpoints

#### Создание endpoint'а

1. Перейдите на вкладку **"Endpoints"**
2. Нажмите кнопку **"Add Endpoint"**
3. Заполните параметры:
   - **Path** - Путь endpoint'а (должен начинаться с `/`)
   - **Method** - HTTP метод (GET, POST, PUT, DELETE, PATCH)
   - **Backends** - Выберите backend'ы для агрегации (чекбоксы)
   - **Aggregator** - Стратегия агрегации (merge, parallel, sequential)
   - **Cache TTL** - Время жизни кэша в секундах (опционально)
   - **Timeout** - Таймаут endpoint'а в миллисекундах (опционально)
4. Нажмите **"Save"**

#### Редактирование endpoint'а

1. Выберите endpoint из списка
2. Нажмите кнопку **"Edit"** (иконка карандаша)
3. Измените параметры
4. Нажмите **"Save"**

#### Удаление endpoint'а

1. Выберите endpoint из списка
2. Нажмите кнопку **"Delete"** (иконка корзины)
3. Подтвердите удаление

### Настройка Settings

1. Перейдите на вкладку **"Settings"**
2. Настройте общие параметры:
   - **Enable Caching** - Включить кэширование
   - **Cache Mode** - Режим кэша (memory, redis, off)
   - **Cache TTL** - Время жизни кэша в секундах
   - **Enable Request Batching** - Включить батчинг запросов
   - **Enable Response Compression** - Включить сжатие ответов
   - **Default Timeout** - Таймаут по умолчанию в миллисекундах
   - **Max Concurrent Requests** - Максимальное количество одновременных запросов
   - **Audience** - Тип клиента (mobile, web, partner)
   - **Fallback Enabled** - Включить fallback
   - **Fallback Component** - ID fallback компонента

### Мониторинг

#### Overview Tab

На вкладке **"Overview"** отображаются:
- **Overview Cards** - Backends, Endpoints, Requests, Average Latency
- **Gateway Status** - Общая информация о BFF
- **Performance Metrics** - Метрики производительности

#### Метрики в реальном времени

Все метрики обновляются в реальном времени во время симуляции:
- Метрики backend'ов (requests, avgLatency) синхронизируются из `BFFRoutingEngine`
- Метрики endpoint'ов (requests) рассчитываются на основе backend метрик
- Cache hit rate рассчитывается на основе cache hits/misses

---

## Руководство администратора

### Рекомендации по конфигурации

#### Production BFF

```json
{
  "backends": [
    {
      "name": "user-service",
      "endpoint": "http://user-service:8080/api",
      "protocol": "http",
      "timeout": 5000,
      "retries": 3,
      "retryBackoff": "exponential",
      "circuitBreaker": {
        "enabled": true,
        "failureThreshold": 5,
        "successThreshold": 2,
        "timeout": 60000
      }
    }
  ],
  "endpoints": [
    {
      "path": "/api/user/profile",
      "method": "GET",
      "backends": ["user-service"],
      "aggregator": "merge",
      "cacheTtl": 300,
      "timeout": 5000
    }
  ],
  "enableCaching": true,
  "cacheMode": "redis",
  "cacheTtl": 300,
  "enableResponseCompression": true,
  "defaultTimeout": 5000,
  "maxConcurrentRequests": 100,
  "audience": "mobile"
}
```

**Рекомендации:**
- Используйте Redis кэш для production (распределенный, персистентный)
- Настройте circuit breakers для всех backend'ов
- Используйте exponential backoff для retry
- Установите разумные таймауты (5-10 секунд)
- Настройте cache TTL в зависимости от частоты обновления данных

#### Оптимизация производительности

**Кэширование:**
- Установите `cacheTtl` в зависимости от частоты обновления данных
  - Статические данные: 3600+ секунд
  - Динамические данные: 60-300 секунд
  - Real-time данные: 0 (кэш отключен или очень короткий TTL)
- Используйте Redis кэш для распределенных систем
- Мониторьте cache hit rate - высокий hit rate (> 80%) означает эффективное использование кэша

**Aggregation Strategy:**
- Используйте **merge/parallel** когда backend'ы независимы (минимальная latency)
- Используйте **sequential** когда backend'ы зависят друг от друга (большая latency, но правильная логика)

**Circuit Breakers:**
- Настройте `failureThreshold` в зависимости от допустимого уровня ошибок
  - Обычно: 5-10 ошибок
  - Критичные сервисы: 3-5 ошибок
- Настройте `timeout` для half-open состояния (обычно 60 секунд)

**Retry Logic:**
- Используйте **exponential backoff** для большинства случаев
- Установите `retries` в зависимости от критичности запросов
  - Обычно: 2-3 попытки
  - Критичные запросы: 3-5 попыток
  - Не критичные: 1-2 попытки

### Безопасность

#### Timeout Configuration

- Установите `defaultTimeout` чуть выше ожидаемой latency backend'ов
- Установите `timeout` для каждого endpoint'а в зависимости от сложности агрегации
- Используйте более короткие таймауты для критичных endpoint'ов

#### Circuit Breakers

- Включите circuit breakers для всех backend'ов
- Настройте пороги в зависимости от критичности сервисов
- Мониторьте состояние circuit breakers (open/half-open/closed)

#### Rate Limiting

- Ограничьте `maxConcurrentRequests` для защиты от перегрузки
- Мониторьте utilization - высокий utilization (> 80%) может указывать на необходимость масштабирования

### Мониторинг и алертинг

#### Ключевые метрики

1. **Total Requests**
   - Нормальное значение: зависит от нагрузки
   - Алерт: резкое падение или превышение порога

2. **Error Rate**
   - Нормальное значение: < 1%
   - Алерт: error rate > 5%

3. **Average Latency**
   - Нормальное значение: < 200ms для большинства случаев
   - Алерт: latency > 1000ms или постоянно растущая

4. **Cache Hit Rate**
   - Нормальное значение: > 50% для кэшируемых запросов
   - Алерт: cache hit rate < 20% (возможно, cacheTtl слишком низкий)

5. **Circuit Breaker Open**
   - Мониторьте количество открытых circuit breakers
   - Алерт: circuit breaker открыт более 5 минут (возможны проблемы с backend'ом)

6. **Backend Status**
   - Мониторьте статус backend'ов (connected/disconnected/error)
   - Алерт: backend в состоянии error более 1 минуты

7. **Concurrent Requests**
   - Мониторьте количество одновременных запросов
   - Алерт: concurrent requests > 80% от maxConcurrentRequests

---

## Метрики и мониторинг

### Основные метрики

#### Throughput
- **Описание:** Количество запросов в секунду
- **Единица измерения:** requests/sec
- **Источник:** Рассчитывается на основе входящих соединений и конфигурации

#### Latency
- **Описание:** Задержка обработки запросов
- **Единица измерения:** миллисекунды (ms)
- **Факторы влияния:**
  - Latency backend сервисов
  - Стратегия агрегации (parallel vs sequential)
  - Aggregation overhead (5-15ms)
  - Cache hit (значительно уменьшает latency)

#### Error Rate
- **Описание:** Процент ошибок при обработке
- **Единица измерения:** процент (0-1)
- **Причины ошибок:**
  - Ошибки backend сервисов (502, 503, 500)
  - Circuit breaker open (503)
  - Timeout (504)
  - Ошибки агрегации

#### Utilization
- **Описание:** Загрузка BFF
- **Единица измерения:** процент (0-1)
- **Расчет:** На основе concurrent requests и maxConcurrentRequests

### Кастомные метрики

#### BFF Metrics
- **endpoints** - Количество endpoint'ов
- **backends** - Количество backend'ов
- **connected_backends** - Количество подключенных backend'ов
- **total_requests** - Общее количество запросов
- **total_errors** - Общее количество ошибок
- **avg_latency** - Средняя latency в миллисекундах
- **cache_hit_rate** - Процент попаданий в кэш (0-1)
- **endpoint_requests** - Общее количество запросов к endpoint'ам
- **aggregation_overhead** - Overhead агрегации в миллисекундах
- **concurrent_requests** - Количество одновременных запросов

### Метрики backend'ов

Для каждого backend'а доступны:
- **requestCount** - Количество запросов
- **errorCount** - Количество ошибок
- **averageLatency** - Средняя latency в миллисекундах
- **cacheHits** - Количество попаданий в кэш
- **cacheMisses** - Количество промахов кэша

### Метрики endpoint'ов

Для каждого endpoint'а доступны:
- **requests** - Количество запросов (рассчитывается на основе backend метрик)

### Мониторинг в реальном времени

Все метрики обновляются в реальном времени во время симуляции:
- Метрики backend'ов синхронизируются из `BFFRoutingEngine` через `getStats()`
- Метрики endpoint'ов рассчитываются на основе backend метрик
- Cache hit rate рассчитывается на основе cache hits/misses

---

## Примеры использования

### Пример 1: Простой BFF с одним backend

**Сценарий:** BFF для мобильного приложения с одним backend сервисом

```json
{
  "backends": [
    {
      "id": "api-service-1",
      "name": "API Service",
      "endpoint": "http://api-service:8080/api",
      "protocol": "http",
      "status": "connected",
      "timeout": 5000,
      "retries": 3,
      "retryBackoff": "exponential",
      "circuitBreaker": {
        "enabled": true,
        "failureThreshold": 5,
        "successThreshold": 2,
        "timeout": 60000
      }
    }
  ],
  "endpoints": [
    {
      "id": "user-profile-endpoint",
      "path": "/api/user/profile",
      "method": "GET",
      "backends": ["api-service-1"],
      "aggregator": "merge",
      "cacheTtl": 60,
      "timeout": 5000
    }
  ],
  "enableCaching": true,
  "cacheMode": "memory",
  "cacheTtl": 60,
  "audience": "mobile"
}
```

### Пример 2: BFF с агрегацией нескольких backend'ов

**Сценарий:** BFF агрегирует данные из нескольких сервисов для веб-приложения

```json
{
  "backends": [
    {
      "id": "user-service-1",
      "name": "User Service",
      "endpoint": "http://user-service:8080/api",
      "protocol": "http",
      "status": "connected"
    },
    {
      "id": "order-service-1",
      "name": "Order Service",
      "endpoint": "http://order-service:8080/api",
      "protocol": "http",
      "status": "connected"
    },
    {
      "id": "product-service-1",
      "name": "Product Service",
      "endpoint": "http://product-service:8080/api",
      "protocol": "http",
      "status": "connected"
    }
  ],
  "endpoints": [
    {
      "id": "dashboard-endpoint",
      "path": "/api/dashboard",
      "method": "GET",
      "backends": ["user-service-1", "order-service-1", "product-service-1"],
      "aggregator": "merge",
      "cacheTtl": 300,
      "timeout": 10000
    }
  ],
  "enableCaching": true,
  "cacheMode": "redis",
  "cacheTtl": 300,
  "audience": "web"
}
```

### Пример 3: BFF с sequential агрегацией

**Сценарий:** BFF с зависимыми backend'ами (последовательное выполнение)

```json
{
  "endpoints": [
    {
      "id": "order-details-endpoint",
      "path": "/api/order/details",
      "method": "GET",
      "backends": ["order-service-1", "user-service-1"],
      "aggregator": "sequential",
      "cacheTtl": 120,
      "timeout": 10000
    }
  ]
}
```

### Пример 4: Production BFF с Redis кэшем

**Сценарий:** Production BFF с распределенным кэшем

```json
{
  "enableCaching": true,
  "cacheMode": "redis",
  "cacheTtl": 600,
  "enableResponseCompression": true,
  "defaultTimeout": 5000,
  "maxConcurrentRequests": 200,
  "audience": "mobile",
  "fallbackEnabled": true,
  "fallbackComponent": "cached-response"
}
```

### Пример 5: BFF с gRPC backend

**Сценарий:** BFF агрегирует данные из gRPC сервиса

```json
{
  "backends": [
    {
      "id": "grpc-service-1",
      "name": "gRPC Service",
      "endpoint": "grpc://grpc-service:50051",
      "protocol": "grpc",
      "status": "connected",
      "timeout": 5000,
      "retries": 2,
      "retryBackoff": "exponential"
    }
  ],
  "endpoints": [
    {
      "id": "grpc-endpoint",
      "path": "/api/grpc/data",
      "method": "POST",
      "backends": ["grpc-service-1"],
      "aggregator": "merge"
    }
  ]
}
```

---

## Часто задаваемые вопросы (FAQ)

### Что такое BFF (Backend for Frontend)?

BFF - это паттерн архитектуры, при котором создается отдельный backend сервис для каждого типа клиента (mobile, web, partner). BFF агрегирует данные из множества backend сервисов, оптимизирует ответы для конкретного клиента и предоставляет единый API.

### Как работает агрегация в BFF?

BFF поддерживает три стратегии агрегации:
- **merge/parallel** - Выполняет все backend'ы параллельно и объединяет результаты
- **sequential** - Выполняет backend'ы последовательно, передавая данные предыдущего следующему

### Как работает кэширование в BFF?

BFF поддерживает три режима кэша:
- **memory** - In-memory кэш (быстрый, но ограничен размером)
- **redis** - Redis кэш (распределенный, персистентный)
- **off** - Кэш отключен

### Как работает circuit breaker в BFF?

Circuit breaker защищает BFF от каскадных сбоев. При достижении порога ошибок circuit breaker открывается, и все запросы к backend'у отклоняются. После таймаута circuit breaker переходит в half-open состояние для тестирования, и при успешных запросах закрывается.

### Как работает retry logic в BFF?

BFF автоматически повторяет запросы к backend'ам при ошибках. Поддерживаются три стратегии backoff:
- **exponential** - Экспоненциальный backoff (1s, 2s, 4s, 8s, ...)
- **linear** - Линейный backoff (100ms, 200ms, 300ms, ...)
- **constant** - Постоянная задержка (100ms)

### Как регистрируются backend'ы в BFF?

Backend'ы автоматически регистрируются при создании соединения от BFF Service к другим компонентам на канвасе. Протокол определяется из типа соединения (REST → http, gRPC → grpc, GraphQL → graphql).

### Как влияет audience на поведение BFF?

Audience определяет тип клиента (mobile, web, partner) и влияет на оптимизацию ответов:
- **mobile** - Оптимизация для мобильных приложений (меньший размер payload, сжатие)
- **web** - Оптимизация для веб-приложений (стандартный размер payload)
- **partner** - Оптимизация для партнерских интеграций (расширенные данные)

### Как настроить fallback в BFF?

Включите `fallbackEnabled` и укажите `fallbackComponent` (ID компонента для fallback). При ошибках всех backend'ов BFF может обратиться к fallback компоненту.

### Как мониторить производительность BFF?

Используйте вкладку "Overview" для просмотра метрик в реальном времени:
- Total Requests, Errors, Average Latency
- Cache Hit Rate
- Backend Status
- Endpoint Requests

---

## Дополнительные ресурсы

- [BFF Pattern - Sam Newman](https://samnewman.io/patterns/architectural/bff/)
- [Backend for Frontend Pattern](https://microservices.io/patterns/apigateway.html)
- [Circuit Breaker Pattern](https://martinfowler.com/bliki/CircuitBreaker.html)
- [Retry Pattern](https://docs.microsoft.com/en-us/azure/architecture/patterns/retry)

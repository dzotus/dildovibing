# Jaeger - Документация компонента

## Обзор

Jaeger - это распределенная система трейсинга для мониторинга и отладки микросервисов. Компонент Jaeger в системе симуляции полностью эмулирует поведение реального Jaeger, включая сбор трассировок (spans), sampling механизмы (probabilistic, rate limiting, per-operation), хранение traces, Query Service для поиска и анализа, интеграцию с storage backends (Elasticsearch, Cassandra, Kafka, Memory) и полный набор возможностей Jaeger.

### Основные возможности

- ✅ **Distributed Tracing** - Сбор и хранение трассировок от микросервисов
- ✅ **Sampling Mechanisms** - Probabilistic, Rate Limiting, Per-Operation sampling
- ✅ **Trace Storage** - Хранение traces в памяти или внешних backends (Elasticsearch, Cassandra, Kafka)
- ✅ **Query Service** - Поиск и фильтрация traces по service, operation, tags, времени
- ✅ **Trace Context Propagation** - Автоматическая передача trace context между сервисами
- ✅ **Service Statistics** - Статистика по каждому сервису (traces, errors, avg duration)
- ✅ **Trace Tree Visualization** - Визуализация иерархии spans в trace
- ✅ **Metrics Export** - Экспорт метрик в Prometheus или StatsD
- ✅ **Метрики Jaeger** - Полный набор метрик производительности и использования

---

## Основные функции

### 1. Distributed Tracing (Распределенный трейсинг)

**Описание:** Jaeger собирает трассировки (traces) от микросервисов для анализа производительности и отладки.

**Структура Trace:**
- **Trace** - Полная трассировка запроса через все сервисы
- **Span** - Отдельная операция в trace (один сервис, одна операция)
- **Span Context** - Информация для связи spans (traceId, spanId, parentSpanId)

**Формат Span:**
```json
{
  "traceId": "abc123",
  "spanId": "def456",
  "parentSpanId": "ghi789",
  "operationName": "processRequest",
  "serviceName": "api-service",
  "startTime": 1609459200000000,
  "duration": 50000,
  "tags": [
    { "key": "http.method", "value": "GET" },
    { "key": "http.status_code", "value": 200 }
  ],
  "logs": [
    {
      "timestamp": 1609459200000000,
      "fields": [
        { "key": "event", "value": "request_received" }
      ]
    }
  ]
}
```

**Как работает:**
1. Компоненты автоматически генерируют spans из DataMessage
2. Spans отправляются в Jaeger через Agent или Collector
3. Jaeger группирует spans в traces по traceId
4. Traces хранятся в storage backend
5. Query Service позволяет искать и анализировать traces

### 2. Sampling Mechanisms (Механизмы сэмплирования)

**Описание:** Sampling определяет, какие traces сохранять для оптимизации производительности и хранения.

**Типы Sampling:**

#### 2.1. Probabilistic Sampling (Вероятностное сэмплирование)

**Описание:** Каждый trace сохраняется с заданной вероятностью.

**Параметры:**
- **samplingParam** - Вероятность сохранения (0-1, например: `0.001` = 0.1%)

**Пример:**
```json
{
  "samplingType": "probabilistic",
  "samplingParam": 0.001
}
```

**Как работает:**
- Каждый trace сохраняется с вероятностью `samplingParam`
- Например, `0.001` означает, что сохраняется 1 из 1000 traces
- Подходит для высоконагруженных систем

#### 2.2. Rate Limiting Sampling (Ограничение скорости)

**Описание:** Ограничивает количество traces в секунду.

**Параметры:**
- **samplingParam** - Максимальное количество traces в секунду (например: `10`)

**Пример:**
```json
{
  "samplingType": "ratelimiting",
  "samplingParam": 10
}
```

**Как работает:**
- Использует token bucket алгоритм
- Максимум `samplingParam` traces в секунду
- Подходит для контроля нагрузки на storage

#### 2.3. Per-Operation Sampling (Сэмплирование по операциям)

**Описание:** Разные лимиты для разных операций.

**Параметры:**
- **samplingParam** - Дефолтный лимит для новых операций (например: `10`)

**Пример:**
```json
{
  "samplingType": "peroperation",
  "samplingParam": 10
}
```

**Как работает:**
- Каждая операция (`service:operation`) имеет свой лимит
- Новые операции инициализируются с `samplingParam`
- Подходит для приоритизации важных операций

**Рекомендации:**
- Используйте `probabilistic` для большинства случаев (0.1% - 1%)
- Используйте `ratelimiting` для контроля нагрузки
- Используйте `peroperation` для тонкой настройки

### 3. Trace Storage (Хранение трассировок)

**Описание:** Jaeger хранит traces в различных storage backends.

**Поддерживаемые backends:**
- **Memory** - Хранение в памяти (по умолчанию, для тестирования)
- **Elasticsearch** - Долгосрочное хранение и поиск
- **Cassandra** - Масштабируемое хранение
- **Kafka** - Потоковая обработка traces

**Параметры Storage:**
- **storageBackend** - Тип backend (по умолчанию: `memory`)
- **storageUrl** - URL storage backend (например: `http://elasticsearch:9200`)
- **maxTraces** - Максимальное количество traces в storage (по умолчанию: `10000`)
- **traceTTL** - Время жизни traces в миллисекундах (по умолчанию: `86400000` = 24 часа)

**Пример конфигурации:**
```json
{
  "storageBackend": "elasticsearch",
  "storageUrl": "http://elasticsearch:9200",
  "maxTraces": 50000,
  "traceTTL": 604800000
}
```

**Как работает:**
1. Traces сохраняются в выбранный backend
2. При достижении `maxTraces` старые traces удаляются
3. Traces старше `traceTTL` автоматически удаляются
4. Cleanup выполняется периодически (каждую минуту)

### 4. Query Service (Сервис запросов)

**Описание:** Query Service позволяет искать и анализировать traces.

**Параметры запроса:**
- **service** - Фильтр по сервису (опционально)
- **operation** - Фильтр по операции (опционально)
- **tags** - Фильтр по тегам (опционально)
- **startTime** - Начальное время (опционально)
- **endTime** - Конечное время (опционально)
- **limit** - Максимальное количество результатов (опционально)

**Пример запроса:**
```typescript
const traces = jaegerEngine.queryTraces({
  service: "api-service",
  operation: "processRequest",
  tags: { "http.status_code": "500" },
  startTime: Date.now() - 3600000, // последний час
  endTime: Date.now(),
  limit: 100
});
```

**Фильтрация:**
- По service name
- По operation name
- По tags (key-value пары)
- По времени (startTime, endTime)
- По статусу (success, error)

### 5. Trace Context Propagation (Передача контекста)

**Описание:** Trace context автоматически передается между сервисами для связи spans.

**Как работает:**
1. При создании нового запроса генерируется traceId
2. TraceId передается через DataMessage между компонентами
3. Каждый компонент создает span с тем же traceId
4. Spans группируются в trace по traceId

**Формат Trace Context:**
```json
{
  "traceId": "abc123",
  "spanId": "def456",
  "parentSpanId": "ghi789",
  "sampled": true
}
```

### 6. Service Statistics (Статистика сервисов)

**Описание:** Jaeger собирает статистику по каждому сервису.

**Метрики сервиса:**
- **tracesTotal** - Общее количество traces
- **errorsTotal** - Количество traces с ошибками
- **avgDuration** - Средняя длительность traces (микросекунды)
- **spansTotal** - Общее количество spans
- **lastTraceTime** - Время последнего trace

**Пример статистики:**
```json
{
  "name": "api-service",
  "tracesTotal": 1000,
  "errorsTotal": 50,
  "avgDuration": 50000,
  "spansTotal": 2500,
  "lastTraceTime": 1609459200000
}
```

### 7. Trace Tree Visualization (Визуализация дерева трассировок)

**Описание:** Trace Tree показывает иерархию spans в trace.

**Особенности:**
- Иерархия parent-child spans
- Timeline для всего trace и каждого span
- Отображение duration каждого span
- Выделение spans с ошибками
- Раскрытие/сворачивание узлов

**Пример визуализации:**
```
Trace abc123 (500ms)
├─ api-service:processRequest (200ms)
│  ├─ db-service:query (100ms)
│  └─ cache-service:get (50ms)
└─ notification-service:send (300ms)
```

### 8. Metrics Export (Экспорт метрик)

**Описание:** Jaeger может экспортировать метрики в внешние системы.

**Поддерживаемые backends:**
- **Prometheus** - Метрики в формате Prometheus
- **StatsD** - Метрики в формате StatsD

**Параметры:**
- **enableMetrics** - Включить экспорт метрик (по умолчанию: `true`)
- **metricsBackend** - Backend для метрик (по умолчанию: `prometheus`)
- **metricsUrl** - URL метрик backend (по умолчанию: `http://prometheus:9090`)

**Пример конфигурации:**
```json
{
  "enableMetrics": true,
  "metricsBackend": "prometheus",
  "metricsUrl": "http://prometheus:9090"
}
```

---

## Руководство пользователя

### Быстрый старт

1. **Добавление компонента Jaeger:**
   - Перетащите компонент "Jaeger" из библиотеки компонентов на canvas
   - Откройте панель конфигурации компонента

2. **Настройка базовых параметров:**
   - Перейдите на вкладку **"Settings"**
   - Укажите `serverUrl` (по умолчанию: `http://jaeger:16686`)
   - Укажите endpoints (Agent, Collector, Query)

3. **Настройка Sampling:**
   - Перейдите на вкладку **"Settings"** → **"Sampling"**
   - Выберите тип sampling (`probabilistic`, `ratelimiting`, `peroperation`)
   - Укажите параметр sampling

4. **Настройка Storage:**
   - Перейдите на вкладку **"Settings"** → **"Storage"**
   - Выберите storage backend (`memory`, `elasticsearch`, `cassandra`, `kafka`)
   - Укажите `storageUrl` (если не memory)
   - Настройте `maxTraces` и `traceTTL`

5. **Просмотр Traces:**
   - Перейдите на вкладку **"Traces"**
   - Просмотрите список traces в реальном времени
   - Используйте фильтры для поиска

### Работа с Sampling

#### Настройка Probabilistic Sampling

1. Перейдите на вкладку **"Settings"** → **"Sampling"**
2. Выберите **"Probabilistic"** в `samplingType`
3. Укажите `samplingParam` (0-1):
   - `0.001` = 0.1% (1 из 1000)
   - `0.01` = 1% (1 из 100)
   - `0.1` = 10% (1 из 10)
4. Нажмите **"Save"**

**Рекомендации:**
- Используйте `0.001` для высоконагруженных систем
- Используйте `0.01` для средних нагрузок
- Используйте `0.1` для низких нагрузок или отладки

#### Настройка Rate Limiting Sampling

1. Выберите **"Rate Limiting"** в `samplingType`
2. Укажите `samplingParam` (traces/sec):
   - `10` = максимум 10 traces в секунду
   - `100` = максимум 100 traces в секунду
3. Нажмите **"Save"**

**Рекомендации:**
- Используйте для контроля нагрузки на storage
- Учитывайте capacity storage backend

#### Настройка Per-Operation Sampling

1. Выберите **"Per Operation"** в `samplingType`
2. Укажите `samplingParam` (дефолтный лимит для новых операций)
3. Нажмите **"Save"**

**Примечание:** Лимиты для операций настраиваются автоматически при получении spans.

### Работа с Storage

#### Настройка Memory Storage

1. Перейдите на вкладку **"Settings"** → **"Storage"**
2. Выберите **"Memory"** в `storageBackend`
3. Укажите `maxTraces` (по умолчанию: `10000`)
4. Укажите `traceTTL` в миллисекундах (по умолчанию: `86400000` = 24 часа)
5. Нажмите **"Save"**

**Примечание:** Memory storage подходит только для тестирования. Для production используйте Elasticsearch или Cassandra.

#### Настройка Elasticsearch Storage

1. Выберите **"Elasticsearch"** в `storageBackend`
2. Укажите `storageUrl` (например: `http://elasticsearch:9200`)
3. Нажмите **"Save"**

**Требования:**
- Elasticsearch должен быть доступен
- Индексы создаются автоматически

#### Настройка Cassandra Storage

1. Выберите **"Cassandra"** в `storageBackend`
2. Укажите `storageUrl` (например: `cassandra:9042`)
3. Нажмите **"Save"**

**Требования:**
- Cassandra должен быть доступен
- Keyspaces создаются автоматически

### Работа с Traces

#### Просмотр Traces

1. Перейдите на вкладку **"Traces"**
2. Просмотрите список traces:
   - **Trace ID** - Уникальный идентификатор
   - **Service** - Имя сервиса
   - **Operation** - Имя операции
   - **Duration** - Длительность trace
   - **Spans** - Количество spans
   - **Status** - Статус (success/error)

#### Фильтрация Traces

1. Используйте поиск для фильтрации по trace ID
2. Выберите **Service** из списка
3. Выберите **Operation** из списка
4. Выберите **Status** (all/success/error)
5. Выберите **Time Range** (all/1h/24h/7d)

#### Просмотр Trace Tree

1. Нажмите кнопку **"View"** для trace
2. Просмотрите иерархию spans:
   - Parent-child отношения
   - Duration каждого span
   - Timeline для всего trace
3. Раскройте/сверните узлы для детального просмотра

### Работа с Service Statistics

#### Просмотр статистики

1. Перейдите на вкладку **"Services"**
2. Просмотрите статистику по каждому сервису:
   - **Traces Total** - Общее количество traces
   - **Errors Total** - Количество ошибок
   - **Avg Duration** - Средняя длительность
   - **Spans Total** - Общее количество spans

#### Анализ производительности

1. Используйте статистику для выявления проблем:
   - Высокий `errorsTotal` - проблемы с сервисом
   - Высокий `avgDuration` - проблемы с производительностью
   - Низкий `tracesTotal` - проблемы с sampling

### Работа с Metrics

#### Просмотр метрик

1. Перейдите на вкладку **"Metrics"**
2. Просмотрите метрики Jaeger:
   - **Spans Per Second** - Скорость приема spans
   - **Traces Per Second** - Скорость приема traces
   - **Sampling Rate** - Текущий sampling rate
   - **Storage Utilization** - Использование storage
   - **Query Latency** - Производительность queries

#### Настройка экспорта метрик

1. Перейдите на вкладку **"Settings"** → **"Metrics"**
2. Включите `enableMetrics` (по умолчанию: `true`)
3. Выберите `metricsBackend` (`prometheus` или `statsd`)
4. Укажите `metricsUrl` (например: `http://prometheus:9090`)
5. Нажмите **"Save"**

---

## Руководство администратора

### Рекомендации по конфигурации

#### Production Jaeger

```json
{
  "serverUrl": "http://jaeger:16686",
  "agentEndpoint": "http://jaeger-agent:6831",
  "collectorEndpoint": "http://jaeger-collector:14268",
  "queryEndpoint": "http://jaeger-query:16686",
  "samplingType": "probabilistic",
  "samplingParam": 0.001,
  "storageBackend": "elasticsearch",
  "storageUrl": "http://elasticsearch:9200",
  "maxTraces": 100000,
  "traceTTL": 604800000,
  "enableMetrics": true,
  "metricsBackend": "prometheus",
  "metricsUrl": "http://prometheus:9090"
}
```

**Рекомендации:**
- Используйте `probabilistic` sampling с `0.001` (0.1%) для production
- Используйте Elasticsearch или Cassandra для долгосрочного хранения
- Настройте `traceTTL` согласно требованиям compliance
- Экспортируйте метрики в Prometheus для мониторинга
- Мониторьте метрики Jaeger (spans rate, storage utilization, query latency)

### Оптимизация производительности

**Sampling:**
- Используйте `probabilistic` с низкой вероятностью (0.1% - 1%) для production
- Используйте `ratelimiting` для контроля нагрузки на storage
- Используйте `peroperation` для приоритизации важных операций
- Мониторьте sampling rate в метриках

**Storage:**
- Используйте Elasticsearch для долгосрочного хранения и поиска
- Используйте Cassandra для масштабируемого хранения
- Настройте `maxTraces` и `traceTTL` для управления размером storage
- Мониторьте storage utilization в метриках

**Query Performance:**
- Используйте фильтры для уменьшения количества результатов
- Ограничивайте `limit` в queries
- Используйте time range для уменьшения объема данных
- Мониторьте query latency в метриках

### Безопасность

#### Управление доступом

- Ограничьте доступ к Jaeger UI
- Используйте network policies для изоляции
- Настройте аутентификацию для storage backends
- Используйте TLS для connections к storage

#### Защита данных

- Настройте `traceTTL` для автоматического удаления старых traces
- Регулярно делайте backup конфигурации
- Мониторьте метрики Jaeger (spans dropped, storage errors)
- Настройте алерты для критичных проблем

### Мониторинг и алертинг

#### Ключевые метрики

1. **Spans Per Second**
   - Нормальное значение: зависит от нагрузки
   - Алерт: spansPerSecond > 10000 (высокая нагрузка)

2. **Sampling Rate**
   - Нормальное значение: соответствует `samplingParam`
   - Алерт: samplingRate значительно отличается от `samplingParam` (проблемы с sampling)

3. **Storage Utilization**
   - Нормальное значение: < 80%
   - Алерт: storageUtilization > 80% (приближение к лимиту)

4. **Query Latency**
   - Нормальное значение: queryLatency < 100ms
   - Алерт: queryLatency > 500ms (медленные queries)

5. **Spans Dropped**
   - Нормальное значение: spansDroppedTotal = 0 (или минимально)
   - Алерт: spansDroppedTotal > 0 (проблемы с sampling или storage)

6. **Traces Stored**
   - Нормальное значение: < maxTraces
   - Алерт: tracesStoredTotal > 80% maxTraces (приближение к лимиту)

---

## Метрики и мониторинг

### Метрики Collector

- **spansReceivedTotal** - Общее количество полученных spans
- **spansDroppedTotal** - Общее количество отброшенных spans (sampling)
- **spansProcessedTotal** - Общее количество обработанных spans
- **samplingDecisionsTotal** - Общее количество sampling решений
- **samplingErrorsTotal** - Общее количество ошибок sampling

### Метрики Storage

- **tracesStoredTotal** - Общее количество сохраненных traces
- **tracesDroppedTotal** - Общее количество отброшенных traces (TTL, maxTraces)
- **storageSizeBytes** - Размер storage в bytes
- **storageUtilization** - Использование storage (0-1)

### Метрики Query

- **queryRequestsTotal** - Общее количество query запросов
- **queryErrorsTotal** - Общее количество ошибок queries
- **queryDurationTotal** - Общая длительность queries (ms)
- **queryLatency** - Средняя latency queries (ms)

### Метрики Agent

- **spansSentTotal** - Общее количество отправленных spans
- **spansFailedTotal** - Общее количество неудачных отправок

### Per-Second Метрики

- **spansPerSecond** - Скорость приема spans
- **tracesPerSecond** - Скорость приема traces
- **samplingRate** - Текущий sampling rate (0-1)

### Мониторинг в реальном времени

Все метрики обновляются в реальном времени во время симуляции:
- Метрики синхронизируются из `JaegerEmulationEngine` каждые 500ms
- Метрики отображаются в UI компоненте
- Traces обновляются в реальном времени
- Cleanup выполняется автоматически каждую минуту

---

## Примеры использования

### Пример 1: Базовый Tracing

**Сценарий:** Сбор трассировок от микросервисов

```json
{
  "serverUrl": "http://jaeger:16686",
  "samplingType": "probabilistic",
  "samplingParam": 0.001,
  "storageBackend": "memory",
  "maxTraces": 10000,
  "traceTTL": 86400000
}
```

**Как работает:**
1. Компоненты автоматически генерируют spans
2. Spans отправляются в Jaeger
3. Jaeger применяет sampling (0.1%)
4. Traces сохраняются в memory storage
5. Traces доступны через Query Service

### Пример 2: Production Setup с Elasticsearch

**Сценарий:** Production окружение с долгосрочным хранением

```json
{
  "serverUrl": "http://jaeger:16686",
  "samplingType": "probabilistic",
  "samplingParam": 0.001,
  "storageBackend": "elasticsearch",
  "storageUrl": "http://elasticsearch:9200",
  "maxTraces": 100000,
  "traceTTL": 604800000,
  "enableMetrics": true,
  "metricsBackend": "prometheus",
  "metricsUrl": "http://prometheus:9090"
}
```

**Преимущества:**
- Долгосрочное хранение (7 дней)
- Масштабируемое хранение (100,000 traces)
- Экспорт метрик в Prometheus
- Поиск и анализ через Elasticsearch

### Пример 3: Rate Limiting Sampling

**Сценарий:** Контроль нагрузки на storage

```json
{
  "samplingType": "ratelimiting",
  "samplingParam": 100
}
```

**Поведение:**
- Максимум 100 traces в секунду
- Token bucket алгоритм
- Защита от перегрузки storage

### Пример 4: Query Traces

**Сценарий:** Поиск traces с ошибками

```typescript
const traces = jaegerEngine.queryTraces({
  service: "api-service",
  tags: { "http.status_code": "500" },
  startTime: Date.now() - 3600000,
  endTime: Date.now(),
  limit: 100
});
```

**Результат:**
- Traces от `api-service` с ошибками (500)
- За последний час
- Максимум 100 результатов

### Пример 5: Service Statistics

**Сценарий:** Анализ производительности сервисов

```typescript
const stats = jaegerEngine.getServiceStats();
// [
//   {
//     name: "api-service",
//     tracesTotal: 1000,
//     errorsTotal: 50,
//     avgDuration: 50000,
//     spansTotal: 2500
//   }
// ]
```

**Анализ:**
- `errorsTotal / tracesTotal` = error rate (5%)
- `avgDuration` = средняя производительность
- `spansTotal / tracesTotal` = среднее количество spans на trace

---

## Часто задаваемые вопросы (FAQ)

### Что такое Jaeger?

Jaeger - это распределенная система трейсинга для мониторинга и отладки микросервисов. Jaeger собирает трассировки (traces) от сервисов и позволяет анализировать производительность и находить проблемы.

### Как работает Jaeger?

1. Компоненты автоматически генерируют spans из DataMessage
2. Spans отправляются в Jaeger через Agent или Collector
3. Jaeger применяет sampling для оптимизации
4. Spans группируются в traces по traceId
5. Traces сохраняются в storage backend
6. Query Service позволяет искать и анализировать traces

### Что такое Sampling?

Sampling определяет, какие traces сохранять для оптимизации производительности и хранения. Jaeger поддерживает три типа sampling:
- **Probabilistic** - Вероятностное сэмплирование (каждый trace с вероятностью)
- **Rate Limiting** - Ограничение скорости (максимум traces в секунду)
- **Per-Operation** - Сэмплирование по операциям (разные лимиты для операций)

### Какой sampling использовать?

- **Probabilistic** (0.1% - 1%) - для большинства случаев
- **Rate Limiting** - для контроля нагрузки на storage
- **Per-Operation** - для приоритизации важных операций

### Как работает Trace Context Propagation?

Trace context автоматически передается между сервисами через DataMessage. Каждый компонент создает span с тем же traceId, что позволяет группировать spans в traces.

### Какой storage backend использовать?

- **Memory** - только для тестирования
- **Elasticsearch** - для долгосрочного хранения и поиска (рекомендуется)
- **Cassandra** - для масштабируемого хранения
- **Kafka** - для потоковой обработки

### Как мониторить Jaeger?

Используйте метрики самого Jaeger:
- **Spans Per Second** - нагрузка на Jaeger
- **Sampling Rate** - эффективность sampling
- **Storage Utilization** - использование storage
- **Query Latency** - производительность queries
- **Spans Dropped** - проблемы с sampling или storage

---

## Дополнительные ресурсы

- [Официальная документация Jaeger](https://www.jaegertracing.io/docs/)
- [Jaeger Architecture](https://www.jaegertracing.io/docs/1.50/architecture/)
- [Jaeger Sampling](https://www.jaegertracing.io/docs/1.50/sampling/)
- [Jaeger Storage Backends](https://www.jaegertracing.io/docs/1.50/deployment/#storage-backends)
- [OpenTracing Specification](https://opentracing.io/specification/)
- [Jaeger GitHub](https://github.com/jaegertracing/jaeger)

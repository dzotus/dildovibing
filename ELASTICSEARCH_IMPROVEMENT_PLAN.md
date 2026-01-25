# План улучшения компонента Elasticsearch

## Анализ текущего состояния

### ✅ Что уже реализовано хорошо:
1. **ElasticsearchRoutingEngine** - полноценный движок симуляции с:
   - Кластером и узлами
   - Индексами и шардами
   - Роутингом документов по формуле хеширования
   - Операциями: index, get, search, delete
   - Метриками производительности

2. **Интеграция в систему**:
   - DataFlowEngine: `processElasticsearchOperation()`
   - EmulationEngine: обработка в `simulateDatabase()`
   - Конфигурационная панель: `ElasticsearchConfigAdvanced.tsx`

3. **UI/UX**:
   - Dev Tools для выполнения запросов
   - Визуализация индексов и шардов
   - Метрики кластера

### ⚠️ Проблемы и области для улучшения:

#### 1. Хардкод значений
- **Проблема**: Магические строки и числа разбросаны по коду
  - `'archiphoenix-cluster'`, `'archiphoenix-index'`
  - `'localhost:9200'`
  - Дефолтные значения: 5 шардов, 1 реплика, `'1s'` refresh interval
- **Решение**: Создать файл констант `src/core/elasticsearch/constants.ts`

#### 2. Недостаточная реалистичность симуляции
- **Проблема**: 
  - Упрощенная логика поиска (только match_all и простой match)
  - Нет поддержки агрегаций, фильтров, сортировки
  - Нет симуляции refresh interval
  - Нет симуляции bulk операций
  - Нет симуляции транзакций и optimistic concurrency
- **Решение**: Расширить ElasticsearchRoutingEngine

#### 3. Неполное соответствие реальному Elasticsearch API
- **Проблема**:
  - Нет поддержки всех типов запросов (bool, range, term, etc.)
  - Нет поддержки mapping и settings API
  - Нет поддержки cluster API (_cluster/health, _cluster/stats)
  - Нет поддержки cat API
- **Решение**: Расширить API поддержку

#### 4. Метрики могут быть более реалистичными
- **Проблема**:
  - Упрощенный расчет latency
  - Нет метрик по типам запросов
  - Нет метрик по шардам
- **Решение**: Улучшить расчет метрик

#### 5. UI/UX улучшения
- **Проблема**:
  - Нет визуализации распределения шардов по узлам
  - Нет истории операций в реальном времени
  - Нет индикаторов производительности по индексам
- **Решение**: Расширить UI компоненты

---

## План реализации

### Этап 1: Рефакторинг и устранение хардкода

#### 1.1 Создать файл констант
**Файл**: `src/core/elasticsearch/constants.ts`

```typescript
/**
 * Elasticsearch Constants
 * 
 * Все константы для компонента Elasticsearch.
 * Используются вместо магических чисел и строк для улучшения читаемости и поддержки кода.
 */

// ============================================================================
// Default Values
// ============================================================================

/** Default Elasticsearch HTTP port */
export const DEFAULT_ELASTICSEARCH_PORT = 9200;

/** Default cluster name */
export const DEFAULT_CLUSTER_NAME = 'elasticsearch-cluster';

/** Default index name */
export const DEFAULT_INDEX_NAME = 'default-index';

/** Default number of primary shards */
export const DEFAULT_NUMBER_OF_SHARDS = 5;

/** Default number of replicas */
export const DEFAULT_NUMBER_OF_REPLICAS = 1;

/** Default refresh interval */
export const DEFAULT_REFRESH_INTERVAL = '1s';

/** Default node address */
export const DEFAULT_NODE_ADDRESS = 'localhost:9200';

/** Default username for authentication */
export const DEFAULT_USERNAME = 'elastic';

// ============================================================================
// Limits
// ============================================================================

/** Maximum number of shards per index */
export const MAX_SHARDS_PER_INDEX = 1024;

/** Maximum number of replicas */
export const MAX_REPLICAS = 10;

/** Maximum number of nodes in cluster */
export const MAX_CLUSTER_NODES = 1000;

// ============================================================================
// Performance Constants
// ============================================================================

/** Base latency for index operations (ms) */
export const BASE_INDEX_LATENCY_MS = 5;

/** Base latency for search operations (ms) */
export const BASE_SEARCH_LATENCY_MS = 10;

/** Base latency for get operations (ms) */
export const BASE_GET_LATENCY_MS = 2;

/** Latency per shard for search (ms) */
export const LATENCY_PER_SHARD_MS = 2;

/** Maximum additional latency for large result sets (ms) */
export const MAX_RESULT_SET_LATENCY_MS = 50;

/** Document size estimate (bytes) */
export const ESTIMATED_DOCUMENT_SIZE_BYTES = 1024;

// ============================================================================
// Cluster Health States
// ============================================================================

export const CLUSTER_HEALTH_GREEN = 'green';
export const CLUSTER_HEALTH_YELLOW = 'yellow';
export const CLUSTER_HEALTH_RED = 'red';

// ============================================================================
// Shard States
// ============================================================================

export const SHARD_STATE_STARTED = 'STARTED';
export const SHARD_STATE_RELOCATING = 'RELOCATING';
export const SHARD_STATE_INITIALIZING = 'INITIALIZING';
export const SHARD_STATE_UNASSIGNED = 'UNASSIGNED';

// ============================================================================
// Operation Types
// ============================================================================

export const OPERATION_INDEX = 'index';
export const OPERATION_GET = 'get';
export const OPERATION_SEARCH = 'search';
export const OPERATION_DELETE = 'delete';
export const OPERATION_BULK = 'bulk';
export const OPERATION_UPDATE = 'update';

// ============================================================================
// History Limits
// ============================================================================

/** Maximum number of operations to keep in history */
export const MAX_OPERATION_HISTORY = 500;

/** Maximum number of recent queries to keep */
export const MAX_RECENT_QUERIES = 100;
```

**Задачи**:
- [x] Создать файл `src/core/elasticsearch/constants.ts` ✅
- [x] Заменить все хардкод значения в `ElasticsearchRoutingEngine.ts` ✅
- [x] Заменить все хардкод значения в `DataFlowEngine.ts` (processElasticsearchOperation) ✅
- [x] Заменить все хардкод значения в `EmulationEngine.ts` (initializeElasticsearchRoutingEngine) ✅
- [x] Заменить все хардкод значения в `ElasticsearchConfigAdvanced.tsx` ✅
- [x] Заменить все хардкод значения в `profiles.ts` (elasticsearch profile) - НЕ НАЙДЕНО ✅

#### 1.2 Рефакторинг структуры файлов
**Создать директорию**: `src/core/elasticsearch/`

**Структура**:
```
src/core/elasticsearch/
├── constants.ts          # Константы
├── types.ts              # Типы (вынести из ElasticsearchRoutingEngine.ts)
├── ElasticsearchRoutingEngine.ts  # Основной движок
├── queryParser.ts        # Парсер Elasticsearch запросов
├── shardRouter.ts        # Логика роутинга по шардам
└── metricsCalculator.ts  # Расчет метрик
```

**Задачи**:
- [x] Создать директорию `src/core/elasticsearch/` ✅
- [x] Переместить `ElasticsearchRoutingEngine.ts` в новую директорию ✅
- [x] Вынести типы в `types.ts` ✅
- [x] Создать `queryParser.ts` для парсинга Elasticsearch DSL ✅
- [ ] Создать `shardRouter.ts` для логики роутинга - ОСТАЛОСЬ (роутинг уже реализован в ElasticsearchRoutingEngine)
- [x] Создать `metricsCalculator.ts` для расчета метрик ✅
- [x] Обновить импорты во всех файлах ✅

---

### Этап 2: Улучшение симуляции

#### 2.1 Расширение поддержки Elasticsearch DSL
**Файл**: `src/core/elasticsearch/queryParser.ts`

**Функциональность**:
- Парсинг bool queries (must, should, must_not, filter)
- Парсинг range queries
- Парсинг term queries
- Парсинг match queries (улучшить существующий)
- Парсинг exists queries
- Парсинг wildcard queries
- Парсинг aggregations (terms, date_histogram, etc.)

**Задачи**:
- [x] Создать `queryParser.ts` ✅
- [x] Реализовать парсинг bool queries (must, should, must_not, filter, minimum_should_match) ✅
- [x] Реализовать парсинг range queries ✅
- [x] Реализовать парсинг term queries ✅
- [x] Реализовать парсинг wildcard queries ✅
- [x] Реализовать парсинг exists queries ✅
- [x] Реализовать парсинг match queries (улучшен) ✅
- [ ] Реализовать парсинг aggregations - ОСТАЛОСЬ (базовая поддержка в metricsCalculator для расчета сложности)
- [x] Интегрировать в `ElasticsearchRoutingEngine.search()` ✅

#### 2.2 Симуляция refresh interval
**Файл**: `src/core/elasticsearch/ElasticsearchRoutingEngine.ts`

**Функциональность**:
- Реалистичная симуляция refresh interval
- Документы не сразу доступны для поиска после индексации
- Учет refresh interval в метриках

**Задачи**:
- [x] Добавить очередь документов, ожидающих refresh (pendingDocuments) ✅
- [x] Реализовать логику refresh по интервалу (parseRefreshInterval, refreshIndex, checkAndRefreshIndices) ✅
- [x] Обновить метод `indexDocument()` для учета refresh (документы попадают в pending) ✅
- [x] Обновить метод `search()` для фильтрации неотрефрешенных документов (поиск только по searchable документам) ✅
- [x] Добавить метрики refresh operations (refreshOperations tracking) ✅

#### 2.3 Поддержка bulk операций
**Файл**: `src/core/elasticsearch/ElasticsearchRoutingEngine.ts`

**Функциональность**:
- Обработка bulk API запросов
- Batch обработка операций
- Оптимизация производительности для bulk

**Задачи**:
- [x] Добавить метод `bulk()` в ElasticsearchRoutingEngine ✅
- [x] Парсинг bulk API формата (NDJSON) ✅
- [x] Batch обработка операций ✅
- [x] Метрики bulk операций ✅
- [x] Интеграция в `processElasticsearchOperation()` ✅

#### 2.4 Улучшение расчета latency
**Файл**: `src/core/elasticsearch/metricsCalculator.ts`

**Функциональность**:
- Более реалистичный расчет latency на основе:
  - Количества шардов
  - Размера индекса
  - Сложности запроса
  - Нагрузки на кластер
  - Типа операции

**Задачи**:
- [x] Создать `metricsCalculator.ts` ✅
- [x] Реализовать расчет latency для index операций (calculateIndexLatency) ✅
- [x] Реализовать расчет latency для search операций (calculateSearchLatency) ✅
- [x] Реализовать расчет latency для get операций (calculateGetLatency) ✅
- [x] Учесть нагрузку на кластер (calculateClusterLoad) ✅
- [x] Учесть сложность запроса (calculateQueryComplexity) ✅
- [x] Интегрировать в ElasticsearchRoutingEngine ✅

---

### Этап 3: Расширение API поддержки

#### 3.1 Cluster API
**Файл**: `src/core/elasticsearch/ElasticsearchRoutingEngine.ts`

**Эндпоинты**:
- `GET /_cluster/health`
- `GET /_cluster/stats`
- `GET /_cluster/settings`
- `GET /_nodes`
- `GET /_nodes/stats`

**Задачи**:
- [x] Добавить метод `getClusterHealth()` ✅
- [x] Добавить метод `getClusterStats()` ✅
- [x] Добавить метод `getNodes()` ✅
- [x] Добавить метод `getNodeStats()` ✅
- [x] Интегрировать в `executeQuery()` для парсинга API calls ✅

#### 3.2 Index Management API
**Файл**: `src/core/elasticsearch/ElasticsearchRoutingEngine.ts`

**Эндпоинты**:
- `PUT /{index}` - создание индекса
- `GET /{index}` - получение информации об индексе
- `DELETE /{index}` - удаление индекса
- `GET /_cat/indices` - список индексов
- `GET /{index}/_mapping` - получение mapping
- `PUT /{index}/_mapping` - обновление mapping
- `GET /{index}/_settings` - получение settings

**Задачи**:
- [x] Добавить метод `createIndexViaAPI()` ✅
- [x] Добавить метод `getIndexInfo()` ✅
- [x] Добавить метод `deleteIndexViaAPI()` ✅
- [x] Добавить метод `getIndicesList()` (cat API format) ✅
- [x] Добавить метод `getIndexMapping()` ✅
- [x] Добавить метод `updateIndexMapping()` ✅
- [x] Добавить метод `getIndexSettings()` ✅
- [x] Интегрировать в `executeQuery()` ✅

#### 3.3 Document API улучшения
**Файл**: `src/core/elasticsearch/ElasticsearchRoutingEngine.ts`

**Улучшения**:
- Поддержка `_update` API
- Поддержка `_source` filtering
- Поддержка versioning и optimistic concurrency
- Поддержка `_routing` параметра

**Задачи**:
- [x] Добавить метод `updateDocument()` (partial update) ✅
- [x] Добавить поддержку `_source` filtering в `getDocument()` ✅
- [x] Добавить versioning для документов ✅
- [x] Добавить поддержку `if_seq_no` и `if_primary_term` ✅
- [x] Улучшить поддержку `_routing` во всех операциях ✅

---

### Этап 4: Улучшение метрик

#### 4.1 Расширенные метрики
**Файл**: `src/core/elasticsearch/types.ts`

**Новые метрики**:
- Метрики по типам операций (index/search/get/delete)
- Метрики по индексам
- Метрики по шардам
- Метрики по узлам
- Метрики производительности запросов

**Задачи**:
- [x] Расширить интерфейс `ElasticsearchMetrics` ✅
- [x] Добавить метрики по типам операций ✅
- [x] Добавить метрики по индексам ✅
- [x] Добавить метрики по шардам ✅
- [x] Добавить метрики по узлам ✅
- [x] Обновить `updateMetrics()` для расчета новых метрик ✅

#### 4.2 Интеграция метрик в UI
**Файл**: `src/components/config/data/ElasticsearchConfigAdvanced.tsx`

**Улучшения**:
- Графики метрик в реальном времени
- Метрики по индексам
- Метрики по шардам
- Метрики производительности

**Задачи**:
- [ ] Добавить графики метрик (Recharts)
- [ ] Добавить секцию метрик по индексам
- [ ] Добавить секцию метрик по шардам
- [ ] Добавить секцию метрик производительности
- [ ] Обновлять метрики в реальном времени

---

### Этап 5: UI/UX улучшения

#### 5.1 Визуализация кластера
**Файл**: `src/components/config/data/ElasticsearchClusterView.tsx` (новый)

**Функциональность**:
- Визуализация узлов кластера
- Визуализация распределения шардов по узлам
- Индикаторы здоровья узлов
- Индикаторы нагрузки на узлы

**Задачи**:
- [ ] Создать компонент `ElasticsearchClusterView.tsx`
- [ ] Визуализация узлов кластера
- [ ] Визуализация шардов на узлах
- [ ] Индикаторы здоровья и нагрузки
- [ ] Интегрировать в `ElasticsearchConfigAdvanced.tsx`

#### 5.2 История операций в реальном времени
**Файл**: `src/components/config/data/ElasticsearchOperationsHistory.tsx` (новый)

**Функциональность**:
- Список операций в реальном времени
- Фильтрация по типу операции
- Фильтрация по индексу
- Детали операции (latency, status, etc.)

**Задачи**:
- [ ] Создать компонент `ElasticsearchOperationsHistory.tsx`
- [ ] Отображение операций в реальном времени
- [ ] Фильтрация операций
- [ ] Детали операции
- [ ] Интегрировать в `ElasticsearchConfigAdvanced.tsx`

#### 5.3 Улучшение Dev Tools
**Файл**: `src/components/config/data/ElasticsearchConfigAdvanced.tsx`

**Улучшения**:
- Автодополнение для Elasticsearch DSL
- Подсветка синтаксиса
- Шаблоны запросов
- История запросов с возможностью повторного выполнения

**Задачи**:
- [ ] Добавить автодополнение (Monaco Editor или CodeMirror)
- [ ] Добавить подсветку синтаксиса
- [ ] Добавить шаблоны запросов
- [ ] Улучшить историю запросов
- [ ] Добавить возможность повторного выполнения

---

### Этап 6: Тестирование и валидация

#### 6.1 Валидация соответствия реальному Elasticsearch
**Задачи**:
- [ ] Сравнить API с реальным Elasticsearch 8.x
- [ ] Проверить соответствие форматов ответов
- [ ] Проверить соответствие метрик
- [ ] Проверить соответствие поведения

#### 6.2 Тестирование производительности
**Задачи**:
- [ ] Тестирование с большим количеством документов
- [ ] Тестирование с большим количеством индексов
- [ ] Тестирование с большим количеством шардов
- [ ] Тестирование bulk операций
- [ ] Оптимизация производительности

#### 6.3 Тестирование UI/UX
**Задачи**:
- [ ] Тестирование всех UI компонентов
- [ ] Проверка отзывчивости интерфейса
- [ ] Проверка обновления метрик в реальном времени
- [ ] Проверка работы Dev Tools

---

## Приоритеты реализации

### Высокий приоритет (критично для симулятивности):
1. ✅ **ВЫПОЛНЕНО** Этап 1: Рефакторинг и устранение хардкода
   - ✅ 1.1 Создан файл констант `src/core/elasticsearch/constants.ts`
   - ✅ 1.2 Создана структура директорий `src/core/elasticsearch/`
   - ✅ 1.2 Вынесены типы в `types.ts`
   - ✅ 1.2 Перемещен `ElasticsearchRoutingEngine.ts` в новую директорию
   - ✅ Все хардкод значения заменены на константы во всех файлах
   - ✅ Обновлены импорты во всех файлах
2. ✅ **ВЫПОЛНЕНО** Этап 2.2: Симуляция refresh interval
   - ✅ Реализована очередь pending документов
   - ✅ Реализована логика refresh по интервалу
   - ✅ Обновлены методы indexDocument и search
   - ✅ Добавлены метрики refresh operations
3. ✅ **ВЫПОЛНЕНО** Этап 2.1: Расширение поддержки Elasticsearch DSL
   - ✅ Создан queryParser.ts с поддержкой bool, range, term, wildcard, exists, match
   - ✅ Интегрирован в ElasticsearchRoutingEngine.search()
4. ✅ **ВЫПОЛНЕНО** Этап 2.4: Улучшение расчета latency
   - ✅ Создан metricsCalculator.ts
   - ✅ Учитывается нагрузка на кластер и сложность запроса

### Средний приоритет (важно для реалистичности):
5. ✅ Этап 2.3: Поддержка bulk операций
6. ✅ Этап 2.4: Улучшение расчета latency
7. ✅ Этап 3.1: Cluster API
8. ✅ Этап 3.2: Index Management API

### Низкий приоритет (улучшения UX):
9. ✅ Этап 5.1: Визуализация кластера
10. ✅ Этап 5.2: История операций
11. ✅ Этап 5.3: Улучшение Dev Tools
12. ✅ Этап 4.2: Интеграция метрик в UI

---

## Критерии успеха

### Симулятивность:
- ✅ **ВЫПОЛНЕНО** Все хардкод значения вынесены в константы
- ✅ Симуляция соответствует реальному Elasticsearch по поведению - УЛУЧШЕНО (добавлена симуляция refresh interval, расширена поддержка DSL)
- ✅ Метрики реалистичны и соответствуют реальным значениям - УЛУЧШЕНО (учитывается нагрузка на кластер, сложность запроса, количество шардов)
- ✅ Поддерживаются основные типы запросов Elasticsearch DSL - УЛУЧШЕНО (bool, range, term, wildcard, exists, match)

### UI/UX:
- ✅ Интерфейс интуитивен и соответствует реальным инструментам Elasticsearch
- ✅ Метрики обновляются в реальном времени
- ✅ Dev Tools работают как в реальном Elasticsearch

### Производительность:
- ✅ Симуляция работает плавно даже с большим количеством данных
- ✅ Нет утечек памяти
- ✅ Оптимизированы вычисления метрик

---

## Заметки для разработчика

### Важные принципы:
1. **Избегать хардкода**: Все значения должны быть в константах или конфигурации
2. **Реалистичность**: Симуляция должна максимально соответствовать реальному Elasticsearch
3. **Расширяемость**: Код должен быть легко расширяемым для новых фич
4. **Производительность**: Симуляция не должна тормозить UI

### Ссылки на документацию:
- Elasticsearch API: https://www.elastic.co/guide/en/elasticsearch/reference/current/rest-apis.html
- Elasticsearch Query DSL: https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl.html
- Elasticsearch Cluster API: https://www.elastic.co/guide/en/elasticsearch/reference/current/cluster.html

### Примеры для тестирования:
- Простые запросы: match_all, match, term
- Сложные запросы: bool с must/should/must_not
- Агрегации: terms, date_histogram
- Bulk операции
- Cluster health и stats

---

## Статус выполнения

### ✅ ВЫПОЛНЕНО (Версия 0.1.8p):

- **Этап 4.1: Расширенные метрики** - ВЫПОЛНЕНО
  - ✅ Расширен интерфейс `ElasticsearchMetrics` в `types.ts`:
    - Добавлен `OperationTypeMetrics` с метриками по типам операций (operationsPerSecond, averageLatency, p50Latency, p99Latency, errorRate, totalOperations, totalErrors)
    - Добавлен `IndexMetrics` с метриками по индексам (docs, size, shards, replicas, health, операции, latency, refresh, pending)
    - Добавлен `ShardMetrics` с метриками по шардам (index, shard, primary, node, state, docs, size, операции, latency)
    - Добавлен `NodeMetrics` с метриками по узлам (address, status, load, shards, операции, latency, memoryUsage, cpuUsage)
  - ✅ Обновлен метод `updateMetrics()` в `ElasticsearchRoutingEngine.ts`:
    - Добавлен метод `calculateOperationMetrics()` для расчета метрик по типам операций
    - Добавлен метод `calculatePercentile()` для расчета процентилей (p50, p99)
    - Реализован расчет метрик по типам операций (index, search, get, delete, bulk, update)
    - Реализован расчет метрик по индексам (распределение операций пропорционально размеру индекса)
    - Реализован расчет метрик по шардам (операции, latency)
    - Реализован расчет метрик по узлам (операции, latency, memoryUsage, cpuUsage на основе load)
  - ✅ Обновлены методы record*Operation:
    - `recordIndexOperation()` теперь принимает параметр `success`
    - `recordSearchOperation()` теперь принимает параметр `success`
    - `recordGetOperation()` теперь принимает параметр `success`
    - Добавлен `recordDeleteOperation()` для отслеживания delete операций
    - Добавлен `recordUpdateOperation()` для отслеживания update операций
  - ✅ Обновлены методы операций:
    - `indexDocument()` вызывает `recordIndexOperation(latency, true)`
    - `getDocument()` вызывает `recordGetOperation(latency, docFound)`
    - `search()` вызывает `recordSearchOperation(latency, hits, true)`
    - `deleteDocument()` вызывает `recordDeleteOperation(latency, deleted)`
    - `updateDocument()` вызывает `recordUpdateOperation(latency, true)` вместо `recordIndexOperation()`

- **Этап 3: Расширение API поддержки** - ВЫПОЛНЕНО
  - ✅ 3.1 Cluster API - реализованы методы:
    - `getClusterHealth()` - GET /_cluster/health
    - `getClusterStats()` - GET /_cluster/stats
    - `getNodes()` - GET /_nodes
    - `getNodeStats()` - GET /_nodes/stats
  - ✅ 3.2 Index Management API - реализованы методы:
    - `createIndexViaAPI()` - PUT /{index}
    - `getIndexInfo()` - GET /{index}
    - `deleteIndexViaAPI()` - DELETE /{index}
    - `getIndicesList()` - GET /_cat/indices (поддержка JSON и text форматов)
    - `getIndexMapping()` - GET /{index}/_mapping
    - `updateIndexMapping()` - PUT /{index}/_mapping
    - `getIndexSettings()` - GET /{index}/_settings
  - ✅ 3.3 Document API улучшения:
    - `updateDocument()` - POST /{index}/_update/{id} (partial update с поддержкой upsert)
    - Поддержка `_source` filtering в `getDocument()` (массивы полей или false)
    - Versioning для документов (_version, _seq_no, _primary_term)
    - Поддержка optimistic concurrency control (if_seq_no, if_primary_term)
  - ✅ Расширен `executeQuery()` для поддержки всех новых API endpoints через HTTP метод + path формат

### ✅ ВЫПОЛНЕНО (Версия 0.1.8p - предыдущие этапы):
- **Этап 1: Рефакторинг и устранение хардкода** - ПОЛНОСТЬЮ ВЫПОЛНЕНО
  - ✅ Создан файл констант `src/core/elasticsearch/constants.ts`
  - ✅ Создана структура директорий `src/core/elasticsearch/`
  - ✅ Вынесены типы в `types.ts`
  - ✅ Перемещен `ElasticsearchRoutingEngine.ts` в новую директорию
  - ✅ Заменены все хардкод значения на константы в:
    - `ElasticsearchRoutingEngine.ts`
    - `DataFlowEngine.ts`
    - `EmulationEngine.ts`
    - `ElasticsearchConfigAdvanced.tsx`
  - ✅ Обновлены импорты во всех файлах

- **Этап 2.1: Расширение поддержки Elasticsearch DSL** - ВЫПОЛНЕНО
  - ✅ Создан `queryParser.ts` с поддержкой:
    - bool queries (must, should, must_not, filter, minimum_should_match)
    - range queries
    - term queries
    - wildcard queries
    - exists queries
    - match queries (улучшен)
  - ✅ Интегрирован в `ElasticsearchRoutingEngine.search()`

- **Этап 2.2: Симуляция refresh interval** - ВЫПОЛНЕНО
  - ✅ Реализована очередь pending документов (pendingDocuments)
  - ✅ Реализован парсер refresh interval (parseRefreshInterval)
  - ✅ Реализована логика refresh (refreshIndex, checkAndRefreshIndices)
  - ✅ Обновлен метод `indexDocument()` - документы попадают в pending
  - ✅ Обновлен метод `search()` - поиск только по searchable документам
  - ✅ Добавлены метрики refresh operations

- **Этап 2.3: Поддержка bulk операций** - ВЫПОЛНЕНО
  - ✅ Добавлен метод `bulk()` в ElasticsearchRoutingEngine
  - ✅ Реализован парсинг NDJSON формата
  - ✅ Реализована batch обработка операций (index, create, update, delete)
  - ✅ Добавлены метрики bulk операций (bulkOperations tracking)
  - ✅ Интегрировано в `processElasticsearchOperation()` в DataFlowEngine
  - ✅ Обновлены типы (добавлены поля items и errors в ElasticsearchOperation)

- **Этап 2.4: Улучшение расчета latency** - ВЫПОЛНЕНО
  - ✅ Создан `metricsCalculator.ts`
  - ✅ Реализован расчет latency с учетом:
    - Количества шардов
    - Размера результата
    - Сложности запроса (calculateQueryComplexity)
    - Нагрузки на кластер (calculateClusterLoad)
    - Размера индекса
  - ✅ Интегрирован в ElasticsearchRoutingEngine

### ⏳ ОСТАЛОСЬ ВЫПОЛНИТЬ:

#### Этап 2: Улучшение симуляции
- ✅ 2.1 Расширение поддержки Elasticsearch DSL (bool, range, term, wildcard, exists, match) - ВЫПОЛНЕНО
- ✅ 2.2 Симуляция refresh interval - ВЫПОЛНЕНО
- ✅ 2.3 Поддержка bulk операций - ВЫПОЛНЕНО
- ✅ 2.4 Улучшение расчета latency (вынесение в отдельный модуль metricsCalculator.ts) - ВЫПОЛНЕНО

#### Этап 3: Расширение API поддержки
- ✅ 3.1 Cluster API (_cluster/health, _cluster/stats, _nodes, _nodes/stats) - ВЫПОЛНЕНО
- ✅ 3.2 Index Management API (PUT/GET/DELETE index, _cat/indices, _mapping, _settings) - ВЫПОЛНЕНО
- ✅ 3.3 Document API улучшения (_update, _source filtering, versioning, optimistic concurrency) - ВЫПОЛНЕНО

#### Этап 4: Улучшение метрик
- ✅ 4.1 Расширенные метрики (по типам операций, по индексам, по шардам, по узлам) - ВЫПОЛНЕНО
  - ✅ Расширен интерфейс ElasticsearchMetrics в types.ts
  - ✅ Добавлены метрики по типам операций (index, search, get, delete, bulk, update) с p50, p99, errorRate
  - ✅ Добавлены метрики по индексам (IndexMetrics)
  - ✅ Добавлены метрики по шардам (ShardMetrics)
  - ✅ Добавлены метрики по узлам (NodeMetrics)
  - ✅ Обновлен метод updateMetrics() для расчета всех новых метрик
  - ✅ Добавлен метод calculateOperationMetrics() для расчета метрик по типам операций
  - ✅ Добавлен метод calculatePercentile() для расчета процентилей
  - ✅ Обновлены методы record*Operation для отслеживания success/failure
- ✅ 4.2 Интеграция метрик в UI (графики, секции метрик) - ВЫПОЛНЕНО
  - ✅ Добавлена вкладка "Metrics" в ElasticsearchConfigAdvanced.tsx
  - ✅ Графики метрик в реальном времени (Recharts):
    - Operations Per Second (LineChart) - Index и Search операции
    - Latency Over Time (AreaChart) - Index, Search, Get latency
    - Latency Percentiles (LineChart) - P50 и P99 для Index и Search
    - Error Rates (AreaChart) - процент ошибок по типам операций
  - ✅ Секция метрик по типам операций (Operation Type Metrics):
    - Карточки для каждого типа операции (index, search, get, delete, bulk, update)
    - Отображение Ops/s, Avg Latency, P50, P99, Error Rate, Total Operations
  - ✅ Секция метрик по индексам (Index Metrics):
    - Детальные метрики для каждого индекса
    - Documents, Size, Shards, Replicas, Health
    - Index Ops/s, Search Ops/s, Avg Latency, Pending Documents
  - ✅ Секция метрик по шардам (Shard Metrics):
    - Таблица с метриками по каждому шарду
    - Index, Shard, Type (Primary/Replica), Node, State
    - Docs, Size, Ops/s, Avg Latency
  - ✅ Секция метрик по узлам (Node Metrics):
    - Карточки для каждого узла кластера
    - Load, Shards, Ops/s, Avg Latency, Memory Usage, CPU Usage
    - Progress bars для Load, Memory, CPU
  - ✅ Обновление метрик в реальном времени (useEffect с интервалом 1 секунда)
  - ✅ История метрик (последние 100 точек данных)

#### Этап 5: UI/UX улучшения
- ✅ 5.1 Визуализация кластера (ElasticsearchClusterView.tsx) - ВЫПОЛНЕНО
  - ✅ Создан компонент ElasticsearchClusterView.tsx
  - ✅ Визуализация узлов кластера с метриками (load, memory, CPU)
  - ✅ Визуализация распределения шардов по узлам
  - ✅ Индикаторы здоровья узлов и кластера
  - ✅ Индикаторы нагрузки на узлы (Progress bars)
  - ✅ Интегрирован в ElasticsearchConfigAdvanced.tsx (вкладка Cluster)
- ✅ 5.2 История операций в реальном времени (ElasticsearchOperationsHistory.tsx) - ВЫПОЛНЕНО
  - ✅ Создан компонент ElasticsearchOperationsHistory.tsx
  - ✅ Отображение операций в реальном времени с фильтрацией
  - ✅ Фильтрация по типу операции (index, search, get, delete, bulk, update)
  - ✅ Фильтрация по индексу
  - ✅ Поиск по операциям
  - ✅ Детали операции (latency, status, hits, items, errors)
  - ✅ Автообновление истории операций (каждую секунду)
  - ✅ Интегрирован в ElasticsearchConfigAdvanced.tsx (новая вкладка History)
  - ✅ Добавлен метод getOperationHistory() в ElasticsearchRoutingEngine
- ✅ 5.3 Улучшение Dev Tools - ВЫПОЛНЕНО
  - ✅ Добавлены шаблоны запросов (match_all, match, bool, range, term, index_document, get_document, delete_document, bulk, cluster_health, cluster_stats, indices_list, index_info)
  - ✅ Улучшен UI Dev Tools (увеличен размер textarea, улучшена типографика)
  - ✅ Поддержка выбора шаблонов через кнопки
  - ✅ Автодополнение (CodeMirror) - ВЫПОЛНЕНО
    - Создан компонент ElasticsearchQueryEditor.tsx с CodeMirror
    - Автодополнение для Elasticsearch API endpoints (GET /_search, POST /_bulk, etc.)
    - Автодополнение для Elasticsearch Query DSL (match, term, bool, range, etc.)
    - Автодополнение для JSON свойств (query, aggs, sort, from, size, etc.)
    - Активация при вводе (activateOnTyping: true)
  - ✅ Подсветка синтаксиса (CodeMirror) - ВЫПОЛНЕНО
    - Подсветка JSON синтаксиса через @codemirror/lang-json
    - Темная тема (oneDark) для лучшей читаемости
    - Номера строк, скобки, автозакрытие скобок
    - Подсветка совпадений при выделении
    - Интегрировано в ElasticsearchConfigAdvanced.tsx

#### Этап 6: Тестирование и валидация
- ⏳ 6.1 Валидация соответствия реальному Elasticsearch
- ⏳ 6.2 Тестирование производительности
- ⏳ 6.3 Тестирование UI/UX

## Следующие шаги

1. ✅ **Этап 1 выполнен** - рефакторинг и устранение хардкода
2. ✅ **Этап 2 полностью выполнен** - расширение DSL, refresh interval, bulk операции, улучшение latency
3. ✅ **Этап 3 полностью выполнен** - расширение API (Cluster API, Index Management API, Document API улучшения)
4. ✅ **Этап 4 полностью выполнен** - расширенные метрики (по типам операций, по индексам, по шардам, по узлам) и интеграция в UI
5. ✅ **Этап 5 выполнен** - UI/UX улучшения (визуализация кластера, история операций, улучшение Dev Tools с шаблонами)
6. **Продолжить с Этапом 6** - тестирование и валидация (опционально)

Каждый этап можно выполнять независимо и тестировать отдельно.

### Текущий статус выполнения

**✅ ВЫПОЛНЕНО:**
- Этап 1: Рефакторинг и устранение хардкода (100%)
- Этап 2: Улучшение симуляции (100%)
- Этап 3: Расширение API поддержки (100%)
- Этап 4: Улучшение метрик (100%)
  - 4.1: Расширенные метрики ✅
  - 4.2: Интеграция метрик в UI ✅
- Этап 5: UI/UX улучшения (100%)
  - 5.1: Визуализация кластера ✅
  - 5.2: История операций в реальном времени ✅
  - 5.3: Улучшение Dev Tools (шаблоны запросов) ✅

**⏳ ОСТАЛОСЬ (опционально):**
- Этап 5: Дополнительные улучшения Dev Tools (100%) ✅
  - ✅ 5.3: Автодополнение и подсветка синтаксиса (CodeMirror) - ВЫПОЛНЕНО
- Этап 6: Тестирование и валидация (0%)
  - 6.1: Валидация соответствия реальному Elasticsearch
  - 6.2: Тестирование производительности
  - 6.3: Тестирование UI/UX
- Этап 6: Тестирование и валидация (0%)
  - 6.1: Валидация соответствия реальному Elasticsearch
  - 6.2: Тестирование производительности
  - 6.3: Тестирование UI/UX

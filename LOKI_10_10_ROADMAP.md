# Loki 10/10 Roadmap

План работ для доведения симуляции Loki с 9/10 до 10/10.

---

## Фаза 1: Быстрые улучшения (9/10 → 9.5/10)
**Время: 3-4 дня**

### 1.1 Расширение LogQL парсера
- [ ] Добавить поддержку всех aggregations:
  - [ ] `max()`, `min()`, `stddev()`, `stdvar()`
  - [ ] `topk()`, `bottomk()`
  - [ ] `quantile()`
  - [ ] `count()`, `count_over_time()`
- [ ] Добавить поддержку binary operators:
  - [ ] Арифметические: `+`, `-`, `*`, `/`, `%`, `^`
  - [ ] Сравнения: `==`, `!=`, `>`, `<`, `>=`, `<=`
  - [ ] Логические: `and`, `or`, `unless`
- [ ] Добавить поддержку функций:
  - [ ] `label_replace()`, `label_format()`
  - [ ] `line_format()`
- [ ] Добавить поддержку unwrap expressions:
  - [ ] `| unwrap <label>`
  - [ ] Unwrap aggregations
- [ ] Добавить поддержку vector aggregations:
  - [ ] `sum by (label)`, `avg by (label)`, etc.
  - [ ] `without` clause для aggregations

**Файлы:**
- `src/core/LokiEmulationEngine.ts` (методы `parseLogQL`, `applyAggregation`)

---

### 1.2 Улучшение storage симуляции
- [ ] Симуляция chunks (группировка entries в chunks):
  - [ ] Структура chunk (timestamp range, entries, size)
  - [ ] Группировка entries в chunks по времени
  - [ ] Расчет chunk size
- [ ] Симуляция index:
  - [ ] Индекс для быстрого поиска chunks по labels
  - [ ] Расчет index size
  - [ ] Симуляция index queries
- [ ] Симуляция compaction:
  - [ ] Объединение маленьких chunks в большие
  - [ ] Расчет compaction overhead
- [ ] Расчет I/O операций:
  - [ ] Read operations при queries (чтение chunks)
  - [ ] Write operations при ingestion (запись chunks)
  - [ ] Расчет I/O latency

**Файлы:**
- `src/core/LokiEmulationEngine.ts` (новые классы/интерфейсы для chunks, index)

---

### 1.3 Query Frontend симуляция
- [ ] Query splitting:
  - [ ] Разбиение больших time ranges на меньшие
  - [ ] Параллельное выполнение split queries
  - [ ] Объединение результатов
- [ ] Query caching:
  - [ ] Кэширование результатов queries
  - [ ] Расчет cache hit rate
  - [ ] Cache invalidation
- [ ] Query optimization:
  - [ ] Оптимизация stream selectors
  - [ ] Оптимизация фильтров
  - [ ] Расчет query cost

**Файлы:**
- `src/core/LokiQueryFrontend.ts` (новый файл)
- `src/core/LokiEmulationEngine.ts` (интеграция)

---

### 1.4 Ruler симуляция (Alert evaluation)
- [ ] LogQL alert rules:
  - [ ] Парсинг alert rules из конфига
  - [ ] Evaluation LogQL queries для alerts
  - [ ] Расчет alert state (firing, pending, resolved)
- [ ] Интеграция с AlertSystem:
  - [ ] Отправка alerts в AlertSystem
  - [ ] Управление alert state
- [ ] Симуляция evaluation interval:
  - [ ] Периодическое evaluation alerts
  - [ ] Расчет нагрузки от alerts

**Файлы:**
- `src/core/LokiRuler.ts` (новый файл)
- `src/core/LokiEmulationEngine.ts` (интеграция)
- `src/core/AlertSystem.ts` (интеграция)

---

## Фаза 2: Архитектурные улучшения (9.5/10 → 9.8/10)
**Время: 5-7 дней**

### 2.1 Мультикомпонентная архитектура
- [ ] LokiDistributor:
  - [ ] Распределение логов по ingesters
  - [ ] Rate limiting на уровне distributor
  - [ ] Расчет latency distributor → ingester
- [ ] LokiIngester:
  - [ ] Хранение логов в памяти
  - [ ] Flush в storage (chunks)
  - [ ] Расчет memory usage
  - [ ] Симуляция flush interval
- [ ] LokiQuerier:
  - [ ] Выполнение queries
  - [ ] Чтение chunks из storage
  - [ ] Расчет query latency
- [ ] LokiQueryFrontend:
  - [ ] Query splitting и optimization
  - [ ] Caching
  - [ ] Распределение queries по queriers
- [ ] Взаимодействие компонентов:
  - [ ] Симуляция network latency между компонентами
  - [ ] Симуляция очередей между компонентами
  - [ ] Расчет end-to-end latency

**Файлы:**
- `src/core/loki/LokiDistributor.ts` (новый)
- `src/core/loki/LokiIngester.ts` (новый)
- `src/core/loki/LokiQuerier.ts` (новый)
- `src/core/loki/LokiQueryFrontend.ts` (новый)
- `src/core/LokiEmulationEngine.ts` (рефакторинг для использования компонентов)

---

### 2.2 Multi-tenancy support
- [ ] Tenant isolation:
  - [ ] Изоляция streams по tenants
  - [ ] Изоляция queries по tenants
  - [ ] Изоляция storage по tenants
- [ ] Per-tenant limits:
  - [ ] Rate limits (ingestion, queries)
  - [ ] Storage limits
  - [ ] Stream limits
- [ ] Per-tenant metrics:
  - [ ] Метрики по каждому tenant
  - [ ] Расчет utilization по tenant

**Файлы:**
- `src/core/LokiEmulationEngine.ts` (добавить tenant support)
- `src/components/config/observability/LokiConfigAdvanced.tsx` (UI для tenants)

---

### 2.3 Продвинутые features
- [ ] Детальные rate limits:
  - [ ] Per-tenant rate limits
  - [ ] Per-stream rate limits
  - [ ] Per-label rate limits
  - [ ] Симуляция throttling при превышении
- [ ] Quotas:
  - [ ] Storage quotas (per tenant, per stream)
  - [ ] Ingestion quotas
  - [ ] Query quotas
  - [ ] Симуляция rejection при превышении
- [ ] Advanced retention policies:
  - [ ] Разные retention для разных streams
  - [ ] Retention по labels
  - [ ] Retention по tenants
  - [ ] Симуляция lifecycle management

**Файлы:**
- `src/core/LokiEmulationEngine.ts` (добавить quotas, advanced retention)

---

## Фаза 3: Полировка и завершение (9.8/10 → 10/10)
**Время: 5-7 дней**

### 3.1 Полный LogQL парсер
- [ ] Использовать парсер-генератор или написать полноценный parser:
  - [ ] ANTLR grammar для LogQL (или recursive descent parser)
  - [ ] AST (Abstract Syntax Tree) для queries
  - [ ] Query validation
- [ ] Поддержка всех операторов:
  - [ ] Line filters: `|=`, `!=`, `|~`, `!~`, `|`, `| json`, `| regexp`, `| pattern`
  - [ ] Label filters: все операторы сравнения
  - [ ] Binary operators: все арифметические и логические
- [ ] Поддержка всех функций:
  - [ ] Все label functions
  - [ ] Все line format functions
  - [ ] Все aggregation functions
- [ ] Query optimization:
  - [ ] Query planning
  - [ ] Execution plans
  - [ ] Cost estimation

**Файлы:**
- `src/core/loki/LogQLParser.ts` (новый, полноценный парсер)
- `src/core/loki/LogQLAST.ts` (AST структуры)
- `src/core/loki/LogQLOptimizer.ts` (query optimization)

---

### 3.2 Реалистичная симуляция производительности
- [ ] Детальный расчет CPU:
  - [ ] CPU для ingestion (parsing, compression, indexing)
  - [ ] CPU для queries (parsing, execution, aggregation)
  - [ ] CPU для compaction
  - [ ] CPU для network I/O
- [ ] Детальный расчет Memory:
  - [ ] Memory для ingester (in-memory streams)
  - [ ] Memory для querier (query results cache)
  - [ ] Memory для index
  - [ ] Memory для chunks cache
- [ ] Детальный расчет I/O:
  - [ ] Disk read/write для chunks
  - [ ] Disk read для index
  - [ ] Network I/O между компонентами
- [ ] Симуляция backpressure:
  - [ ] При перегрузке ingester
  - [ ] При перегрузке storage
  - [ ] При перегрузке querier

**Файлы:**
- `src/core/loki/LokiPerformanceSimulator.ts` (новый)
- `src/core/LokiEmulationEngine.ts` (интеграция)

---

### 3.3 Интеграция с log collectors
- [ ] Promtail simulation:
  - [ ] Сбор логов из файлов
  - [ ] Парсинг различных форматов (JSON, syslog, Apache, Nginx)
  - [ ] Добавление labels
  - [ ] Отправка в Loki
- [ ] Fluent Bit/Fluentd simulation:
  - [ ] Сбор логов
  - [ ] Трансформация логов
  - [ ] Отправка в Loki
- [ ] Vector simulation:
  - [ ] Сбор и трансформация
  - [ ] Отправка в Loki
- [ ] Симуляция различных log formats:
  - [ ] JSON logs
  - [ ] Syslog
  - [ ] Apache access logs
  - [ ] Nginx access logs
  - [ ] Docker logs

**Файлы:**
- `src/core/PromtailSimulator.ts` (новый)
- `src/core/FluentBitSimulator.ts` (новый)
- `src/core/VectorSimulator.ts` (новый)
- `src/core/EmulationEngine.ts` (интеграция)

---

### 3.4 Полная поддержка Loki HTTP API
- [ ] Push API (`POST /loki/api/v1/push`):
  - [ ] Поддержка всех форматов (JSON, protobuf, snappy)
  - [ ] Валидация payload
  - [ ] Обработка ошибок
- [ ] Query API (`GET /loki/api/v1/query`):
  - [ ] Instant queries
  - [ ] Range queries
  - [ ] Поддержка всех параметров
- [ ] Query Range API (`GET /loki/api/v1/query_range`):
  - [ ] Range queries с step
  - [ ] Поддержка всех параметров
- [ ] Labels API (`GET /loki/api/v1/labels`):
  - [ ] Получение всех labels
  - [ ] Фильтрация по времени
- [ ] Series API (`GET /loki/api/v1/series`):
  - [ ] Получение series по matchers
  - [ ] Фильтрация по времени
- [ ] Streaming queries:
  - [ ] Tail API (`GET /loki/api/v1/tail`)
  - [ ] Симуляция streaming результатов

**Файлы:**
- `src/core/loki/LokiHTTPAPI.ts` (новый, симуляция API endpoints)
- `src/core/DataFlowEngine.ts` (интеграция с API)

---

### 3.5 Продвинутые features
- [ ] Authentication/Authorization:
  - [ ] Симуляция auth проверок
  - [ ] Симуляция authorization (per tenant, per stream)
- [ ] Advanced retention:
  - [ ] Retention по labels
  - [ ] Retention по tenants
  - [ ] Retention policies с условиями
- [ ] Lifecycle management:
  - [ ] Автоматическое удаление по правилам
  - [ ] Архивация старых логов
  - [ ] Compression старых chunks
- [ ] Monitoring и observability:
  - [ ] Метрики самого Loki (Prometheus format)
  - [ ] Логи самого Loki
  - [ ] Health checks

**Файлы:**
- `src/core/LokiEmulationEngine.ts` (добавить features)
- `src/core/PrometheusMetricsExporter.ts` (добавить Loki metrics)

---

### 3.6 Реалистичная симуляция масштабирования
- [ ] Горизонтальное масштабирование:
  - [ ] Multiple ingesters
  - [ ] Multiple queriers
  - [ ] Load balancing между компонентами
- [ ] Replication:
  - [ ] Симуляция replication chunks
  - [ ] Симуляция consistency
- [ ] Capacity planning:
  - [ ] Расчет необходимых ресурсов
  - [ ] Расчет количества компонентов
  - [ ] Расчет storage requirements

**Файлы:**
- `src/core/loki/LokiCluster.ts` (новый, симуляция кластера)
- `src/core/LokiEmulationEngine.ts` (интеграция)

---

## Фаза 4: Тестирование и оптимизация
**Время: 2-3 дня**

### 4.1 Тестирование
- [ ] Unit тесты для LogQL парсера
- [ ] Unit тесты для каждого компонента
- [ ] Интеграционные тесты
- [ ] Тесты производительности
- [ ] Тесты edge cases

**Файлы:**
- `src/core/loki/__tests__/` (новые тесты)

---

### 4.2 Оптимизация
- [ ] Оптимизация структур данных
- [ ] Оптимизация алгоритмов
- [ ] Lazy evaluation где возможно
- [ ] Оптимизация памяти
- [ ] Оптимизация производительности

**Файлы:**
- Все файлы Loki (оптимизация)

---

### 4.3 Документация
- [ ] Документация архитектуры
- [ ] Документация API
- [ ] Документация конфигурации
- [ ] Примеры использования

**Файлы:**
- `docs/loki/` (новая документация)

---

## Приоритеты

### Высокий приоритет (для быстрого улучшения):
1. ✅ Расширение LogQL парсера (больше aggregations, operators)
2. ✅ Query Frontend (caching, splitting)
3. ✅ Ruler (alert evaluation)
4. ✅ Улучшение storage симуляции (chunks, I/O)

### Средний приоритет (для архитектурных улучшений):
1. Мультикомпонентная архитектура
2. Multi-tenancy
3. Продвинутые features (quotas, advanced retention)

### Низкий приоритет (для полировки):
1. Полный LogQL парсер (ANTLR/recursive descent)
2. Интеграция с log collectors
3. Полная поддержка HTTP API
4. Реалистичная симуляция масштабирования

---

## Оценка времени

- **Фаза 1 (9/10 → 9.5/10)**: 3-4 дня
- **Фаза 2 (9.5/10 → 9.8/10)**: 5-7 дней
- **Фаза 3 (9.8/10 → 10/10)**: 5-7 дней
- **Фаза 4 (Тестирование)**: 2-3 дня

**Итого: 15-21 день работы**

---

## Риски и ограничения

### Технические риски:
1. **Сложность LogQL парсера**: Полный парсер - очень сложная задача
2. **Производительность**: При большом количестве streams/queries могут быть проблемы
3. **Сложность кода**: Много компонентов = сложнее поддерживать

### Практические ограничения:
1. **Баланс реалистичности и простоты**: Полная симуляция может быть избыточной
2. **Время разработки**: 15-21 день - значительные затраты времени
3. **Тестирование**: Нужны обширные тесты для всех компонентов

---

## Рекомендации

### Минимальный путь к 9.5/10 (быстро):
- Расширить LogQL парсер (больше aggregations)
- Добавить Query Frontend (caching)
- Добавить Ruler (alerts)
- Улучшить storage симуляцию (chunks)

**Время: 3-4 дня**

### Оптимальный путь к 9.8/10 (баланс):
- Все из минимального пути
- Мультикомпонентная архитектура (упрощенная)
- Multi-tenancy (базовая)
- Продвинутые features (базовые)

**Время: 8-11 дней**

### Полный путь к 10/10 (идеально):
- Все из оптимального пути
- Полный LogQL парсер
- Интеграция с log collectors
- Полная поддержка HTTP API
- Реалистичная симуляция масштабирования

**Время: 15-21 день**

---

## Текущий статус: 9/10

**Что уже есть:**
- ✅ Базовый LogQL парсер (stream selectors, line filters, label filters, базовые aggregations)
- ✅ Ingestion обработка (push API формат)
- ✅ Query execution
- ✅ Retention policy
- ✅ Расчет нагрузки
- ✅ Интеграция с Grafana
- ✅ Интеграция с DataFlowEngine
- ✅ Полное редактирование UI

**Что нужно для 10/10:**
- Полный LogQL парсер
- Мультикомпонентная архитектура
- Реалистичная симуляция storage backend
- Продвинутые features
- Интеграция с log collectors
- Полная поддержка HTTP API


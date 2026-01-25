# Loki - Документация компонента

## Обзор

Loki - это горизонтально масштабируемая система агрегации логов, вдохновленная Prometheus. Компонент Loki в системе симуляции полностью эмулирует поведение реального Loki, включая прием логов через Push API, хранение логов в streams с labels, выполнение LogQL queries, retention policy, compression, rate limiting, multi-tenancy и полный набор возможностей Loki.

### Основные возможности

- ✅ **Log Ingestion (Push API)** - Прием логов от компонентов через HTTP Push API
- ✅ **LogQL Queries** - Выполнение запросов к логам через LogQL (Loki Query Language)
- ✅ **Streams** - Хранение логов в streams с labels для организации и фильтрации
- ✅ **Retention Policy** - Автоматическое удаление старых логов по retention period
- ✅ **Compression** - Сжатие логов для экономии места (gzip, snappy, lz4)
- ✅ **Rate Limiting** - Ограничение ingestion rate (lines/sec) и query rate (queries/sec)
- ✅ **Multi-tenancy** - Поддержка множественных tenants с изоляцией данных
- ✅ **Метрики Loki** - Полный набор метрик производительности и использования

---

## Основные функции

### 1. Log Ingestion (Прием логов)

**Описание:** Loki принимает логи от компонентов через HTTP Push API в формате Loki.

**Формат Push API:**
```json
{
  "streams": [
    {
      "stream": {
        "job": "varlogs",
        "level": "info",
        "instance": "node1"
      },
      "values": [
        ["1609459200000000000", "Log line 1"],
        ["1609459201000000000", "Log line 2"]
      ]
    }
  ]
}
```

**Параметры Ingestion:**
- **maxStreams** - Максимальное количество streams (по умолчанию: `10000`)
- **maxLineSize** - Максимальный размер одной строки лога в bytes (по умолчанию: `256000`)
- **ingestionRateLimit** - Лимит ingestion rate в lines/sec (опционально, `null` = unlimited)
- **enableCompression** - Включить сжатие (по умолчанию: `true`)
- **compressionType** - Тип сжатия: `gzip`, `snappy`, `lz4` (по умолчанию: `gzip`)

**Пример конфигурации:**
```json
{
  "maxStreams": 10000,
  "maxLineSize": 256000,
  "ingestionRateLimit": 100000,
  "enableCompression": true,
  "compressionType": "gzip"
}
```

**Как работает:**
1. Компоненты отправляют логи в Loki через HTTP POST запрос к `/loki/api/v1/push`
2. Loki парсит запрос и извлекает streams и entries
3. Для каждого stream создается или обновляется LogStream с labels
4. Entries добавляются в соответствующий stream
5. Применяется compression (если включено)
6. Обновляются метрики (ingestion rate, storage size)

### 2. LogQL Queries (Запросы к логам)

**Описание:** LogQL (Loki Query Language) - язык запросов для поиска и анализа логов.

**Типы запросов:**
- **Log Queries** - Поиск логов по stream selector и фильтрам
- **Metric Queries** - Агрегация логов в метрики

**Основные компоненты LogQL:**

#### 2.1. Stream Selector

**Описание:** Выбор streams по labels.

**Синтаксис:**
```logql
{label="value", label2="value2"}
```

**Примеры:**
```logql
# Все логи с job="varlogs"
{job="varlogs"}

# Логи с job="varlogs" и level="error"
{job="varlogs", level="error"}

# Логи с instance, начинающимся с "node"
{instance=~"node.*"}
```

#### 2.2. Line Filters

**Описание:** Фильтрация строк логов по содержимому.

**Операторы:**
- `|= "text"` - Строка содержит текст
- `!= "text"` - Строка не содержит текст
- `|~ "regex"` - Строка соответствует regex
- `!~ "regex"` - Строка не соответствует regex

**Примеры:**
```logql
# Логи, содержащие "error"
{job="varlogs"} |= "error"

# Логи, не содержащие "debug"
{job="varlogs"} != "debug"

# Логи, соответствующие regex
{job="varlogs"} |~ "error|warning"
```

#### 2.3. Label Filters

**Описание:** Фильтрация по labels после stream selector.

**Операторы:**
- `| label = "value"` - Label равен значению
- `| label != "value"` - Label не равен значению
- `| label =~ "regex"` - Label соответствует regex
- `| label !~ "regex"` - Label не соответствует regex

**Примеры:**
```logql
# Логи с level="error"
{job="varlogs"} | level = "error"

# Логи с instance, начинающимся с "node"
{job="varlogs"} | instance =~ "node.*"
```

#### 2.4. Aggregations

**Описание:** Агрегация логов в метрики.

**Функции:**
- `rate()` - Скорость изменения (entries/sec)
- `count_over_time()` - Количество entries за период
- `sum()` - Сумма значений
- `avg()` - Среднее значение
- `max()` - Максимальное значение
- `min()` - Минимальное значение

**Примеры:**
```logql
# Скорость логов в секунду
rate({job="varlogs"}[5m])

# Количество логов за 5 минут
count_over_time({job="varlogs"}[5m])

# Скорость ошибок по level
sum(rate({job="varlogs"} |= "error"[5m])) by (level)
```

**Параметры Query:**
- **query** - LogQL выражение (обязательно)
- **startTime** - Начальное время (опционально, по умолчанию: последний час)
- **endTime** - Конечное время (опционально, по умолчанию: сейчас)
- **limit** - Максимальное количество результатов (опционально, по умолчанию: `100`)

**Пример выполнения query:**
```typescript
const result = lokiEngine.executeQuery(
  '{job="varlogs"} |= "error"',
  startTime,
  endTime,
  100
);
```

### 3. Streams (Потоки логов)

**Описание:** Streams - это группы логов с одинаковыми labels.

**Структура Stream:**
- **labels** - Метки для идентификации stream (job, level, instance и т.д.)
- **entries** - Массив log entries (timestamp, line)
- **size** - Размер stream в bytes
- **lastEntryTime** - Время последней записи

**Как работает:**
1. При ingestion логов Loki группирует их по labels в streams
2. Каждый уникальный набор labels создает отдельный stream
3. Entries добавляются в соответствующий stream
4. Streams используются для быстрого поиска при queries

**Пример streams:**
```json
{
  "streams": [
    {
      "labels": { "job": "varlogs", "level": "info" },
      "entries": [
        { "timestamp": "1609459200000000000", "line": "Application started" },
        { "timestamp": "1609459201000000000", "line": "Processing request" }
      ],
      "size": 2048,
      "lastEntryTime": 1609459201000
    },
    {
      "labels": { "job": "varlogs", "level": "error" },
      "entries": [
        { "timestamp": "1609459202000000000", "line": "Error occurred" }
      ],
      "size": 1024,
      "lastEntryTime": 1609459202000
    }
  ]
}
```

**Ограничения:**
- **maxStreams** - Максимальное количество streams (по умолчанию: `10000`)
- При достижении лимита новые streams не создаются (ошибка ingestion)

### 4. Retention Policy (Политика хранения)

**Описание:** Retention policy автоматически удаляет старые логи по заданному периоду.

**Параметры:**
- **retentionPeriod** - Период хранения (например: `168h` = 7 дней, `30d` = 30 дней)
- По умолчанию: `168h` (7 дней)

**Формат retention period:**
- `s` - секунды
- `m` - минуты
- `h` - часы
- `d` - дни

**Как работает:**
1. Retention выполняется периодически (каждые 5 минут)
2. Удаляются entries старше `retentionPeriod`
3. Пустые streams удаляются
4. Обновляются метрики (retention deletions, storage size)

**Пример конфигурации:**
```json
{
  "retentionPeriod": "168h"
}
```

**Преимущества:**
- Автоматическое управление местом на диске
- Соответствие требованиям compliance
- Оптимизация производительности queries

### 5. Compression (Сжатие)

**Описание:** Loki сжимает логи для экономии места на диске.

**Типы сжатия:**
- **gzip** - Высокое сжатие (~70%), медленнее (по умолчанию)
- **snappy** - Среднее сжатие (~50%), быстрее
- **lz4** - Среднее сжатие (~60%), очень быстро

**Параметры:**
- **enableCompression** - Включить сжатие (по умолчанию: `true`)
- **compressionType** - Тип сжатия (по умолчанию: `gzip`)

**Пример конфигурации:**
```json
{
  "enableCompression": true,
  "compressionType": "gzip"
}
```

**Как работает:**
1. При ingestion логи сжимаются согласно `compressionType`
2. Размер stream пересчитывается с учетом compression ratio
3. Compression ratio учитывается в метриках storage size

**Рекомендации:**
- Используйте `gzip` для максимального сжатия (production)
- Используйте `snappy` или `lz4` для лучшей производительности

### 6. Rate Limiting (Ограничение скорости)

**Описание:** Rate limiting ограничивает ingestion и query rate для защиты от перегрузки.

**Типы rate limits:**
- **ingestionRateLimit** - Лимит ingestion rate в lines/sec (опционально, `null` = unlimited)
- **queryRateLimit** - Лимит query rate в queries/sec (опционально, `null` = unlimited)

**Как работает:**
1. Rate limiting использует sliding window (1 секунда)
2. При превышении лимита возвращается ошибка `429 Too Many Requests`
3. Rate limiting применяется на уровне источника (ingestion) или глобально (queries)

**Пример конфигурации:**
```json
{
  "ingestionRateLimit": 100000,
  "queryRateLimit": 100
}
```

**Рекомендации:**
- Установите `ingestionRateLimit` для защиты от перегрузки
- Установите `queryRateLimit` для защиты от expensive queries
- Мониторьте метрики rate limit errors

### 7. Multi-tenancy (Мультитенантность)

**Описание:** Multi-tenancy позволяет изолировать данные по tenants.

**Параметры:**
- **enableMultiTenancy** - Включить multi-tenancy (по умолчанию: `false`)
- **tenants** - Список tenants (опционально)

**Как работает:**
1. При включении multi-tenancy данные изолируются по tenants
2. Queries выполняются в контексте tenant
3. Ingestion привязывается к tenant
4. Storage изолируется по tenants

**Пример конфигурации:**
```json
{
  "enableMultiTenancy": true,
  "tenants": ["tenant1", "tenant2", "tenant3"]
}
```

**Преимущества:**
- Изоляция данных между tenants
- Безопасность и compliance
- Управление ресурсами по tenants

---

## Руководство пользователя

### Быстрый старт

1. **Добавление компонента Loki:**
   - Перетащите компонент "Loki" из библиотеки компонентов на canvas
   - Откройте панель конфигурации компонента

2. **Настройка базовых параметров:**
   - Перейдите на вкладку **"Server Configuration"**
   - Укажите `serverUrl` (по умолчанию: `http://loki:3100`)
   - Перейдите на вкладку **"Retention & Limits"**
   - Укажите `retentionPeriod` (по умолчанию: `168h` = 7 дней)
   - Укажите `maxStreams` (по умолчанию: `10000`)

3. **Подключение компонентов к Loki:**
   - Создайте connection от компонента к Loki
   - Компонент автоматически отправляет логи в Loki через Push API
   - Логи группируются в streams по labels

4. **Настройка Compression:**
   - Перейдите на вкладку **"Compression"**
   - Включите compression (`enableCompression: true`)
   - Выберите тип сжатия (`gzip`, `snappy`, `lz4`)

5. **Настройка Rate Limits:**
   - Перейдите на вкладку **"Rate Limits"**
   - Укажите `ingestionRateLimit` (lines/sec, опционально)
   - Укажите `queryRateLimit` (queries/sec, опционально)

### Работа с Ingestion

#### Настройка Ingestion

1. Перейдите на вкладку **"Retention & Limits"**
2. Настройте параметры:
   - **Max Streams** - Максимальное количество streams
   - **Max Line Size** - Максимальный размер строки лога
   - **Average Log Line Size** - Средний размер строки (для оценки трафика)
3. Нажмите **"Save"**

#### Мониторинг Ingestion

1. Перейдите на вкладку **"Metrics"**
2. Просмотрите метрики:
   - **Ingestion Lines Per Second** - Скорость ingestion
   - **Ingestion Bytes Per Second** - Объем ingestion
   - **Active Streams** - Количество активных streams
   - **Total Storage Size** - Общий размер хранилища

### Работа с LogQL Queries

#### Выполнение Query

1. Перейдите на вкладку **"Queries"**
2. Нажмите кнопку **"Add Query"**
3. Введите LogQL выражение:
   ```logql
   {job="varlogs"} |= "error"
   ```
4. Нажмите кнопку **"Execute"**
5. Просмотрите результаты

#### Примеры LogQL Queries

**Простой поиск:**
```logql
{job="varlogs"}
```

**Поиск с фильтром:**
```logql
{job="varlogs"} |= "error"
```

**Поиск с regex:**
```logql
{job="varlogs"} |~ "error|warning"
```

**Агрегация:**
```logql
sum(rate({job="varlogs"} |= "error"[5m])) by (level)
```

**Количество логов:**
```logql
count_over_time({job="varlogs"}[5m])
```

### Работа с Streams

#### Просмотр Streams

1. Перейдите на вкладку **"Streams"**
2. Просмотрите список streams:
   - **Labels** - Метки stream
   - **Entries** - Количество entries
   - **Size** - Размер stream
   - **Last Entry** - Время последней записи

#### Фильтрация Streams

1. Используйте поиск для фильтрации streams по labels
2. Используйте LogQL query для поиска streams:
   ```logql
   {job="varlogs", level="error"}
   ```

### Работа с Retention

#### Настройка Retention

1. Перейдите на вкладку **"Retention & Limits"**
2. Укажите `retentionPeriod`:
   - `168h` - 7 дней
   - `720h` - 30 дней
   - `2160h` - 90 дней
3. Нажмите **"Save"**

**Примечание:** Retention выполняется автоматически каждые 5 минут.

#### Мониторинг Retention

1. Перейдите на вкладку **"Metrics"**
2. Просмотрите метрику **Retention Deletions** - количество удаленных entries

### Работа с Compression

#### Настройка Compression

1. Перейдите на вкладку **"Compression"**
2. Включите compression (`enableCompression: true`)
3. Выберите тип сжатия:
   - **gzip** - Максимальное сжатие (~70%)
   - **snappy** - Среднее сжатие (~50%), быстрее
   - **lz4** - Среднее сжатие (~60%), очень быстро
4. Нажмите **"Save"**

**Рекомендации:**
- Используйте `gzip` для production (максимальное сжатие)
- Используйте `snappy` или `lz4` для лучшей производительности

### Работа с Rate Limits

#### Настройка Rate Limits

1. Перейдите на вкладку **"Rate Limits"**
2. Укажите `ingestionRateLimit` (lines/sec):
   - `null` или `0` - без лимита
   - Например: `100000` - 100,000 lines/sec
3. Укажите `queryRateLimit` (queries/sec):
   - `null` или `0` - без лимита
   - Например: `100` - 100 queries/sec
4. Нажмите **"Save"**

**Примечание:** При превышении лимита возвращается ошибка `429 Too Many Requests`.

---

## Руководство администратора

### Рекомендации по конфигурации

#### Production Loki

```json
{
  "serverUrl": "http://loki:3100",
  "retentionPeriod": "720h",
  "maxStreams": 50000,
  "maxLineSize": 256000,
  "avgLogLineSize": 200,
  "enableCompression": true,
  "compressionType": "gzip",
  "enableAuth": true,
  "enableMultiTenancy": false,
  "ingestionRateLimit": 1000000,
  "queryRateLimit": 1000
}
```

**Рекомендации:**
- Используйте compression для экономии места (`gzip`)
- Настройте retention period согласно требованиям compliance
- Установите rate limits для защиты от перегрузки
- Мониторьте метрики Loki (ingestion rate, storage size, query latency)
- Используйте multi-tenancy для изоляции данных

### Оптимизация производительности

**Retention Period:**
- Используйте `168h-720h` (7-30 дней) для большинства случаев
- Используйте `2160h` (90 дней) для долгосрочного хранения
- Мониторьте storage size и настройте retention соответственно

**Compression:**
- Используйте `gzip` для максимального сжатия (production)
- Используйте `snappy` или `lz4` для лучшей производительности
- Мониторьте compression ratio в метриках

**Rate Limits:**
- Установите `ingestionRateLimit` для защиты от перегрузки
- Установите `queryRateLimit` для защиты от expensive queries
- Мониторьте rate limit errors в метриках

**Stream Management:**
- Ограничьте количество уникальных labels для уменьшения количества streams
- Используйте разумные значения `maxStreams` (10,000-50,000)
- Мониторьте количество streams в метриках

### Безопасность

#### Управление доступом

- Используйте аутентификацию (`enableAuth: true`)
- Используйте multi-tenancy для изоляции данных
- Ограничьте доступ к Loki API
- Используйте network policies для изоляции

#### Защита данных

- Настройте retention period согласно требованиям compliance
- Регулярно делайте backup конфигурации
- Мониторьте метрики Loki (ingestion errors, query errors)
- Настройте алерты для критичных проблем

### Мониторинг и алертинг

#### Ключевые метрики

1. **Ingestion Rate**
   - Нормальное значение: зависит от нагрузки
   - Алерт: ingestionRateLimit exceeded (rate limit errors > 0)

2. **Storage Size**
   - Нормальное значение: зависит от retention period
   - Алерт: storageSize > 80% диска (приближение к лимиту)

3. **Active Streams**
   - Нормальное значение: < maxStreams
   - Алерт: activeStreams > 80% maxStreams (приближение к лимиту)

4. **Query Latency**
   - Нормальное значение: averageQueryLatency < 100ms
   - Алерт: averageQueryLatency > 500ms (медленные queries)

5. **Ingestion Errors**
   - Нормальное значение: ingestionErrorsTotal = 0
   - Алерт: ingestionErrorsTotal > 0 (проблемы с ingestion)

6. **Query Errors**
   - Нормальное значение: queryErrorsTotal = 0
   - Алерт: queryErrorsTotal > 0 (проблемы с queries)

---

## Метрики и мониторинг

### Метрики Ingestion

- **ingestionRequestsTotal** - Общее количество ingestion запросов
- **ingestionErrorsTotal** - Общее количество ошибок ingestion
- **ingestionLinesTotal** - Общее количество принятых строк логов
- **ingestionBytesTotal** - Общий объем принятых данных (bytes)
- **ingestionLinesPerSecond** - Скорость ingestion (lines/sec)
- **ingestionBytesPerSecond** - Объем ingestion (bytes/sec)
- **averageIngestionLatency** - Средняя latency ingestion (ms)
- **ingestionErrorRate** - Процент ошибок ingestion

### Метрики Queries

- **queryRequestsTotal** - Общее количество query запросов
- **queryErrorsTotal** - Общее количество ошибок queries
- **queryDurationTotal** - Общая длительность queries (ms)
- **queriesPerSecond** - Скорость queries (queries/sec)
- **averageQueryLatency** - Средняя latency queries (ms)
- **queryErrorRate** - Процент ошибок queries

### Метрики Storage

- **activeStreams** - Количество активных streams
- **totalStorageSize** - Общий размер хранилища (bytes)
- **storageUtilization** - Использование хранилища (0-1)
- **retentionDeletions** - Количество удаленных entries (retention)

### Мониторинг в реальном времени

Все метрики обновляются в реальном времени во время симуляции:
- Метрики синхронизируются из `LokiEmulationEngine` каждые 500ms
- Метрики отображаются в UI компоненте
- Retention выполняется автоматически каждые 5 минут
- Rate limiting применяется в реальном времени

---

## Примеры использования

### Пример 1: Простой Ingestion

**Сценарий:** Прием логов от компонента в Loki

```json
{
  "serverUrl": "http://loki:3100",
  "retentionPeriod": "168h",
  "maxStreams": 10000,
  "enableCompression": true,
  "compressionType": "gzip"
}
```

**Как работает:**
1. Компонент отправляет логи в Loki через Push API
2. Логи группируются в streams по labels
3. Логи сжимаются и сохраняются
4. Метрики обновляются

### Пример 2: LogQL Query для поиска ошибок

**Сценарий:** Поиск всех ошибок за последний час

**LogQL Query:**
```logql
{job="varlogs"} |= "error"
```

**Результат:**
```json
{
  "stream": { "job": "varlogs", "level": "error" },
  "values": [
    ["1609459200000000000", "Error: Connection failed"],
    ["1609459201000000000", "Error: Timeout occurred"]
  ]
}
```

### Пример 3: LogQL Aggregation

**Сценарий:** Подсчет количества ошибок по level за 5 минут

**LogQL Query:**
```logql
sum(count_over_time({job="varlogs"} |= "error"[5m])) by (level)
```

**Результат:**
```json
{
  "stream": { "level": "error" },
  "values": [
    ["1609459200000000000", "42"]
  ]
}
```

### Пример 4: Rate Limiting

**Сценарий:** Защита от перегрузки ingestion и queries

```json
{
  "ingestionRateLimit": 100000,
  "queryRateLimit": 100
}
```

**Поведение:**
- Ingestion ограничен 100,000 lines/sec
- Queries ограничены 100 queries/sec
- При превышении лимита возвращается `429 Too Many Requests`

### Пример 5: Multi-tenancy

**Сценарий:** Изоляция данных по tenants

```json
{
  "enableMultiTenancy": true,
  "tenants": ["tenant1", "tenant2", "tenant3"]
}
```

**Поведение:**
- Данные изолируются по tenants
- Queries выполняются в контексте tenant
- Storage изолируется по tenants

### Пример 6: Retention Policy

**Сценарий:** Хранение логов в течение 30 дней

```json
{
  "retentionPeriod": "720h"
}
```

**Поведение:**
- Логи старше 30 дней автоматически удаляются
- Retention выполняется каждые 5 минут
- Пустые streams удаляются

---

## Часто задаваемые вопросы (FAQ)

### Что такое Loki?

Loki - это горизонтально масштабируемая система агрегации логов, вдохновленная Prometheus. Loki принимает логи от компонентов через Push API, хранит их в streams с labels и позволяет выполнять запросы через LogQL.

### Как работает Loki?

1. Компоненты отправляют логи в Loki через HTTP Push API
2. Loki группирует логи в streams по labels
3. Логи сжимаются и сохраняются
4. Пользователи выполняют LogQL queries для поиска и анализа логов
5. Retention policy автоматически удаляет старые логи

### В чем разница между Loki и Elasticsearch?

- **Loki**: Оптимизирован для логов, использует labels (как Prometheus), более простой и эффективный
- **Elasticsearch**: Универсальная поисковая система, более сложная, требует больше ресурсов

**Преимущества Loki:**
- Простота использования
- Эффективность хранения (compression)
- Интеграция с Prometheus и Grafana
- LogQL для запросов

### Что такое LogQL?

LogQL (Loki Query Language) - язык запросов для поиска и анализа логов в Loki. LogQL похож на PromQL, но оптимизирован для работы с логами.

**Основные компоненты:**
- Stream selector: `{job="varlogs"}`
- Line filters: `|= "error"`
- Label filters: `| level = "error"`
- Aggregations: `rate()`, `count_over_time()`

### Как работает Retention?

Retention policy автоматически удаляет логи старше заданного периода. Retention выполняется периодически (каждые 5 минут) и удаляет entries, которые старше `retentionPeriod`.

**Пример:**
- `retentionPeriod: "168h"` - логи хранятся 7 дней
- `retentionPeriod: "720h"` - логи хранятся 30 дней

### Как работает Compression?

Loki сжимает логи для экономии места на диске. Поддерживаются три типа сжатия:
- **gzip**: ~70% сжатие, медленнее (рекомендуется для production)
- **snappy**: ~50% сжатие, быстрее
- **lz4**: ~60% сжатие, очень быстро

### Как работает Rate Limiting?

Rate limiting ограничивает ingestion rate (lines/sec) и query rate (queries/sec) для защиты от перегрузки. При превышении лимита возвращается ошибка `429 Too Many Requests`.

**Пример:**
- `ingestionRateLimit: 100000` - максимум 100,000 lines/sec
- `queryRateLimit: 100` - максимум 100 queries/sec

### Как мониторить Loki?

Используйте метрики самого Loki:
- **Ingestion Rate** - скорость приема логов
- **Storage Size** - размер хранилища
- **Active Streams** - количество streams
- **Query Latency** - производительность queries
- **Ingestion/Query Errors** - ошибки

---

## Дополнительные ресурсы

- [Официальная документация Loki](https://grafana.com/docs/loki/latest/)
- [Loki Query Language (LogQL)](https://grafana.com/docs/loki/latest/logql/)
- [Loki Push API](https://grafana.com/docs/loki/latest/api/#push-log-entries-to-loki)
- [Loki Best Practices](https://grafana.com/docs/loki/latest/best-practices/)
- [Grafana Loki GitHub](https://github.com/grafana/loki)

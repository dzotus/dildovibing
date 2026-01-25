# ClickHouse - Документация компонента

## Обзор

ClickHouse - это колоночная OLAP (Online Analytical Processing) база данных для аналитики в реальном времени. Компонент ClickHouse в системе симуляции полностью эмулирует поведение реального ClickHouse, включая колоночное хранение данных, табличные движки (MergeTree, ReplacingMergeTree, SummingMergeTree, AggregatingMergeTree, ReplicatedMergeTree, Distributed), сжатие данных, партиционирование, репликацию через ClickHouse Keeper, кластерную архитектуру с шардированием, SQL запросы, merge операции, метрики производительности и полный набор возможностей ClickHouse.

### Основные возможности

- ✅ **Колоночное хранение** - Оптимизированное хранение данных по колонкам для аналитики
- ✅ **Table Engines** - MergeTree, ReplacingMergeTree, SummingMergeTree, AggregatingMergeTree, ReplicatedMergeTree, Distributed
- ✅ **SQL** - Полный набор SQL команд (SELECT, INSERT, CREATE, DROP, ALTER)
- ✅ **Compression** - Сжатие данных (LZ4, ZSTD, LZ4HC, None)
- ✅ **Partitioning** - Партиционирование данных по датам или другим ключам
- ✅ **Replication** - Репликация данных через ClickHouse Keeper
- ✅ **Clustering** - Кластерная архитектура с шардированием и репликацией
- ✅ **Merge Operations** - Автоматическое объединение частей данных (parts)
- ✅ **Метрики в реальном времени** - Полный набор метрик ClickHouse (throughput, latency, memory, compression, parts, merges, replication)

---

## Основные функции

### 1. Управление Connection (Подключение)

**Описание:** Настройка подключения к ClickHouse серверу.

**Параметры подключения:**
- **host** - Хост ClickHouse сервера (по умолчанию: `localhost`)
- **port** - Порт ClickHouse сервера (по умолчанию: `8123`)
- **database** - Имя базы данных (по умолчанию: `default`)
- **username** - Имя пользователя (по умолчанию: `default`)
- **password** - Пароль (опционально)

**Пример конфигурации:**
```json
{
  "host": "localhost",
  "port": 8123,
  "database": "default",
  "username": "default",
  "password": ""
}
```

### 2. Управление Cluster (Кластер)

**Описание:** Настройка кластера ClickHouse с шардированием и репликацией.

**Параметры кластера:**
- **cluster** - Имя кластера (по умолчанию: `archiphoenix-cluster`)
- **replication** - Включить ли репликацию (по умолчанию: `false`)
- **clusterNodes** - Количество узлов в кластере (по умолчанию: `1` или `3` если репликация включена)
- **shards** - Количество шардов (по умолчанию: `1`)
- **replicas** - Количество реплик на шард (по умолчанию: `1` или `3` если репликация включена)
- **keeperNodes** - Узлы ClickHouse Keeper для координации реплик (массив строк `host:port`, опционально)

**Пример конфигурации:**
```json
{
  "cluster": "my-cluster",
  "replication": true,
  "clusterNodes": 6,
  "shards": 2,
  "replicas": 3,
  "keeperNodes": [
    "localhost:2181",
    "localhost:2182",
    "localhost:2183"
  ]
}
```

### 3. Table Engines (Движки таблиц)

**Описание:** ClickHouse поддерживает различные движки таблиц для разных сценариев использования.

#### 3.1. MergeTree

**Описание:** Базовый движок для хранения данных с поддержкой партиционирования и сортировки.

**Особенности:**
- Партиционирование по дате или другому ключу
- Сортировка по ORDER BY колонкам
- Автоматическое объединение частей (merge)
- Поддержка индексов

**Пример:**
```sql
CREATE TABLE events (
  event_date Date,
  event_time DateTime,
  user_id UInt64,
  event_type String,
  value Float64
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(event_date)
ORDER BY (event_date, event_time, user_id);
```

#### 3.2. ReplacingMergeTree

**Описание:** MergeTree с автоматической заменой дубликатов при merge.

**Особенности:**
- Заменяет дубликаты по ORDER BY ключу
- Полезно для дедупликации данных

**Пример:**
```sql
CREATE TABLE users (
  user_id UInt64,
  username String,
  email String,
  updated_at DateTime
) ENGINE = ReplacingMergeTree(updated_at)
ORDER BY user_id;
```

#### 3.3. SummingMergeTree

**Описание:** MergeTree с автоматическим суммированием числовых колонок при merge.

**Особенности:**
- Суммирует указанные колонки при merge
- Полезно для агрегации метрик

**Пример:**
```sql
CREATE TABLE metrics (
  date Date,
  metric_name String,
  value UInt64
) ENGINE = SummingMergeTree()
PARTITION BY date
ORDER BY (date, metric_name);
```

#### 3.4. AggregatingMergeTree

**Описание:** MergeTree с автоматической агрегацией данных при merge.

**Особенности:**
- Использует агрегатные функции (sum, count, avg и др.)
- Полезно для предварительно агрегированных данных

**Пример:**
```sql
CREATE TABLE aggregated_metrics (
  date Date,
  metric_name String,
  value AggregateFunction(sum, UInt64)
) ENGINE = AggregatingMergeTree()
PARTITION BY date
ORDER BY (date, metric_name);
```

#### 3.5. ReplicatedMergeTree

**Описание:** MergeTree с репликацией через ClickHouse Keeper.

**Особенности:**
- Репликация данных между узлами
- Координация через ClickHouse Keeper
- Автоматическая синхронизация

**Пример:**
```sql
CREATE TABLE events (
  event_date Date,
  event_time DateTime,
  user_id UInt64
) ENGINE = ReplicatedMergeTree('/clickhouse/tables/{shard}/events', '{replica}')
PARTITION BY toYYYYMM(event_date)
ORDER BY (event_date, event_time);
```

#### 3.6. Distributed

**Описание:** Распределенная таблица для работы с кластером.

**Особенности:**
- Распределяет запросы по шардам
- Агрегирует результаты
- Прозрачная работа с кластером

**Пример:**
```sql
CREATE TABLE distributed_events AS events
ENGINE = Distributed(my-cluster, default, events, rand());
```

### 4. SQL (Structured Query Language)

**Описание:** ClickHouse поддерживает SQL для работы с данными.

#### 4.1. SELECT (Чтение данных)

**Синтаксис:**
```sql
SELECT [columns] FROM [database.]table
[WHERE condition]
[GROUP BY columns]
[ORDER BY columns [ASC|DESC]]
[LIMIT n]
[OFFSET n]
[SAMPLE coefficient]
[FINAL]
```

**Примеры:**
```sql
-- Простой SELECT
SELECT * FROM events WHERE event_date = today();

-- SELECT с агрегацией
SELECT 
  event_type,
  count() as count,
  sum(value) as total_value
FROM events
WHERE event_date >= today() - 7
GROUP BY event_type
ORDER BY count DESC;

-- SELECT с SAMPLE
SELECT * FROM events SAMPLE 0.1;

-- SELECT с FINAL (для ReplacingMergeTree)
SELECT * FROM users FINAL WHERE user_id = 123;
```

**Особенности:**
- **PREWHERE** - Фильтрация до чтения данных (оптимизация)
- **SAMPLE** - Выборка данных для быстрого анализа
- **FINAL** - Принудительное выполнение merge перед чтением
- **GROUP BY** - Агрегация данных
- **ORDER BY** - Сортировка результатов

#### 4.2. INSERT (Вставка данных)

**Синтаксис:**
```sql
INSERT INTO [database.]table [(columns)]
VALUES (values), (values), ...
[FORMAT format]
```

**Примеры:**
```sql
-- Простой INSERT
INSERT INTO events VALUES 
  ('2024-01-01', '2024-01-01 10:00:00', 123, 'click', 1.5),
  ('2024-01-01', '2024-01-01 10:01:00', 456, 'view', 2.0);

-- INSERT с указанием колонок
INSERT INTO events (event_date, event_time, user_id, event_type, value)
VALUES ('2024-01-01', '2024-01-01 10:00:00', 123, 'click', 1.5);

-- INSERT из SELECT
INSERT INTO events_daily
SELECT 
  event_date,
  event_type,
  count() as count
FROM events
GROUP BY event_date, event_type;
```

#### 4.3. CREATE TABLE (Создание таблицы)

**Синтаксис:**
```sql
CREATE TABLE [IF NOT EXISTS] [database.]table
(
  column_name type [DEFAULT value],
  ...
)
ENGINE = engine_name
[PARTITION BY expression]
[ORDER BY columns]
[PRIMARY KEY columns]
[SAMPLE BY expression]
[TTL expression]
[SETTINGS name = value, ...]
[ON CLUSTER cluster_name]
```

**Примеры:**
```sql
-- Простая таблица MergeTree
CREATE TABLE events (
  event_date Date,
  event_time DateTime,
  user_id UInt64,
  event_type String,
  value Float64
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(event_date)
ORDER BY (event_date, event_time, user_id);

-- Таблица с TTL
CREATE TABLE sessions (
  session_id String,
  user_id UInt64,
  created_at DateTime,
  expires_at DateTime
) ENGINE = MergeTree()
ORDER BY session_id
TTL expires_at;

-- Таблица на кластере
CREATE TABLE events ON CLUSTER my-cluster (
  event_date Date,
  user_id UInt64
) ENGINE = ReplicatedMergeTree('/clickhouse/tables/{shard}/events', '{replica}')
PARTITION BY toYYYYMM(event_date)
ORDER BY event_date;
```

#### 4.4. ALTER TABLE (Изменение таблицы)

**Синтаксис:**
```sql
ALTER TABLE [database.]table
[ADD COLUMN column_name type [AFTER column_name]]
[DROP COLUMN column_name]
[MODIFY COLUMN column_name type]
[COMMENT COLUMN column_name 'comment']
[ORDER BY columns]
```

**Примеры:**
```sql
-- Добавить колонку
ALTER TABLE events ADD COLUMN source String DEFAULT 'web';

-- Удалить колонку
ALTER TABLE events DROP COLUMN old_column;

-- Изменить тип колонки
ALTER TABLE events MODIFY COLUMN value Decimal(10, 2);
```

#### 4.5. DROP TABLE (Удаление таблицы)

**Синтаксис:**
```sql
DROP TABLE [IF EXISTS] [database.]table [ON CLUSTER cluster_name]
```

**Пример:**
```sql
DROP TABLE IF EXISTS old_events;
DROP TABLE events ON CLUSTER my-cluster;
```

### 5. Compression (Сжатие данных)

**Описание:** ClickHouse сжимает данные для экономии места на диске.

**Типы сжатия:**
- **LZ4** - Быстрое сжатие, хороший баланс (по умолчанию)
- **ZSTD** - Высокое сжатие, медленнее чем LZ4
- **LZ4HC** - Высокое сжатие LZ4, медленнее чем LZ4
- **None** - Без сжатия

**Параметры:**
- **compression** - Тип сжатия (по умолчанию: `LZ4`)

**Метрики:**
- **compressionRatio** - Коэффициент сжатия (отношение несжатого размера к сжатому)

**Пример конфигурации:**
```json
{
  "compression": "LZ4"
}
```

### 6. Partitioning (Партиционирование)

**Описание:** Партиционирование разделяет данные на части для оптимизации запросов.

**Преимущества:**
- Быстрый доступ к данным по партициям
- Эффективное удаление старых данных
- Параллельная обработка партиций

**Пример:**
```sql
CREATE TABLE events (
  event_date Date,
  event_time DateTime,
  user_id UInt64
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(event_date)  -- Партиция по году и месяцу
ORDER BY (event_date, event_time);
```

### 7. Replication (Репликация)

**Описание:** Репликация обеспечивает высокую доступность и отказоустойчивость.

**Как работает:**
- Данные реплицируются между узлами через ClickHouse Keeper
- Keeper координирует операции (INSERT, MERGE, MUTATION)
- Автоматическая синхронизация реплик

**Параметры:**
- **replication** - Включить ли репликацию (по умолчанию: `false`)
- **replicas** - Количество реплик на шард (по умолчанию: `1` или `3` если репликация включена)
- **keeperNodes** - Узлы ClickHouse Keeper (массив строк `host:port`)

**Пример конфигурации:**
```json
{
  "replication": true,
  "replicas": 3,
  "keeperNodes": [
    "localhost:2181",
    "localhost:2182",
    "localhost:2183"
  ]
}
```

### 8. ClickHouse Keeper

**Описание:** ClickHouse Keeper - это координатор для репликации (аналог ZooKeeper).

**Функции:**
- Координация операций INSERT, MERGE, MUTATION
- Синхронизация реплик
- Хранение метаданных

**Параметры:**
- **keeperNodes** - Узлы Keeper (массив строк `host:port`)
- **keeperBaseLatency** - Базовая задержка Keeper в ms (по умолчанию: `10ms`)
- **keeperOperationLatencies** - Задержки операций Keeper (INSERT, MERGE, MUTATION, REPLICATE)

**Метрики:**
- **ReplicatedFetches** - Количество fetch операций с реплик
- **ReplicatedSends** - Количество send операций на реплики
- **ReplicatedChecks** - Количество проверок консистентности
- **ReplicatedDataLoss** - События потери данных (должно быть 0)

### 9. Merge Operations (Операции объединения)

**Описание:** ClickHouse автоматически объединяет части данных (parts) для оптимизации.

**Как работает:**
- При INSERT создаются новые parts
- Background процесс периодически объединяет parts
- Merge уменьшает количество parts и оптимизирует чтение

**Стратегии merge:**
- **SizeTiered** - Объединение parts похожего размера
- **Leveled** - Многоуровневое объединение

**Метрики:**
- **partsCount** - Количество частей данных
- **pendingMerges** - Количество ожидающих merge операций
- **MergedRows** - Количество объединенных строк
- **MergedUncompressedBytes** - Размер объединенных данных (несжатый)
- **MergedCompressedBytes** - Размер объединенных данных (сжатый)

### 10. Memory Management (Управление памятью)

**Описание:** ClickHouse управляет использованием памяти для оптимизации производительности.

**Параметры:**
- **maxMemoryUsage** - Максимальное использование памяти в bytes (по умолчанию: `10GB`)

**Метрики:**
- **memoryUsage** - Текущее использование памяти (bytes)
- **memoryUsagePercent** - Процент использования памяти (0-100)
- **MemoryTracking** - Основное использование памяти
- **MemoryTrackingInBackgroundProcessingPool** - Память в background процессах
- **MemoryTrackingInMerges** - Память в merge операциях
- **MemoryTrackingInQueries** - Память в запросах

---

## Руководство пользователя

### Быстрый старт

1. **Добавление компонента ClickHouse:**
   - Перетащите компонент "ClickHouse" из библиотеки компонентов на canvas
   - Откройте панель конфигурации компонента

2. **Настройка подключения:**
   - Перейдите на вкладку **"Configuration"**
   - Укажите host, port, database, username, password

3. **Настройка кластера:**
   - Укажите cluster name
   - Включите replication при необходимости
   - Настройте shards и replicas

4. **Создание таблицы:**
   - Перейдите на вкладку **"Tables"**
   - Нажмите кнопку **"Add Table"**
   - Укажите имя, engine, колонки
   - Нажмите **"Save"**

5. **Выполнение SQL запросов:**
   - Перейдите на вкладку **"SQL"**
   - Введите SQL запрос
   - Нажмите **"Execute"** или Ctrl+Enter

### Работа с Tables

#### Создание таблицы

1. Перейдите на вкладку **"Tables"**
2. Нажмите кнопку **"Add Table"**
3. Заполните параметры:
   - **Name** - Имя таблицы
   - **Engine** - Движок таблицы (MergeTree, ReplacingMergeTree и др.)
   - **Columns** - Добавьте колонки (имя и тип)
4. Нажмите **"Save"**

**Или через SQL:**
```sql
CREATE TABLE events (
  event_date Date,
  event_time DateTime,
  user_id UInt64,
  event_type String,
  value Float64
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(event_date)
ORDER BY (event_date, event_time);
```

#### Редактирование таблицы

1. Выберите таблицу из списка
2. Нажмите кнопку **"Edit"** (иконка карандаша)
3. Измените параметры
4. Нажмите **"Save"**

#### Удаление таблицы

1. Выберите таблицу из списка
2. Нажмите кнопку **"Delete"** (иконка корзины)
3. Подтвердите удаление

**Или через SQL:**
```sql
DROP TABLE events;
```

### Работа с SQL

#### Выполнение запросов

1. Перейдите на вкладку **"SQL"**
2. Введите SQL запрос:
   ```sql
   SELECT * FROM events WHERE event_date = today();
   ```
3. Нажмите **"Execute"** или Ctrl+Enter
4. Результат отобразится ниже

#### Примеры запросов

**SELECT:**
```sql
-- Простой SELECT
SELECT * FROM events LIMIT 100;

-- SELECT с агрегацией
SELECT 
  event_type,
  count() as count,
  sum(value) as total
FROM events
WHERE event_date >= today() - 7
GROUP BY event_type
ORDER BY count DESC;

-- SELECT с SAMPLE
SELECT * FROM events SAMPLE 0.1;
```

**INSERT:**
```sql
INSERT INTO events VALUES 
  ('2024-01-01', '2024-01-01 10:00:00', 123, 'click', 1.5),
  ('2024-01-01', '2024-01-01 10:01:00', 456, 'view', 2.0);
```

**CREATE TABLE:**
```sql
CREATE TABLE events (
  event_date Date,
  event_time DateTime,
  user_id UInt64,
  event_type String,
  value Float64
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(event_date)
ORDER BY (event_date, event_time);
```

---

## Руководство администратора

### Рекомендации по конфигурации

#### Production ClickHouse

```json
{
  "host": "clickhouse.production.internal",
  "port": 8123,
  "database": "analytics",
  "username": "analytics_user",
  "password": "***",
  "cluster": "production-cluster",
  "replication": true,
  "clusterNodes": 6,
  "shards": 2,
  "replicas": 3,
  "keeperNodes": [
    "keeper1.internal:2181",
    "keeper2.internal:2181",
    "keeper3.internal:2181"
  ],
  "maxMemoryUsage": 100000000000,
  "compression": "LZ4"
}
```

**Рекомендации:**
- Используйте репликацию для production (минимум 2 реплики)
- Настройте ClickHouse Keeper для координации реплик
- Используйте партиционирование для больших таблиц
- Выберите подходящий table engine для вашего сценария
- Мониторьте метрики памяти, compression, merge операций

### Оптимизация производительности

**Table Engines:**
- Используйте **MergeTree** для общих случаев
- Используйте **ReplacingMergeTree** для дедупликации
- Используйте **SummingMergeTree** для агрегации метрик
- Используйте **AggregatingMergeTree** для предварительно агрегированных данных
- Используйте **ReplicatedMergeTree** для репликации
- Используйте **Distributed** для работы с кластером

**Partitioning:**
- Партиционируйте по дате для time-series данных
- Используйте разумный размер партиций (не слишком мелкие, не слишком крупные)
- Удаляйте старые партиции для освобождения места

**Compression:**
- Используйте **LZ4** для баланса между скоростью и сжатием
- Используйте **ZSTD** для максимального сжатия
- Мониторьте compression ratio

**Memory:**
- Установите `maxMemoryUsage` в зависимости от доступной памяти
- Мониторьте `memoryUsagePercent` (должно быть < 80%)
- Оптимизируйте запросы для уменьшения использования памяти

**Merge Operations:**
- Мониторьте `pendingMerges` (должно быть < 100)
- Оптимизируйте размер parts для эффективного merge
- Используйте подходящую стратегию merge

### Безопасность

#### Управление доступом

- Используйте сильные пароли
- Не храните пароли в открытом виде в конфигурации
- Используйте переменные окружения для паролей
- Ограничьте доступ к ClickHouse только необходимым приложениям
- Используйте firewall для ограничения доступа по сети

#### Защита данных

- Используйте репликацию для защиты от потери данных
- Регулярно делайте backup (snapshots)
- Мониторьте ReplicatedDataLoss (должно быть 0)
- Используйте TTL для автоматического удаления старых данных

### Мониторинг и алертинг

#### Ключевые метрики

1. **Query Throughput / Queries Per Second**
   - Нормальное значение: зависит от нагрузки
   - Алерт: резкое падение или превышение порога

2. **Average Query Time**
   - Нормальное значение: < 100ms для большинства запросов
   - Алерт: average query time > 500ms

3. **Memory Usage Percent**
   - Нормальное значение: < 80%
   - Алерт: memory usage > 90% (риск OOM)

4. **Pending Merges**
   - Нормальное значение: < 100
   - Алерт: pending merges > 1000 (недостаточно ресурсов для merge)

5. **Parts Count**
   - Нормальное значение: зависит от размера таблиц
   - Алерт: parts count > 10000 (слишком много частей, нужен merge)

6. **Compression Ratio**
   - Нормальное значение: > 2.0 для LZ4
   - Алерт: compression ratio < 1.5 (неэффективное сжатие)

7. **ReplicatedDataLoss**
   - Нормальное значение: 0
   - Алерт: ReplicatedDataLoss > 0 (потеря данных при репликации)

8. **Read/Write Rows Per Second**
   - Нормальное значение: зависит от нагрузки
   - Алерт: резкое падение или превышение порога

---

## Метрики и мониторинг

### Основные метрики

#### Throughput
- **Описание:** Количество запросов в секунду
- **Единица измерения:** queries/sec
- **Типы:** Query Throughput, Queries Per Second
- **Источник:** Рассчитывается из истории запросов за последнюю секунду

#### Latency
- **Описание:** Задержка выполнения запросов
- **Единица измерения:** миллисекунды (ms)
- **Типы:** Average Query Time
- **Факторы влияния:**
  - Размер данных
  - Количество parts
  - Compression ratio
  - Network latency (для кластера)
  - Memory pressure

#### Memory Usage
- **Описание:** Использование памяти
- **Единица измерения:** bytes, процент от maxMemoryUsage
- **Типы:** Memory Usage, Memory Usage Percent
- **Факторы влияния:**
  - Размер данных
  - Количество активных запросов
  - Merge операции
  - Compression

### Метрики Queries

- **queryThroughput** - Пропускная способность запросов (queries/sec)
- **queriesPerSecond** - Запросов в секунду
- **avgQueryTime** - Среднее время выполнения запроса (ms)
- **activeQueries** - Количество активных запросов
- **slow_query_count** - Количество медленных запросов (> 1s)
- **failed_queries** - Количество неуспешных запросов

### Метрики Data

- **totalRows** - Общее количество строк
- **totalSize** - Общий размер данных (bytes)
- **totalTables** - Количество таблиц
- **readRowsPerSecond** - Строк прочитано в секунду
- **writtenRowsPerSecond** - Строк записано в секунду

### Метрики Compression

- **compressionRatio** - Коэффициент сжатия (отношение несжатого размера к сжатому)
- **CompressedReadBufferBytes** - Размер прочитанных данных (сжатый, bytes)
- **UncompressedReadBufferBytes** - Размер прочитанных данных (несжатый, bytes)
- **CompressedWriteBufferBytes** - Размер записанных данных (сжатый, bytes)
- **UncompressedWriteBufferBytes** - Размер записанных данных (несжатый, bytes)

### Метрики Parts

- **partsCount** - Количество частей данных (parts)
- **PartsActive** - Активные parts
- **PartsCommitted** - Зафиксированные parts
- **PartsOutdated** - Устаревшие parts (к удалению)
- **PartsDeleting** - Parts в процессе удаления

### Метрики Merge

- **pendingMerges** - Количество ожидающих merge операций
- **BackgroundMerges** - Количество background merge операций
- **BackgroundMergesAndMutationsPoolTask** - Задач в merge pool
- **MergedRows** - Количество объединенных строк
- **MergedUncompressedBytes** - Размер объединенных данных (несжатый, bytes)
- **MergedCompressedBytes** - Размер объединенных данных (сжатый, bytes)

### Метрики Replication

- **ReplicatedFetches** - Количество fetch операций с реплик
- **ReplicatedSends** - Количество send операций на реплики
- **ReplicatedChecks** - Количество проверок консистентности
- **ReplicatedDataLoss** - События потери данных (должно быть 0)

### Метрики Cluster

- **clusterNodes** - Количество узлов в кластере
- **healthyNodes** - Количество доступных узлов

### Метрики Memory

- **memoryUsage** - Используемая память (bytes)
- **memoryUsagePercent** - Процент использования памяти (0-100)
- **MemoryTracking** - Основное использование памяти (bytes)
- **MemoryTrackingInBackgroundProcessingPool** - Память в background процессах (bytes)
- **MemoryTrackingInMerges** - Память в merge операциях (bytes)
- **MemoryTrackingInQueries** - Память в запросах (bytes)

### Метрики Network

- **NetworkReceiveBytes** - Размер полученных данных (bytes)
- **NetworkSendBytes** - Размер отправленных данных (bytes)
- **NetworkReceiveElapsedMicroseconds** - Время получения (microseconds)
- **NetworkSendElapsedMicroseconds** - Время отправки (microseconds)

### Метрики Disk

- **DiskReadBytes** - Размер прочитанных данных с диска (bytes)
- **DiskWriteBytes** - Размер записанных данных на диск (bytes)
- **DiskReadElapsedMicroseconds** - Время чтения с диска (microseconds)
- **DiskWriteElapsedMicroseconds** - Время записи на диск (microseconds)

### Метрики Query Types

- **SelectQuery** - Количество SELECT запросов
- **InsertQuery** - Количество INSERT запросов
- **AlterQuery** - Количество ALTER запросов
- **CreateQuery** - Количество CREATE запросов
- **DropQuery** - Количество DROP запросов

### Мониторинг в реальном времени

Все метрики обновляются в реальном времени во время симуляции:
- Метрики синхронизируются из `ClickHouseRoutingEngine` каждые 500ms
- Метрики отображаются в UI компоненте
- История запросов хранится для расчета метрик
- Merge операции отслеживаются в реальном времени

---

## Примеры использования

### Пример 1: Простая таблица для аналитики

**Сценарий:** Таблица событий для аналитики

```sql
CREATE TABLE events (
  event_date Date,
  event_time DateTime,
  user_id UInt64,
  event_type String,
  value Float64
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(event_date)
ORDER BY (event_date, event_time, user_id);
```

**Вставка данных:**
```sql
INSERT INTO events VALUES 
  ('2024-01-01', '2024-01-01 10:00:00', 123, 'click', 1.5),
  ('2024-01-01', '2024-01-01 10:01:00', 456, 'view', 2.0);
```

**Запросы:**
```sql
-- Агрегация по типу события
SELECT 
  event_type,
  count() as count,
  sum(value) as total_value
FROM events
WHERE event_date >= today() - 7
GROUP BY event_type
ORDER BY count DESC;
```

### Пример 2: Replicated таблица

**Сценарий:** Реплицированная таблица для высокой доступности

```sql
CREATE TABLE events (
  event_date Date,
  event_time DateTime,
  user_id UInt64
) ENGINE = ReplicatedMergeTree('/clickhouse/tables/{shard}/events', '{replica}')
PARTITION BY toYYYYMM(event_date)
ORDER BY (event_date, event_time);
```

**Конфигурация:**
```json
{
  "replication": true,
  "replicas": 3,
  "keeperNodes": [
    "localhost:2181",
    "localhost:2182",
    "localhost:2183"
  ]
}
```

### Пример 3: Distributed таблица

**Сценарий:** Распределенная таблица для кластера

```sql
-- Локальная таблица на каждом шарде
CREATE TABLE events_local (
  event_date Date,
  user_id UInt64,
  value Float64
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(event_date)
ORDER BY event_date;

-- Distributed таблица
CREATE TABLE events AS events_local
ENGINE = Distributed(my-cluster, default, events_local, rand());
```

**Конфигурация:**
```json
{
  "cluster": "my-cluster",
  "shards": 2,
  "replicas": 3
}
```

### Пример 4: ReplacingMergeTree для дедупликации

**Сценарий:** Таблица пользователей с дедупликацией

```sql
CREATE TABLE users (
  user_id UInt64,
  username String,
  email String,
  updated_at DateTime
) ENGINE = ReplacingMergeTree(updated_at)
ORDER BY user_id;
```

**Использование:**
```sql
-- Вставка дубликатов
INSERT INTO users VALUES (123, 'john', 'john@example.com', '2024-01-01 10:00:00');
INSERT INTO users VALUES (123, 'john_doe', 'john@example.com', '2024-01-01 11:00:00');

-- При merge останется последняя версия (с максимальным updated_at)
SELECT * FROM users FINAL WHERE user_id = 123;
```

### Пример 5: Production конфигурация

**Сценарий:** Production кластер с репликацией

```json
{
  "host": "clickhouse.production.internal",
  "port": 8123,
  "database": "analytics",
  "username": "analytics_user",
  "password": "***",
  "cluster": "production-cluster",
  "replication": true,
  "clusterNodes": 6,
  "shards": 2,
  "replicas": 3,
  "keeperNodes": [
    "keeper1.internal:2181",
    "keeper2.internal:2181",
    "keeper3.internal:2181"
  ],
  "maxMemoryUsage": 100000000000,
  "compression": "LZ4"
}
```

---

## Часто задаваемые вопросы (FAQ)

### Что такое ClickHouse?

ClickHouse - это колоночная OLAP (Online Analytical Processing) база данных для аналитики в реальном времени. ClickHouse оптимизирован для быстрого чтения больших объемов данных и агрегации.

### В чем разница между ClickHouse и традиционными базами данных?

- **Модель данных:** ClickHouse использует колоночное хранение, традиционные БД - строчное
- **Оптимизация:** ClickHouse оптимизирован для чтения и агрегации, традиционные БД - для транзакций
- **Масштабирование:** ClickHouse масштабируется горизонтально (кластер), традиционные БД - вертикально
- **Использование:** ClickHouse для аналитики, традиционные БД - для OLTP

### Что такое колоночное хранение?

Колоночное хранение означает, что данные хранятся по колонкам, а не по строкам. Это позволяет:
- Читать только нужные колонки
- Эффективно сжимать данные
- Быстро выполнять агрегацию

### Что такое table engine?

Table engine определяет, как данные хранятся и обрабатываются:
- **MergeTree** - Базовый движок для хранения
- **ReplacingMergeTree** - С автоматической заменой дубликатов
- **SummingMergeTree** - С автоматическим суммированием
- **AggregatingMergeTree** - С автоматической агрегацией
- **ReplicatedMergeTree** - С репликацией
- **Distributed** - Для работы с кластером

### Как работает репликация в ClickHouse?

Репликация в ClickHouse работает через ClickHouse Keeper:
- Keeper координирует операции (INSERT, MERGE, MUTATION)
- Данные реплицируются между узлами
- Автоматическая синхронизация реплик

### Что такое merge операции?

Merge операции объединяют части данных (parts) для оптимизации:
- При INSERT создаются новые parts
- Background процесс периодически объединяет parts
- Merge уменьшает количество parts и оптимизирует чтение

### Как работает партиционирование?

Партиционирование разделяет данные на части:
- Партиции определяются выражением (например, по дате)
- Запросы с фильтром по партиции работают быстрее
- Старые партиции можно удалять для освобождения места

### Как мониторить производительность ClickHouse?

Используйте метрики в реальном времени:
- Query Throughput, Average Query Time
- Memory Usage, Compression Ratio
- Parts Count, Pending Merges
- Replication Metrics, Network/Disk I/O

### Как оптимизировать ClickHouse?

1. Используйте подходящий table engine
2. Партиционируйте большие таблицы
3. Используйте репликацию для высокой доступности
4. Мониторьте метрики и устраняйте проблемы
5. Оптимизируйте запросы (используйте PREWHERE, SAMPLE)
6. Настройте compression для экономии места

---

## Дополнительные ресурсы

- [Официальная документация ClickHouse](https://clickhouse.com/docs/)
- [ClickHouse SQL Reference](https://clickhouse.com/docs/en/sql-reference/)
- [ClickHouse Best Practices](https://clickhouse.com/docs/en/guides/best-practices/)
- [ClickHouse Performance Tuning](https://clickhouse.com/docs/en/operations/performance/)

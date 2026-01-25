# Apache Cassandra - Документация компонента

## Обзор

Apache Cassandra - это распределенная NoSQL база данных, предназначенная для обработки больших объемов данных на множестве серверов с высокой доступностью и линейной масштабируемостью. Компонент Cassandra в системе симуляции полностью эмулирует поведение реального Apache Cassandra, включая кластерную топологию, keyspaces, таблицы, CQL (Cassandra Query Language), consistency levels, replication strategies, token ring с vnodes, gossip протокол, hinted handoff, read repair, compaction strategies, TTL (Time To Live), lightweight transactions, batch operations и полный набор метрик производительности.

### Основные возможности

- ✅ **Кластерная топология** - Управление узлами кластера с datacenter/rack организацией
- ✅ **Keyspaces** - Логические пространства имен для группировки таблиц
- ✅ **Tables** - Таблицы с колонками и primary key (partition key + clustering columns)
- ✅ **CQL (Cassandra Query Language)** - Полный набор CQL команд (SELECT, INSERT, UPDATE, DELETE, CREATE, DROP)
- ✅ **Consistency Levels** - 10 уровней консистентности (ONE, QUORUM, ALL, LOCAL_QUORUM и др.)
- ✅ **Replication Strategies** - SimpleStrategy и NetworkTopologyStrategy
- ✅ **Token Ring** - Распределение данных по token ring с Murmur3Partitioner и vnodes
- ✅ **Gossip Protocol** - Симуляция gossip протокола для обмена информацией о кластере
- ✅ **Hinted Handoff** - Сохранение и доставка записей для недоступных узлов
- ✅ **Read Repair** - Автоматическое исправление рассинхронизации реплик
- ✅ **Compaction Strategies** - SizeTiered, Leveled, TimeWindow compaction strategies
- ✅ **TTL (Time To Live)** - Автоматическое удаление записей с истекшим временем жизни
- ✅ **Lightweight Transactions** - IF EXISTS, IF NOT EXISTS условия
- ✅ **Batch Operations** - Выполнение множественных операций в одной транзакции
- ✅ **Метрики в реальном времени** - Полный набор метрик Cassandra (latency, operations, consistency violations, compaction, hinted handoffs)

---

## Основные функции

### 1. Управление Cluster (Кластер)

**Описание:** Настройка кластера Cassandra с узлами, datacenter и rack организацией.

**Параметры кластера:**
- **clusterName** - Имя кластера (по умолчанию: `archiphoenix-cluster`)
- **nodes** - Список узлов кластера (массив)
- **datacenter** - Имя datacenter (по умолчанию: `dc1`)

**Параметры Node:**
- **address** - Адрес узла в формате `host:port` (обязательно, например: `localhost:9042`)
- **status** - Статус узла: `up` или `down` (по умолчанию: `up`)
- **load** - Загрузка узла (0-1, по умолчанию: `0.5`)
- **tokens** - Количество токенов (vnodes, по умолчанию: `256`)
- **datacenter** - Datacenter узла (по умолчанию: `dc1`)
- **rack** - Rack узла (по умолчанию: `rack1`)

**Пример конфигурации:**
```json
{
  "clusterName": "my-cluster",
  "datacenter": "dc1",
  "nodes": [
    {
      "address": "localhost:9042",
      "status": "up",
      "load": 0.5,
      "tokens": 256,
      "datacenter": "dc1",
      "rack": "rack1"
    },
    {
      "address": "localhost:9043",
      "status": "up",
      "load": 0.3,
      "tokens": 256,
      "datacenter": "dc1",
      "rack": "rack2"
    }
  ]
}
```

### 2. Управление Keyspaces (Пространства имен)

**Описание:** Keyspace - это логическое пространство имен для группировки таблиц.

**Параметры Keyspace:**
- **name** - Имя keyspace (обязательно, уникальное)
- **replication** - Replication factor (по умолчанию: `3`)
- **replicationStrategy** - Стратегия репликации: `SimpleStrategy` или `NetworkTopologyStrategy` (по умолчанию: `NetworkTopologyStrategy`)
- **datacenterReplication** - Replication factor по datacenter для NetworkTopologyStrategy (опционально, объект: `{ "dc1": 3, "dc2": 2 }`)
- **durableWrites** - Включить ли durable writes (по умолчанию: `true`)

**Пример конфигурации:**
```json
{
  "keyspaces": [
    {
      "name": "my_keyspace",
      "replication": 3,
      "replicationStrategy": "NetworkTopologyStrategy",
      "datacenterReplication": {
        "dc1": 3,
        "dc2": 2
      },
      "durableWrites": true
    }
  ]
}
```

### 3. Управление Tables (Таблицы)

**Описание:** Таблицы хранят данные в Cassandra. Каждая таблица имеет primary key, состоящий из partition key и опциональных clustering columns.

**Параметры Table:**
- **name** - Имя таблицы (обязательно, уникальное в рамках keyspace)
- **keyspace** - Имя keyspace (обязательно)
- **columns** - Список колонок (массив)
- **rows** - Количество строк (обновляется автоматически)
- **size** - Размер таблицы в bytes (обновляется автоматически)

**Параметры Column:**
- **name** - Имя колонки (обязательно)
- **type** - Тип данных (например, `TEXT`, `INT`, `UUID`, `TIMESTAMP`, `BOOLEAN`)
- **primaryKey** - Является ли частью primary key (по умолчанию: `false`)

**Пример конфигурации:**
```json
{
  "tables": [
    {
      "name": "users",
      "keyspace": "my_keyspace",
      "columns": [
        { "name": "user_id", "type": "UUID", "primaryKey": true },
        { "name": "username", "type": "TEXT", "primaryKey": false },
        { "name": "email", "type": "TEXT", "primaryKey": false },
        { "name": "created_at", "type": "TIMESTAMP", "primaryKey": false }
      ]
    }
  ]
}
```

### 4. CQL (Cassandra Query Language)

**Описание:** CQL - язык запросов для работы с Cassandra, похожий на SQL.

#### 4.1. SELECT (Чтение данных)

**Синтаксис:**
```cql
SELECT [columns] FROM keyspace.table
WHERE [conditions]
[ORDER BY column [ASC|DESC]]
[LIMIT n]
```

**Примеры:**
```cql
-- Простой SELECT
SELECT * FROM my_keyspace.users WHERE user_id = 123e4567-e89b-12d3-a456-426614174000;

-- SELECT с условиями
SELECT username, email FROM my_keyspace.users 
WHERE user_id = 123e4567-e89b-12d3-a456-426614174000 
AND username = 'john_doe';

-- SELECT с ORDER BY
SELECT * FROM my_keyspace.users 
WHERE user_id = 123e4567-e89b-12d3-a456-426614174000 
ORDER BY created_at DESC;

-- SELECT с агрегатными функциями
SELECT COUNT(*) FROM my_keyspace.users;
SELECT AVG(age) FROM my_keyspace.users GROUP BY city;
```

**Поддерживаемые операторы WHERE:**
- `=` - Равно
- `!=`, `<>` - Не равно
- `>`, `<`, `>=`, `<=` - Сравнение
- `IN` - В списке значений
- `LIKE` - Поиск по шаблону
- `CONTAINS`, `CONTAINS_KEY` - Для коллекций

#### 4.2. INSERT (Вставка данных)

**Синтаксис:**
```cql
INSERT INTO keyspace.table (columns) VALUES (values)
[USING TTL seconds]
[IF NOT EXISTS]
```

**Примеры:**
```cql
-- Простой INSERT
INSERT INTO my_keyspace.users (user_id, username, email) 
VALUES (123e4567-e89b-12d3-a456-426614174000, 'john_doe', 'john@example.com');

-- INSERT с TTL
INSERT INTO my_keyspace.users (user_id, username, email) 
VALUES (123e4567-e89b-12d3-a456-426614174000, 'john_doe', 'john@example.com')
USING TTL 3600;

-- INSERT с IF NOT EXISTS (lightweight transaction)
INSERT INTO my_keyspace.users (user_id, username, email) 
VALUES (123e4567-e89b-12d3-a456-426614174000, 'john_doe', 'john@example.com')
IF NOT EXISTS;
```

#### 4.3. UPDATE (Обновление данных)

**Синтаксис:**
```cql
UPDATE keyspace.table
SET column = value [, column = value ...]
WHERE [conditions]
[USING TTL seconds]
[IF EXISTS]
```

**Примеры:**
```cql
-- Простой UPDATE
UPDATE my_keyspace.users 
SET email = 'newemail@example.com' 
WHERE user_id = 123e4567-e89b-12d3-a456-426614174000;

-- UPDATE с TTL
UPDATE my_keyspace.users 
SET email = 'newemail@example.com' 
WHERE user_id = 123e4567-e89b-12d3-a456-426614174000
USING TTL 3600;

-- UPDATE с IF EXISTS (lightweight transaction)
UPDATE my_keyspace.users 
SET email = 'newemail@example.com' 
WHERE user_id = 123e4567-e89b-12d3-a456-426614174000
IF EXISTS;
```

#### 4.4. DELETE (Удаление данных)

**Синтаксис:**
```cql
DELETE [columns] FROM keyspace.table
WHERE [conditions]
```

**Примеры:**
```cql
-- Удаление строки
DELETE FROM my_keyspace.users 
WHERE user_id = 123e4567-e89b-12d3-a456-426614174000;

-- Удаление колонки
DELETE email FROM my_keyspace.users 
WHERE user_id = 123e4567-e89b-12d3-a456-426614174000;
```

#### 4.5. CREATE KEYSPACE (Создание keyspace)

**Синтаксис:**
```cql
CREATE KEYSPACE keyspace_name
WITH REPLICATION = {
  'class': 'SimpleStrategy' | 'NetworkTopologyStrategy',
  'replication_factor': n
  -- или для NetworkTopologyStrategy:
  -- 'dc1': n, 'dc2': m
}
[AND DURABLE_WRITES = true | false];
```

**Примеры:**
```cql
-- SimpleStrategy
CREATE KEYSPACE my_keyspace
WITH REPLICATION = {
  'class': 'SimpleStrategy',
  'replication_factor': 3
};

-- NetworkTopologyStrategy
CREATE KEYSPACE my_keyspace
WITH REPLICATION = {
  'class': 'NetworkTopologyStrategy',
  'dc1': 3,
  'dc2': 2
}
AND DURABLE_WRITES = true;
```

#### 4.6. CREATE TABLE (Создание таблицы)

**Синтаксис:**
```cql
CREATE TABLE keyspace.table (
  column_name type [PRIMARY KEY],
  ...
  PRIMARY KEY (partition_key [, clustering_column ...])
);
```

**Примеры:**
```cql
-- Простая таблица
CREATE TABLE my_keyspace.users (
  user_id UUID PRIMARY KEY,
  username TEXT,
  email TEXT,
  created_at TIMESTAMP
);

-- Таблица с clustering columns
CREATE TABLE my_keyspace.user_posts (
  user_id UUID,
  post_id UUID,
  title TEXT,
  content TEXT,
  created_at TIMESTAMP,
  PRIMARY KEY (user_id, post_id)
);
```

#### 4.7. BATCH (Пакетные операции)

**Синтаксис:**
```cql
BEGIN BATCH
  [USING CONSISTENCY level]
  INSERT ...;
  UPDATE ...;
  DELETE ...;
APPLY BATCH;
```

**Пример:**
```cql
BEGIN BATCH
  USING CONSISTENCY QUORUM
  INSERT INTO my_keyspace.users (user_id, username) VALUES (uuid(), 'user1');
  INSERT INTO my_keyspace.users (user_id, username) VALUES (uuid(), 'user2');
  UPDATE my_keyspace.users SET email = 'new@example.com' WHERE user_id = uuid();
APPLY BATCH;
```

### 5. Consistency Levels (Уровни консистентности)

**Описание:** Consistency level определяет, сколько реплик должно подтвердить операцию перед возвратом результата.

**Уровни консистентности:**
- **ONE** - Требуется подтверждение от одной реплики (самый быстрый, наименьшая консистентность)
- **TWO** - Требуется подтверждение от двух реплик
- **THREE** - Требуется подтверждение от трех реплик
- **QUORUM** - Требуется подтверждение от большинства реплик (replication_factor / 2 + 1)
- **ALL** - Требуется подтверждение от всех реплик (самый медленный, максимальная консистентность)
- **LOCAL_ONE** - Требуется подтверждение от одной реплики в локальном datacenter
- **LOCAL_QUORUM** - Требуется подтверждение от большинства реплик в локальном datacenter
- **EACH_QUORUM** - Требуется QUORUM в каждом datacenter
- **SERIAL** - Для lightweight transactions
- **LOCAL_SERIAL** - Для lightweight transactions в локальном datacenter

**Параметры:**
- **defaultConsistencyLevel** - Уровень консистентности по умолчанию (по умолчанию: `QUORUM`)

**Пример конфигурации:**
```json
{
  "defaultConsistencyLevel": "QUORUM"
}
```

### 6. Replication Strategies (Стратегии репликации)

**Описание:** Стратегия репликации определяет, как данные распределяются по узлам кластера.

#### 6.1. SimpleStrategy

**Описание:** Простая стратегия для single-datacenter кластеров. Реплики размещаются последовательно по token ring.

**Параметры:**
- **replication_factor** - Количество реплик

**Пример:**
```json
{
  "replicationStrategy": "SimpleStrategy",
  "replication": 3
}
```

#### 6.2. NetworkTopologyStrategy

**Описание:** Стратегия для multi-datacenter кластеров. Реплики размещаются в разных datacenter и rack для высокой доступности.

**Параметры:**
- **datacenterReplication** - Replication factor по datacenter (объект: `{ "dc1": 3, "dc2": 2 }`)

**Пример:**
```json
{
  "replicationStrategy": "NetworkTopologyStrategy",
  "datacenterReplication": {
    "dc1": 3,
    "dc2": 2
  }
}
```

### 7. Token Ring и Vnodes

**Описание:** Token ring распределяет данные по узлам кластера. Каждый узел отвечает за определенный диапазон токенов.

**Как работает:**
- Partition key хэшируется через Murmur3Partitioner для получения токена
- Токен определяет, на каком узле хранится primary replica
- Replication strategy определяет, на каких узлах хранятся остальные реплики
- Vnodes (virtual nodes) позволяют каждому узлу иметь несколько токенов для более равномерного распределения

**Параметры:**
- **tokens** - Количество токенов (vnodes) на узел (по умолчанию: `256`)

### 8. Gossip Protocol

**Описание:** Gossip протокол используется для обмена информацией о состоянии кластера между узлами.

**Как работает:**
- Узлы периодически обмениваются информацией о статусе, загрузке, токенах
- Gossip позволяет определить недоступные узлы (heartbeat timeout)
- Информация распространяется по всему кластеру

**Метрики:**
- **healthyNodes** - Количество доступных узлов
- **totalNodes** - Общее количество узлов

### 9. Hinted Handoff

**Описание:** Hinted handoff сохраняет записи для недоступных узлов и доставляет их, когда узел возвращается.

**Как работает:**
- При записи, если реплика недоступна, запись сохраняется как hint
- Hint имеет TTL (по умолчанию 3 часа)
- Когда узел возвращается, hints доставляются автоматически
- Expired hints удаляются

**Метрики:**
- **hintedHandoffs** - Количество активных hints

### 10. Read Repair

**Описание:** Read repair автоматически исправляет рассинхронизацию реплик при чтении.

**Как работает:**
- При чтении с QUORUM или выше, данные читаются с нескольких реплик
- Версии данных сравниваются
- Если обнаружена рассинхронизация, автоматически выполняется repair
- Обновляются метрики consistency violations

**Метрики:**
- **readConsistencyViolations** - Количество обнаруженных violations при чтении
- **writeConsistencyViolations** - Количество violations при записи

### 11. Compaction Strategies (Стратегии компактификации)

**Описание:** Compaction объединяет SSTables для оптимизации чтения и освобождения места.

**Стратегии:**
- **SizeTieredCompactionStrategy** - Объединяет SSTables похожего размера (по умолчанию)
- **LeveledCompactionStrategy** - Многоуровневая компактификация для равномерного распределения данных
- **TimeWindowCompactionStrategy** - Компактификация по временным окнам для time-series данных

**Параметры:**
- **enableCompaction** - Включить ли compaction (по умолчанию: `true`)
- **compactionStrategy** - Стратегия compaction (по умолчанию: `SizeTieredCompactionStrategy`)

**Метрики:**
- **pendingCompactions** - Количество ожидающих compaction операций

### 12. TTL (Time To Live)

**Описание:** TTL автоматически удаляет записи с истекшим временем жизни.

**Использование:**
- Устанавливается в INSERT/UPDATE через `USING TTL seconds`
- TTL применяется к каждой записи отдельно
- Expired записи автоматически удаляются

**Пример:**
```cql
INSERT INTO my_keyspace.users (user_id, username) 
VALUES (uuid(), 'john_doe')
USING TTL 3600; -- Запись истечет через 1 час
```

### 13. Lightweight Transactions

**Описание:** Lightweight transactions позволяют выполнять условные операции.

**Условия:**
- **IF NOT EXISTS** - Выполнить только если запись не существует (для INSERT)
- **IF EXISTS** - Выполнить только если запись существует (для UPDATE)

**Пример:**
```cql
-- INSERT только если запись не существует
INSERT INTO my_keyspace.users (user_id, username) 
VALUES (uuid(), 'john_doe')
IF NOT EXISTS;

-- UPDATE только если запись существует
UPDATE my_keyspace.users 
SET email = 'new@example.com' 
WHERE user_id = uuid()
IF EXISTS;
```

**Метрики:**
- **lightweightTransactionsTotal** - Общее количество lightweight transactions
- **lightweightTransactionsApplied** - Количество примененных transactions

---

## Руководство пользователя

### Быстрый старт

1. **Добавление компонента Cassandra:**
   - Перетащите компонент "Cassandra" из библиотеки компонентов на canvas
   - Откройте панель конфигурации компонента

2. **Настройка кластера:**
   - Перейдите на вкладку **"Cluster"**
   - Укажите clusterName и datacenter
   - Добавьте узлы кластера (нажмите "Add Node")

3. **Создание keyspace:**
   - Перейдите на вкладку **"Keyspaces"**
   - Нажмите кнопку **"Add Keyspace"**
   - Укажите имя, replication factor и strategy
   - Нажмите **"Save"**

4. **Создание таблицы:**
   - Перейдите на вкладку **"Tables"**
   - Нажмите кнопку **"Add Table"**
   - Укажите имя, keyspace, колонки
   - Нажмите **"Save"**

5. **Выполнение CQL запросов:**
   - Перейдите на вкладку **"CQL"**
   - Введите CQL запрос
   - Нажмите **"Execute"** или Ctrl+Enter

### Работа с Cluster

#### Добавление узла

1. Перейдите на вкладку **"Cluster"**
2. Нажмите кнопку **"Add Node"**
3. Заполните параметры:
   - **Address** - `host:port` (например, `localhost:9042`)
   - **Tokens** - Количество токенов (vnodes, по умолчанию: `256`)
   - **Datacenter** - Имя datacenter
   - **Rack** - Имя rack
   - **Status** - `up` или `down`
4. Нажмите **"Save"**

#### Редактирование узла

1. Выберите узел из списка
2. Нажмите кнопку **"Edit"** (иконка карандаша)
3. Измените параметры
4. Нажмите **"Save"**

#### Удаление узла

1. Выберите узел из списка
2. Нажмите кнопку **"Delete"** (иконка корзины)
3. Подтвердите удаление

### Работа с Keyspaces

#### Создание keyspace

1. Перейдите на вкладку **"Keyspaces"**
2. Нажмите кнопку **"Add Keyspace"**
3. Заполните параметры:
   - **Name** - Имя keyspace
   - **Replication** - Replication factor
   - **Strategy** - SimpleStrategy или NetworkTopologyStrategy
   - **Datacenter Replication** - Для NetworkTopologyStrategy (опционально)
4. Нажмите **"Save"**

#### Редактирование keyspace

1. Выберите keyspace из списка
2. Нажмите кнопку **"Edit"**
3. Измените параметры
4. Нажмите **"Save"**

### Работа с Tables

#### Создание таблицы

1. Перейдите на вкладку **"Tables"**
2. Нажмите кнопку **"Add Table"**
3. Заполните параметры:
   - **Name** - Имя таблицы
   - **Keyspace** - Выберите keyspace
   - **Columns** - Добавьте колонки (укажите primaryKey для partition key)
4. Нажмите **"Save"**

### Работа с CQL

#### Выполнение запросов

1. Перейдите на вкладку **"CQL"**
2. Введите CQL запрос:
   ```cql
   SELECT * FROM my_keyspace.users WHERE user_id = uuid();
   ```
3. Нажмите **"Execute"** или Ctrl+Enter
4. Результат отобразится ниже

#### Примеры запросов

**SELECT:**
```cql
SELECT * FROM my_keyspace.users;
SELECT username, email FROM my_keyspace.users WHERE user_id = uuid();
SELECT COUNT(*) FROM my_keyspace.users;
```

**INSERT:**
```cql
INSERT INTO my_keyspace.users (user_id, username, email) 
VALUES (uuid(), 'john_doe', 'john@example.com');
```

**UPDATE:**
```cql
UPDATE my_keyspace.users 
SET email = 'new@example.com' 
WHERE user_id = uuid();
```

**DELETE:**
```cql
DELETE FROM my_keyspace.users 
WHERE user_id = uuid();
```

---

## Руководство администратора

### Рекомендации по конфигурации

#### Production Cassandra

```json
{
  "clusterName": "production-cluster",
  "datacenter": "dc1",
  "nodes": [
    {
      "address": "cassandra1.production.internal:9042",
      "status": "up",
      "tokens": 256,
      "datacenter": "dc1",
      "rack": "rack1"
    },
    {
      "address": "cassandra2.production.internal:9042",
      "status": "up",
      "tokens": 256,
      "datacenter": "dc1",
      "rack": "rack2"
    },
    {
      "address": "cassandra3.production.internal:9042",
      "status": "up",
      "tokens": 256,
      "datacenter": "dc1",
      "rack": "rack3"
    }
  ],
  "defaultConsistencyLevel": "QUORUM",
  "defaultReplicationFactor": 3,
  "compactionStrategy": "SizeTieredCompactionStrategy",
  "enableCompaction": true
}
```

**Рекомендации:**
- Используйте NetworkTopologyStrategy для production (multi-datacenter)
- Установите replication factor минимум 3 для высокой доступности
- Размещайте реплики в разных rack для защиты от сбоев rack
- Используйте QUORUM для баланса между консистентностью и производительностью
- Мониторьте метрики latency, consistency violations, compaction

### Оптимизация производительности

**Consistency Levels:**
- Используйте **ONE** для read-heavy workloads (быстро, но может быть неактуально)
- Используйте **QUORUM** для баланса между консистентностью и производительностью
- Используйте **ALL** для критичных данных (медленно, но максимальная консистентность)
- Используйте **LOCAL_QUORUM** для multi-datacenter (быстрее чем QUORUM)

**Replication:**
- Установите replication factor минимум 3 для высокой доступности
- Для multi-datacenter используйте NetworkTopologyStrategy с replication в каждом datacenter
- Размещайте реплики в разных rack для защиты от сбоев

**Compaction:**
- Используйте **SizeTieredCompactionStrategy** для общих случаев
- Используйте **LeveledCompactionStrategy** для read-heavy workloads
- Используйте **TimeWindowCompactionStrategy** для time-series данных
- Мониторьте pending compactions (должно быть < 100)

**Token Ring:**
- Используйте vnodes (256 токенов) для равномерного распределения данных
- Добавляйте узлы постепенно для балансировки нагрузки

### Безопасность

#### Управление доступом

- Используйте authentication и authorization (не реализовано в симуляции)
- Ограничьте доступ к Cassandra только необходимым приложениям
- Используйте firewall для ограничения доступа по сети
- Регулярно обновляйте Cassandra

#### Защита данных

- Используйте replication factor минимум 3 для защиты от потери данных
- Регулярно делайте backup (snapshots)
- Мониторьте consistency violations
- Используйте TTL для временных данных

### Мониторинг и алертинг

#### Ключевые метрики

1. **Read Latency / Write Latency**
   - Нормальное значение: < 10ms для локальных операций
   - Алерт: latency > 50ms (проблемы с сетью или нагрузкой)

2. **Consistency Violations**
   - Нормальное значение: 0
   - Алерт: consistency violations > 0 (рассинхронизация реплик)

3. **Pending Compactions**
   - Нормальное значение: < 100
   - Алерт: pending compactions > 1000 (недостаточно ресурсов для compaction)

4. **Hinted Handoffs**
   - Нормальное значение: 0 (все узлы доступны)
   - Алерт: hinted handoffs > 100 (недоступные узлы)

5. **Healthy Nodes**
   - Нормальное значение: все узлы healthy
   - Алерт: healthy nodes < total nodes (недоступные узлы)

6. **Read/Write Operations Per Second**
   - Нормальное значение: зависит от нагрузки
   - Алерт: резкое падение или превышение порога

---

## Метрики и мониторинг

### Основные метрики

#### Latency
- **Описание:** Задержка выполнения операций
- **Единица измерения:** миллисекунды (ms)
- **Типы:** Read Latency, Write Latency
- **Факторы влияния:**
  - Consistency level (больше реплик = выше latency)
  - Network latency между узлами
  - Node load (загруженные узлы = выше latency)
  - Replication factor
  - Datacenter topology (LOCAL_QUORUM быстрее чем QUORUM)

#### Throughput
- **Описание:** Количество операций в секунду
- **Единица измерения:** operations/sec
- **Типы:** Read Operations Per Second, Write Operations Per Second
- **Источник:** Рассчитывается из истории операций за последнюю секунду

#### Consistency Violations
- **Описание:** Количество обнаруженных рассинхронизаций реплик
- **Единица измерения:** количество
- **Типы:** Read Consistency Violations, Write Consistency Violations
- **Причины:**
  - Недоступные узлы во время записи
  - Network partitions
  - Clock skew

### Метрики Cluster

- **totalNodes** - Общее количество узлов
- **healthyNodes** - Количество доступных узлов
- **nodeLoad** - Загрузка узлов (0-1)

### Метрики Data

- **totalKeyspaces** - Количество keyspaces
- **totalTables** - Количество таблиц
- **totalRows** - Общее количество строк
- **totalSize** - Общий размер данных (bytes)

### Метрики Operations

- **readOperationsPerSecond** - Операций чтения в секунду
- **writeOperationsPerSecond** - Операций записи в секунду
- **readLatency** - Средняя задержка чтения (ms)
- **writeLatency** - Средняя задержка записи (ms)

### Метрики Consistency

- **readConsistencyViolations** - Количество violations при чтении
- **writeConsistencyViolations** - Количество violations при записи

### Метрики Compaction

- **pendingCompactions** - Количество ожидающих compaction операций

### Метрики Hinted Handoff

- **hintedHandoffs** - Количество активных hints

### Метрики Lightweight Transactions

- **lightweightTransactionsTotal** - Общее количество lightweight transactions
- **lightweightTransactionsApplied** - Количество примененных transactions

### Мониторинг в реальном времени

Все метрики обновляются в реальном времени во время симуляции:
- Метрики синхронизируются из `CassandraRoutingEngine` каждые 500ms
- Метрики отображаются в UI компоненте
- История операций хранится для расчета метрик
- Gossip протокол обновляет статус узлов в реальном времени

---

## Примеры использования

### Пример 1: Простой кластер с одной таблицей

**Сценарий:** Базовый кластер для хранения пользователей

```json
{
  "clusterName": "my-cluster",
  "datacenter": "dc1",
  "nodes": [
    {
      "address": "localhost:9042",
      "status": "up",
      "tokens": 256,
      "datacenter": "dc1",
      "rack": "rack1"
    }
  ],
  "keyspaces": [
    {
      "name": "my_keyspace",
      "replication": 3,
      "replicationStrategy": "SimpleStrategy",
      "durableWrites": true
    }
  ],
  "tables": [
    {
      "name": "users",
      "keyspace": "my_keyspace",
      "columns": [
        { "name": "user_id", "type": "UUID", "primaryKey": true },
        { "name": "username", "type": "TEXT" },
        { "name": "email", "type": "TEXT" }
      ]
    }
  ]
}
```

### Пример 2: Multi-datacenter кластер

**Сценарий:** Production кластер с несколькими datacenter

```json
{
  "clusterName": "production-cluster",
  "datacenter": "dc1",
  "nodes": [
    {
      "address": "cassandra1.dc1.internal:9042",
      "status": "up",
      "tokens": 256,
      "datacenter": "dc1",
      "rack": "rack1"
    },
    {
      "address": "cassandra2.dc1.internal:9042",
      "status": "up",
      "tokens": 256,
      "datacenter": "dc1",
      "rack": "rack2"
    },
    {
      "address": "cassandra1.dc2.internal:9042",
      "status": "up",
      "tokens": 256,
      "datacenter": "dc2",
      "rack": "rack1"
    }
  ],
  "keyspaces": [
    {
      "name": "production_keyspace",
      "replication": 3,
      "replicationStrategy": "NetworkTopologyStrategy",
      "datacenterReplication": {
        "dc1": 3,
        "dc2": 2
      },
      "durableWrites": true
    }
  ]
}
```

### Пример 3: Time-series данные с TTL

**Сценарий:** Хранение метрик с автоматическим удалением

```cql
-- Создание таблицы для метрик
CREATE TABLE my_keyspace.metrics (
  metric_id UUID,
  timestamp TIMESTAMP,
  value DOUBLE,
  tags MAP<TEXT, TEXT>,
  PRIMARY KEY (metric_id, timestamp)
);

-- Вставка с TTL (данные истекают через 30 дней)
INSERT INTO my_keyspace.metrics (metric_id, timestamp, value, tags)
VALUES (uuid(), toTimestamp(now()), 42.5, {'host': 'server1'})
USING TTL 2592000;
```

### Пример 4: Lightweight Transactions

**Сценарий:** Условные операции для предотвращения дубликатов

```cql
-- Вставка только если запись не существует
INSERT INTO my_keyspace.users (user_id, username, email)
VALUES (123e4567-e89b-12d3-a456-426614174000, 'john_doe', 'john@example.com')
IF NOT EXISTS;

-- Обновление только если запись существует
UPDATE my_keyspace.users
SET email = 'newemail@example.com'
WHERE user_id = 123e4567-e89b-12d3-a456-426614174000
IF EXISTS;
```

### Пример 5: Batch операции

**Сценарий:** Атомарное выполнение множественных операций

```cql
BEGIN BATCH
  USING CONSISTENCY QUORUM
  INSERT INTO my_keyspace.users (user_id, username) VALUES (uuid(), 'user1');
  INSERT INTO my_keyspace.users (user_id, username) VALUES (uuid(), 'user2');
  UPDATE my_keyspace.users SET email = 'new@example.com' WHERE user_id = uuid();
APPLY BATCH;
```

---

## Часто задаваемые вопросы (FAQ)

### Что такое Apache Cassandra?

Apache Cassandra - это распределенная NoSQL база данных, предназначенная для обработки больших объемов данных на множестве серверов с высокой доступностью и линейной масштабируемостью. Cassandra использует masterless архитектуру, где все узлы равноправны.

### В чем разница между Cassandra и традиционными базами данных?

- **Архитектура:** Cassandra использует masterless архитектуру (нет master узла), традиционные БД - master-slave
- **Масштабирование:** Cassandra масштабируется горизонтально (добавление узлов), традиционные БД - вертикально (увеличение ресурсов)
- **Консистентность:** Cassandra предлагает настраиваемую консистентность (tunable consistency), традиционные БД - строгая консистентность
- **Модель данных:** Cassandra использует wide-column модель, традиционные БД - реляционную

### Что такое keyspace в Cassandra?

Keyspace - это логическое пространство имен для группировки таблиц. Keyspace определяет стратегию репликации и replication factor для всех таблиц внутри него.

### Что такое partition key и clustering columns?

- **Partition key** - Определяет, на каком узле хранится запись (хэшируется для получения токена)
- **Clustering columns** - Определяют порядок записей в partition (сортировка)

### Как работает replication в Cassandra?

Replication определяет, сколько копий данных хранится в кластере. Replication factor определяет количество реплик. Replication strategy определяет, как реплики размещаются по узлам (SimpleStrategy или NetworkTopologyStrategy).

### Что такое consistency level?

Consistency level определяет, сколько реплик должно подтвердить операцию перед возвратом результата. Более высокий consistency level обеспечивает большую консистентность, но увеличивает latency.

### Как работает token ring?

Token ring распределяет данные по узлам кластера. Каждый partition key хэшируется для получения токена. Токен определяет, на каком узле хранится primary replica. Replication strategy определяет, на каких узлах хранятся остальные реплики.

### Что такое hinted handoff?

Hinted handoff сохраняет записи для недоступных узлов и доставляет их, когда узел возвращается. Это обеспечивает доступность данных даже при временной недоступности узлов.

### Как мониторить производительность Cassandra?

Используйте метрики в реальном времени:
- Read/Write Latency, Operations Per Second
- Consistency Violations, Pending Compactions
- Hinted Handoffs, Healthy Nodes
- Token Ring Distribution, Datacenter Metrics

### Как оптимизировать Cassandra?

1. Используйте подходящий consistency level (QUORUM для баланса)
2. Используйте NetworkTopologyStrategy для multi-datacenter
3. Установите replication factor минимум 3
4. Используйте подходящую compaction strategy
5. Мониторьте метрики и устраняйте проблемы
6. Используйте TTL для временных данных

---

## Дополнительные ресурсы

- [Официальная документация Apache Cassandra](https://cassandra.apache.org/doc/latest/)
- [CQL Reference](https://cassandra.apache.org/doc/latest/cassandra/cql/)
- [Cassandra Best Practices](https://cassandra.apache.org/doc/latest/cassandra/operating/)
- [DataStax Academy](https://academy.datastax.com/)

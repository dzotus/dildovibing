# MongoDB - Документация компонента

## Обзор

MongoDB - это документо-ориентированная NoSQL база данных, предназначенная для хранения данных в формате JSON-подобных документов (BSON). Компонент MongoDB в системе симуляции полностью эмулирует поведение реального MongoDB, включая коллекции, документы, индексы, aggregation pipeline, change streams, транзакции, replica sets, sharding, connection pooling, WiredTiger storage engine, oplog и полный набор метрик производительности.

### Основные возможности

- ✅ **Document Model** - Хранение данных в формате JSON/BSON документов
- ✅ **Collections** - Управление коллекциями (аналог таблиц в реляционных БД)
- ✅ **Indexes** - Различные типы индексов (single, compound, text, geospatial, hashed, TTL)
- ✅ **Schema Validation** - Опциональная валидация схемы документов
- ✅ **Aggregation Pipeline** - Мощный pipeline для обработки и трансформации данных
- ✅ **Change Streams** - Real-time уведомления об изменениях в коллекциях
- ✅ **Transactions** - Multi-document транзакции с read/write concerns
- ✅ **Replica Set** - Репликация данных с primary/secondary/arbiter ролями
- ✅ **Sharding** - Горизонтальное масштабирование с распределением данных по шардам
- ✅ **Connection Pool** - Пул соединений с настраиваемыми параметрами
- ✅ **WiredTiger Storage Engine** - Симуляция storage engine с кэшированием
- ✅ **Oplog** - Операционный лог для репликации
- ✅ **Метрики в реальном времени** - Полный набор метрик MongoDB (operations, connections, cache, replication, sharding, oplog)

---

## Основные функции

### 1. Управление Connection (Подключение)

**Описание:** Настройка подключения к базе данных MongoDB.

**Параметры подключения:**
- **host** - Хост базы данных (по умолчанию: `localhost`)
- **port** - Порт базы данных (по умолчанию: `27017`)
- **database** - Имя базы данных (по умолчанию: `test`)
- **username** - Имя пользователя (по умолчанию: `admin`)
- **password** - Пароль (опционально)
- **authSource** - База данных для аутентификации (по умолчанию: `admin`)
- **connectionString** - MongoDB connection string (опционально, альтернатива host/port)

**Connection Pool Configuration:**
- **maxConnections** - Максимальное количество соединений (по умолчанию: 100)
- **minConnections** - Минимальное количество соединений (по умолчанию: 0)
- **connectionTimeout** - Таймаут подключения в миллисекундах (по умолчанию: 5000ms = 5 секунд)
- **queryLatency** - Базовая задержка выполнения операций в миллисекундах (по умолчанию: 10ms)

**Пример конфигурации:**
```json
{
  "host": "localhost",
  "port": 27017,
  "database": "test",
  "username": "admin",
  "password": "",
  "authSource": "admin",
  "maxConnections": 100,
  "minConnections": 0,
  "connectionTimeout": 5000,
  "queryLatency": 10
}
```

### 2. Управление Collections (Коллекции)

**Описание:** Коллекции в MongoDB аналогичны таблицам в реляционных БД, но хранят документы вместо строк.

**Параметры Collection:**
- **name** - Имя коллекции (обязательно, уникальное в рамках базы данных)
- **database** - Имя базы данных (обязательно)
- **documentCount** - Количество документов (обновляется автоматически)
- **size** - Размер коллекции в мегабайтах (обновляется автоматически)
- **indexes** - Список индексов (опционально, массив)
- **validation** - Schema validation (опционально)
- **documents** - Документы коллекции (опционально, массив)

**Пример конфигурации:**
```json
{
  "collections": [
    {
      "name": "users",
      "database": "test",
      "documentCount": 1000,
      "size": 2.5,
      "indexes": [
        {
          "name": "idx_users_email",
          "keys": { "email": 1 },
          "unique": true
        }
      ],
      "documents": [
        {
          "_id": "507f1f77bcf86cd799439011",
          "username": "john_doe",
          "email": "john@example.com",
          "age": 30
        }
      ]
    }
  ]
}
```

### 3. Document Model (Модель документов)

**Описание:** MongoDB хранит данные в формате BSON (Binary JSON) документов.

**Особенности:**
- **Динамическая схема** - Документы в одной коллекции могут иметь разную структуру
- **Вложенные структуры** - Поддержка вложенных объектов и массивов
- **_id поле** - Уникальный идентификатор документа (автоматически генерируется, если не указан)
- **BSON типы** - Поддержка различных типов данных (string, number, boolean, date, array, object, null, и т.д.)

**Пример документа:**
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "username": "john_doe",
  "email": "john@example.com",
  "age": 30,
  "address": {
    "street": "123 Main St",
    "city": "New York",
    "zip": "10001"
  },
  "tags": ["developer", "mongodb"],
  "created_at": "2024-01-01T00:00:00Z"
}
```

### 4. Управление Indexes (Индексы)

**Описание:** Индексы ускоряют выполнение запросов и обеспечивают уникальность.

**Параметры Index:**
- **name** - Имя индекса (обязательно, уникальное)
- **keys** - Поля индекса (обязательно, объект): `{ "field": 1 }` (ascending) или `{ "field": -1 }` (descending)
- **unique** - Уникальный ли индекс (по умолчанию: `false`)
- **sparse** - Sparse индекс (только для документов с полем, по умолчанию: `false`)
- **background** - Создавать ли индекс в фоне (по умолчанию: `false`)
- **partial** - Partial индекс с условием (опционально)
- **ttl** - TTL индекс с временем истечения в секундах (опционально)

**Типы индексов:**
- **Single Field** - Индекс по одному полю: `{ "email": 1 }`
- **Compound** - Индекс по нескольким полям: `{ "username": 1, "email": 1 }`
- **Text** - Текстовый индекс для полнотекстового поиска: `{ "description": "text" }`
- **Geospatial** - Геопространственный индекс: `{ "location": "2dsphere" }`
- **Hashed** - Хэш-индекс: `{ "_id": "hashed" }`
- **TTL** - Индекс с автоматическим удалением документов: `{ "created_at": 1, "ttl": 3600 }`

**Пример конфигурации:**
```json
{
  "indexes": [
    {
      "name": "idx_users_email",
      "keys": { "email": 1 },
      "unique": true
    },
    {
      "name": "idx_users_location",
      "keys": { "location": "2dsphere" }
    },
    {
      "name": "idx_users_created_at",
      "keys": { "created_at": 1 },
      "ttl": 86400
    }
  ]
}
```

### 5. Schema Validation (Валидация схемы)

**Описание:** Опциональная валидация структуры документов при insert/update.

**Параметры Validation:**
- **validator** - JSON Schema валидатор (обязательно, объект)
- **validationLevel** - Уровень валидации: `off`, `strict`, `moderate` (по умолчанию: `strict`)
- **validationAction** - Действие при ошибке: `error`, `warn` (по умолчанию: `error`)

**Пример конфигурации:**
```json
{
  "validation": {
    "validator": {
      "$jsonSchema": {
        "bsonType": "object",
        "required": ["username", "email"],
        "properties": {
          "username": {
            "bsonType": "string",
            "description": "Username must be a string"
          },
          "email": {
            "bsonType": "string",
            "pattern": "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
            "description": "Email must be a valid email address"
          },
          "age": {
            "bsonType": "int",
            "minimum": 0,
            "maximum": 150
          }
        }
      }
    },
    "validationLevel": "strict",
    "validationAction": "error"
  }
}
```

### 6. Операции с документами

**Описание:** MongoDB поддерживает CRUD операции с документами.

**Операции:**

1. **Insert** - Вставка документов
   ```javascript
   db.users.insertOne({
     username: "jane_doe",
     email: "jane@example.com",
     age: 25
   });
   ```

2. **Find** - Поиск документов
   ```javascript
   db.users.find({ email: "john@example.com" });
   db.users.find({ age: { $gt: 30 } });
   ```

3. **Update** - Обновление документов
   ```javascript
   db.users.updateOne(
     { email: "john@example.com" },
     { $set: { age: 31 } }
   );
   ```

4. **Delete** - Удаление документов
   ```javascript
   db.users.deleteOne({ email: "john@example.com" });
   ```

**Query Operators:**
- **$eq, $ne** - Равно, не равно
- **$gt, $gte, $lt, $lte** - Больше, больше или равно, меньше, меньше или равно
- **$in, $nin** - В списке, не в списке
- **$and, $or, $not** - Логические операторы
- **$exists** - Поле существует
- **$regex** - Регулярное выражение

### 7. Aggregation Pipeline

**Описание:** Aggregation Pipeline - мощный механизм для обработки и трансформации данных.

**Pipeline Stages:**
- **$match** - Фильтрация документов (аналог WHERE)
- **$group** - Группировка документов
- **$project** - Выбор и трансформация полей (аналог SELECT)
- **$sort** - Сортировка документов (аналог ORDER BY)
- **$limit** - Ограничение количества документов
- **$skip** - Пропуск документов
- **$unwind** - Разворачивание массивов
- **$lookup** - Объединение коллекций (аналог JOIN)
- **$facet** - Множественные pipeline для одного набора данных
- **$bucket** - Группировка в корзины

**Aggregation Expressions:**
- **$sum, $avg, $min, $max** - Агрегация чисел
- **$push, $addToSet** - Добавление в массив
- **$first, $last** - Первый/последний элемент
- **$count** - Подсчет документов

**Пример Aggregation Pipeline:**
```json
{
  "stages": [
    {
      "stage": "$match",
      "expression": "{\"age\": {\"$gte\": 18}}"
    },
    {
      "stage": "$group",
      "expression": "{\"_id\": \"$city\", \"avgAge\": {\"$avg\": \"$age\"}, \"count\": {\"$sum\": 1}}"
    },
    {
      "stage": "$sort",
      "expression": "{\"count\": -1}"
    },
    {
      "stage": "$limit",
      "expression": "10"
    }
  ]
}
```

### 8. Change Streams

**Описание:** Change Streams предоставляют real-time уведомления об изменениях в коллекциях.

**Типы операций:**
- **insert** - Вставка документа
- **update** - Обновление документа
- **replace** - Замена документа
- **delete** - Удаление документа
- **invalidate** - Инвалидация change stream

**Change Event:**
```json
{
  "_id": { "_data": "..." },
  "operationType": "insert",
  "fullDocument": {
    "_id": "507f1f77bcf86cd799439011",
    "username": "john_doe",
    "email": "john@example.com"
  },
  "documentKey": { "_id": "507f1f77bcf86cd799439011" },
  "clusterTime": { "$timestamp": "..." }
}
```

**Использование:**
- Change Streams можно фильтровать по типу операции
- Поддерживается aggregation pipeline для фильтрации change events
- Resume tokens позволяют восстановить stream после сбоя

### 9. Transactions (Транзакции)

**Описание:** MongoDB поддерживает multi-document транзакции с ACID гарантиями.

**Read Concerns:**
- **local** - Чтение локальных данных (быстро, но может быть неактуально)
- **majority** - Чтение данных, подтвержденных большинством реплик (по умолчанию)
- **snapshot** - Снимок данных на момент начала транзакции

**Write Concerns:**
- **majority** - Запись должна быть подтверждена большинством реплик
- **number** - Запись должна быть подтверждена указанным количеством реплик

**Пример транзакции:**
```javascript
const session = client.startSession();
session.startTransaction();

try {
  await usersCollection.insertOne({ username: "user1" }, { session });
  await ordersCollection.insertOne({ userId: "user1", total: 100 }, { session });
  await session.commitTransaction();
} catch (error) {
  await session.abortTransaction();
} finally {
  session.endSession();
}
```

### 10. Replica Set (Репликация)

**Описание:** Replica Set обеспечивает высокую доступность и надежность данных.

**Роли в Replica Set:**
- **Primary** - Основной узел, обрабатывает все операции записи
- **Secondary** - Вторичные узлы, реплицируют данные с primary
- **Arbiter** - Арбитр, участвует в выборах primary, но не хранит данные

**Параметры Replica Set:**
- **enableReplicaSet** - Включить ли replica set (по умолчанию: `false`)
- **replicaSetName** - Имя replica set (по умолчанию: `rs0`)
- **replicaSetMembers** - Список членов replica set (массив)

**Параметры Replica Set Member:**
- **host** - Хост узла (обязательно)
- **port** - Порт узла (обязательно)
- **priority** - Приоритет узла для выбора primary (по умолчанию: 1)
- **votes** - Количество голосов в выборах (по умолчанию: 1)
- **arbiterOnly** - Является ли арбитром (по умолчанию: `false`)

**Как работает:**
- Primary обрабатывает все операции записи
- Операции записываются в oplog
- Secondary реплицируют данные из oplog primary
- При падении primary происходит election для выбора нового primary
- Replication lag показывает задержку репликации

**Пример конфигурации:**
```json
{
  "enableReplicaSet": true,
  "replicaSetName": "rs0",
  "replicaSetMembers": [
    { "host": "localhost", "port": 27017, "priority": 1, "votes": 1 },
    { "host": "localhost", "port": 27018, "priority": 1, "votes": 1 },
    { "host": "localhost", "port": 27019, "priority": 0, "votes": 0, "arbiterOnly": true }
  ]
}
```

### 11. Sharding (Шардирование)

**Описание:** Sharding обеспечивает горизонтальное масштабирование MongoDB.

**Компоненты Sharding:**
- **Config Servers** - Хранят метаданные о распределении данных
- **Mongos** - Роутер запросов к шардам
- **Shards** - Узлы, хранящие данные (обычно replica sets)

**Параметры Sharding:**
- **enableSharding** - Включить ли sharding (по умолчанию: `false`)
- **shardConfig** - Конфигурация sharding (обязательно, если sharding включен)

**Параметры ShardConfig:**
- **shardKey** - Ключ шардирования (обязательно): `{ "userId": "hashed" }` или `{ "userId": 1 }`
- **shards** - Список шардов (обязательно, массив)

**Параметры Shard:**
- **name** - Имя шарда (обязательно)
- **hosts** - Список хостов шарда (массив строк `host:port`, обязательно)
- **zones** - Зоны для географического распределения (опционально, массив строк)
- **weight** - Вес шарда для балансировщика (1-100, по умолчанию: 1)
- **tags** - Теги для управления шардами (опционально, объект)

**Как работает:**
- Данные распределяются по шардам на основе shard key
- Chunks (чанки) - единицы распределения данных
- Balancer автоматически перераспределяет chunks между шардами
- Mongos направляет запросы к соответствующим шардам

**Пример конфигурации:**
```json
{
  "enableSharding": true,
  "shardConfig": {
    "shardKey": { "userId": "hashed" },
    "shards": [
      {
        "name": "shard1",
        "hosts": ["localhost:27017", "localhost:27018"],
        "zones": ["us-east"],
        "weight": 1
      },
      {
        "name": "shard2",
        "hosts": ["localhost:27019", "localhost:27020"],
        "zones": ["us-west"],
        "weight": 1
      }
    ]
  }
}
```

### 12. Connection Pool (Пул соединений)

**Описание:** Connection Pool управляет соединениями с базой данных для оптимизации производительности.

**Состояния соединений:**
- **idle** - Соединение свободно и готово к использованию
- **active** - Соединение активно выполняет операцию
- **waiting** - Соединение ожидает освобождения пула

**Метрики пула:**
- **currentConnections** - Текущее количество соединений
- **availableConnections** - Доступные соединения
- **activeConnections** - Активные соединения
- **connectionUtilization** - Загрузка пула (0-1)

**Как работает:**
- При запросе соединения пул пытается переиспользовать idle соединение
- Если нет свободных соединений и не достигнут maxConnections, создается новое
- Если пул исчерпан, соединение ожидает в очереди или получает ошибку

### 13. WiredTiger Storage Engine

**Описание:** WiredTiger - storage engine по умолчанию в MongoDB, обеспечивающий document-level concurrency и сжатие.

**Особенности:**
- **Document-level concurrency** - Блокировка на уровне документа (в отличие от row-level в PostgreSQL)
- **Compression** - Сжатие данных (snappy, zlib, zstd)
- **Checkpoint** - Периодическая запись данных на диск
- **Cache** - Кэш для часто используемых данных
- **Journal** - Журнал для crash recovery

**Метрики Cache:**
- **cacheHitRatio** - Процент попаданий в кэш (0-1)
- **cacheUsed** - Используемый размер кэша (bytes)
- **cacheTotal** - Общий размер кэша (bytes)
- **cacheUtilization** - Загрузка кэша (0-1)

### 14. Oplog (Операционный лог)

**Описание:** Oplog хранит все операции записи для репликации.

**Oplog Entry:**
```json
{
  "ts": { "$timestamp": "..." },
  "h": 1234567890,
  "v": 2,
  "op": "i",
  "ns": "test.users",
  "o": { "_id": "...", "username": "john_doe" }
}
```

**Типы операций:**
- **i** - insert
- **u** - update
- **d** - delete
- **c** - command
- **n** - noop

**Метрики Oplog:**
- **oplogSize** - Размер oplog (bytes)
- **oplogUsed** - Используемый размер oplog (bytes)
- **oplogUtilization** - Загрузка oplog (0-1)

---

## Руководство пользователя

### Быстрый старт

1. **Добавление компонента MongoDB:**
   - Перетащите компонент "MongoDB" из библиотеки компонентов на canvas
   - Откройте панель конфигурации компонента

2. **Настройка подключения:**
   - Перейдите на вкладку **"Connection"**
   - Укажите host, port, database, username, password
   - Настройте параметры connection pool

3. **Создание коллекции:**
   - Перейдите на вкладку **"Collections"**
   - Нажмите кнопку **"Add Collection"**
   - Укажите имя коллекции и базу данных
   - Добавьте индексы и schema validation при необходимости

4. **Добавление документов:**
   - Перейдите на вкладку **"Documents"**
   - Выберите коллекцию
   - Нажмите кнопку **"Add Document"**
   - Введите JSON документ
   - Нажмите **"Save"**

5. **Выполнение запросов:**
   - Перейдите на вкладку **"Documents"**
   - Выберите коллекцию
   - Введите фильтр запроса (JSON)
   - Нажмите кнопку **"Find"**

### Работа с Collections

#### Создание коллекции

1. Перейдите на вкладку **"Collections"**
2. Нажмите кнопку **"Add Collection"**
3. Заполните параметры:
   - **Name** - Имя коллекции (уникальное в рамках базы данных)
   - **Database** - Имя базы данных
4. Нажмите **"Save"**

#### Редактирование коллекции

1. Выберите коллекцию из списка
2. Нажмите кнопку **"Edit"** (иконка карандаша)
3. Измените параметры:
   - Добавьте/удалите индексы
   - Настройте schema validation
4. Нажмите **"Save"**

#### Удаление коллекции

1. Выберите коллекцию из списка
2. Нажмите кнопку **"Delete"** (иконка корзины)
3. Подтвердите удаление

### Работа с Indexes

#### Создание индекса

1. Выберите коллекцию из списка
2. Нажмите кнопку **"Add Index"**
3. Заполните параметры:
   - **Name** - Имя индекса
   - **Keys** - Поля индекса (JSON): `{ "email": 1 }` или `{ "username": 1, "email": 1 }`
   - **Unique** - Уникальный ли индекс
   - **Sparse** - Sparse индекс
   - **Background** - Создавать в фоне
4. Нажмите **"Save"**

#### Типы индексов

**Single Field:**
```json
{ "email": 1 }
```

**Compound:**
```json
{ "username": 1, "email": 1 }
```

**Text:**
```json
{ "description": "text" }
```

**Geospatial:**
```json
{ "location": "2dsphere" }
```

**Hashed:**
```json
{ "_id": "hashed" }
```

### Работа с Documents

#### Добавление документа

1. Перейдите на вкладку **"Documents"**
2. Выберите коллекцию
3. Нажмите кнопку **"Add Document"**
4. Введите JSON документ:
   ```json
   {
     "username": "john_doe",
     "email": "john@example.com",
     "age": 30
   }
   ```
5. Нажмите **"Save"**

**Примечание:** Поле `_id` генерируется автоматически, если не указано.

#### Поиск документов

1. Выберите коллекцию
2. Введите фильтр запроса (JSON):
   ```json
   { "email": "john@example.com" }
   ```
   или
   ```json
   { "age": { "$gte": 18 } }
   ```
3. Нажмите кнопку **"Find"**
4. Результаты отобразятся в таблице

#### Редактирование документа

1. Выберите документ из списка
2. Нажмите кнопку **"Edit"** (иконка карандаша)
3. Измените JSON документ
4. Нажмите **"Save"**

#### Удаление документа

1. Выберите документ из списка
2. Нажмите кнопку **"Delete"** (иконка корзины)
3. Подтвердите удаление

### Работа с Aggregation Pipeline

#### Создание Aggregation Pipeline

1. Перейдите на вкладку **"Aggregations"**
2. Выберите коллекцию
3. Нажмите кнопку **"Add Stage"**
4. Выберите stage из списка:
   - **$match** - Фильтрация
   - **$group** - Группировка
   - **$project** - Выбор полей
   - **$sort** - Сортировка
   - **$limit** - Ограничение
   - **$skip** - Пропуск
   - **$unwind** - Разворачивание массивов
   - **$lookup** - Объединение коллекций
5. Заполните expression (JSON):
   ```json
   { "age": { "$gte": 18 } }
   ```
6. Нажмите **"Execute"** для выполнения pipeline

#### Пример Aggregation Pipeline

**Задача:** Найти средний возраст пользователей по городам, отсортировать по количеству пользователей

```json
[
  {
    "stage": "$match",
    "expression": "{\"age\": {\"$gte\": 18}}"
  },
  {
    "stage": "$group",
    "expression": "{\"_id\": \"$city\", \"avgAge\": {\"$avg\": \"$age\"}, \"count\": {\"$sum\": 1}}"
  },
  {
    "stage": "$sort",
    "expression": "{\"count\": -1}"
  },
  {
    "stage": "$limit",
    "expression": "10"
  }
]
```

### Работа с Replica Set

#### Включение Replica Set

1. Перейдите на вкладку **"Replication"**
2. Включите переключатель **"Enable Replica Set"**
3. Укажите **Replica Set Name** (например, `rs0`)
4. Добавьте members:
   - Нажмите **"Add Member"**
   - Укажите host, port, priority, votes
   - Установите `arbiterOnly` для арбитра
5. Нажмите **"Save"**

#### Управление Members

- **Добавление:** Нажмите **"Add Member"** и заполните параметры
- **Редактирование:** Выберите member и нажмите **"Edit"**
- **Удаление:** Выберите member и нажмите **"Delete"**

**Примечание:** Primary выбирается автоматически на основе priority.

### Работа с Sharding

#### Включение Sharding

1. Перейдите на вкладку **"Sharding"**
2. Включите переключатель **"Enable Sharding"**
3. Настройте **Shard Key**:
   - Выберите поле для шардирования
   - Выберите тип: `1` (ascending), `-1` (descending), `hashed`
4. Добавьте шарды:
   - Нажмите **"Add Shard"**
   - Укажите name, hosts, zones, weight
5. Нажмите **"Save"**

#### Управление Shards

- **Добавление:** Нажмите **"Add Shard"** и заполните параметры
- **Редактирование:** Выберите shard и нажмите **"Edit"**
- **Удаление:** Выберите shard и нажмите **"Delete"**

---

## Руководство администратора

### Рекомендации по конфигурации

#### Production MongoDB

```json
{
  "host": "mongodb.production.internal",
  "port": 27017,
  "database": "production_db",
  "username": "app_user",
  "password": "***",
  "maxConnections": 200,
  "minConnections": 20,
  "connectionTimeout": 5000,
  "queryLatency": 5,
  "enableReplicaSet": true,
  "replicaSetName": "rs0",
  "replicaSetMembers": [
    { "host": "mongodb1.internal", "port": 27017, "priority": 2, "votes": 1 },
    { "host": "mongodb2.internal", "port": 27017, "priority": 1, "votes": 1 },
    { "host": "mongodb3.internal", "port": 27017, "priority": 0, "votes": 0, "arbiterOnly": true }
  ]
}
```

**Рекомендации:**
- Используйте replica set для production (минимум 3 узла)
- Настройте connection pool в зависимости от нагрузки
- Создавайте индексы для часто используемых полей
- Используйте schema validation для критичных коллекций
- Мониторьте метрики производительности

#### Оптимизация производительности

**Connection Pool:**
- Установите `maxConnections` в зависимости от нагрузки
  - Обычно: 50-200 соединений для большинства случаев
  - Высоконагруженные системы: 200-500 соединений
- Установите `minConnections` для поддержания минимального пула

**Indexes:**
- Создавайте индексы для полей, используемых в запросах
- Используйте compound индексы для запросов с несколькими полями
- Избегайте избыточных индексов (они замедляют insert/update)
- Используйте sparse индексы для полей, которые есть не у всех документов
- Мониторьте использование индексов через метрики

**Schema Validation:**
- Используйте `strict` validation level для критичных коллекций
- Используйте `moderate` для коллекций с существующими данными
- Используйте `warn` action для постепенного внедрения валидации

**Aggregation Pipeline:**
- Используйте `$match` в начале pipeline для уменьшения количества документов
- Используйте `$project` для выбора только нужных полей
- Используйте `$limit` для ограничения результатов
- Оптимизируйте порядок stages

### Безопасность

#### Управление доступом

- Используйте сильные пароли
- Не храните пароли в открытом виде в конфигурации
- Используйте переменные окружения для паролей
- Настройте `authSource` для аутентификации

#### Schema Validation

- Используйте schema validation для защиты от некорректных данных
- Начните с `warn` action для постепенного внедрения
- Перейдите на `error` action после проверки

### Мониторинг и алертинг

#### Ключевые метрики

1. **Operations Per Second**
   - Нормальное значение: зависит от нагрузки
   - Алерт: резкое падение или превышение порога

2. **Average Query Time**
   - Нормальное значение: < 50ms для большинства запросов
   - Алерт: average query time > 200ms

3. **P95/P99 Query Time**
   - Нормальное значение: P95 < 100ms, P99 < 500ms
   - Алерт: P95 > 500ms, P99 > 1000ms

4. **Cache Hit Ratio**
   - Нормальное значение: > 95%
   - Алерт: cache hit ratio < 90% (недостаточно памяти или неэффективные запросы)

5. **Connection Utilization**
   - Нормальное значение: < 80%
   - Алерт: connection utilization > 90% (недостаточно соединений)

6. **Replication Lag**
   - Нормальное значение: < 100ms
   - Алерт: replication lag > 1000ms (проблемы с репликацией)

7. **Oplog Utilization**
   - Нормальное значение: < 80%
   - Алерт: oplog utilization > 90% (oplog может переполниться)

8. **Storage Utilization**
   - Нормальное значение: < 80%
   - Алерт: storage utilization > 90% (необходимо расширение)

9. **Error Rate**
   - Нормальное значение: < 1%
   - Алерт: error rate > 5%

10. **Validation Errors**
    - Нормальное значение: 0
    - Алерт: validation errors > 0 (некорректные данные)

---

## Метрики и мониторинг

### Основные метрики

#### Throughput
- **Описание:** Количество операций в секунду
- **Единица измерения:** operations/sec
- **Источник:** Рассчитывается из истории операций за последнюю секунду

#### Latency
- **Описание:** Задержка выполнения операций
- **Единица измерения:** миллисекунды (ms)
- **Percentiles:** P50, P95, P99
- **Факторы влияния:**
  - Размер коллекций
  - Использование индексов
  - Сложность запросов
  - Нагрузка на базу данных
  - Cache hit ratio

#### Error Rate
- **Описание:** Процент ошибок при выполнении операций
- **Единица измерения:** процент (0-1)
- **Причины ошибок:**
  - Ошибки валидации схемы
  - Ошибки доступа
  - Ошибки транзакций
  - Connection pool exhausted

#### Utilization
- **Описание:** Загрузка connection pool
- **Единица измерения:** процент (0-1)
- **Расчет:** currentConnections / maxConnections

### Метрики Operations

- **operationsPerSecond** - Общее количество операций в секунду
- **insertsPerSecond** - Количество insert операций в секунду
- **queriesPerSecond** - Количество query операций в секунду
- **updatesPerSecond** - Количество update операций в секунду
- **deletesPerSecond** - Количество delete операций в секунду
- **commandsPerSecond** - Количество command операций в секунду
- **getmoresPerSecond** - Количество getmore операций в секунду (для cursors)

### Метрики Performance

- **averageQueryTime** - Среднее время выполнения запросов (ms)
- **averageInsertTime** - Среднее время выполнения insert (ms)
- **averageUpdateTime** - Среднее время выполнения update (ms)
- **averageDeleteTime** - Среднее время выполнения delete (ms)
- **p50QueryTime** - 50-й перцентиль времени выполнения запросов (ms)
- **p95QueryTime** - 95-й перцентиль времени выполнения запросов (ms)
- **p99QueryTime** - 99-й перцентиль времени выполнения запросов (ms)

### Метрики Connection Pool

- **currentConnections** - Текущее количество соединений
- **availableConnections** - Доступные соединения
- **activeConnections** - Активные соединения
- **connectionUtilization** - Загрузка пула (0-1)

### Метрики Collections & Documents

- **totalCollections** - Количество коллекций
- **totalDocuments** - Общее количество документов
- **totalIndexes** - Общее количество индексов
- **dataSize** - Размер данных (bytes)
- **storageSize** - Размер хранилища (bytes)
- **indexSize** - Размер индексов (bytes)
- **avgObjSize** - Средний размер документа (bytes)

### Метрики Cache (WiredTiger)

- **cacheHitRatio** - Процент попаданий в кэш (0-1)
- **cacheUsed** - Используемый размер кэша (bytes)
- **cacheTotal** - Общий размер кэша (bytes)
- **cacheUtilization** - Загрузка кэша (0-1)

### Метрики Replication

- **replicationLag** - Задержка репликации (ms, 0 если primary)
- **replicaSetMembers** - Количество членов replica set
- **primaryMember** - Хост:порт primary узла
- **isPrimary** - Является ли этот узел primary

### Метрики Sharding

- **shardCount** - Количество шардов
- **totalChunks** - Общее количество chunks
- **chunkDistribution** - Распределение chunks по шардам (объект)
- **balancerRunning** - Запущен ли balancer

### Метрики Oplog

- **oplogSize** - Размер oplog (bytes)
- **oplogUsed** - Используемый размер oplog (bytes)
- **oplogUtilization** - Загрузка oplog (0-1)

### Метрики Cursors

- **openCursors** - Количество открытых cursors
- **timedOutCursors** - Количество истекших cursors

### Метрики Errors

- **errorRate** - Процент ошибок (0-1)
- **validationErrors** - Количество ошибок валидации
- **connectionErrors** - Количество ошибок подключения

### Метрики Storage

- **storageUtilization** - Загрузка хранилища (0-1)

### Мониторинг в реальном времени

Все метрики обновляются в реальном времени во время симуляции:
- Метрики синхронизируются из `MongoDBEmulationEngine` каждую секунду
- Метрики отображаются в UI компоненте
- История операций хранится для расчета метрик

---

## Примеры использования

### Пример 1: Простая коллекция с документами

**Сценарий:** Коллекция пользователей

```json
{
  "host": "localhost",
  "port": 27017,
  "database": "test",
  "collections": [
    {
      "name": "users",
      "database": "test",
      "indexes": [
        {
          "name": "idx_users_email",
          "keys": { "email": 1 },
          "unique": true
        }
      ],
      "documents": [
        {
          "_id": "507f1f77bcf86cd799439011",
          "username": "john_doe",
          "email": "john@example.com",
          "age": 30
        }
      ]
    }
  ]
}
```

### Пример 2: Коллекция с Schema Validation

**Сценарий:** Коллекция с валидацией схемы

```json
{
  "collections": [
    {
      "name": "users",
      "database": "test",
      "validation": {
        "validator": {
          "$jsonSchema": {
            "bsonType": "object",
            "required": ["username", "email"],
            "properties": {
              "username": {
                "bsonType": "string",
                "minLength": 3,
                "maxLength": 50
              },
              "email": {
                "bsonType": "string",
                "pattern": "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
              },
              "age": {
                "bsonType": "int",
                "minimum": 0,
                "maximum": 150
              }
            }
          }
        },
        "validationLevel": "strict",
        "validationAction": "error"
      }
    }
  ]
}
```

### Пример 3: Replica Set конфигурация

**Сценарий:** Production replica set с 3 узлами

```json
{
  "enableReplicaSet": true,
  "replicaSetName": "rs0",
  "replicaSetMembers": [
    {
      "host": "mongodb1.production.internal",
      "port": 27017,
      "priority": 2,
      "votes": 1
    },
    {
      "host": "mongodb2.production.internal",
      "port": 27017,
      "priority": 1,
      "votes": 1
    },
    {
      "host": "mongodb3.production.internal",
      "port": 27017,
      "priority": 0,
      "votes": 0,
      "arbiterOnly": true
    }
  ]
}
```

### Пример 4: Sharding конфигурация

**Сценарий:** Sharded cluster с 3 шардами

```json
{
  "enableSharding": true,
  "shardConfig": {
    "shardKey": { "userId": "hashed" },
    "shards": [
      {
        "name": "shard1",
        "hosts": ["mongodb1.internal:27017", "mongodb2.internal:27017"],
        "zones": ["us-east"],
        "weight": 1
      },
      {
        "name": "shard2",
        "hosts": ["mongodb3.internal:27017", "mongodb4.internal:27017"],
        "zones": ["us-west"],
        "weight": 1
      },
      {
        "name": "shard3",
        "hosts": ["mongodb5.internal:27017", "mongodb6.internal:27017"],
        "zones": ["eu-west"],
        "weight": 1
      }
    ]
  }
}
```

### Пример 5: Aggregation Pipeline

**Сценарий:** Анализ пользователей по городам

```json
{
  "aggregationPipeline": [
    {
      "stage": "$match",
      "expression": "{\"age\": {\"$gte\": 18}}"
    },
    {
      "stage": "$group",
      "expression": "{\"_id\": \"$city\", \"avgAge\": {\"$avg\": \"$age\"}, \"count\": {\"$sum\": 1}, \"users\": {\"$push\": \"$username\"}}"
    },
    {
      "stage": "$sort",
      "expression": "{\"count\": -1}"
    },
    {
      "stage": "$limit",
      "expression": "10"
    }
  ]
}
```

---

## Часто задаваемые вопросы (FAQ)

### Что такое MongoDB?

MongoDB - это документо-ориентированная NoSQL база данных, которая хранит данные в формате JSON-подобных документов (BSON). Она отличается от реляционных БД отсутствием фиксированной схемы и поддержкой вложенных структур.

### В чем разница между MongoDB и PostgreSQL?

- **Модель данных:** MongoDB использует документную модель (JSON), PostgreSQL - реляционную (таблицы)
- **Схема:** MongoDB имеет динамическую схему (schema-less), PostgreSQL - фиксированную
- **Масштабирование:** MongoDB поддерживает горизонтальное масштабирование (sharding), PostgreSQL - вертикальное
- **Транзакции:** MongoDB поддерживает multi-document транзакции, PostgreSQL - multi-row транзакции

### Что такое коллекция в MongoDB?

Коллекция в MongoDB аналогична таблице в реляционных БД, но хранит документы вместо строк. Документы в коллекции могут иметь разную структуру (динамическая схема).

### Что такое индекс в MongoDB?

Индекс ускоряет выполнение запросов и обеспечивает уникальность. MongoDB поддерживает различные типы индексов: single field, compound, text, geospatial, hashed, TTL.

### Как работает Aggregation Pipeline?

Aggregation Pipeline обрабатывает документы через последовательность stages. Каждый stage трансформирует документы и передает результат следующему stage. Это позволяет выполнять сложные запросы и трансформации данных.

### Что такое Change Streams?

Change Streams предоставляют real-time уведомления об изменениях в коллекциях. Они генерируют события при insert, update, delete операциях и могут быть использованы для синхронизации данных или обработки событий.

### Как работает Replica Set?

Replica Set обеспечивает высокую доступность через репликацию данных. Primary узел обрабатывает все операции записи, secondary узлы реплицируют данные. При падении primary происходит election для выбора нового primary.

### Как работает Sharding?

Sharding обеспечивает горизонтальное масштабирование через распределение данных по шардам. Данные распределяются на основе shard key, balancer автоматически перераспределяет chunks между шардами для балансировки нагрузки.

### Как мониторить производительность MongoDB?

Используйте метрики в реальном времени:
- Operations Per Second, Average Query Time, P95/P99 Query Time
- Cache Hit Ratio, Connection Utilization
- Replication Lag, Oplog Utilization
- Storage Utilization, Error Rate

### Как оптимизировать запросы MongoDB?

1. Создавайте индексы для полей в фильтрах запросов
2. Используйте `$match` в начале aggregation pipeline
3. Используйте `$project` для выбора только нужных полей
4. Избегайте `$lookup` когда возможно (используйте embedded документы)
5. Используйте `$limit` для ограничения результатов

---

## Дополнительные ресурсы

- [Официальная документация MongoDB](https://docs.mongodb.com/)
- [MongoDB University](https://university.mongodb.com/)
- [MongoDB Best Practices](https://docs.mongodb.com/manual/administration/production-notes/)
- [MongoDB Performance Tuning](https://docs.mongodb.com/manual/administration/analyzing-mongodb-performance/)

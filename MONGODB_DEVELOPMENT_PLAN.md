# План разработки компонента MongoDB

## Анализ текущего состояния

### ✅ Что уже реализовано

1. **UI компонент (MongoDBConfigAdvanced.tsx)**
   - Табы: Collections, Documents, Aggregations, Replication, Sharding
   - CRUD операции для коллекций
   - Управление индексами (создание, редактирование, удаление)
   - Schema Validation с уровнями валидации
   - Работа с документами (insert, find, delete)
   - Aggregation Pipeline Builder
   - Replica Set Configuration
   - Sharding Configuration
   - Настройки подключения

2. **Базовая обработка в DataFlowEngine**
   - Обработка операций insert, update, delete, query
   - Schema validation при insert/update
   - Использование документов из коллекций для query
   - Простая фильтрация документов

3. **Базовая симуляция в EmulationEngine**
   - Использует общий метод `simulateDatabase()`
   - Учитывает индексы для расчета производительности
   - Учитывает Replication для availability
   - Учитывает Sharding для throughput
   - Базовые метрики (throughput, latency, utilization, errorRate)

### ❌ Что отсутствует или работает некорректно

1. **✅ MongoDBEmulationEngine - РЕАЛИЗОВАНО**
   - ✅ Создан специализированный движок симуляции MongoDB (`MongoDBEmulationEngine.ts`)
   - ✅ Реализована полная симуляция с реальными паттернами MongoDB
   - ✅ Метрики соответствуют реальным метрикам MongoDB
   - ✅ Реализована симуляция внутренних процессов MongoDB

2. **✅ Метрики MongoDB - РЕАЛИЗОВАНО**
   - ✅ Метрики из `db.serverStatus()` (operations, connections, network, memory, storage)
   - ✅ Метрики из `db.stats()` (collections, dataSize, storageSize, indexes)
   - ✅ Метрики из `db.collection.stats()` (count, size, avgObjSize, storageSize, totalIndexSize)
   - ✅ Метрики операций (inserts, queries, updates, deletes, getmores, commands)
   - ✅ Метрики replication lag (если настроена репликация)
   - ✅ Метрики sharding (chunks, migrations, balancer)
   - ✅ Метрики cache (WiredTiger cache hit ratio)
   - ✅ Метрики oplog (replication oplog size, lag)
   - ✅ Метрики connections (current, available, active)
   - ✅ Метрики cursors (open, timedOut)

3. **Отсутствуют уникальные особенности MongoDB**
   - **Document Model**: Нет симуляции работы с документами как с JSON объектами
   - **Aggregation Pipeline**: Нет реального выполнения pipeline, только упрощенная симуляция
   - **Change Streams**: Полностью отсутствует (это ключевая фича MongoDB)
   - **Transactions**: Нет симуляции multi-document transactions
   - **Replica Set**: Нет симуляции primary/secondary/arbiter ролей, election, heartbeat
   - **Sharding**: Нет симуляции chunk distribution, balancer, migrations
   - **Indexes**: Нет симуляции различных типов индексов (text, 2dsphere, hashed, compound)
   - **WiredTiger Storage Engine**: Нет симуляции storage engine (cache, compression, checkpoint)
   - **Oplog**: Нет симуляции oplog для репликации
   - **Connection Pooling**: Нет симуляции connection pool (как в реальном MongoDB driver)

4. **Синхронизация данных**
   - Документы в UI не синхронизируются с симуляцией в реальном времени
   - Результаты aggregation не влияют на метрики
   - Изменения в UI не отражаются в симуляции немедленно
   - Нет отслеживания изменений документов (change streams)

5. **UI/UX проблемы**
   - Табы не адаптивны (не переносятся на новую строку при узком экране)
   - Нет отображения реальных метрик из симуляции
   - Нет визуализации query execution plans
   - Нет истории операций
   - Нет мониторинга активных операций
   - Нет отображения replica set status
   - Нет мониторинга sharding status
   - Нет отображения change streams
   - Нет отображения активных transactions

6. **Интеграция с DataFlowEngine**
   - Aggregation pipeline выполняется только в UI, не через DataFlowEngine
   - Change streams не обрабатываются в DataFlowEngine
   - Transactions не обрабатываются в DataFlowEngine
   - Результаты операций не влияют на метрики в реальном времени

## Уникальные особенности MongoDB (отличаются от PostgreSQL)

### 1. Document Model
- **JSON/BSON документы** вместо реляционных таблиц
- **Вложенные структуры** (nested objects, arrays)
- **Динамическая схема** (schema-less, но с optional validation)
- **Embedded vs Referenced** документы

### 2. Aggregation Pipeline
- **Pipeline stages**: $match, $group, $project, $sort, $limit, $skip, $unwind, $lookup, $facet, $bucket и др.
- **Expressions**: $sum, $avg, $min, $max, $push, $addToSet и др.
- **Real-time processing** документов через pipeline

### 3. Change Streams
- **Real-time notifications** об изменениях в коллекциях
- **Filtering** изменений по типу операции (insert, update, delete, replace)
- **Resume tokens** для восстановления после сбоя
- **Aggregation pipeline** для фильтрации change events

### 4. Transactions
- **Multi-document transactions** (ACID)
- **Read/Write concerns** (majority, local, snapshot)
- **Retry logic** для transient errors

### 5. Replication
- **Replica Set** с primary/secondary/arbiter
- **Election** для выбора primary
- **Heartbeat** для мониторинга состояния
- **Oplog** для репликации операций
- **Read preferences** (primary, secondary, nearest)

### 6. Sharding
- **Sharded cluster** с config servers, mongos, shards
- **Chunk distribution** и балансировка
- **Shard key** для распределения данных
- **Balancer** для перераспределения chunks
- **Zone sharding** для географического распределения

### 7. Indexes
- **Single field, compound, multikey, text, geospatial, hashed, TTL**
- **Partial indexes** (с условием)
- **Sparse indexes** (только для документов с полем)
- **Background building** индексов

### 8. Storage Engine (WiredTiger)
- **Document-level concurrency** (в отличие от row-level в PostgreSQL)
- **Compression** (snappy, zlib, zstd)
- **Checkpoint** для durability
- **Cache** для часто используемых данных
- **Journal** для crash recovery

## План реализации

### ✅ Этап 1: Создание MongoDBEmulationEngine - ВЫПОЛНЕНО

**Цель:** Создать специализированный движок симуляции MongoDB, учитывающий уникальные особенности MongoDB (не по аналогии с PostgreSQL)

**Задачи:**

1. **Создать файл `src/core/MongoDBEmulationEngine.ts`**
   - Класс `MongoDBEmulationEngine` с методами:
     - `initializeConfig(node: CanvasNode): void` - инициализация из конфига
     - `updateConfig(config: Partial<MongoDBConfig>): void` - обновление конфига
     - `updateMetrics(): void` - обновление метрик
     - `getMetrics(): MongoDBMetrics` - получение метрик
     - `executeOperation(operation: string, collection: string, ...args): OperationResult` - выполнение операции
     - `executeAggregation(collection: string, pipeline: AggregationStage[]): AggregationResult` - выполнение aggregation
     - `getCollections(): Collection[]` - список коллекций
     - `getReplicaSetStatus(): ReplicaSetStatus` - статус replica set
     - `getShardingStatus(): ShardingStatus` - статус sharding

2. **Реализовать интерфейсы метрик MongoDB**
   ```typescript
   interface MongoDBMetrics {
     // Operations
     operationsPerSecond: number;
     insertsPerSecond: number;
     queriesPerSecond: number;
     updatesPerSecond: number;
     deletesPerSecond: number;
     commandsPerSecond: number;
     
     // Connections
     currentConnections: number;
     availableConnections: number;
     activeConnections: number;
     
     // Collections & Documents
     totalCollections: number;
     totalDocuments: number;
     totalIndexes: number;
     dataSize: number; // bytes
     storageSize: number; // bytes
     indexSize: number; // bytes
     
     // Performance
     averageQueryTime: number; // ms
     averageInsertTime: number; // ms
     averageUpdateTime: number; // ms
     averageDeleteTime: number; // ms
     p50QueryTime: number;
     p95QueryTime: number;
     p99QueryTime: number;
     
     // Cache (WiredTiger)
     cacheHitRatio: number; // 0-1
     cacheUsed: number; // bytes
     cacheTotal: number; // bytes
     
     // Replication
     replicationLag: number; // ms (0 if primary)
     replicaSetMembers: number;
     primaryMember?: string;
     
     // Sharding
     shardCount: number;
     totalChunks: number;
     chunkDistribution: Record<string, number>;
     balancerRunning: boolean;
     
     // Errors
     errorRate: number; // 0-1
     validationErrors: number;
     connectionErrors: number;
     
     // Utilization
     connectionUtilization: number; // 0-1
     storageUtilization: number; // 0-1
     cacheUtilization: number; // 0-1
   }
   ```

3. **Реализовать внутреннее состояние движка**
   - `collections: Map<string, CollectionState>` - состояние коллекций
   - `documents: Map<string, Document[]>` - документы по коллекциям
   - `indexes: Map<string, Index[]>` - индексы по коллекциям
   - `operations: Operation[]` - история операций
   - `activeOperations: Map<string, ActiveOperation>` - активные операции
   - `replicaSetState: ReplicaSetState` - состояние replica set
   - `shardingState: ShardingState` - состояние sharding
   - `changeStreams: Map<string, ChangeStream>` - активные change streams
   - `transactions: Map<string, Transaction>` - активные транзакции
   - `connectionPool: ConnectionPool` - пул соединений
   - `cache: WiredTigerCache` - кэш WiredTiger
   - `oplog: OplogEntry[]` - oplog для репликации

4. **Реализовать симуляцию Document Model**
   - Хранение документов как JSON объектов
   - Поддержка вложенных структур
   - Динамическая схема с optional validation
   - Embedded vs Referenced документы

5. **Реализовать симуляцию Aggregation Pipeline**
   - Реальное выполнение всех stages ($match, $group, $project, $sort, $limit, $skip, $unwind, $lookup, $facet, $bucket)
   - Поддержка expressions ($sum, $avg, $min, $max, $push, $addToSet)
   - Обработка ошибок в pipeline
   - Расчет времени выполнения pipeline

6. **Реализовать симуляцию Change Streams**
   - Генерация change events при операциях
   - Фильтрация по типу операции
   - Resume tokens для восстановления
   - Поддержка aggregation pipeline для фильтрации

7. **Реализовать симуляцию Transactions**
   - Multi-document transactions
   - Read/Write concerns
   - Retry logic для transient errors
   - Isolation levels

8. **Реализовать симуляцию Replication**
   - Primary/Secondary/Arbiter роли
   - Election для выбора primary
   - Heartbeat для мониторинга
   - Oplog для репликации операций
   - Replication lag calculation
   - Read preferences

9. **Реализовать симуляцию Sharding**
   - Chunk distribution
   - Shard key calculation
   - Balancer для перераспределения
   - Chunk migrations
   - Zone sharding

10. **Реализовать симуляцию Indexes**
    - Различные типы индексов (single, compound, text, geospatial, hashed, TTL)
    - Partial и sparse индексы
    - Background building
    - Влияние индексов на производительность запросов

11. **Реализовать симуляцию WiredTiger Storage Engine**
    - Document-level concurrency
    - Compression
    - Checkpoint
    - Cache hit ratio
    - Journal

12. **Реализовать Connection Pool**
    - Пул соединений с настраиваемыми параметрами
    - Активные/ожидающие соединения
    - Timeout для соединений
    - Connection metrics

### Этап 2: Интеграция MongoDBEmulationEngine в EmulationEngine

**Цель:** Интегрировать MongoDBEmulationEngine в основной EmulationEngine

**Задачи:**

1. **Добавить MongoDBEmulationEngine в EmulationEngine**
   - Поле `mongodbEmulationEngines: Map<string, MongoDBEmulationEngine>`
   - Метод `initializeMongoDBEmulationEngine(node: CanvasNode): void`
   - Метод `updateMongoDBMetrics(node: CanvasNode): void`

2. **Заменить общий simulateDatabase на специализированный для MongoDB**
   - В методе `simulateDatabase()` добавить проверку `if (node.type === 'mongodb')`
   - Использовать MongoDBEmulationEngine вместо общего кода
   - Обновлять метрики из MongoDBEmulationEngine

3. **Синхронизация конфига**
   - При изменении конфига в UI обновлять MongoDBEmulationEngine
   - При изменении коллекций/документов обновлять состояние движка
   - При изменении replica set/sharding обновлять состояние

### ✅ Этап 3: Расширение DataFlowEngine для MongoDB - ВЫПОЛНЕНО

**Цель:** Реализовать полную обработку MongoDB операций в DataFlowEngine

**Задачи:**

1. **Расширить обработку операций**
   - `insert`: использовать MongoDBEmulationEngine.executeOperation()
   - `update`: использовать MongoDBEmulationEngine.executeOperation()
   - `delete`: использовать MongoDBEmulationEngine.executeOperation()
   - `query`: использовать MongoDBEmulationEngine.executeOperation()
   - `aggregate`: использовать MongoDBEmulationEngine.executeAggregation()
   - `transaction`: использовать MongoDBEmulationEngine для transactions

2. **Реализовать обработку Change Streams**
   - Генерация change events при операциях
   - Отправка change events в подключенные компоненты
   - Поддержка resume tokens

3. **Реализовать обработку Transactions**
   - Multi-document transactions
   - Read/Write concerns
   - Retry logic

4. **Улучшить обработку Aggregation Pipeline**
   - Использовать реальный execution engine из MongoDBEmulationEngine
   - Поддержка всех stages и expressions
   - Обработка ошибок

### Этап 4: Расширение UI до уровня MongoDB Compass/Atlas

**Цель:** Довести UI до уровня реального MongoDB Compass/Atlas

**Задачи:**

1. **Улучшить таб Collections**
   - Отображение реальных метрик из симуляции (documentCount, size, indexes)
   - Визуализация индексов с типами
   - Schema Analysis (анализ структуры документов)
   - Collection Stats (реальные метрики из симуляции)

2. **Улучшить таб Documents**
   - Real-time обновление документов из симуляции
   - Улучшенный query builder (как в Compass)
   - Отображение query execution plan
   - История запросов
   - Поддержка различных форматов (JSON, Table, List)

3. **Улучшить таб Aggregations**
   - Визуальный builder для pipeline (drag & drop stages)
   - Real-time выполнение через MongoDBEmulationEngine
   - Отображение результатов с пагинацией
   - Сохранение pipeline для повторного использования
   - Поддержка всех stages и expressions

4. **Добавить таб Change Streams** (новый)
   - Создание change streams для коллекций
   - Фильтрация по типу операции
   - Real-time отображение change events
   - Resume tokens
   - Поддержка aggregation pipeline для фильтрации

5. **Добавить таб Transactions** (новый)
   - Создание и управление транзакциями
   - Отображение активных транзакций
   - Read/Write concerns настройки
   - История транзакций

6. **Улучшить таб Replication**
   - Real-time статус replica set (primary/secondary/arbiter)
   - Отображение replication lag
   - Heartbeat status
   - Oplog size и utilization
   - Election history

7. **Улучшить таб Sharding**
   - Real-time статус sharding
   - Chunk distribution visualization
   - Balancer status
   - Chunk migrations
   - Zone sharding configuration

8. **Добавить таб Performance** (новый)
   - Real-time метрики из MongoDBEmulationEngine
   - Operations per second (inserts, queries, updates, deletes)
   - Connection pool status
   - Cache hit ratio (WiredTiger)
   - Query performance (p50, p95, p99)
   - Slow operations

9. **Добавить таб Monitoring** (новый)
   - Server status (db.serverStatus())
   - Database stats (db.stats())
   - Collection stats (db.collection.stats())
   - Active operations
   - Current operations
   - Locks

10. **✅ Сделать табы адаптивными - ВЫПОЛНЕНО**
    - ✅ Табы переносятся на новую строку при узком экране
    - ✅ Подложка расширяется при переносе табов

### Этап 5: Синхронизация UI с симуляцией

**Цель:** Обеспечить полную синхронизацию UI с симуляцией в реальном времени

**Задачи:**

1. **Синхронизация коллекций**
   - Изменения в UI → MongoDBEmulationEngine
   - Изменения в симуляции → UI (real-time)

2. **Синхронизация документов**
   - Документы из симуляции отображаются в UI
   - Изменения документов в UI отражаются в симуляции
   - Real-time обновление при операциях

3. **Синхронизация метрик**
   - Метрики из MongoDBEmulationEngine отображаются в UI
   - Real-time обновление метрик
   - Визуализация метрик (графики, charts)

4. **Синхронизация Replica Set**
   - Статус replica set из симуляции отображается в UI
   - Изменения ролей отражаются в реальном времени

5. **Синхронизация Sharding**
   - Статус sharding из симуляции отображается в UI
   - Chunk distribution обновляется в реальном времени

6. **Синхронизация Change Streams**
   - Change events отображаются в UI в реальном времени
   - Подписка на change streams через UI

### Этап 6: Исправление неработающих элементов

**Цель:** Исправить все неработающие элементы UI

**Задачи:**

1. **Проверить все интерактивные элементы**
   - Кнопки (Add, Edit, Delete, Save, Cancel)
   - Формы и поля ввода
   - Переключатели и чекбоксы
   - Выпадающие списки
   - Модальные окна

2. **Исправить проблемы**
   - Добавить обработчики для всех действий
   - Исправить сохранение данных
   - Исправить индексацию в циклах
   - Исправить состояние компонентов

3. **Связать с симуляцией**
   - Синхронизация конфига с эмуляцией при изменениях
   - Отображение реальных метрик из эмуляции
   - Обновление UI при изменении состояния

### Этап 7: Очистка и оптимизация

**Цель:** Удалить ненужные элементы и оптимизировать код

**Задачи:**

1. **Удалить ненужные элементы**
   - Неиспользуемые кнопки/ссылки
   - Статические элементы без функциональности
   - Визуальные настройки, не влияющие на симуляцию

2. **Оптимизировать UI**
   - Убрать дублирование
   - Упростить навигацию
   - Оптимизировать layout

3. **Оптимизировать симуляцию**
   - Оптимизировать выполнение aggregation pipeline
   - Оптимизировать работу с документами
   - Оптимизировать расчет метрик

## Критерии качества

### Функциональность (10/10)
- [ ] Все функции MongoDB реализованы
- [ ] Все CRUD операции работают
- [ ] Aggregation Pipeline работает полностью
- [ ] Change Streams реализованы
- [ ] Transactions реализованы
- [ ] Replication симулируется реалистично
- [ ] Sharding симулируется реалистично
- [ ] Валидация данных корректна
- [ ] Обработка ошибок реализована

### UI/UX (10/10)
- [ ] Структура соответствует MongoDB Compass/Atlas
- [ ] Все элементы интерактивны
- [ ] Навигация интуитивна
- [ ] Визуальный стиль соответствует оригиналу
- [ ] Табы адаптивны
- [ ] Real-time обновление метрик
- [ ] Визуализация данных (графики, charts)

### Симулятивность (10/10)
- [ ] Компонент влияет на метрики системы
- [ ] Метрики отражают реальное состояние
- [ ] Конфигурация влияет на поведение
- [ ] Интеграция с другими компонентами работает
- [ ] Replication влияет на availability
- [ ] Sharding влияет на throughput
- [ ] Indexes влияют на query performance
- [ ] Change Streams генерируют события
- [ ] Transactions работают корректно

## Важные принципы

1. **Избегать хардкода**
   - Использовать конфигурацию и данные
   - Не использовать статические значения

2. **Реализовать реальную логику**
   - Не заглушки, а реальная симуляция
   - Учитывать уникальные особенности MongoDB

3. **Синхронизировать UI с симуляцией**
   - Показывать реальные данные
   - Real-time обновление

4. **Исправить все баги**
   - Ничего не должно быть сломано
   - Все элементы должны работать

5. **Оптимизировать UX**
   - Делать интерфейс удобным
   - Соответствовать оригиналу

6. **Не делать по аналогии с PostgreSQL**
   - MongoDB уникален, имеет свои особенности
   - Document model vs Relational model
   - Aggregation Pipeline vs SQL
   - Change Streams vs Triggers
   - Replication vs PostgreSQL replication
   - Sharding vs PostgreSQL partitioning

## Примеры вопросов для проверки

- Все ли кнопки работают?
- Сохраняются ли все изменения?
- Отображаются ли реальные метрики?
- Соответствует ли UI MongoDB Compass/Atlas?
- Влияет ли конфигурация на симуляцию?
- Работают ли Change Streams?
- Работают ли Transactions?
- Влияет ли Replication на метрики?
- Влияет ли Sharding на метрики?
- Есть ли ненужные элементы?

## Результат

Компонент должен:
- Работать как реальный MongoDB по функциональности
- Выглядеть как MongoDB Compass/Atlas по UI/UX
- Симулировать работу как реальный MongoDB
- Быть полностью интегрированным в систему симуляции
- Учитывать уникальные особенности MongoDB (не по аналогии с PostgreSQL)

# План разработки компонента PostgreSQL

## Анализ текущего состояния

### ✅ Что уже реализовано

1. **UI компонент (PostgreSQLConfigAdvanced.tsx)**
   - Табы: Schemas, Tables, Data Editor, Query Tool, Views, Roles, Connection
   - CRUD операции для таблиц, схем, представлений, ролей
   - Редактор данных таблиц
   - SQL Query Tool с выполнением запросов
   - Настройки подключения и connection pool
   - Настройки метрик (postgres_exporter)

2. **Query Engine (src/core/postgresql/)**
   - PostgreSQLQueryEngine - выполнение SQL запросов
   - PostgreSQLSQLParser - парсинг SQL
   - QueryPlanner - планирование запросов
   - TransactionManager - управление транзакциями
   - PermissionManager - управление правами
   - ConnectionPool - пул соединений

3. **Интеграция в DataFlowEngine**
   - Обработка SQL запросов через processPostgreSQLQuery()
   - Поддержка выполнения запросов из сообщений

4. **Базовая симуляция в EmulationEngine**
   - Инициализация ConnectionPool
   - Базовая симуляция запросов через пул
   - Простые метрики (throughput, latency, utilization)

### ❌ Что отсутствует или работает некорректно

1. **Отсутствует PostgreSQLEmulationEngine**
   - Нет специализированного движка симуляции (как у других компонентов)
   - Симуляция упрощенная, не учитывает реальные паттерны PostgreSQL
   - Метрики не соответствуют реальным метрикам PostgreSQL

2. **Метрики не соответствуют реальности**
   - Нет метрик из pg_stat_statements (топ запросы, медленные запросы)
   - Нет метрик из pg_stat_database (transactions, commits, rollbacks, bloat)
   - Нет метрик из pg_stat_user_tables (seq scans, index scans, dead tuples)
   - Нет метрик WAL (write-ahead log)
   - Нет метрик vacuum/autovacuum
   - Нет метрик locks и блокировок
   - Нет метрик replication lag (если настроена репликация)

3. **Синхронизация данных**
   - Данные таблиц в UI не синхронизируются с симуляцией
   - Результаты запросов не влияют на метрики
   - Изменения в UI не отражаются в симуляции в реальном времени

4. **Отсутствуют реальные паттерны PostgreSQL**
   - Нет симуляции WAL (Write-Ahead Log)
   - Нет симуляции checkpoint
   - Нет симуляции autovacuum
   - Нет симуляции bloat (раздувание таблиц)
   - Нет симуляции dead tuples
   - Нет симуляции locks и блокировок
   - Нет симуляции connection pool exhaustion
   - Нет симуляции slow queries

5. **UI/UX проблемы**
   - Табы не адаптивны (не переносятся на новую строку при узком экране)
   - Нет отображения реальных метрик из симуляции
   - Нет визуализации query plans
   - Нет истории запросов
   - Нет мониторинга активных соединений
   - Нет отображения блокировок
   - Нет мониторинга vacuum операций

6. **Интеграция Query Engine**
   - Query Engine не интегрирован в симуляцию
   - Запросы выполняются только через UI, не через DataFlowEngine
   - Результаты запросов не влияют на метрики

## План реализации

### ✅ Этап 1: Создание PostgreSQLEmulationEngine (ЗАВЕРШЕН)

**Цель:** Создать специализированный движок симуляции PostgreSQL, аналогичный другим компонентам (GraphQLEmulationEngine, SparkEmulationEngine и т.д.)

**Статус:** ✅ ВЫПОЛНЕНО
- ✅ Создан файл `src/core/PostgreSQLEmulationEngine.ts`
- ✅ Реализован класс `PostgreSQLEmulationEngine` со всеми методами
- ✅ Реализованы интерфейсы метрик PostgreSQL
- ✅ Реализовано внутреннее состояние движка
- ✅ Интегрирован с QueryEngine и ConnectionPool

**Задачи:**

1. **Создать файл `src/core/PostgreSQLEmulationEngine.ts`**
   - Класс `PostgreSQLEmulationEngine` с методами:
     - `initializeConfig(node: CanvasNode): void` - инициализация из конфига
     - `updateConfig(config: Partial<PostgreSQLConfig>): void` - обновление конфига
     - `updateMetrics(): void` - обновление метрик
     - `getMetrics(): PostgreSQLMetrics` - получение метрик
     - `executeQuery(sql: string): QueryExecutionResult` - выполнение запроса
     - `getActiveConnections(): ConnectionState[]` - активные соединения
     - `getTables(): PostgreSQLTable[]` - список таблиц
     - `getViews(): PostgreSQLView[]` - список представлений
     - `getSchemas(): PostgreSQLSchema[]` - список схем
     - `getRoles(): Role[]` - список ролей

2. **Интерфейсы метрик PostgreSQL**
   ```typescript
   interface PostgreSQLMetrics {
     // Connection metrics
     activeConnections: number;
     idleConnections: number;
     waitingConnections: number;
     totalConnections: number;
     maxConnections: number;
     connectionUtilization: number; // 0-1
     
     // Query metrics (from pg_stat_statements)
     queriesPerSecond: number;
     totalQueries: number;
     averageQueryTime: number;
     p50QueryTime: number;
     p95QueryTime: number;
     p99QueryTime: number;
     slowQueries: number; // queries > 1s
     
     // Database metrics (from pg_stat_database)
     transactionsPerSecond: number;
     commitsPerSecond: number;
     rollbacksPerSecond: number;
     databaseSize: number; // bytes
     bloatRatio: number; // 0-1, table bloat
     
     // Table metrics (from pg_stat_user_tables)
     totalTables: number;
     totalRows: number;
     totalIndexes: number;
     seqScansPerSecond: number;
     indexScansPerSecond: number;
     deadTuples: number;
     liveTuples: number;
     
     // Cache metrics
     cacheHitRatio: number; // 0-1, shared_buffers hit ratio
     indexCacheHitRatio: number; // 0-1
     
     // WAL metrics
     walWritten: number; // bytes per second
     walArchived: number; // bytes per second
     checkpointFrequency: number; // checkpoints per hour
     
     // Vacuum metrics
     autovacuumRunning: number;
     vacuumOperationsPerHour: number;
     lastVacuumTime: number;
     
     // Lock metrics
     activeLocks: number;
     blockedQueries: number;
     lockWaitTime: number; // ms
     
     // Replication metrics (if enabled)
     replicationLag: number; // ms
     replicationStatus: 'active' | 'inactive' | 'error';
     
     // Error metrics
     errorRate: number; // 0-1
     connectionErrors: number;
     queryErrors: number;
   }
   ```

3. **Внутреннее состояние движка**
   - История запросов для расчета метрик
   - Активные транзакции
   - Активные блокировки
   - История vacuum операций
   - WAL статистика
   - Статистика по таблицам (seq scans, index scans, dead tuples)

4. **Интеграция с QueryEngine**
   - Использовать существующий PostgreSQLQueryEngine для выполнения запросов
   - Отслеживать все запросы для метрик
   - Рассчитывать query plans и использовать их для метрик

5. **Интеграция с ConnectionPool**
   - Использовать существующий PostgreSQLConnectionPool
   - Отслеживать состояние пула для метрик

### ✅ Этап 2: Реализация реальных метрик PostgreSQL (ЗАВЕРШЕН)

**Цель:** Реализовать метрики, соответствующие реальным метрикам PostgreSQL

**Статус:** ✅ ВЫПОЛНЕНО
- ✅ Метрики из pg_stat_statements (queries per second, average/p50/p95/p99 query time, slow queries, top queries)
- ✅ Метрики из pg_stat_database (transactions, commits, rollbacks, database size, bloat ratio)
- ✅ Метрики из pg_stat_user_tables (seq scans, index scans, dead tuples, live tuples)
- ✅ Метрики WAL (wal written, wal archived, checkpoint frequency)
- ✅ Метрики vacuum/autovacuum (running, operations per hour, last vacuum time)
- ✅ Метрики locks (active locks, blocked queries, lock wait time)
- ✅ Метрики cache (cache hit ratio, index cache hit ratio)

**Задачи:**

1. **Метрики из pg_stat_statements**
   - Топ запросы по времени выполнения
   - Топ запросы по количеству вызовов
   - Медленные запросы (> 1s)
   - Процентили времени выполнения (p50, p95, p99)

2. **Метрики из pg_stat_database**
   - Количество транзакций в секунду
   - Количество коммитов/роллбэков
   - Размер базы данных
   - Bloat ratio (раздувание таблиц)

3. **Метрики из pg_stat_user_tables**
   - Sequential scans vs index scans
   - Dead tuples (мертвые строки)
   - Live tuples (живые строки)
   - Размер таблиц

4. **Метрики WAL**
   - Скорость записи в WAL
   - Частота checkpoint
   - Размер WAL файлов

5. **Метрики vacuum/autovacuum**
   - Количество запусков autovacuum
   - Время последнего vacuum
   - Статистика по dead tuples

6. **Метрики locks**
   - Количество активных блокировок
   - Заблокированные запросы
   - Время ожидания блокировок

7. **Метрики cache**
   - Cache hit ratio (shared_buffers)
   - Index cache hit ratio
   - Зависимость от паттернов запросов

### ✅ Этап 3: Симуляция реальных паттернов PostgreSQL (ЗАВЕРШЕН)

**Цель:** Симулировать реальное поведение PostgreSQL

**Статус:** ✅ ВЫПОЛНЕНО
- ✅ Симуляция WAL (Write-Ahead Log) - запись изменений в WAL, расчет размера
- ✅ Симуляция checkpoint - периодическая запись на диск
- ✅ Симуляция bloat (раздувание таблиц) - увеличение размера при UPDATE/DELETE, расчет dead tuples
- ✅ Симуляция vacuum/autovacuum - автоматический запуск при накоплении dead tuples
- ✅ Симуляция locks - блокировки при одновременных операциях
- ✅ Симуляция slow queries - запросы без индексов медленнее
- ✅ Симуляция connection pool exhaustion - ошибки при исчерпании пула

**Задачи:**

1. **Симуляция WAL (Write-Ahead Log)**
   - Запись всех изменений в WAL перед коммитом
   - Расчет размера WAL на основе операций записи
   - Симуляция checkpoint (периодическая запись на диск)

2. **Симуляция bloat (раздувание таблиц)**
   - Увеличение размера таблиц при UPDATE/DELETE
   - Расчет dead tuples
   - Влияние bloat на производительность

3. **Симуляция vacuum/autovacuum**
   - Автоматический запуск vacuum при накоплении dead tuples
   - Очистка dead tuples
   - Влияние на производительность

4. **Симуляция locks**
   - Блокировки при одновременных операциях
   - Deadlocks
   - Влияние на latency

5. **Симуляция slow queries**
   - Запросы без индексов = медленнее
   - Большие таблицы = медленнее
   - Сложные JOIN = медленнее

6. **Симуляция connection pool exhaustion**
   - Ошибки при исчерпании пула
   - Ожидание освобождения соединений
   - Влияние на error rate

### ✅ Этап 4: Интеграция в EmulationEngine (ЗАВЕРШЕН)

**Цель:** Интегрировать PostgreSQLEmulationEngine в основной движок симуляции

**Статус:** ✅ ВЫПОЛНЕНО
- ✅ Добавлен `postgresEmulationEngines: Map<string, PostgreSQLEmulationEngine>` в EmulationEngine
- ✅ Реализован метод `initializePostgreSQLEmulationEngine(node: CanvasNode)`
- ✅ Реализован метод `getPostgreSQLEmulationEngine(nodeId: string)`
- ✅ Обновлен `simulateDatabase()` для использования PostgreSQLEmulationEngine
- ✅ Реализована синхронизация конфигурации через `updateConfig()`
- ✅ Интегрирован с DataFlowEngine через `processPostgreSQLQuery()`

**Задачи:**

1. **Добавить в EmulationEngine**
   - `postgresEmulationEngines: Map<string, PostgreSQLEmulationEngine>`
   - Метод `initializePostgreSQLEmulationEngine(node: CanvasNode)`
   - Метод `getPostgreSQLEmulationEngine(nodeId: string)`
   - Метод `updatePostgreSQLMetrics(node: CanvasNode)`

2. **Обновить simulateDatabase()**
   - Использовать PostgreSQLEmulationEngine вместо упрощенной логики
   - Вызывать `updateMetrics()` на каждом цикле
   - Использовать реальные метрики из движка

3. **Синхронизация конфигурации**
   - Метод `syncPostgreSQLConfigFromUI(node: CanvasNode)`
   - Обновление таблиц, схем, представлений из UI
   - Обновление данных таблиц из UI

4. **Интеграция с DataFlowEngine**
   - Использовать PostgreSQLEmulationEngine для обработки SQL запросов
   - Обновлять метрики при выполнении запросов

### ✅ Этап 5: Синхронизация UI с симуляцией (ЗАВЕРШЕН)

**Цель:** Обеспечить двустороннюю синхронизацию между UI и симуляцией

**Статус:** ✅ ВЫПОЛНЕНО
- ✅ Добавлен useEffect для синхронизации конфигурации с emulationEngine
- ✅ Добавлен useEffect для периодического обновления метрик из симуляции
- ✅ Обновлено выполнение запросов через emulationEngine вместо прямого вызова QueryEngine
- ✅ Синхронизация данных таблиц после выполнения запросов
- ✅ Добавлен таб "Metrics" с отображением всех метрик PostgreSQL в реальном времени

**Задачи:**

1. **Обновление UI из симуляции**
   - useEffect для периодического обновления метрик
   - Отображение реальных метрик из PostgreSQLEmulationEngine
   - Обновление данных таблиц из симуляции (если изменены запросами)

2. **Обновление симуляции из UI**
   - При изменении таблиц в UI - обновлять в движке
   - При изменении данных в UI - обновлять в движке
   - При выполнении запроса в UI - выполнять в движке

3. **Отображение метрик в UI**
   - Добавить таб "Metrics" с реальными метриками
   - Графики метрик (queries per second, latency, cache hit ratio)
   - Таблица топ запросов
   - Мониторинг активных соединений
   - Мониторинг блокировок

4. **Визуализация query plans**
   - Отображение плана выполнения запроса
   - Показать используемые индексы
   - Показать estimated cost

### ✅ Этап 6: Улучшение UI/UX (ЗАВЕРШЕН)

**Цель:** Улучшить пользовательский опыт и соответствие реальному PostgreSQL

**Статус:** ✅ ВЫПОЛНЕНО
- ✅ Табы сделаны адаптивными (flex-wrap вместо grid-cols) - переносятся на новую строку при узком экране
- ✅ Добавлен таб "Metrics" с отображением всех метрик PostgreSQL:
  - Connection Metrics (active, idle, waiting connections, utilization)
  - Query Metrics (queries/sec, avg/p95 query time, slow queries)
  - Database Metrics (transactions/sec, commits/sec, database size, bloat ratio)
  - Table Metrics (total tables, total rows, dead/live tuples)
  - Cache Metrics (cache hit ratio, index cache hit ratio)
  - WAL & Vacuum Metrics (WAL written, checkpoints, autovacuum, vacuum ops)
  - Lock Metrics (active locks, blocked queries, lock wait time)
- ✅ Метрики обновляются в реальном времени (каждую секунду)

**Задачи:**

1. **Адаптивность табов**
   - Табы должны переноситься на новую строку при узком экране
   - Подложка должна расширяться

2. **Новый таб "Metrics"**
   - Отображение всех метрик PostgreSQL
   - Графики метрик
   - Таблица топ запросов
   - Мониторинг активных соединений

3. **Новый таб "Monitoring"**
   - Активные запросы
   - Блокировки
   - Vacuum операции
   - WAL статистика

4. **Улучшение Query Tool**
   - История запросов
   - Сохранение часто используемых запросов
   - Автодополнение SQL
   - Подсветка синтаксиса

5. **Улучшение Data Editor**
   - Пагинация для больших таблиц
   - Поиск и фильтрация
   - Экспорт данных

6. **Валидация**
   - Валидация SQL запросов перед выполнением
   - Валидация данных при редактировании
   - Показ ошибок валидации

### Этап 7: Интеграция с DataFlowEngine

**Цель:** Обеспечить обработку SQL запросов через DataFlowEngine

**Задачи:**

1. **Обновить processPostgreSQLQuery()**
   - Использовать PostgreSQLEmulationEngine вместо прямого вызова QueryEngine
   - Обновлять метрики при выполнении запросов
   - Возвращать реальные метрики выполнения

2. **Обработка различных типов сообщений**
   - SQL запросы в payload
   - Пакетные запросы
   - Транзакции

3. **Метрики для соединений**
   - Latency на основе реального времени выполнения
   - Throughput на основе количества запросов
   - Error rate на основе ошибок выполнения

### Этап 8: Тестирование и оптимизация

**Цель:** Убедиться, что все работает корректно и эффективно

**Задачи:**

1. **Тестирование функциональности**
   - Все CRUD операции работают
   - Запросы выполняются корректно
   - Метрики рассчитываются правильно
   - Синхронизация UI ↔ симуляция работает

2. **Тестирование производительности**
   - Симуляция не замедляет работу при большом количестве таблиц
   - Метрики обновляются в реальном времени
   - Нет утечек памяти

3. **Оптимизация**
   - Оптимизация расчета метрик
   - Оптимизация синхронизации данных
   - Кэширование где возможно

## Критерии качества

### Функциональность (10/10)
- [ ] Все функции реального PostgreSQL реализованы
- [ ] Все CRUD операции работают
- [ ] SQL запросы выполняются корректно
- [ ] Транзакции работают
- [ ] Валидация данных корректна
- [ ] Обработка ошибок реализована

### UI/UX (10/10)
- [ ] Структура соответствует реальному PostgreSQL
- [ ] Все элементы интерактивны
- [ ] Навигация интуитивна
- [ ] Табы адаптивны
- [ ] Метрики отображаются в реальном времени
- [ ] Визуальный стиль соответствует оригиналу

### Симулятивность (10/10)
- [ ] Компонент влияет на метрики системы
- [ ] Метрики отражают реальное состояние
- [ ] Конфигурация влияет на поведение
- [ ] Интеграция с другими компонентами работает
- [ ] Реальные паттерны PostgreSQL симулируются
- [ ] Метрики соответствуют реальным метрикам PostgreSQL

## Приоритеты реализации

1. **Высокий приоритет:**
   - Создание PostgreSQLEmulationEngine
   - Реализация базовых метрик
   - Интеграция в EmulationEngine
   - Синхронизация UI ↔ симуляция

2. **Средний приоритет:**
   - Реализация расширенных метрик
   - Симуляция реальных паттернов PostgreSQL
   - Улучшение UI/UX

3. **Низкий приоритет:**
   - Оптимизация производительности
   - Дополнительные функции мониторинга

## Заметки

- Не использовать хардкод - все должно быть основано на конфигурации и данных
- Реализовать реальную логику - не заглушки
- Синхронизировать UI с симуляцией - показывать реальные данные
- Исправлять все баги - ничего не должно быть сломано
- Оптимизировать UX - делать интерфейс удобным
- Следовать правилам из .cursor/rules/ - защитное программирование, валидация, обработка ошибок

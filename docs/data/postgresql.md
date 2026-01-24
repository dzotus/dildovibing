# PostgreSQL - Документация компонента

## Обзор

PostgreSQL - это мощная объектно-реляционная система управления базами данных с открытым исходным кодом. Компонент PostgreSQL в системе симуляции полностью эмулирует поведение реального PostgreSQL, включая схемы, таблицы, представления, роли, connection pooling, выполнение SQL запросов, транзакции, управление правами доступа, WAL (Write-Ahead Log), vacuum/autovacuum, блокировки и полный набор метрик производительности.

### Основные возможности

- ✅ **Schemas** - Управление схемами базы данных
- ✅ **Tables** - Создание и управление таблицами с колонками, индексами, constraints
- ✅ **Views** - Создание и управление представлениями (views)
- ✅ **Roles** - Управление ролями и правами доступа
- ✅ **Connection Pool** - Пул соединений с настраиваемыми параметрами
- ✅ **Query Engine** - Выполнение SQL запросов (SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, ALTER)
- ✅ **Transactions** - Поддержка транзакций с уровнями изоляции
- ✅ **Permissions** - Управление правами доступа к таблицам
- ✅ **WAL (Write-Ahead Log)** - Симуляция WAL для надежности
- ✅ **Vacuum/Autovacuum** - Автоматическая очистка dead tuples
- ✅ **Query Planning** - Планирование запросов с использованием индексов
- ✅ **Метрики в реальном времени** - Полный набор метрик PostgreSQL (pg_stat_statements, pg_stat_database, pg_stat_user_tables, WAL, vacuum, locks)

---

## Основные функции

### 1. Управление Connection (Подключение)

**Описание:** Настройка подключения к базе данных PostgreSQL.

**Параметры подключения:**
- **host** - Хост базы данных (по умолчанию: `localhost`)
- **port** - Порт базы данных (по умолчанию: `5432`)
- **database** - Имя базы данных (по умолчанию: `postgres`)
- **username** - Имя пользователя (по умолчанию: `postgres`)
- **password** - Пароль (опционально)

**Connection Pool Configuration:**
- **maxConnections** - Максимальное количество соединений (по умолчанию: 100)
- **minConnections** - Минимальное количество соединений (по умолчанию: 0)
- **idleTimeout** - Таймаут простоя соединения в миллисекундах (по умолчанию: 300000ms = 5 минут)
- **maxLifetime** - Максимальное время жизни соединения в миллисекундах (по умолчанию: 3600000ms = 1 час)
- **connectionTimeout** - Таймаут подключения в миллисекундах (по умолчанию: 5000ms = 5 секунд)
- **queryLatency** - Базовая задержка выполнения запросов в миллисекундах (по умолчанию: 10ms)

**Пример конфигурации:**
```json
{
  "host": "localhost",
  "port": 5432,
  "database": "postgres",
  "username": "postgres",
  "password": "",
  "maxConnections": 100,
  "minConnections": 0,
  "idleTimeout": 300000,
  "maxLifetime": 3600000,
  "connectionTimeout": 5000,
  "queryLatency": 10
}
```

### 2. Управление Schemas (Схемы)

**Описание:** Схемы используются для организации объектов базы данных в логические группы.

**Параметры Schema:**
- **name** - Имя схемы (обязательно, уникальное)
- **owner** - Владелец схемы (по умолчанию: `postgres`)

**Системные схемы:**
- `public` - Схема по умолчанию для пользовательских объектов
- `information_schema` - Системная схема с метаданными

**Пример конфигурации:**
```json
{
  "schemas": [
    { "name": "public", "owner": "postgres" },
    { "name": "app", "owner": "app_user" },
    { "name": "analytics", "owner": "analytics_user" }
  ],
  "currentSchema": "public"
}
```

### 3. Управление Tables (Таблицы)

**Описание:** Таблицы хранят данные в реляционном формате.

**Параметры Table:**
- **name** - Имя таблицы (обязательно, уникальное в рамках схемы)
- **schema** - Имя схемы (по умолчанию: `public`)
- **columns** - Список колонок (обязательно, массив)
- **indexes** - Список индексов (опционально, массив строк)
- **constraints** - Список constraints (опционально, массив строк)
- **data** - Данные таблицы (опционально, массив строк)
- **comment** - Комментарий к таблице (опционально)

**Параметры Column:**
- **name** - Имя колонки (обязательно)
- **type** - Тип данных (обязательно): `SERIAL`, `INTEGER`, `BIGINT`, `VARCHAR(n)`, `TEXT`, `BOOLEAN`, `DATE`, `TIMESTAMP`, `DECIMAL(p,s)`, и т.д.
- **nullable** - Может ли быть NULL (по умолчанию: `true`)
- **default** - Значение по умолчанию (опционально)
- **primaryKey** - Является ли первичным ключом (по умолчанию: `false`)
- **comment** - Комментарий к колонке (опционально)

**Пример конфигурации:**
```json
{
  "tables": [
    {
      "name": "users",
      "schema": "public",
      "columns": [
        {
          "name": "id",
          "type": "SERIAL",
          "nullable": false,
          "primaryKey": true
        },
        {
          "name": "username",
          "type": "VARCHAR(50)",
          "nullable": false
        },
        {
          "name": "email",
          "type": "VARCHAR(100)",
          "nullable": false
        },
        {
          "name": "created_at",
          "type": "TIMESTAMP",
          "nullable": false,
          "default": "CURRENT_TIMESTAMP"
        }
      ],
      "indexes": ["idx_users_email", "idx_users_username"],
      "constraints": ["UNIQUE(username)", "UNIQUE(email)"],
      "data": [
        {
          "id": 1,
          "username": "john_doe",
          "email": "john@example.com",
          "created_at": "2024-01-01T00:00:00Z"
        }
      ]
    }
  ]
}
```

### 4. Управление Views (Представления)

**Описание:** Views - это виртуальные таблицы, основанные на результатах SQL запроса.

**Параметры View:**
- **name** - Имя представления (обязательно, уникальное в рамках схемы)
- **schema** - Имя схемы (по умолчанию: `public`)
- **definition** - SQL определение представления (обязательно)

**Пример конфигурации:**
```json
{
  "views": [
    {
      "name": "user_summary",
      "schema": "public",
      "definition": "SELECT id, username, email FROM users WHERE created_at > '2024-01-01'"
    }
  ]
}
```

### 5. Управление Roles (Роли)

**Описание:** Roles определяют пользователей и их права доступа к базе данных.

**Параметры Role:**
- **name** - Имя роли (обязательно, уникальное)
- **login** - Может ли роль подключаться к базе данных (по умолчанию: `false`)
- **superuser** - Является ли роль суперпользователем (по умолчанию: `false`)

**Системные роли:**
- `postgres` - Суперпользователь по умолчанию (login: true, superuser: true)
- `app_user` - Пользователь приложения (login: true, superuser: false)
- `readonly` - Роль только для чтения (login: true, superuser: false)

**Пример конфигурации:**
```json
{
  "roles": [
    { "name": "postgres", "login": true, "superuser": true },
    { "name": "app_user", "login": true, "superuser": false },
    { "name": "readonly", "login": true, "superuser": false }
  ]
}
```

### 6. Query Engine (Движок запросов)

**Описание:** Query Engine выполняет SQL запросы против таблиц и представлений.

**Поддерживаемые операции:**
- **SELECT** - Выборка данных
- **INSERT** - Вставка данных
- **UPDATE** - Обновление данных
- **DELETE** - Удаление данных
- **CREATE TABLE** - Создание таблиц
- **DROP TABLE** - Удаление таблиц
- **ALTER TABLE** - Изменение таблиц
- **BEGIN/COMMIT/ROLLBACK** - Управление транзакциями

**Query Planning:**
- Query Engine анализирует запрос и создает план выполнения
- Использует индексы для оптимизации запросов
- Определяет, нужен ли sequential scan или index scan
- Оценивает стоимость выполнения запроса

**Примеры запросов:**
```sql
-- SELECT с WHERE
SELECT * FROM users WHERE email = 'john@example.com';

-- SELECT с JOIN
SELECT u.username, o.order_id 
FROM users u 
JOIN orders o ON u.id = o.user_id;

-- INSERT
INSERT INTO users (username, email) 
VALUES ('jane_doe', 'jane@example.com');

-- UPDATE
UPDATE users SET email = 'newemail@example.com' WHERE id = 1;

-- DELETE
DELETE FROM users WHERE id = 1;
```

### 7. Transactions (Транзакции)

**Описание:** Транзакции обеспечивают атомарность операций.

**Уровни изоляции:**
- **READ UNCOMMITTED** - Чтение незафиксированных данных (низкий уровень изоляции)
- **READ COMMITTED** - Чтение только зафиксированных данных (по умолчанию)
- **REPEATABLE READ** - Повторяемое чтение
- **SERIALIZABLE** - Сериализуемый уровень (высокий уровень изоляции)

**Управление транзакциями:**
```sql
-- Начало транзакции
BEGIN;
-- или
BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;

-- Коммит транзакции
COMMIT;

-- Откат транзакции
ROLLBACK;
```

**Как работает:**
- Все запросы внутри транзакции выполняются атомарно
- При ошибке транзакция автоматически откатывается
- Транзакции отслеживаются в `PostgreSQLEmulationEngine`

### 8. Connection Pool (Пул соединений)

**Описание:** Connection Pool управляет соединениями с базой данных для оптимизации производительности.

**Состояния соединений:**
- **idle** - Соединение свободно и готово к использованию
- **active** - Соединение активно выполняет запрос
- **waiting** - Соединение ожидает освобождения пула
- **terminated** - Соединение завершено

**Метрики пула:**
- **totalConnections** - Общее количество соединений
- **activeConnections** - Количество активных соединений
- **idleConnections** - Количество свободных соединений
- **waitingConnections** - Количество ожидающих соединений
- **utilization** - Загрузка пула (0-1)

**Как работает:**
- При запросе соединения пул пытается переиспользовать idle соединение
- Если нет свободных соединений и не достигнут maxConnections, создается новое
- Если пул исчерпан, запрос получает ошибку "Connection pool exhausted"
- Idle соединения автоматически закрываются после idleTimeout
- Соединения автоматически закрываются после maxLifetime

### 9. WAL (Write-Ahead Log)

**Описание:** WAL - это механизм надежности PostgreSQL, который записывает все изменения в лог перед записью на диск.

**Как работает:**
- Все операции записи (INSERT, UPDATE, DELETE) записываются в WAL
- WAL обеспечивает надежность и возможность восстановления
- Checkpoint периодически записывает WAL на диск и очищает его

**Метрики WAL:**
- **walWritten** - Скорость записи в WAL (bytes/sec)
- **walArchived** - Скорость архивации WAL (bytes/sec)
- **checkpointFrequency** - Частота checkpoint (checkpoints/hour)
- **walSize** - Текущий размер WAL (bytes)

**Симуляция:**
- WAL записывается при каждой операции записи
- Размер WAL оценивается как ~50 bytes на строку
- Checkpoint выполняется каждые 5 минут (CHECKPOINT_INTERVAL = 300000ms)

### 10. Vacuum и Autovacuum

**Описание:** Vacuum очищает dead tuples (мертвые строки) из таблиц.

**Dead Tuples:**
- Dead tuples создаются при UPDATE и DELETE операциях
- Они занимают место, но не используются
- Autovacuum автоматически запускается при накоплении dead tuples

**Параметры:**
- **AUTOVACUUM_THRESHOLD** - Порог для запуска autovacuum (по умолчанию: 20% dead tuples)
- **vacuumOperationsPerHour** - Количество операций vacuum в час
- **lastVacuumTime** - Время последнего vacuum

**Как работает:**
- При UPDATE старые версии строк становятся dead tuples
- При DELETE строки становятся dead tuples
- Autovacuum запускается автоматически, когда dead tuples > 20% от общего количества
- Vacuum удаляет dead tuples и освобождает место

**Метрики:**
- **autovacuumRunning** - Количество запущенных autovacuum операций
- **vacuumOperationsPerHour** - Количество операций vacuum в час
- **lastVacuumTime** - Время последнего vacuum
- **deadTuples** - Общее количество dead tuples во всех таблицах

### 11. Locks (Блокировки)

**Описание:** Locks обеспечивают целостность данных при одновременных операциях.

**Типы блокировок:**
- **SHARE** - Разделяемая блокировка (для чтения)
- **EXCLUSIVE** - Исключительная блокировка (для записи)
- **ROW EXCLUSIVE** - Блокировка строки для записи
- **SHARE ROW EXCLUSIVE** - Разделяемая блокировка строки
- **ACCESS EXCLUSIVE** - Полная блокировка таблицы

**Метрики:**
- **activeLocks** - Количество активных блокировок
- **blockedQueries** - Количество заблокированных запросов
- **lockWaitTime** - Время ожидания блокировок (ms)

### 12. Query Planning и Index Usage

**Описание:** Query Planner анализирует запросы и выбирает оптимальный план выполнения.

**Типы сканирования:**
- **Sequential Scan** - Последовательное сканирование всей таблицы (медленнее)
- **Index Scan** - Сканирование с использованием индекса (быстрее)

**Как работает:**
- Planner анализирует WHERE условия и определяет, можно ли использовать индекс
- Если индекс доступен и селективен, используется Index Scan
- Если индекс недоступен или не селективен, используется Sequential Scan

**Метрики:**
- **seqScansPerSecond** - Количество sequential scans в секунду
- **indexScansPerSecond** - Количество index scans в секунду
- **cacheHitRatio** - Процент попаданий в кэш (0-1)
- **indexCacheHitRatio** - Процент попаданий в индексный кэш (0-1)

---

## Руководство пользователя

### Быстрый старт

1. **Добавление компонента PostgreSQL:**
   - Перетащите компонент "PostgreSQL" из библиотеки компонентов на canvas
   - Откройте панель конфигурации компонента

2. **Настройка подключения:**
   - Перейдите на вкладку **"Connection"**
   - Укажите host, port, database, username, password
   - Настройте параметры connection pool

3. **Создание схемы:**
   - Перейдите на вкладку **"Schemas"**
   - Нажмите кнопку **"Add Schema"**
   - Укажите имя схемы и владельца

4. **Создание таблицы:**
   - Перейдите на вкладку **"Tables"**
   - Нажмите кнопку **"Add Table"**
   - Укажите имя таблицы, схему, добавьте колонки
   - Добавьте индексы и constraints при необходимости

5. **Выполнение запросов:**
   - Перейдите на вкладку **"Query Tool"**
   - Введите SQL запрос
   - Нажмите кнопку **"Execute"**
   - Просмотрите результаты

### Работа со Schemas

#### Создание схемы

1. Перейдите на вкладку **"Schemas"**
2. Нажмите кнопку **"Add Schema"**
3. Заполните параметры:
   - **Name** - Имя схемы (уникальное)
   - **Owner** - Владелец схемы
4. Нажмите **"Save"**

#### Редактирование схемы

1. Выберите схему из списка
2. Нажмите кнопку **"Edit"** (иконка карандаша)
3. Измените параметры
4. Нажмите **"Save"**

#### Удаление схемы

1. Выберите схему из списка
2. Нажмите кнопку **"Delete"** (иконка корзины)
3. Подтвердите удаление

**Примечание:** Нельзя удалить схему, если в ней есть таблицы или представления.

### Работа с Tables

#### Создание таблицы

1. Перейдите на вкладку **"Tables"**
2. Нажмите кнопку **"Add Table"**
3. Заполните параметры:
   - **Name** - Имя таблицы (уникальное в рамках схемы)
   - **Schema** - Схема таблицы
   - **Columns** - Добавьте колонки:
     - Name, Type, Nullable, Default, Primary Key
   - **Indexes** - Добавьте индексы (опционально)
   - **Constraints** - Добавьте constraints (опционально)
4. Нажмите **"Save"**

#### Редактирование таблицы

1. Выберите таблицу из списка
2. Нажмите кнопку **"Edit"** (иконка карандаша)
3. Измените параметры:
   - Добавьте/удалите колонки
   - Измените индексы и constraints
4. Нажмите **"Save"**

#### Удаление таблицы

1. Выберите таблицу из списка
2. Нажмите кнопку **"Delete"** (иконка корзины)
3. Подтвердите удаление

### Работа с Data Editor

#### Просмотр данных таблицы

1. Перейдите на вкладку **"Data Editor"**
2. Выберите схему и таблицу из выпадающих списков
3. Данные таблицы отобразятся в таблице

#### Редактирование данных

1. Выберите строку в таблице
2. Нажмите кнопку **"Edit"** (иконка карандаша)
3. Измените значения в полях
4. Нажмите **"Save"**

#### Добавление строки

1. Нажмите кнопку **"Add Row"**
2. Заполните поля новой строки
3. Нажмите **"Save"**

#### Удаление строки

1. Выберите строку в таблице
2. Нажмите кнопку **"Delete"** (иконка корзины)
3. Подтвердите удаление

### Работа с Query Tool

#### Выполнение SQL запроса

1. Перейдите на вкладку **"Query Tool"**
2. Введите SQL запрос в текстовом поле
3. Нажмите кнопку **"Execute"** (иконка Play)
4. Просмотрите результаты в таблице ниже

#### Примеры запросов

```sql
-- Простой SELECT
SELECT * FROM users;

-- SELECT с WHERE
SELECT * FROM users WHERE email = 'john@example.com';

-- SELECT с JOIN
SELECT u.username, o.order_id 
FROM users u 
JOIN orders o ON u.id = o.user_id;

-- INSERT
INSERT INTO users (username, email) 
VALUES ('jane_doe', 'jane@example.com');

-- UPDATE
UPDATE users SET email = 'newemail@example.com' WHERE id = 1;

-- DELETE
DELETE FROM users WHERE id = 1;
```

#### Транзакции

```sql
-- Начало транзакции
BEGIN;

-- Выполнение операций
INSERT INTO users (username, email) VALUES ('user1', 'user1@example.com');
UPDATE users SET email = 'updated@example.com' WHERE id = 1;

-- Коммит транзакции
COMMIT;

-- Или откат
ROLLBACK;
```

### Работа с Views

#### Создание представления

1. Перейдите на вкладку **"Views"**
2. Нажмите кнопку **"Add View"**
3. Заполните параметры:
   - **Name** - Имя представления
   - **Schema** - Схема представления
   - **Definition** - SQL определение представления
4. Нажмите **"Save"**

#### Редактирование представления

1. Выберите представление из списка
2. Нажмите кнопку **"Edit"** (иконка карандаша)
3. Измените определение
4. Нажмите **"Save"**

### Работа с Roles

#### Создание роли

1. Перейдите на вкладку **"Roles"**
2. Нажмите кнопку **"Add Role"**
3. Заполните параметры:
   - **Name** - Имя роли
   - **Login** - Может ли роль подключаться
   - **Superuser** - Является ли суперпользователем
4. Нажмите **"Save"**

### Schema Diagram

1. Перейдите на вкладку **"Schema Diagram"**
2. Просмотрите визуальную диаграмму схемы базы данных
3. Таблицы отображаются как прямоугольники с колонками
4. Связи между таблицами отображаются как линии

### Импорт/Экспорт схемы

#### Импорт схемы

1. Перейдите на вкладку **"Tables"** или **"Schemas"**
2. Нажмите кнопку **"Import SQL"**
3. Вставьте SQL код создания таблиц
4. Нажмите **"Import"**
5. Таблицы будут созданы автоматически

#### Экспорт схемы

1. Перейдите на вкладку **"Tables"** или **"Schema Diagram"**
2. Нажмите кнопку **"Export"**
3. Выберите формат экспорта:
   - **SQL** - SQL DDL код
   - **Mermaid** - Mermaid диаграмма
   - **DBML** - DBML формат
   - **Documentation** - Markdown документация
4. Скопируйте экспортированный код

---

## Руководство администратора

### Рекомендации по конфигурации

#### Production PostgreSQL

```json
{
  "host": "postgres.production.internal",
  "port": 5432,
  "database": "production_db",
  "username": "app_user",
  "password": "***",
  "maxConnections": 200,
  "minConnections": 10,
  "idleTimeout": 600000,
  "maxLifetime": 7200000,
  "connectionTimeout": 5000,
  "queryLatency": 5
}
```

**Рекомендации:**
- Используйте отдельные схемы для разных приложений
- Настройте connection pool в зависимости от нагрузки
- Используйте индексы для часто используемых колонок
- Регулярно выполняйте VACUUM для очистки dead tuples
- Мониторьте метрики производительности

#### Оптимизация производительности

**Connection Pool:**
- Установите `maxConnections` в зависимости от нагрузки
  - Обычно: 50-200 соединений для большинства случаев
  - Высоконагруженные системы: 200-500 соединений
- Установите `minConnections` для поддержания минимального пула
- Настройте `idleTimeout` для освобождения неиспользуемых соединений

**Индексы:**
- Создавайте индексы для колонок, используемых в WHERE условиях
- Создавайте индексы для колонок, используемых в JOIN
- Избегайте избыточных индексов (они замедляют INSERT/UPDATE)
- Мониторьте использование индексов через метрики

**Vacuum:**
- Autovacuum запускается автоматически при накоплении dead tuples
- Мониторьте `deadTuples` и `bloatRatio`
- При необходимости запускайте VACUUM вручную

**Query Optimization:**
- Используйте EXPLAIN для анализа планов запросов
- Избегайте SELECT * - выбирайте только нужные колонки
- Используйте LIMIT для больших выборок
- Оптимизируйте JOIN - используйте индексы на ключах соединения

### Безопасность

#### Управление ролями

- Создавайте отдельные роли для разных приложений
- Используйте принцип наименьших привилегий
- Не используйте суперпользователя для приложений
- Регулярно проверяйте права доступа

#### Защита паролей

- Используйте сильные пароли
- Не храните пароли в открытом виде в конфигурации
- Используйте переменные окружения для паролей

### Мониторинг и алертинг

#### Ключевые метрики

1. **Queries Per Second**
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

6. **Dead Tuples**
   - Нормальное значение: < 10% от общего количества строк
   - Алерт: dead tuples > 20% (необходим VACUUM)

7. **Bloat Ratio**
   - Нормальное значение: < 0.1 (10%)
   - Алерт: bloat ratio > 0.2 (20%) (необходим VACUUM)

8. **Active Locks**
   - Нормальное значение: < 10
   - Алерт: active locks > 50 (возможны блокировки)

9. **Blocked Queries**
   - Нормальное значение: 0
   - Алерт: blocked queries > 5 (возможны deadlocks)

10. **Slow Queries**
    - Нормальное значение: < 1% от общего количества
    - Алерт: slow queries > 5% (необходима оптимизация)

---

## Метрики и мониторинг

### Основные метрики

#### Throughput
- **Описание:** Количество запросов в секунду
- **Единица измерения:** queries/sec
- **Источник:** Рассчитывается из истории запросов за последнюю секунду

#### Latency
- **Описание:** Задержка выполнения запросов
- **Единица измерения:** миллисекунды (ms)
- **Percentiles:** P50, P95, P99
- **Факторы влияния:**
  - Размер таблиц
  - Использование индексов
  - Сложность запросов
  - Нагрузка на базу данных

#### Error Rate
- **Описание:** Процент ошибок при выполнении запросов
- **Единица измерения:** процент (0-1)
- **Причины ошибок:**
  - Синтаксические ошибки SQL
  - Ошибки доступа (permissions)
  - Ошибки транзакций
  - Connection pool exhausted

#### Utilization
- **Описание:** Загрузка connection pool
- **Единица измерения:** процент (0-1)
- **Расчет:** activeConnections / maxConnections

### Метрики Connection Pool

- **activeConnections** - Количество активных соединений
- **idleConnections** - Количество свободных соединений
- **waitingConnections** - Количество ожидающих соединений
- **totalConnections** - Общее количество соединений
- **maxConnections** - Максимальное количество соединений
- **connectionUtilization** - Загрузка пула (0-1)

### Метрики Query Performance (pg_stat_statements)

- **queriesPerSecond** - Количество запросов в секунду
- **totalQueries** - Общее количество запросов
- **averageQueryTime** - Среднее время выполнения запросов (ms)
- **p50QueryTime** - 50-й перцентиль времени выполнения (ms)
- **p95QueryTime** - 95-й перцентиль времени выполнения (ms)
- **p99QueryTime** - 99-й перцентиль времени выполнения (ms)
- **slowQueries** - Количество медленных запросов (> 1s)
- **topQueries** - Топ запросов по времени выполнения

### Метрики Database (pg_stat_database)

- **transactionsPerSecond** - Количество транзакций в секунду
- **commitsPerSecond** - Количество коммитов в секунду
- **rollbacksPerSecond** - Количество роллбэков в секунду
- **databaseSize** - Размер базы данных (bytes)
- **bloatRatio** - Коэффициент раздувания таблиц (0-1)

### Метрики Tables (pg_stat_user_tables)

- **totalTables** - Количество таблиц
- **totalRows** - Общее количество строк
- **totalIndexes** - Общее количество индексов
- **seqScansPerSecond** - Количество sequential scans в секунду
- **indexScansPerSecond** - Количество index scans в секунду
- **deadTuples** - Количество dead tuples
- **liveTuples** - Количество live tuples

### Метрики Cache

- **cacheHitRatio** - Процент попаданий в кэш (0-1)
- **indexCacheHitRatio** - Процент попаданий в индексный кэш (0-1)

### Метрики WAL

- **walWritten** - Скорость записи в WAL (bytes/sec)
- **walArchived** - Скорость архивации WAL (bytes/sec)
- **checkpointFrequency** - Частота checkpoint (checkpoints/hour)

### Метрики Vacuum

- **autovacuumRunning** - Количество запущенных autovacuum операций
- **vacuumOperationsPerHour** - Количество операций vacuum в час
- **lastVacuumTime** - Время последнего vacuum (timestamp)

### Метрики Locks

- **activeLocks** - Количество активных блокировок
- **blockedQueries** - Количество заблокированных запросов
- **lockWaitTime** - Время ожидания блокировок (ms)

### Метрики Replication (если включена)

- **replicationLag** - Задержка репликации (ms)
- **replicationStatus** - Статус репликации: `active`, `inactive`, `error`

### Метрики Errors

- **errorRate** - Процент ошибок (0-1)
- **connectionErrors** - Количество ошибок подключения
- **queryErrors** - Количество ошибок выполнения запросов

### Мониторинг в реальном времени

Все метрики обновляются в реальном времени во время симуляции:
- Метрики синхронизируются из `PostgreSQLEmulationEngine` каждую секунду
- Метрики отображаются на вкладке **"Metrics"** в UI
- История запросов хранится для расчета метрик

---

## Примеры использования

### Пример 1: Простая база данных с одной таблицей

**Сценарий:** База данных для хранения пользователей

```json
{
  "host": "localhost",
  "port": 5432,
  "database": "app_db",
  "username": "app_user",
  "schemas": [
    { "name": "public", "owner": "app_user" }
  ],
  "tables": [
    {
      "name": "users",
      "schema": "public",
      "columns": [
        {
          "name": "id",
          "type": "SERIAL",
          "nullable": false,
          "primaryKey": true
        },
        {
          "name": "username",
          "type": "VARCHAR(50)",
          "nullable": false
        },
        {
          "name": "email",
          "type": "VARCHAR(100)",
          "nullable": false
        }
      ],
      "indexes": ["idx_users_email"]
    }
  ]
}
```

### Пример 2: База данных с несколькими схемами

**Сценарий:** Разделение данных по схемам

```json
{
  "schemas": [
    { "name": "public", "owner": "postgres" },
    { "name": "app", "owner": "app_user" },
    { "name": "analytics", "owner": "analytics_user" }
  ],
  "tables": [
    {
      "name": "users",
      "schema": "app",
      "columns": [
        { "name": "id", "type": "SERIAL", "nullable": false, "primaryKey": true },
        { "name": "username", "type": "VARCHAR(50)", "nullable": false }
      ]
    },
    {
      "name": "events",
      "schema": "analytics",
      "columns": [
        { "name": "id", "type": "SERIAL", "nullable": false, "primaryKey": true },
        { "name": "user_id", "type": "INTEGER", "nullable": false },
        { "name": "event_type", "type": "VARCHAR(50)", "nullable": false },
        { "name": "timestamp", "type": "TIMESTAMP", "nullable": false }
      ],
      "indexes": ["idx_events_user_id", "idx_events_timestamp"]
    }
  ]
}
```

### Пример 3: База данных с представлениями

**Сценарий:** Использование views для упрощения запросов

```json
{
  "tables": [
    {
      "name": "users",
      "schema": "public",
      "columns": [
        { "name": "id", "type": "SERIAL", "nullable": false, "primaryKey": true },
        { "name": "username", "type": "VARCHAR(50)", "nullable": false },
        { "name": "email", "type": "VARCHAR(100)", "nullable": false },
        { "name": "created_at", "type": "TIMESTAMP", "nullable": false }
      ]
    },
    {
      "name": "orders",
      "schema": "public",
      "columns": [
        { "name": "id", "type": "SERIAL", "nullable": false, "primaryKey": true },
        { "name": "user_id", "type": "INTEGER", "nullable": false },
        { "name": "total", "type": "DECIMAL(10,2)", "nullable": false }
      ]
    }
  ],
  "views": [
    {
      "name": "user_orders_summary",
      "schema": "public",
      "definition": "SELECT u.id, u.username, COUNT(o.id) as order_count, SUM(o.total) as total_spent FROM users u LEFT JOIN orders o ON u.id = o.user_id GROUP BY u.id, u.username"
    }
  ]
}
```

### Пример 4: Production конфигурация

**Сценарий:** Production база данных с оптимизированными настройками

```json
{
  "host": "postgres.production.internal",
  "port": 5432,
  "database": "production_db",
  "username": "app_user",
  "maxConnections": 200,
  "minConnections": 20,
  "idleTimeout": 600000,
  "maxLifetime": 7200000,
  "connectionTimeout": 5000,
  "queryLatency": 5,
  "schemas": [
    { "name": "public", "owner": "app_user" },
    { "name": "app", "owner": "app_user" }
  ],
  "roles": [
    { "name": "app_user", "login": true, "superuser": false },
    { "name": "readonly", "login": true, "superuser": false }
  ]
}
```

### Пример 5: База данных с транзакциями

**Сценарий:** Использование транзакций для атомарности операций

```sql
-- Начало транзакции
BEGIN;

-- Выполнение операций
INSERT INTO users (username, email) VALUES ('user1', 'user1@example.com');
INSERT INTO orders (user_id, total) VALUES (1, 100.00);
UPDATE users SET email = 'updated@example.com' WHERE id = 1;

-- Коммит транзакции (все операции выполняются атомарно)
COMMIT;

-- Или откат при ошибке
ROLLBACK;
```

---

## Часто задаваемые вопросы (FAQ)

### Что такое PostgreSQL?

PostgreSQL - это мощная объектно-реляционная система управления базами данных с открытым исходным кодом. Она поддерживает SQL стандарт и предоставляет множество расширенных функций.

### Как работает connection pool в PostgreSQL?

Connection pool управляет соединениями с базой данных для оптимизации производительности. При запросе соединения пул пытается переиспользовать свободное соединение. Если нет свободных соединений и не достигнут maxConnections, создается новое. Если пул исчерпан, запрос получает ошибку.

### Что такое WAL (Write-Ahead Log)?

WAL - это механизм надежности PostgreSQL, который записывает все изменения в лог перед записью на диск. Это обеспечивает надежность и возможность восстановления после сбоев.

### Что такое dead tuples?

Dead tuples - это старые версии строк, которые создаются при UPDATE и DELETE операциях. Они занимают место, но не используются. Autovacuum автоматически очищает dead tuples.

### Что такое vacuum?

Vacuum - это операция очистки dead tuples из таблиц. Autovacuum запускается автоматически при накоплении dead tuples (обычно при > 20% от общего количества строк).

### Как работает query planning?

Query Planner анализирует запрос и создает план выполнения. Он определяет, можно ли использовать индекс (Index Scan) или нужно последовательное сканирование (Sequential Scan). Использование индексов значительно ускоряет запросы.

### Что такое bloat?

Bloat - это раздувание таблиц из-за накопления dead tuples. Bloat ratio показывает процент dead tuples от общего количества строк. Высокий bloat ratio (> 20%) указывает на необходимость VACUUM.

### Как мониторить производительность PostgreSQL?

Используйте вкладку **"Metrics"** для просмотра метрик в реальном времени:
- Queries Per Second, Average Query Time, P95/P99 Query Time
- Cache Hit Ratio, Connection Utilization
- Dead Tuples, Bloat Ratio
- Active Locks, Blocked Queries
- Top Queries по времени выполнения

### Как оптимизировать запросы?

1. Используйте индексы для колонок в WHERE условиях
2. Избегайте SELECT * - выбирайте только нужные колонки
3. Используйте LIMIT для больших выборок
4. Оптимизируйте JOIN - используйте индексы на ключах соединения
5. Анализируйте планы запросов через EXPLAIN

### Как работает транзакция?

Транзакция обеспечивает атомарность операций. Все запросы внутри транзакции выполняются атомарно - либо все успешно (COMMIT), либо все откатываются (ROLLBACK). При ошибке транзакция автоматически откатывается.

---

## Дополнительные ресурсы

- [Официальная документация PostgreSQL](https://www.postgresql.org/docs/)
- [PostgreSQL Tutorial](https://www.postgresqltutorial.com/)
- [PostgreSQL Performance Tuning](https://wiki.postgresql.org/wiki/Performance_Optimization)
- [PostgreSQL Best Practices](https://wiki.postgresql.org/wiki/Don%27t_Do_This)

# Snowflake - Документация компонента

## Обзор

Snowflake - это облачная платформа данных с разделением хранилища и вычислений (storage and compute separation). Компонент Snowflake в системе симуляции полностью эмулирует поведение реального Snowflake, включая управление warehouses (вычислительными ресурсами), databases, schemas, tables, SQL запросы, query queuing, auto-suspend/auto-resume warehouses, multi-cluster scaling, result caching, cost calculation, метрики производительности и полный набор возможностей Snowflake.

### Основные возможности

- ✅ **Separation of Storage and Compute** - Разделение хранилища и вычислений для независимого масштабирования
- ✅ **Warehouses** - Управление вычислительными ресурсами (warehouses) с различными размерами
- ✅ **Multi-Cluster Scaling** - Автоматическое масштабирование кластеров для параллельной обработки
- ✅ **Auto-Suspend/Auto-Resume** - Автоматическая приостановка и возобновление warehouses
- ✅ **Databases & Schemas** - Иерархическая структура данных (Database → Schema → Table)
- ✅ **SQL** - Полный набор SQL команд (SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, ALTER)
- ✅ **Query Queuing** - Очередь запросов при перегрузке warehouses
- ✅ **Result Caching** - Кэширование результатов запросов для ускорения
- ✅ **Cost Calculation** - Расчет стоимости использования (credits) на основе warehouse size и времени работы
- ✅ **Метрики в реальном времени** - Полный набор метрик Snowflake (queries, latency, warehouse utilization, cache hit rate, cost)

---

## Основные функции

### 1. Управление Account (Аккаунт)

**Описание:** Настройка подключения к Snowflake аккаунту.

**Параметры подключения:**
- **account** - Account identifier (уникальный идентификатор аккаунта, генерируется автоматически)
- **region** - Регион Snowflake (по умолчанию: `us-east-1`)
- **username** - Имя пользователя (по умолчанию: `admin`)
- **password** - Пароль (опционально)
- **role** - Роль пользователя (по умолчанию: `ACCOUNTADMIN`)

**Формат account URL:**
- Полный формат: `account.region.cloud` (например, `myaccount.us-east-1.aws`)
- Account identifier должен содержать только буквы, цифры, дефисы и подчеркивания

**Пример конфигурации:**
```json
{
  "account": "myaccount.us-east-1.aws",
  "region": "us-east-1",
  "username": "admin",
  "password": "",
  "role": "ACCOUNTADMIN"
}
```

### 2. Управление Warehouses (Вычислительные ресурсы)

**Описание:** Warehouse - это вычислительный ресурс для выполнения SQL запросов. Snowflake разделяет хранилище и вычисления, что позволяет независимо масштабировать compute ресурсы.

**Параметры Warehouse:**
- **name** - Имя warehouse (обязательно, уникальное, например: `COMPUTE_WH`)
- **size** - Размер warehouse (по умолчанию: `Small`): `X-Small`, `Small`, `Medium`, `Large`, `X-Large`, `2X-Large`, `3X-Large`, `4X-Large`
- **status** - Статус warehouse: `running`, `suspended`, `resuming`, `suspending`
- **autoSuspend** - Автоматическая приостановка через N секунд простоя (по умолчанию: `60` секунд)
- **autoResume** - Автоматическое возобновление при поступлении запроса (по умолчанию: `true`)
- **minClusterCount** - Минимальное количество кластеров (по умолчанию: `1`)
- **maxClusterCount** - Максимальное количество кластеров (по умолчанию: `1`)

**Warehouse Sizes:**
- **X-Small** - 1 сервер, 1 credit/hour
- **Small** - 2 сервера, 2 credits/hour
- **Medium** - 4 сервера, 4 credits/hour
- **Large** - 8 серверов, 8 credits/hour
- **X-Large** - 16 серверов, 16 credits/hour
- **2X-Large** - 32 сервера, 32 credits/hour
- **3X-Large** - 64 сервера, 64 credits/hour
- **4X-Large** - 128 серверов, 128 credits/hour

**Warehouse Lifecycle:**
1. **Suspended** - Warehouse приостановлен, не потребляет credits
2. **Resuming** - Warehouse возобновляется (2-5 секунд)
3. **Running** - Warehouse работает, выполняет запросы
4. **Suspending** - Warehouse приостанавливается (1-3 секунды)

**Пример конфигурации:**
```json
{
  "warehouses": [
    {
      "name": "COMPUTE_WH",
      "size": "Small",
      "status": "suspended",
      "autoSuspend": 60,
      "autoResume": true,
      "minClusterCount": 1,
      "maxClusterCount": 1
    },
    {
      "name": "ANALYTICS_WH",
      "size": "Large",
      "status": "suspended",
      "autoSuspend": 300,
      "autoResume": true,
      "minClusterCount": 1,
      "maxClusterCount": 4
    }
  ]
}
```

### 3. Multi-Cluster Scaling

**Описание:** Multi-cluster scaling позволяет warehouse автоматически масштабироваться для параллельной обработки запросов.

**Как работает:**
- Warehouse может иметь несколько кластеров (minClusterCount - maxClusterCount)
- Запросы распределяются по кластерам для параллельной обработки
- Каждый кластер обрабатывает часть данных независимо
- Результаты агрегируются

**Преимущества:**
- Параллельная обработка запросов
- Уменьшение времени выполнения
- Автоматическое масштабирование при нагрузке

**Параметры:**
- **minClusterCount** - Минимальное количество кластеров (по умолчанию: `1`)
- **maxClusterCount** - Максимальное количество кластеров (по умолчанию: `1`)

**Пример:**
```json
{
  "name": "ANALYTICS_WH",
  "size": "Large",
  "minClusterCount": 1,
  "maxClusterCount": 4
}
```

### 4. Auto-Suspend / Auto-Resume

**Описание:** Автоматическая приостановка и возобновление warehouses для оптимизации стоимости.

**Auto-Suspend:**
- Warehouse автоматически приостанавливается после периода простоя
- Не потребляет credits в приостановленном состоянии
- Экономит стоимость при отсутствии нагрузки

**Auto-Resume:**
- Warehouse автоматически возобновляется при поступлении запроса
- Задержка возобновления: 2-5 секунд
- Запросы ставятся в очередь до возобновления warehouse

**Параметры:**
- **autoSuspend** - Время простоя в секундах перед приостановкой (по умолчанию: `60`)
- **autoResume** - Включить ли auto-resume (по умолчанию: `true`)

**Пример:**
```json
{
  "autoSuspend": 300,
  "autoResume": true
}
```

### 5. Управление Databases (Базы данных)

**Описание:** Database - это контейнер для schemas и tables.

**Параметры Database:**
- **name** - Имя базы данных (обязательно, уникальное, например: `MY_DATABASE`)
- **comment** - Комментарий (опционально)
- **retentionTime** - Время хранения в днях (по умолчанию: `1`)
- **size** - Размер базы данных в bytes (обновляется автоматически)
- **schemas** - Список схем (массив)

**Системная база данных:**
- **SNOWFLAKE** - Системная база данных (всегда присутствует)
  - Схема **INFORMATION_SCHEMA** - Метаданные и системная информация

**Пример конфигурации:**
```json
{
  "databases": [
    {
      "name": "MY_DATABASE",
      "comment": "Production database",
      "retentionTime": 7,
      "schemas": [
        {
          "name": "PUBLIC",
          "tables": [],
          "views": 0,
          "functions": 0
        }
      ]
    }
  ]
}
```

### 6. Управление Schemas (Схемы)

**Описание:** Schema - это контейнер для tables, views и functions внутри database.

**Параметры Schema:**
- **name** - Имя схемы (обязательно, уникальное в рамках database, например: `PUBLIC`)
- **tables** - Список таблиц (массив)
- **views** - Количество views (обновляется автоматически)
- **functions** - Количество functions (обновляется автоматически)

**Стандартные схемы:**
- **PUBLIC** - Публичная схема по умолчанию

**Пример:**
```json
{
  "name": "PUBLIC",
  "tables": [],
  "views": 0,
  "functions": 0
}
```

### 7. Управление Tables (Таблицы)

**Описание:** Таблицы хранят данные в Snowflake.

**Параметры Table:**
- **name** - Имя таблицы (обязательно, уникальное в рамках schema)
- **schema** - Имя схемы (обязательно)
- **database** - Имя базы данных (обязательно)
- **columns** - Список колонок (массив)
- **rows** - Количество строк (обновляется автоматически)
- **size** - Размер таблицы в bytes (обновляется автоматически)
- **created** - Временная метка создания (опционально)

**Параметры Column:**
- **name** - Имя колонки (обязательно)
- **type** - Тип данных (например, `VARCHAR`, `NUMBER`, `TIMESTAMP`, `BOOLEAN`)
- **nullable** - Может ли быть NULL (по умолчанию: `true`)

**Пример конфигурации:**
```json
{
  "tables": [
    {
      "name": "users",
      "schema": "PUBLIC",
      "database": "MY_DATABASE",
      "columns": [
        { "name": "user_id", "type": "NUMBER", "nullable": false },
        { "name": "username", "type": "VARCHAR(255)", "nullable": false },
        { "name": "email", "type": "VARCHAR(255)", "nullable": true },
        { "name": "created_at", "type": "TIMESTAMP", "nullable": false }
      ],
      "rows": 0,
      "size": 0
    }
  ]
}
```

### 8. SQL (Structured Query Language)

**Описание:** Snowflake поддерживает стандартный SQL для работы с данными.

#### 8.1. SELECT (Чтение данных)

**Синтаксис:**
```sql
SELECT [columns] FROM [database.]schema.table
[WHERE condition]
[GROUP BY columns]
[ORDER BY columns [ASC|DESC]]
[LIMIT n]
```

**Примеры:**
```sql
-- Простой SELECT
SELECT * FROM MY_DATABASE.PUBLIC.users;

-- SELECT с условиями
SELECT user_id, username, email 
FROM MY_DATABASE.PUBLIC.users 
WHERE user_id > 100;

-- SELECT с агрегацией
SELECT 
  COUNT(*) as total_users,
  AVG(user_id) as avg_id
FROM MY_DATABASE.PUBLIC.users;

-- SELECT с GROUP BY
SELECT 
  DATE_TRUNC('day', created_at) as date,
  COUNT(*) as users_count
FROM MY_DATABASE.PUBLIC.users
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY date DESC;
```

#### 8.2. INSERT (Вставка данных)

**Синтаксис:**
```sql
INSERT INTO [database.]schema.table (columns)
VALUES (values), (values), ...
```

**Примеры:**
```sql
-- Простой INSERT
INSERT INTO MY_DATABASE.PUBLIC.users (user_id, username, email, created_at)
VALUES (1, 'john_doe', 'john@example.com', CURRENT_TIMESTAMP);

-- INSERT множественных строк
INSERT INTO MY_DATABASE.PUBLIC.users (user_id, username, email, created_at)
VALUES 
  (1, 'john_doe', 'john@example.com', CURRENT_TIMESTAMP),
  (2, 'jane_doe', 'jane@example.com', CURRENT_TIMESTAMP);
```

#### 8.3. UPDATE (Обновление данных)

**Синтаксис:**
```sql
UPDATE [database.]schema.table
SET column = value [, column = value ...]
WHERE condition
```

**Пример:**
```sql
UPDATE MY_DATABASE.PUBLIC.users
SET email = 'newemail@example.com'
WHERE user_id = 1;
```

#### 8.4. DELETE (Удаление данных)

**Синтаксис:**
```sql
DELETE FROM [database.]schema.table
WHERE condition
```

**Пример:**
```sql
DELETE FROM MY_DATABASE.PUBLIC.users
WHERE user_id = 1;
```

#### 8.5. CREATE TABLE (Создание таблицы)

**Синтаксис:**
```sql
CREATE TABLE [database.]schema.table (
  column_name type [NOT NULL],
  ...
)
```

**Пример:**
```sql
CREATE TABLE MY_DATABASE.PUBLIC.users (
  user_id NUMBER NOT NULL,
  username VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  created_at TIMESTAMP NOT NULL
);
```

#### 8.6. DROP TABLE (Удаление таблицы)

**Синтаксис:**
```sql
DROP TABLE [database.]schema.table
```

**Пример:**
```sql
DROP TABLE MY_DATABASE.PUBLIC.users;
```

### 9. Query Queuing (Очередь запросов)

**Описание:** Запросы ставятся в очередь, если warehouse перегружен или приостановлен.

**Как работает:**
- Если warehouse `running` и есть свободная емкость - запрос выполняется сразу
- Если warehouse `suspended` - запрос ставится в очередь, warehouse возобновляется
- Если warehouse `running` но перегружен - запрос ставится в очередь
- Запросы из очереди обрабатываются по мере освобождения ресурсов

**Метрики:**
- **queuedQueries** - Количество запросов в очереди
- **runningQueries** - Количество выполняющихся запросов

**Ограничения:**
- Максимальное количество concurrent queries зависит от размера warehouse
- Большие warehouses могут обрабатывать больше запросов параллельно

### 10. Result Caching (Кэширование результатов)

**Описание:** Snowflake кэширует результаты запросов для ускорения повторных запросов.

**Как работает:**
- Результаты SELECT запросов кэшируются
- TTL кэша: 5 минут (300000ms)
- При повторном запросе с теми же параметрами возвращается результат из кэша
- Cache hit значительно быстрее обычного выполнения

**Метрики:**
- **cacheHitRate** - Процент попаданий в кэш (0-1)
- **resultCacheUsed** - Использован ли кэш для запроса

**Преимущества:**
- Быстрое выполнение повторных запросов
- Снижение нагрузки на warehouse
- Экономия credits

### 11. Cost Calculation (Расчет стоимости)

**Описание:** Snowflake использует кредитную систему (credits) для расчета стоимости.

**Как рассчитывается:**
- Стоимость зависит от размера warehouse и времени работы
- Warehouse потребляет credits только в состоянии `running`
- Приостановленные warehouses не потребляют credits
- Большие warehouses потребляют больше credits в час

**Warehouse Credit Rates:**
- **X-Small** - 1 credit/hour
- **Small** - 2 credits/hour
- **Medium** - 4 credits/hour
- **Large** - 8 credits/hour
- **X-Large** - 16 credits/hour
- **2X-Large** - 32 credits/hour
- **3X-Large** - 64 credits/hour
- **4X-Large** - 128 credits/hour

**Метрики:**
- **totalCost** - Общая стоимость в credits (симулируется)

**Оптимизация стоимости:**
- Используйте auto-suspend для автоматической приостановки
- Выбирайте подходящий размер warehouse
- Используйте result cache для уменьшения нагрузки

---

## Руководство пользователя

### Быстрый старт

1. **Добавление компонента Snowflake:**
   - Перетащите компонент "Snowflake" из библиотеки компонентов на canvas
   - Откройте панель конфигурации компонента

2. **Настройка аккаунта:**
   - Перейдите на вкладку **"Account"**
   - Account identifier генерируется автоматически
   - Укажите region, username, password, role

3. **Создание warehouse:**
   - Перейдите на вкладку **"Warehouses"**
   - Нажмите кнопку **"Add Warehouse"**
   - Укажите имя, размер, auto-suspend, auto-resume
   - Нажмите **"Save"**

4. **Создание database:**
   - Перейдите на вкладку **"Databases"**
   - Нажмите кнопку **"Add Database"**
   - Укажите имя, retention time
   - Нажмите **"Save"**

5. **Выполнение SQL запросов:**
   - Перейдите на вкладку **"SQL"**
   - Введите SQL запрос
   - Выберите warehouse (опционально)
   - Нажмите **"Execute"** или Ctrl+Enter

### Работа с Warehouses

#### Создание warehouse

1. Перейдите на вкладку **"Warehouses"**
2. Нажмите кнопку **"Add Warehouse"**
3. Заполните параметры:
   - **Name** - Имя warehouse (уникальное, например: `COMPUTE_WH`)
   - **Size** - Размер warehouse (X-Small, Small, Medium, Large и др.)
   - **Auto Suspend** - Время простоя в секундах перед приостановкой
   - **Auto Resume** - Включить ли автоматическое возобновление
   - **Min/Max Cluster Count** - Количество кластеров для multi-cluster scaling
4. Нажмите **"Save"**

#### Управление warehouse

- **Resume** - Возобновить warehouse (переход из `suspended` в `running`)
- **Suspend** - Приостановить warehouse (переход из `running` в `suspended`)
- **Edit** - Редактировать параметры warehouse
- **Delete** - Удалить warehouse

**Примечание:** Warehouse автоматически возобновляется при поступлении запроса, если включен auto-resume.

### Работа с Databases

#### Создание database

1. Перейдите на вкладку **"Databases"**
2. Нажмите кнопку **"Add Database"**
3. Заполните параметры:
   - **Name** - Имя базы данных (уникальное)
   - **Comment** - Комментарий (опционально)
   - **Retention Time** - Время хранения в днях
4. Нажмите **"Save"**

#### Редактирование database

1. Выберите database из списка
2. Нажмите кнопку **"Edit"**
3. Измените параметры
4. Нажмите **"Save"**

### Работа с SQL

#### Выполнение запросов

1. Перейдите на вкладку **"SQL"**
2. Введите SQL запрос:
   ```sql
   SELECT * FROM MY_DATABASE.PUBLIC.users LIMIT 100;
   ```
3. Выберите warehouse (опционально, если не указан - используется первый доступный)
4. Нажмите **"Execute"** или Ctrl+Enter
5. Результат отобразится ниже

**Примечание:** Если warehouse приостановлен, он автоматически возобновится при поступлении запроса (если включен auto-resume).

#### Примеры запросов

**SELECT:**
```sql
-- Простой SELECT
SELECT * FROM MY_DATABASE.PUBLIC.users;

-- SELECT с условиями
SELECT user_id, username 
FROM MY_DATABASE.PUBLIC.users 
WHERE user_id > 100;

-- SELECT с агрегацией
SELECT COUNT(*) as total 
FROM MY_DATABASE.PUBLIC.users;
```

**INSERT:**
```sql
INSERT INTO MY_DATABASE.PUBLIC.users (user_id, username, email)
VALUES (1, 'john_doe', 'john@example.com');
```

**CREATE TABLE:**
```sql
CREATE TABLE MY_DATABASE.PUBLIC.users (
  user_id NUMBER NOT NULL,
  username VARCHAR(255) NOT NULL,
  email VARCHAR(255)
);
```

---

## Руководство администратора

### Рекомендации по конфигурации

#### Production Snowflake

```json
{
  "account": "production.us-east-1.aws",
  "region": "us-east-1",
  "username": "admin",
  "role": "ACCOUNTADMIN",
  "warehouses": [
    {
      "name": "COMPUTE_WH",
      "size": "Medium",
      "autoSuspend": 300,
      "autoResume": true,
      "minClusterCount": 1,
      "maxClusterCount": 2
    },
    {
      "name": "ANALYTICS_WH",
      "size": "Large",
      "autoSuspend": 600,
      "autoResume": true,
      "minClusterCount": 1,
      "maxClusterCount": 4
    }
  ]
}
```

**Рекомендации:**
- Используйте отдельные warehouses для разных workload (compute, analytics, ETL)
- Настройте auto-suspend для экономии credits
- Используйте multi-cluster scaling для высоконагруженных warehouses
- Мониторьте метрики warehouse utilization и cost

### Оптимизация производительности

**Warehouse Sizing:**
- Используйте **Small** или **Medium** для общих workload
- Используйте **Large** или **X-Large** для аналитики и ETL
- Используйте **X-Small** для тестирования и разработки
- Мониторьте warehouse utilization (должно быть 50-80%)

**Multi-Cluster Scaling:**
- Используйте multi-cluster для параллельной обработки запросов
- Начните с minClusterCount=1, maxClusterCount=2-4
- Мониторьте эффективность масштабирования

**Auto-Suspend:**
- Установите auto-suspend в зависимости от паттерна нагрузки
- Для production: 300-600 секунд
- Для development: 60-120 секунд
- Для тестирования: можно отключить auto-suspend

**Result Caching:**
- Используйте result cache для повторяющихся запросов
- Мониторьте cache hit rate (должно быть > 50% для повторяющихся запросов)
- Оптимизируйте запросы для лучшего использования кэша

**Query Optimization:**
- Используйте WHERE для фильтрации данных
- Используйте LIMIT для ограничения результатов
- Избегайте SELECT * когда возможно
- Используйте подходящие типы данных

### Безопасность

#### Управление доступом

- Используйте сильные пароли
- Не храните пароли в открытом виде в конфигурации
- Используйте переменные окружения для паролей
- Используйте роли для управления доступом (ACCOUNTADMIN, SYSADMIN, USERADMIN)
- Ограничьте доступ к warehouses только необходимым пользователям

#### Защита данных

- Используйте retention time для автоматического удаления старых данных
- Регулярно делайте backup (Time Travel, если доступен)
- Мониторьте использование warehouses для предотвращения неожиданных затрат

### Мониторинг и алертинг

#### Ключевые метрики

1. **Queries Per Second**
   - Нормальное значение: зависит от нагрузки
   - Алерт: резкое падение или превышение порога

2. **Average Query Time**
   - Нормальное значение: < 500ms для большинства запросов
   - Алерт: average query time > 2000ms

3. **Warehouse Utilization**
   - Нормальное значение: 50-80%
   - Алерт: utilization > 90% (недостаточно ресурсов) или < 20% (неэффективное использование)

4. **Queued Queries**
   - Нормальное значение: 0
   - Алерт: queued queries > 10 (warehouse перегружен)

5. **Cache Hit Rate**
   - Нормальное значение: > 50% для повторяющихся запросов
   - Алерт: cache hit rate < 30% (неэффективное использование кэша)

6. **Running Warehouses**
   - Нормальное значение: зависит от нагрузки
   - Алерт: все warehouses suspended при наличии запросов (проблема с auto-resume)

7. **Total Cost (Credits)**
   - Нормальное значение: зависит от использования
   - Алерт: резкое увеличение стоимости (проверить warehouse size и время работы)

---

## Метрики и мониторинг

### Основные метрики

#### Throughput
- **Описание:** Количество запросов в секунду
- **Единица измерения:** queries/sec
- **Типы:** Queries Per Second
- **Источник:** Рассчитывается из истории запросов за последнюю секунду

#### Latency
- **Описание:** Задержка выполнения запросов
- **Единица измерения:** миллисекунды (ms)
- **Типы:** Average Query Time
- **Факторы влияния:**
  - Размер warehouse (больше = быстрее)
  - Количество кластеров (больше = быстрее при параллельной обработке)
  - Сложность запроса
  - Использование result cache
  - Задержка возобновления warehouse

#### Utilization
- **Описание:** Загрузка warehouses
- **Единица измерения:** процент (0-1)
- **Типы:** Warehouse Utilization
- **Расчет:** Средняя загрузка всех warehouses

### Метрики Warehouses

- **totalWarehouses** - Общее количество warehouses
- **runningWarehouses** - Количество работающих warehouses
- **suspendedWarehouses** - Количество приостановленных warehouses
- **warehouseUtilization** - Средняя загрузка warehouses (0-1)

### Метрики Queries

- **totalQueries** - Общее количество запросов
- **runningQueries** - Количество выполняющихся запросов
- **queuedQueries** - Количество запросов в очереди
- **queriesPerSecond** - Запросов в секунду
- **avgQueryTime** - Среднее время выполнения запроса (ms)

### Метрики Data

- **totalDataRead** - Общее количество прочитанных строк
- **totalDataWritten** - Общее количество записанных строк

### Метрики Cache

- **cacheHitRate** - Процент попаданий в кэш (0-1)
- **resultCacheUsed** - Использован ли кэш для запроса

### Метрики Cost

- **totalCost** - Общая стоимость в credits (симулируется)
- **totalComputeTime** - Общее время вычислений в секундах

### Мониторинг в реальном времени

Все метрики обновляются в реальном времени во время симуляции:
- Метрики синхронизируются из `SnowflakeRoutingEngine` каждые 500ms
- Метрики отображаются в UI компоненте
- История метрик хранится для графиков (query performance, cost trends)
- Warehouse статус обновляется в реальном времени

---

## Примеры использования

### Пример 1: Простой warehouse для разработки

**Сценарий:** Базовый warehouse для разработки и тестирования

```json
{
  "account": "dev.us-east-1.aws",
  "region": "us-east-1",
  "warehouses": [
    {
      "name": "DEV_WH",
      "size": "X-Small",
      "autoSuspend": 60,
      "autoResume": true,
      "minClusterCount": 1,
      "maxClusterCount": 1
    }
  ],
  "databases": [
    {
      "name": "DEV_DB",
      "retentionTime": 1,
      "schemas": [
        {
          "name": "PUBLIC",
          "tables": []
        }
      ]
    }
  ]
}
```

### Пример 2: Production warehouse с multi-cluster

**Сценарий:** Production warehouse с автоматическим масштабированием

```json
{
  "warehouses": [
    {
      "name": "PROD_COMPUTE_WH",
      "size": "Large",
      "autoSuspend": 300,
      "autoResume": true,
      "minClusterCount": 1,
      "maxClusterCount": 4
    }
  ]
}
```

**SQL запросы:**
```sql
-- Запрос выполняется на всех кластерах параллельно
SELECT 
  DATE_TRUNC('day', created_at) as date,
  COUNT(*) as count
FROM PROD_DB.PUBLIC.events
WHERE created_at >= CURRENT_DATE - 7
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY date DESC;
```

### Пример 3: Разделение workload по warehouses

**Сценарий:** Разные warehouses для разных типов workload

```json
{
  "warehouses": [
    {
      "name": "ETL_WH",
      "size": "X-Large",
      "autoSuspend": 600,
      "autoResume": true,
      "minClusterCount": 1,
      "maxClusterCount": 2
    },
    {
      "name": "ANALYTICS_WH",
      "size": "Large",
      "autoSuspend": 300,
      "autoResume": true,
      "minClusterCount": 1,
      "maxClusterCount": 4
    },
    {
      "name": "REPORTING_WH",
      "size": "Medium",
      "autoSuspend": 180,
      "autoResume": true,
      "minClusterCount": 1,
      "maxClusterCount": 1
    }
  ]
}
```

**Использование:**
```sql
-- ETL запросы используют ETL_WH
USE WAREHOUSE ETL_WH;
INSERT INTO PROD_DB.PUBLIC.users SELECT * FROM STAGING_DB.PUBLIC.users;

-- Аналитические запросы используют ANALYTICS_WH
USE WAREHOUSE ANALYTICS_WH;
SELECT COUNT(*) FROM PROD_DB.PUBLIC.events WHERE event_date = CURRENT_DATE;

-- Отчеты используют REPORTING_WH
USE WAREHOUSE REPORTING_WH;
SELECT * FROM PROD_DB.PUBLIC.daily_report;
```

### Пример 4: Оптимизация стоимости

**Сценарий:** Минимизация стоимости через auto-suspend

```json
{
  "warehouses": [
    {
      "name": "COST_OPTIMIZED_WH",
      "size": "Small",
      "autoSuspend": 60,
      "autoResume": true,
      "minClusterCount": 1,
      "maxClusterCount": 1
    }
  ]
}
```

**Преимущества:**
- Warehouse приостанавливается через 60 секунд простоя
- Не потребляет credits в приостановленном состоянии
- Автоматически возобновляется при поступлении запроса

### Пример 5: Production конфигурация

**Сценарий:** Полная production конфигурация

```json
{
  "account": "production.us-east-1.aws",
  "region": "us-east-1",
  "username": "admin",
  "role": "ACCOUNTADMIN",
  "warehouses": [
    {
      "name": "COMPUTE_WH",
      "size": "Medium",
      "autoSuspend": 300,
      "autoResume": true,
      "minClusterCount": 1,
      "maxClusterCount": 2
    },
    {
      "name": "ANALYTICS_WH",
      "size": "Large",
      "autoSuspend": 600,
      "autoResume": true,
      "minClusterCount": 1,
      "maxClusterCount": 4
    }
  ],
  "databases": [
    {
      "name": "PROD_DB",
      "retentionTime": 30,
      "schemas": [
        {
          "name": "PUBLIC",
          "tables": []
        }
      ]
    }
  ]
}
```

---

## Часто задаваемые вопросы (FAQ)

### Что такое Snowflake?

Snowflake - это облачная платформа данных с разделением хранилища и вычислений. Snowflake позволяет независимо масштабировать storage и compute ресурсы, что обеспечивает гибкость и оптимизацию стоимости.

### В чем разница между Snowflake и традиционными базами данных?

- **Архитектура:** Snowflake разделяет storage и compute, традиционные БД - объединяют
- **Масштабирование:** Snowflake масштабируется независимо (storage и compute отдельно), традиционные БД - вместе
- **Модель оплаты:** Snowflake использует кредитную систему (pay-per-use), традиционные БД - фиксированная стоимость
- **Auto-Suspend:** Snowflake может автоматически приостанавливать compute, традиционные БД - всегда работают

### Что такое warehouse в Snowflake?

Warehouse - это вычислительный ресурс для выполнения SQL запросов. Warehouse может быть приостановлен (suspended) для экономии credits или работать (running) для выполнения запросов.

### Как работает multi-cluster scaling?

Multi-cluster scaling позволяет warehouse иметь несколько кластеров для параллельной обработки запросов:
- Запросы распределяются по кластерам
- Каждый кластер обрабатывает часть данных независимо
- Результаты агрегируются
- Время выполнения уменьшается благодаря параллелизму

### Как работает auto-suspend/auto-resume?

- **Auto-Suspend:** Warehouse автоматически приостанавливается после периода простоя (не потребляет credits)
- **Auto-Resume:** Warehouse автоматически возобновляется при поступлении запроса (задержка 2-5 секунд)
- Запросы ставятся в очередь до возобновления warehouse

### Как работает result caching?

- Результаты SELECT запросов кэшируются на 5 минут
- При повторном запросе с теми же параметрами возвращается результат из кэша
- Cache hit значительно быстрее обычного выполнения
- Снижает нагрузку на warehouse и экономит credits

### Как рассчитывается стоимость в Snowflake?

Стоимость рассчитывается на основе:
- Размера warehouse (больше = дороже)
- Времени работы (только в состоянии `running`)
- Количества кластеров (для multi-cluster)

**Credit Rates:**
- X-Small: 1 credit/hour
- Small: 2 credits/hour
- Medium: 4 credits/hour
- Large: 8 credits/hour
- И так далее (удваивается для каждого размера)

### Как оптимизировать стоимость Snowflake?

1. Используйте auto-suspend для автоматической приостановки
2. Выбирайте подходящий размер warehouse
3. Используйте result cache для уменьшения нагрузки
4. Мониторьте warehouse utilization
5. Используйте multi-cluster только при необходимости

### Как мониторить производительность Snowflake?

Используйте метрики в реальном времени:
- Queries Per Second, Average Query Time
- Warehouse Utilization, Queued Queries
- Cache Hit Rate, Running Warehouses
- Total Cost (Credits)

---

## Дополнительные ресурсы

- [Официальная документация Snowflake](https://docs.snowflake.com/)
- [Snowflake SQL Reference](https://docs.snowflake.com/en/sql-reference/)
- [Snowflake Best Practices](https://docs.snowflake.com/en/user-guide/best-practices.html)
- [Snowflake Cost Optimization](https://docs.snowflake.com/en/user-guide/cost-understanding.html)

# Elasticsearch - Документация компонента

## Обзор

Elasticsearch - это распределенный поисковый и аналитический движок, построенный на Apache Lucene. Компонент Elasticsearch в системе симуляции полностью эмулирует поведение реального Elasticsearch, включая кластерную архитектуру, индексы, шарды и реплики, роутинг документов, операции индексирования и поиска, refresh interval, query DSL (Domain Specific Language), bulk операции, версионирование документов, метрики производительности и полный набор возможностей Elasticsearch.

### Основные возможности

- ✅ **Кластерная архитектура** - Управление узлами кластера с распределением данных
- ✅ **Indices** - Индексы для хранения и поиска документов
- ✅ **Shards & Replicas** - Шарды и реплики для распределения и отказоустойчивости
- ✅ **Document Routing** - Роутинг документов по шардам на основе routing key
- ✅ **Operations** - Index, Get, Search, Delete, Update, Bulk операции
- ✅ **Query DSL** - Полный набор типов запросов (match, term, range, bool, wildcard, exists)
- ✅ **Refresh Interval** - Настраиваемый интервал обновления индексов
- ✅ **Document Versioning** - Версионирование документов для optimistic concurrency
- ✅ **Метрики в реальном времени** - Полный набор метрик Elasticsearch (operations, latency, cluster health, shard states, index metrics)

---

## Основные функции

### 1. Управление Cluster (Кластер)

**Описание:** Настройка кластера Elasticsearch с узлами.

**Параметры кластера:**
- **clusterName** - Имя кластера (по умолчанию: `elasticsearch-cluster`)
- **nodes** - Список узлов кластера (массив строк `host:port`, по умолчанию: `['localhost:9200']`)

**Параметры Node:**
- **address** - Адрес узла в формате `host:port` (например: `localhost:9200`)
- **status** - Статус узла: `up` или `down` (по умолчанию: `up`)
- **load** - Загрузка узла (0-1, обновляется автоматически)
- **shards** - Количество шардов на узле (обновляется автоматически)

**Пример конфигурации:**
```json
{
  "clusterName": "my-cluster",
  "nodes": [
    "localhost:9200",
    "localhost:9201",
    "localhost:9202"
  ]
}
```

### 2. Управление Indices (Индексы)

**Описание:** Index - это коллекция документов, аналогичная базе данных в реляционных БД.

**Параметры Index:**
- **name** - Имя индекса (обязательно, уникальное, например: `my_index`)
- **shards** - Количество primary shards (по умолчанию: `5`)
- **replicas** - Количество реплик на primary shard (по умолчанию: `1`)
- **docs** - Количество документов (обновляется автоматически)
- **size** - Размер индекса в bytes (обновляется автоматически)
- **health** - Состояние индекса: `green`, `yellow`, `red` (обновляется автоматически)
- **mappings** - Mapping индекса (опционально, объект)
- **settings** - Настройки индекса (опционально, объект)

**Пример конфигурации:**
```json
{
  "indices": [
    {
      "name": "my_index",
      "shards": 5,
      "replicas": 1,
      "mappings": {
        "properties": {
          "title": { "type": "text" },
          "content": { "type": "text" },
          "created_at": { "type": "date" }
        }
      },
      "settings": {
        "index": {
          "refresh_interval": "1s"
        }
      }
    }
  ]
}
```

### 3. Shards & Replicas (Шарды и реплики)

**Описание:** Shards распределяют данные по узлам кластера. Replicas обеспечивают отказоустойчивость.

**Primary Shards:**
- Данные разделяются на primary shards
- Количество primary shards определяется при создании индекса
- Количество primary shards нельзя изменить после создания индекса
- Документы распределяются по primary shards на основе routing key

**Replica Shards:**
- Каждый primary shard может иметь одну или несколько реплик
- Реплики обеспечивают отказоустойчивость и увеличивают throughput для чтения
- Реплики распределяются по разным узлам

**Shard States:**
- **STARTED** - Шард работает нормально
- **RELOCATING** - Шард перемещается на другой узел
- **INITIALIZING** - Шард инициализируется
- **UNASSIGNED** - Шард не назначен ни на один узел (проблема)

**Пример:**
```json
{
  "name": "my_index",
  "shards": 5,
  "replicas": 1
}
```
Это создаст:
- 5 primary shards
- 5 replica shards (по 1 реплике на каждый primary)
- Всего: 10 shards (5 primary + 5 replica)

### 4. Document Routing (Роутинг документов)

**Описание:** Документы распределяются по шардам на основе routing key.

**Как работает:**
- По умолчанию используется `_id` документа как routing key
- Можно указать кастомный `_routing` при индексировании
- Формула: `shard_num = hash(routing_key) % num_primary_shards`
- Документы с одинаковым routing key попадают в один шард

**Преимущества:**
- Документы с общим routing key хранятся вместе
- Улучшает производительность запросов с фильтром по routing key
- Позволяет контролировать распределение данных

**Пример:**
```json
{
  "_id": "1",
  "_routing": "user123",
  "_source": {
    "user_id": "user123",
    "message": "Hello"
  }
}
```

### 5. Operations (Операции)

**Описание:** Elasticsearch поддерживает различные операции для работы с документами.

#### 5.1. Index (Индексирование)

**Описание:** Добавление или обновление документа в индексе.

**Параметры:**
- **index** - Имя индекса (обязательно)
- **id** - ID документа (обязательно)
- **document** - Тело документа (обязательно, объект)
- **routing** - Routing key (опционально)

**Пример:**
```json
{
  "operation": "index",
  "index": "my_index",
  "id": "1",
  "document": {
    "title": "My Document",
    "content": "Document content",
    "created_at": "2024-01-01T00:00:00Z"
  },
  "routing": "user123"
}
```

#### 5.2. Get (Получение документа)

**Описание:** Получение документа по ID.

**Параметры:**
- **index** - Имя индекса (обязательно)
- **id** - ID документа (обязательно)
- **routing** - Routing key (опционально)

**Пример:**
```json
{
  "operation": "get",
  "index": "my_index",
  "id": "1",
  "routing": "user123"
}
```

#### 5.3. Search (Поиск)

**Описание:** Поиск документов по запросу.

**Параметры:**
- **index** - Имя индекса (обязательно)
- **query** - Query DSL запрос (обязательно, объект)
- **size** - Количество результатов (по умолчанию: `10`)

**Пример:**
```json
{
  "operation": "search",
  "index": "my_index",
  "query": {
    "query": {
      "match": {
        "title": "document"
      }
    }
  },
  "size": 20
}
```

#### 5.4. Delete (Удаление)

**Описание:** Удаление документа по ID.

**Параметры:**
- **index** - Имя индекса (обязательно)
- **id** - ID документа (обязательно)
- **routing** - Routing key (опционально)

**Пример:**
```json
{
  "operation": "delete",
  "index": "my_index",
  "id": "1",
  "routing": "user123"
}
```

#### 5.5. Update (Обновление)

**Описание:** Обновление документа (частичное или полное).

**Параметры:**
- **index** - Имя индекса (обязательно)
- **id** - ID документа (обязательно)
- **document** - Обновляемые поля (обязательно, объект)
- **routing** - Routing key (опционально)

**Пример:**
```json
{
  "operation": "update",
  "index": "my_index",
  "id": "1",
  "document": {
    "content": "Updated content"
  },
  "routing": "user123"
}
```

#### 5.6. Bulk (Пакетные операции)

**Описание:** Выполнение множественных операций в одной транзакции.

**Формат:** NDJSON (Newline Delimited JSON)

**Пример:**
```json
{
  "operation": "bulk",
  "index": "my_index",
  "payload": "{\"index\":{\"_id\":\"1\"}}\n{\"title\":\"Doc 1\"}\n{\"index\":{\"_id\":\"2\"}}\n{\"title\":\"Doc 2\"}\n"
}
```

### 6. Query DSL (Domain Specific Language)

**Описание:** Elasticsearch использует JSON-based Query DSL для поиска.

#### 6.1. Match Query

**Описание:** Полнотекстовый поиск с анализом текста.

**Пример:**
```json
{
  "query": {
    "match": {
      "title": "elasticsearch"
    }
  }
}
```

#### 6.2. Term Query

**Описание:** Точное совпадение значения (без анализа).

**Пример:**
```json
{
  "query": {
    "term": {
      "status": "published"
    }
  }
}
```

#### 6.3. Range Query

**Описание:** Поиск по диапазону значений.

**Пример:**
```json
{
  "query": {
    "range": {
      "age": {
        "gte": 18,
        "lte": 65
      }
    }
  }
}
```

#### 6.4. Bool Query

**Описание:** Комбинирование нескольких запросов.

**Clauses:**
- **must** - Все должны совпадать (AND)
- **should** - Хотя бы один должен совпадать (OR)
- **must_not** - Ни один не должен совпадать (NOT)
- **filter** - То же что must, но не влияет на score

**Пример:**
```json
{
  "query": {
    "bool": {
      "must": [
        { "match": { "title": "elasticsearch" } }
      ],
      "filter": [
        { "term": { "status": "published" } }
      ],
      "must_not": [
        { "term": { "archived": true } }
      ]
    }
  }
}
```

#### 6.5. Wildcard Query

**Описание:** Поиск по шаблону с wildcards (*, ?).

**Пример:**
```json
{
  "query": {
    "wildcard": {
      "title": "elastic*"
    }
  }
}
```

#### 6.6. Exists Query

**Описание:** Поиск документов, у которых существует поле.

**Пример:**
```json
{
  "query": {
    "exists": {
      "field": "email"
    }
  }
}
```

#### 6.7. Match All Query

**Описание:** Возвращает все документы.

**Пример:**
```json
{
  "query": {
    "match_all": {}
  }
}
```

### 7. Refresh Interval (Интервал обновления)

**Описание:** Refresh делает документы доступными для поиска.

**Как работает:**
- При индексировании документы сначала попадают в pending state
- Через refresh interval документы становятся searchable
- Refresh можно отключить (`-1`) для немедленной доступности

**Параметры:**
- **refreshInterval** - Интервал обновления (по умолчанию: `1s`)
  - Формат: `1s`, `5m`, `1h`, `-1` (отключено)
  - Можно настроить для каждого индекса отдельно

**Пример конфигурации:**
```json
{
  "refreshInterval": "1s"
}
```

**Или для конкретного индекса:**
```json
{
  "indices": [
    {
      "name": "my_index",
      "settings": {
        "index": {
          "refresh_interval": "5s"
        }
      }
    }
  ]
}
```

### 8. Document Versioning (Версионирование документов)

**Описание:** Elasticsearch отслеживает версии документов для optimistic concurrency.

**Версии:**
- **version** - Номер версии документа (увеличивается при каждом обновлении)
- **seq_no** - Sequence number (глобальный порядковый номер)
- **primary_term** - Primary term (увеличивается при смене primary shard)

**Использование:**
- Предотвращает конфликты при одновременном обновлении
- Позволяет отслеживать изменения документов
- Используется для optimistic concurrency control

**Пример:**
```json
{
  "_id": "1",
  "_version": 3,
  "_seq_no": 12345,
  "_primary_term": 1,
  "_source": {
    "title": "Document"
  }
}
```

### 9. Cluster Health (Состояние кластера)

**Описание:** Cluster health показывает общее состояние кластера.

**Состояния:**
- **green** - Все primary и replica shards работают
- **yellow** - Все primary shards работают, но некоторые replica shards недоступны
- **red** - Некоторые primary shards недоступны

**Расчет:**
- **green** - Если все shards в состоянии STARTED
- **yellow** - Если есть shards в состоянии INITIALIZING или RELOCATING
- **red** - Если есть shards в состоянии UNASSIGNED

**Метрики:**
- **activeShards** - Количество активных shards
- **relocatingShards** - Количество перемещающихся shards
- **initializingShards** - Количество инициализирующихся shards
- **unassignedShards** - Количество неназначенных shards

---

## Руководство пользователя

### Быстрый старт

1. **Добавление компонента Elasticsearch:**
   - Перетащите компонент "Elasticsearch" из библиотеки компонентов на canvas
   - Откройте панель конфигурации компонента

2. **Настройка кластера:**
   - Перейдите на вкладку **"Cluster"**
   - Укажите clusterName
   - Добавьте узлы кластера (нажмите "Add Node")

3. **Создание индекса:**
   - Перейдите на вкладку **"Indices"**
   - Нажмите кнопку **"Add Index"**
   - Укажите имя, shards, replicas
   - Нажмите **"Save"**

4. **Индексирование документа:**
   - Перейдите на вкладку **"Documents"**
   - Выберите индекс
   - Нажмите кнопку **"Index Document"**
   - Введите ID и JSON документ
   - Нажмите **"Save"**

5. **Выполнение поиска:**
   - Перейдите на вкладку **"Search"**
   - Выберите индекс
   - Введите Query DSL запрос
   - Нажмите **"Execute"**

### Работа с Indices

#### Создание индекса

1. Перейдите на вкладку **"Indices"**
2. Нажмите кнопку **"Add Index"**
3. Заполните параметры:
   - **Name** - Имя индекса (уникальное)
   - **Shards** - Количество primary shards (по умолчанию: `5`)
   - **Replicas** - Количество реплик (по умолчанию: `1`)
   - **Refresh Interval** - Интервал обновления (по умолчанию: `1s`)
4. Нажмите **"Save"**

**Примечание:** Количество primary shards нельзя изменить после создания индекса.

#### Редактирование индекса

1. Выберите индекс из списка
2. Нажмите кнопку **"Edit"** (иконка карандаша)
3. Измените параметры (replicas, refresh interval)
4. Нажмите **"Save"**

#### Удаление индекса

1. Выберите индекс из списка
2. Нажмите кнопку **"Delete"** (иконка корзины)
3. Подтвердите удаление

### Работа с Documents

#### Индексирование документа

1. Перейдите на вкладку **"Documents"**
2. Выберите индекс
3. Нажмите кнопку **"Index Document"**
4. Заполните параметры:
   - **ID** - ID документа (обязательно)
   - **Document** - JSON документ (обязательно)
   - **Routing** - Routing key (опционально)
5. Нажмите **"Save"**

**Пример документа:**
```json
{
  "title": "My Document",
  "content": "Document content",
  "created_at": "2024-01-01T00:00:00Z",
  "tags": ["elasticsearch", "search"]
}
```

#### Получение документа

1. Выберите индекс
2. Введите ID документа
3. Нажмите кнопку **"Get"**
4. Результат отобразится ниже

#### Удаление документа

1. Выберите индекс
2. Введите ID документа
3. Нажмите кнопку **"Delete"**
4. Подтвердите удаление

### Работа с Search

#### Выполнение поиска

1. Перейдите на вкладку **"Search"**
2. Выберите индекс
3. Введите Query DSL запрос:
   ```json
   {
     "query": {
       "match": {
         "title": "elasticsearch"
       }
     }
   }
   ```
4. Нажмите **"Execute"** или Ctrl+Enter
5. Результаты отобразятся ниже

#### Примеры запросов

**Match Query:**
```json
{
  "query": {
    "match": {
      "title": "elasticsearch"
    }
  }
}
```

**Term Query:**
```json
{
  "query": {
    "term": {
      "status": "published"
    }
  }
}
```

**Range Query:**
```json
{
  "query": {
    "range": {
      "age": {
        "gte": 18,
        "lte": 65
      }
    }
  }
}
```

**Bool Query:**
```json
{
  "query": {
    "bool": {
      "must": [
        { "match": { "title": "elasticsearch" } }
      ],
      "filter": [
        { "term": { "status": "published" } }
      ]
    }
  }
}
```

---

## Руководство администратора

### Рекомендации по конфигурации

#### Production Elasticsearch

```json
{
  "clusterName": "production-cluster",
  "nodes": [
    "elasticsearch1.production.internal:9200",
    "elasticsearch2.production.internal:9200",
    "elasticsearch3.production.internal:9200"
  ],
  "indices": [
    {
      "name": "production_index",
      "shards": 5,
      "replicas": 2,
      "settings": {
        "index": {
          "refresh_interval": "1s"
        }
      }
    }
  ]
}
```

**Рекомендации:**
- Используйте минимум 3 узла для высокой доступности
- Установите replicas минимум 1 (лучше 2 для production)
- Выберите подходящее количество shards (5-10 для большинства случаев)
- Мониторьте cluster health (должно быть green)
- Настройте refresh interval в зависимости от требований (1s для real-time, 5s-30s для batch)

### Оптимизация производительности

**Shards:**
- Используйте 5-10 primary shards для большинства индексов
- Избегайте слишком большого количества shards (overhead)
- Избегайте слишком малого количества shards (недостаточный параллелизм)
- Количество shards должно быть кратно количеству узлов для равномерного распределения

**Replicas:**
- Используйте минимум 1 replica для отказоустойчивости
- Используйте 2-3 replicas для production
- Replicas увеличивают throughput для чтения
- Replicas увеличивают использование диска

**Refresh Interval:**
- Используйте `1s` для real-time поиска
- Используйте `5s-30s` для batch индексирования (лучшая производительность)
- Используйте `-1` для отключения refresh (только для bulk индексирования)

**Query Optimization:**
- Используйте `filter` вместо `must` когда score не важен (быстрее)
- Используйте `term` вместо `match` для точных совпадений (быстрее)
- Используйте `range` для числовых диапазонов
- Избегайте `match_all` без фильтров для больших индексов

### Безопасность

#### Управление доступом

- Используйте authentication (enableAuth: true)
- Используйте сильные пароли
- Не храните пароли в открытом виде в конфигурации
- Используйте переменные окружения для паролей
- Ограничьте доступ к Elasticsearch только необходимым приложениям
- Используйте SSL (enableSSL: true) для production

#### Защита данных

- Используйте replicas для защиты от потери данных
- Мониторьте cluster health (должно быть green)
- Регулярно делайте backup (snapshots)
- Мониторьте unassigned shards (должно быть 0)

### Мониторинг и алертинг

#### Ключевые метрики

1. **Cluster Health**
   - Нормальное значение: `green`
   - Алерт: `yellow` (некоторые replica shards недоступны) или `red` (некоторые primary shards недоступны)

2. **Unassigned Shards**
   - Нормальное значение: 0
   - Алерт: unassigned shards > 0 (проблемы с кластером)

3. **Index/Search Operations Per Second**
   - Нормальное значение: зависит от нагрузки
   - Алерт: резкое падение или превышение порога

4. **Average Index/Search Latency**
   - Нормальное значение: < 50ms для index, < 100ms для search
   - Алерт: average latency > 200ms

5. **Active Shards**
   - Нормальное значение: все shards активны
   - Алерт: relocating shards > 0 (балансировка нагрузки) или initializing shards > 0 (восстановление)

6. **Pending Documents**
   - Нормальное значение: зависит от refresh interval
   - Алерт: большое количество pending documents (медленный refresh)

---

## Метрики и мониторинг

### Основные метрики

#### Throughput
- **Описание:** Количество операций в секунду
- **Единица измерения:** operations/sec
- **Типы:** Index Operations Per Second, Search Operations Per Second
- **Источник:** Рассчитывается из истории операций за последнюю секунду

#### Latency
- **Описание:** Задержка выполнения операций
- **Единица измерения:** миллисекунды (ms)
- **Типы:** Average Index Latency, Average Search Latency, Average Get Latency
- **Percentiles:** P50, P99 для каждого типа операции
- **Факторы влияния:**
  - Количество shards (больше shards = выше latency для search)
  - Размер результата (больше результатов = выше latency)
  - Сложность запроса
  - Загрузка узлов

#### Cluster Health
- **Описание:** Общее состояние кластера
- **Значения:** `green`, `yellow`, `red`
- **Расчет:** На основе состояния всех shards

### Метрики Cluster

- **totalNodes** - Общее количество узлов
- **healthyNodes** - Количество доступных узлов
- **clusterHealth** - Состояние кластера (green/yellow/red)

### Метрики Indices

- **totalIndices** - Количество индексов
- **totalDocs** - Общее количество документов
- **totalSize** - Общий размер данных (bytes)
- **indexMetrics** - Метрики по каждому индексу (docs, size, operations, latency, pending documents)

### Метрики Shards

- **activeShards** - Количество активных shards
- **relocatingShards** - Количество перемещающихся shards
- **initializingShards** - Количество инициализирующихся shards
- **unassignedShards** - Количество неназначенных shards
- **shardMetrics** - Метрики по каждому shard (docs, size, operations, latency)

### Метрики Operations

- **indexOperationsPerSecond** - Операций индексирования в секунду
- **searchOperationsPerSecond** - Операций поиска в секунду
- **averageIndexLatency** - Средняя задержка индексирования (ms)
- **averageSearchLatency** - Средняя задержка поиска (ms)
- **averageGetLatency** - Средняя задержка получения (ms)

### Метрики по типам операций

Для каждого типа операции (index, search, get, delete, bulk, update):
- **operationsPerSecond** - Операций в секунду
- **averageLatency** - Средняя задержка (ms)
- **p50Latency** - 50-й перцентиль задержки (ms)
- **p99Latency** - 99-й перцентиль задержки (ms)
- **errorRate** - Процент ошибок (0-1)
- **totalOperations** - Общее количество операций
- **totalErrors** - Общее количество ошибок

### Метрики Nodes

- **nodeMetrics** - Метрики по каждому узлу (status, load, shards, operations, latency, memory, CPU)

### Мониторинг в реальном времени

Все метрики обновляются в реальном времени во время симуляции:
- Метрики синхронизируются из `ElasticsearchRoutingEngine` каждые 500ms
- Метрики отображаются в UI компоненте
- История операций хранится для расчета метрик
- Cluster health обновляется на основе состояния shards

---

## Примеры использования

### Пример 1: Простой индекс для поиска

**Сценарий:** Индекс для полнотекстового поиска документов

```json
{
  "clusterName": "my-cluster",
  "nodes": ["localhost:9200"],
  "indices": [
    {
      "name": "documents",
      "shards": 5,
      "replicas": 1,
      "mappings": {
        "properties": {
          "title": { "type": "text" },
          "content": { "type": "text" },
          "created_at": { "type": "date" }
        }
      }
    }
  ]
}
```

**Индексирование:**
```json
{
  "operation": "index",
  "index": "documents",
  "id": "1",
  "document": {
    "title": "Elasticsearch Guide",
    "content": "Elasticsearch is a distributed search engine",
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

**Поиск:**
```json
{
  "operation": "search",
  "index": "documents",
  "query": {
    "query": {
      "match": {
        "title": "elasticsearch"
      }
    }
  }
}
```

### Пример 2: Production кластер

**Сценарий:** Production кластер с несколькими узлами

```json
{
  "clusterName": "production-cluster",
  "nodes": [
    "elasticsearch1.internal:9200",
    "elasticsearch2.internal:9200",
    "elasticsearch3.internal:9200"
  ],
  "indices": [
    {
      "name": "production_index",
      "shards": 10,
      "replicas": 2,
      "settings": {
        "index": {
          "refresh_interval": "1s"
        }
      }
    }
  ]
}
```

### Пример 3: Индекс с routing

**Сценарий:** Индекс с кастомным routing для группировки документов

```json
{
  "operation": "index",
  "index": "user_events",
  "id": "1",
  "routing": "user123",
  "document": {
    "user_id": "user123",
    "event_type": "click",
    "timestamp": "2024-01-01T00:00:00Z"
  }
}
```

**Преимущества:**
- Все события пользователя хранятся в одном shard
- Быстрее выполнять запросы по конкретному пользователю

### Пример 4: Bulk индексирование

**Сценарий:** Массовое индексирование документов

```json
{
  "operation": "bulk",
  "index": "documents",
  "payload": "{\"index\":{\"_id\":\"1\"}}\n{\"title\":\"Doc 1\"}\n{\"index\":{\"_id\":\"2\"}}\n{\"title\":\"Doc 2\"}\n{\"index\":{\"_id\":\"3\"}}\n{\"title\":\"Doc 3\"}\n"
}
```

### Пример 5: Сложный поиск с bool query

**Сценарий:** Поиск с несколькими условиями

```json
{
  "operation": "search",
  "index": "documents",
  "query": {
    "query": {
      "bool": {
        "must": [
          { "match": { "title": "elasticsearch" } }
        ],
        "filter": [
          { "term": { "status": "published" } },
          { "range": { "created_at": { "gte": "2024-01-01" } } }
        ],
        "must_not": [
          { "term": { "archived": true } }
        ]
      }
    },
    "size": 20
  }
}
```

---

## Часто задаваемые вопросы (FAQ)

### Что такое Elasticsearch?

Elasticsearch - это распределенный поисковый и аналитический движок, построенный на Apache Lucene. Elasticsearch позволяет индексировать и искать большие объемы данных в реальном времени.

### В чем разница между Elasticsearch и традиционными базами данных?

- **Модель данных:** Elasticsearch использует документную модель (JSON), традиционные БД - реляционную
- **Оптимизация:** Elasticsearch оптимизирован для поиска, традиционные БД - для транзакций
- **Масштабирование:** Elasticsearch масштабируется горизонтально (кластер), традиционные БД - вертикально
- **Использование:** Elasticsearch для поиска и аналитики, традиционные БД - для OLTP

### Что такое индекс в Elasticsearch?

Index - это коллекция документов, аналогичная базе данных в реляционных БД. Каждый индекс состоит из shards и replicas для распределения и отказоустойчивости.

### Что такое shard в Elasticsearch?

Shard - это часть индекса, содержащая подмножество документов. Primary shards распределяют данные по узлам кластера. Replica shards обеспечивают отказоустойчивость и увеличивают throughput для чтения.

### Как работает роутинг документов?

Документы распределяются по shards на основе routing key:
- По умолчанию используется `_id` документа
- Можно указать кастомный `_routing`
- Формула: `shard_num = hash(routing_key) % num_primary_shards`
- Документы с одинаковым routing key попадают в один shard

### Что такое refresh interval?

Refresh interval определяет, как часто документы становятся доступными для поиска:
- При индексировании документы сначала попадают в pending state
- Через refresh interval документы становятся searchable
- Можно отключить refresh (`-1`) для немедленной доступности

### Как работает cluster health?

Cluster health показывает общее состояние кластера:
- **green** - Все shards работают
- **yellow** - Все primary shards работают, но некоторые replica shards недоступны
- **red** - Некоторые primary shards недоступны

### Как мониторить производительность Elasticsearch?

Используйте метрики в реальном времени:
- Cluster Health, Unassigned Shards
- Index/Search Operations Per Second, Average Latency
- Active/Relocating/Initializing Shards
- Index Metrics, Shard Metrics, Node Metrics

### Как оптимизировать Elasticsearch?

1. Выберите подходящее количество shards (5-10 для большинства случаев)
2. Используйте replicas для отказоустойчивости (минимум 1, лучше 2-3)
3. Настройте refresh interval в зависимости от требований
4. Используйте routing для группировки связанных документов
5. Оптимизируйте запросы (используйте filter вместо must, term вместо match)
6. Мониторьте метрики и устраняйте проблемы

---

## Дополнительные ресурсы

- [Официальная документация Elasticsearch](https://www.elastic.co/guide/en/elasticsearch/reference/current/index.html)
- [Elasticsearch Query DSL](https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl.html)
- [Elasticsearch Best Practices](https://www.elastic.co/guide/en/elasticsearch/reference/current/tune-for-indexing-speed.html)
- [Elasticsearch Performance Tuning](https://www.elastic.co/guide/en/elasticsearch/reference/current/tune-for-search-speed.html)

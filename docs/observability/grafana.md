# Grafana - Документация компонента

## Обзор

Grafana - это платформа для визуализации и аналитики метрик, логов и трейсов. Компонент Grafana в системе симуляции полностью эмулирует поведение реального Grafana, включая подключение к множественным datasources (Prometheus, Loki, InfluxDB и др.), создание и обновление dashboards, выполнение queries через HTTP API, кэширование запросов, алертинг и полный набор возможностей Grafana.

### Основные возможности

- ✅ **Множественные DataSources** - Подключение к Prometheus, Loki, InfluxDB, Elasticsearch, PostgreSQL, MySQL
- ✅ **Dashboards и Panels** - Создание дашбордов с различными типами панелей (graph, table, stat, gauge, piechart, bargraph)
- ✅ **PromQL и LogQL Queries** - Выполнение запросов к Prometheus и Loki через HTTP API
- ✅ **HTTP Routing** - Реальные HTTP запросы к datasources через GrafanaRoutingEngine
- ✅ **Query Caching** - Кэширование результатов instant queries для оптимизации
- ✅ **Load Balancing** - Балансировка нагрузки между множественными instances datasources (round-robin)
- ✅ **Alerting** - Правила алертов с PromQL выражениями и уведомлениями
- ✅ **Dashboard Refresh** - Автоматическое обновление dashboards по заданному интервалу
- ✅ **Метрики Grafana** - Полный набор метрик производительности и использования

---

## Основные функции

### 1. DataSources (Источники данных)

**Описание:** DataSources определяют, откуда Grafana получает данные для визуализации.

**Поддерживаемые типы:**
- **Prometheus** - Метрики временных рядов
- **Loki** - Логи
- **InfluxDB** - Метрики временных рядов
- **Elasticsearch** - Логи и метрики
- **PostgreSQL** - Данные из базы данных
- **MySQL** - Данные из базы данных

**Параметры DataSource:**
- **name** - Имя datasource (обязательно, уникальное)
- **type** - Тип datasource (обязательно)
- **url** - URL datasource (обязательно)
- **access** - Режим доступа: `proxy` (через Grafana) или `direct` (напрямую из браузера)
- **isDefault** - Использовать как datasource по умолчанию (опционально)
- **basicAuth** - Использовать Basic Authentication (опционально)
- **basicAuthUser** - Имя пользователя для Basic Auth (опционально)
- **basicAuthPassword** - Пароль для Basic Auth (опционально)

**Пример конфигурации:**
```json
{
  "datasources": [
    {
      "name": "Prometheus",
      "type": "prometheus",
      "url": "http://prometheus:9090",
      "access": "proxy",
      "isDefault": true
    },
    {
      "name": "Loki",
      "type": "loki",
      "url": "http://loki:3100",
      "access": "proxy"
    }
  ]
}
```

**Автоматическая настройка:**
- При подключении Grafana к Prometheus через connection, datasource автоматически создается
- URL datasource определяется через ServiceDiscovery на основе connection

### 2. Dashboards (Дашборды)

**Описание:** Dashboards содержат панели (panels) для визуализации данных из datasources.

**Параметры Dashboard:**
- **id** - Уникальный идентификатор (обязательно)
- **name** - Имя дашборда (обязательно)
- **panels** - Массив панелей (обязательно)
- **tags** - Теги для организации (опционально)
- **variables** - Переменные для фильтрации (опционально)
- **refresh** - Интервал обновления (опционально, например: `30s`, `1m`, `5m`)
- **timeRange** - Временной диапазон по умолчанию (опционально)

**Пример конфигурации:**
```json
{
  "dashboards": [
    {
      "id": "system-overview",
      "name": "System Overview",
      "panels": [
        {
          "id": "panel-1",
          "title": "CPU Usage",
          "type": "graph",
          "datasource": "Prometheus",
          "queries": [
            {
              "refId": "A",
              "expr": "cpu_usage",
              "legendFormat": "{{instance}}"
            }
          ],
          "gridPos": {
            "x": 0,
            "y": 0,
            "w": 12,
            "h": 8
          }
        }
      ],
      "tags": ["system", "monitoring"],
      "refresh": "30s"
    }
  ]
}
```

### 3. Panels (Панели)

**Описание:** Panels отображают данные из datasources в различных форматах.

**Типы панелей:**
- **graph** - График временных рядов
- **table** - Таблица данных
- **stat** - Статистика (одно значение)
- **gauge** - Индикатор (gauge)
- **piechart** - Круговая диаграмма
- **bargraph** - Столбчатая диаграмма

**Параметры Panel:**
- **id** - Уникальный идентификатор (обязательно)
- **title** - Заголовок панели (обязательно)
- **type** - Тип панели (обязательно)
- **datasource** - Имя datasource (обязательно)
- **queries** - Массив queries (обязательно)
- **gridPos** - Позиция в сетке (обязательно)

**Пример конфигурации:**
```json
{
  "id": "panel-1",
  "title": "Request Rate",
  "type": "graph",
  "datasource": "Prometheus",
  "queries": [
    {
      "refId": "A",
      "expr": "rate(http_requests_total[5m])",
      "legendFormat": "{{method}} {{status}}"
    }
  ],
  "gridPos": {
    "x": 0,
    "y": 0,
    "w": 12,
    "h": 8
  }
}
```

### 4. Queries (Запросы)

**Описание:** Queries определяют, какие данные получать из datasources.

**Параметры Query:**
- **refId** - Референсный идентификатор (обязательно, например: `A`, `B`, `C`)
- **expr** - Выражение запроса (обязательно)
  - Для Prometheus: PromQL выражение
  - Для Loki: LogQL выражение
- **legendFormat** - Формат легенды (опционально)
- **step** - Шаг для range queries (опционально)

**Типы запросов:**
- **Instant Query** - Мгновенное значение (кэшируется на 5 секунд)
- **Range Query** - Значения за период времени (не кэшируется)

**Примеры PromQL queries:**
```promql
# Простая метрика
cpu_usage

# Rate (скорость изменения)
rate(http_requests_total[5m])

# Агрегация
sum(http_requests_total) by (method, status)

# Сравнение
cpu_usage > 0.8
```

**Примеры LogQL queries:**
```logql
# Простой запрос логов
{job="varlogs"}

# С фильтром
{job="varlogs"} |= "error"

# С агрегацией
sum(rate({job="varlogs"}[5m])) by (level)
```

### 5. HTTP Routing (Маршрутизация HTTP запросов)

**Описание:** GrafanaRoutingEngine маршрутизирует HTTP запросы от Grafana к datasources.

**Как работает:**
1. Grafana инициирует HTTP запрос к datasource (Prometheus, Loki)
2. GrafanaRoutingEngine определяет правильный datasource по имени
3. Для Prometheus: формируется запрос к `/api/v1/query` (instant) или `/api/v1/query_range` (range)
4. Для Loki: формируется запрос к `/loki/api/v1/query` или `/loki/api/v1/query_range`
5. Запрос выполняется через PromQLEvaluator или Loki query executor
6. Результат возвращается в Grafana для визуализации

**Особенности:**
- Учитывается latency соединения между Grafana и datasource
- Поддерживается балансировка нагрузки между множественными instances (round-robin)
- Визуализация HTTP запросов на canvas в реальном времени

**Пример маршрутизации:**
```typescript
// Grafana → HTTP Request → Prometheus API → Response → Grafana
const result = await routingEngine.routeQuery(
  query,
  datasource,
  timeRange,
  isRangeQuery
);
```

### 6. Query Caching (Кэширование запросов)

**Описание:** Grafana кэширует результаты instant queries для оптимизации производительности.

**Как работает:**
- Instant queries кэшируются на 5 секунд (TTL)
- Range queries не кэшируются (всегда выполняются заново)
- Кэш автоматически очищается при истечении TTL
- Cache hit учитывается в метриках (`cachedQueries`)

**Преимущества:**
- Уменьшение нагрузки на datasources
- Улучшение производительности dashboards
- Снижение latency для повторяющихся запросов

### 7. Load Balancing (Балансировка нагрузки)

**Описание:** Grafana поддерживает балансировку нагрузки между множественными instances datasources.

**Алгоритм:**
- Round-robin между instances одного типа datasource
- Каждый datasource имеет свой round-robin счетчик
- Запросы распределяются равномерно между доступными instances

**Пример:**
```json
{
  "datasources": [
    {
      "name": "Prometheus-1",
      "type": "prometheus",
      "url": "http://prometheus-1:9090"
    },
    {
      "name": "Prometheus-2",
      "type": "prometheus",
      "url": "http://prometheus-2:9090"
    }
  ]
}
```

**Поведение:**
- Первый запрос → Prometheus-1
- Второй запрос → Prometheus-2
- Третий запрос → Prometheus-1
- И так далее...

### 8. Alerting (Алертинг)

**Описание:** Grafana может оценивать alert rules и отправлять уведомления.

**Параметры Alert Rule:**
- **id** - Уникальный идентификатор (обязательно)
- **name** - Имя правила (обязательно)
- **condition** - Условие алерта (обязательно)
  - **query** - PromQL запрос
  - **evaluator** - Оценщик (gt, lt, eq, ne)
  - **reducer** - Редуктор (avg, sum, min, max, last)
- **for** - Длительность, в течение которой условие должно быть true (опционально, например: `5m`)
- **annotations** - Аннотации для алерта (обязательно)
- **labels** - Дополнительные labels (опционально)
- **notificationChannels** - Каналы уведомлений (обязательно)

**Пример конфигурации:**
```json
{
  "alerts": [
    {
      "id": "alert-1",
      "name": "High CPU Usage",
      "condition": {
        "query": "cpu_usage",
        "evaluator": {
          "type": "gt",
          "params": [0.8]
        },
        "reducer": {
          "type": "avg",
          "params": []
        }
      },
      "for": "5m",
      "annotations": {
        "summary": "High CPU usage detected",
        "description": "CPU usage is above 80% for more than 5 minutes"
      },
      "labels": {
        "severity": "warning"
      },
      "notificationChannels": ["email", "slack"]
    }
  ]
}
```

**Оценка алертов:**
- Alert rules оцениваются каждые `for` duration
- Если условие выполнено и `for` duration истек, алерт становится активным
- Уведомления отправляются через указанные каналы

### 9. Dashboard Refresh (Обновление дашбордов)

**Описание:** Dashboards автоматически обновляются по заданному интервалу.

**Параметры:**
- **refresh** - Интервал обновления (например: `30s`, `1m`, `5m`, `never`)
- По умолчанию: `30s`

**Как работает:**
1. Dashboard обновляется каждые `refresh` интервал
2. Все queries в панелях выполняются заново
3. Данные обновляются в реальном времени
4. Метрики обновляются (`dashboardRefreshesPerSecond`)

---

## Руководство пользователя

### Быстрый старт

1. **Добавление компонента Grafana:**
   - Перетащите компонент "Grafana" из библиотеки компонентов на canvas
   - Откройте панель конфигурации компонента

2. **Настройка базовых параметров:**
   - Перейдите на вкладку **"Administration"**
   - Укажите `adminUser` (по умолчанию: `admin`)
   - Укажите `adminPassword` (по умолчанию: `admin`)
   - Выберите `theme` (по умолчанию: `dark`)

3. **Подключение к Prometheus:**
   - Создайте connection от Grafana к Prometheus
   - DataSource автоматически создается при подключении
   - Или добавьте DataSource вручную на вкладке **"Data Sources"**

4. **Создание Dashboard:**
   - Перейдите на вкладку **"Dashboards"**
   - Нажмите кнопку **"Add Dashboard"**
   - Укажите имя и настройте параметры
   - Нажмите **"Save"**

5. **Добавление Panel:**
   - Выберите dashboard из списка
   - Нажмите кнопку **"Add Panel"**
   - Выберите тип панели (graph, table, stat, gauge и т.д.)
   - Настройте queries (PromQL или LogQL)
   - Нажмите **"Save"**

### Работа с DataSources

#### Создание DataSource

1. Перейдите на вкладку **"Data Sources"**
2. Нажмите кнопку **"Add Data Source"**
3. Заполните параметры:
   - **Name** - Имя datasource (уникальное)
   - **Type** - Тип datasource (Prometheus, Loki, InfluxDB и т.д.)
   - **URL** - URL datasource
   - **Access** - Режим доступа (proxy или direct)
   - **Is Default** - Использовать как datasource по умолчанию
4. Нажмите **"Save"**

#### Редактирование DataSource

1. Выберите datasource из списка
2. Нажмите кнопку **"Edit"**
3. Измените параметры
4. Нажмите **"Save"**

#### Удаление DataSource

1. Выберите datasource из списка
2. Нажмите кнопку **"Delete"**
3. Подтвердите удаление

**Примечание:** DataSource нельзя удалить, если он используется в панелях.

### Работа с Dashboards

#### Создание Dashboard

1. Перейдите на вкладку **"Dashboards"**
2. Нажмите кнопку **"Add Dashboard"**
3. Заполните параметры:
   - **ID** - Уникальный идентификатор (автоматически генерируется)
   - **Name** - Имя дашборда
   - **Tags** - Теги для организации (опционально)
   - **Refresh** - Интервал обновления (опционально)
4. Нажмите **"Save"**

#### Редактирование Dashboard

1. Выберите dashboard из списка
2. Нажмите кнопку **"Edit"**
3. Измените параметры
4. Нажмите **"Save"**

#### Просмотр Dashboard

1. Выберите dashboard из списка
2. Нажмите кнопку **"View"**
3. Dashboard откроется в отдельном окне
4. Данные обновляются в реальном времени согласно `refresh` интервалу

#### Удаление Dashboard

1. Выберите dashboard из списка
2. Нажмите кнопку **"Delete"**
3. Подтвердите удаление

### Работа с Panels

#### Добавление Panel

1. Выберите dashboard из списка
2. Нажмите кнопку **"Add Panel"**
3. Заполните параметры:
   - **Title** - Заголовок панели
   - **Type** - Тип панели (graph, table, stat, gauge, piechart, bargraph)
   - **Data Source** - Выберите datasource
   - **Queries** - Добавьте queries (PromQL или LogQL)
4. Настройте `gridPos` для позиционирования
5. Нажмите **"Save"**

#### Редактирование Panel

1. Выберите dashboard из списка
2. Найдите panel в списке панелей
3. Нажмите кнопку **"Edit"**
4. Измените параметры
5. Нажмите **"Save"**

#### Удаление Panel

1. Выберите dashboard из списка
2. Найдите panel в списке панелей
3. Нажмите кнопку **"Delete"**
4. Подтвердите удаление

### Работа с Queries

#### Добавление Query

1. Откройте panel для редактирования
2. В секции **"Queries"** нажмите кнопку **"Add Query"**
3. Заполните параметры:
   - **Ref ID** - Референсный идентификатор (A, B, C и т.д.)
   - **Expression** - PromQL или LogQL выражение
   - **Legend Format** - Формат легенды (опционально)
   - **Step** - Шаг для range queries (опционально)
4. Нажмите **"Save"**

**Примеры PromQL выражений:**
```promql
# Простая метрика
cpu_usage

# Rate
rate(http_requests_total[5m])

# Агрегация
sum(http_requests_total) by (method, status)

# С фильтром
cpu_usage{instance="node1"}
```

**Примеры LogQL выражений:**
```logql
# Простой запрос
{job="varlogs"}

# С фильтром
{job="varlogs"} |= "error"

# С агрегацией
sum(rate({job="varlogs"}[5m])) by (level)
```

### Работа с Alerts

#### Создание Alert Rule

1. Перейдите на вкладку **"Alerting"**
2. Нажмите кнопку **"Add Alert Rule"**
3. Заполните параметры:
   - **Name** - Имя правила (уникальное)
   - **Query** - PromQL запрос
   - **Evaluator** - Оценщик (gt, lt, eq, ne)
   - **Reducer** - Редуктор (avg, sum, min, max, last)
   - **For** - Длительность (опционально)
   - **Annotations** - Аннотации (summary, description)
   - **Labels** - Дополнительные labels (опционально)
   - **Notification Channels** - Каналы уведомлений
4. Нажмите **"Save"**

**Пример PromQL запроса для алерта:**
```promql
# High CPU usage
cpu_usage > 0.8

# Service down
up == 0

# High error rate
rate(http_errors_total[5m]) > 0.1
```

#### Просмотр активных алертов

1. Перейдите на вкладку **"Alerting"**
2. Просмотрите список активных алертов
3. Алерты обновляются в реальном времени

---

## Руководство администратора

### Рекомендации по конфигурации

#### Production Grafana

```json
{
  "adminUser": "admin",
  "adminPassword": "secure_password",
  "enableAuth": true,
  "authProvider": "ldap",
  "enableAlerting": true,
  "theme": "dark",
  "datasources": [
    {
      "name": "Prometheus",
      "type": "prometheus",
      "url": "http://prometheus:9090",
      "access": "proxy",
      "isDefault": true
    },
    {
      "name": "Loki",
      "type": "loki",
      "url": "http://loki:3100",
      "access": "proxy"
    }
  ],
  "dashboards": [
    {
      "id": "system-overview",
      "name": "System Overview",
      "panels": [
        {
          "id": "panel-1",
          "title": "CPU Usage",
          "type": "graph",
          "datasource": "Prometheus",
          "queries": [
            {
              "refId": "A",
              "expr": "cpu_usage",
              "legendFormat": "{{instance}}"
            }
          ],
          "gridPos": { "x": 0, "y": 0, "w": 12, "h": 8 }
        }
      ],
      "tags": ["system", "monitoring"],
      "refresh": "30s"
    }
  ],
  "alerts": [
    {
      "id": "alert-1",
      "name": "High CPU Usage",
      "condition": {
        "query": "cpu_usage",
        "evaluator": { "type": "gt", "params": [0.8] },
        "reducer": { "type": "avg", "params": [] }
      },
      "for": "5m",
      "annotations": {
        "summary": "High CPU usage detected",
        "description": "CPU usage is above 80% for more than 5 minutes"
      },
      "notificationChannels": ["email", "slack"]
    }
  ]
}
```

**Рекомендации:**
- Используйте аутентификацию для production (`enableAuth: true`)
- Настройте множественные datasources для резервирования
- Используйте балансировку нагрузки между множественными instances
- Настройте alert rules для критичных метрик
- Оптимизируйте refresh intervals для dashboards (не слишком часто)
- Используйте кэширование для instant queries

### Оптимизация производительности

**Dashboard Refresh Intervals:**
- Используйте `30s` для большинства dashboards
- Используйте `1m` или `5m` для редко изменяющихся метрик
- Избегайте слишком частого обновления (< 10s) - увеличивает нагрузку на datasources

**Query Optimization:**
- Используйте instant queries для текущих значений (кэшируются)
- Используйте range queries только когда нужна история
- Оптимизируйте PromQL выражения (избегайте сложных агрегаций)
- Используйте recording rules в Prometheus для предварительного вычисления

**Caching:**
- Instant queries автоматически кэшируются на 5 секунд
- Кэш уменьшает нагрузку на datasources
- Мониторьте cache hit rate в метриках

**Load Balancing:**
- Используйте множественные instances datasources для резервирования
- Round-robin алгоритм распределяет нагрузку равномерно
- Мониторьте latency каждого instance

### Безопасность

#### Управление доступом

- Используйте аутентификацию (`enableAuth: true`)
- Настройте auth provider (LDAP, OAuth и т.д.)
- Ограничьте доступ к Grafana UI
- Используйте network policies для изоляции

#### Защита данных

- Используйте HTTPS для datasources (если поддерживается)
- Используйте Basic Auth для datasources при необходимости
- Регулярно делайте backup конфигурации dashboards
- Мониторьте метрики Grafana (datasource errors, query latency)

### Мониторинг и алертинг

#### Ключевые метрики

1. **Queries Per Second**
   - Нормальное значение: зависит от количества dashboards и refresh intervals
   - Алерт: queriesPerSecond > 100 (высокая нагрузка на datasources)

2. **Query Latency**
   - Нормальное значение: queryLatency < 100ms
   - Алерт: queryLatency > 500ms (медленные запросы)

3. **Datasource Errors**
   - Нормальное значение: datasourceErrors = 0
   - Алерт: datasourceErrors > 0 (проблемы с подключением к datasources)

4. **Cache Hit Rate**
   - Нормальное значение: cacheHitRate > 50% (хорошее использование кэша)
   - Алерт: cacheHitRate < 20% (неэффективное использование кэша)

5. **Dashboard Refresh Rate**
   - Нормальное значение: зависит от количества dashboards
   - Алерт: dashboardRefreshesPerSecond > 10 (слишком частые обновления)

6. **Rendering Latency**
   - Нормальное значение: renderingLatency < 50ms
   - Алерт: renderingLatency > 200ms (медленный рендеринг панелей)

---

## Метрики и мониторинг

### Метрики Queries

- **queriesPerSecond** - Количество queries в секунду
- **totalQueries** - Общее количество queries
- **cachedQueries** - Количество queries из кэша
- **queryLatency** - Средняя latency queries (ms)

### Метрики Dashboards

- **dashboardRefreshesPerSecond** - Количество обновлений dashboards в секунду
- **activeDashboards** - Количество активных dashboards
- **activePanels** - Количество активных панелей
- **renderingLatency** - Средняя latency рендеринга панелей (ms)

### Метрики Alerting

- **alertEvaluationsPerSecond** - Количество оценок алертов в секунду
- **activeAlerts** - Количество активных алертов

### Метрики DataSources

- **datasourceErrors** - Количество ошибок подключения к datasources
- **datasourceLatency** - Средняя latency запросов к datasources (ms)

### Мониторинг в реальном времени

Все метрики обновляются в реальном времени во время симуляции:
- Метрики синхронизируются из `GrafanaEmulationEngine` каждые 500ms
- Метрики отображаются в UI компоненте
- Dashboards обновляются согласно `refresh` интервалу
- Alert rules оцениваются каждые `for` duration

---

## Примеры использования

### Пример 1: Простой Dashboard с Prometheus

**Сценарий:** Создание dashboard для мониторинга CPU и памяти

```json
{
  "datasources": [
    {
      "name": "Prometheus",
      "type": "prometheus",
      "url": "http://prometheus:9090",
      "access": "proxy",
      "isDefault": true
    }
  ],
  "dashboards": [
    {
      "id": "system-monitoring",
      "name": "System Monitoring",
      "panels": [
        {
          "id": "cpu-panel",
          "title": "CPU Usage",
          "type": "graph",
          "datasource": "Prometheus",
          "queries": [
            {
              "refId": "A",
              "expr": "cpu_usage",
              "legendFormat": "{{instance}}"
            }
          ],
          "gridPos": { "x": 0, "y": 0, "w": 12, "h": 8 }
        },
        {
          "id": "memory-panel",
          "title": "Memory Usage",
          "type": "graph",
          "datasource": "Prometheus",
          "queries": [
            {
              "refId": "A",
              "expr": "memory_usage",
              "legendFormat": "{{instance}}"
            }
          ],
          "gridPos": { "x": 0, "y": 8, "w": 12, "h": 8 }
        }
      ],
      "tags": ["system"],
      "refresh": "30s"
    }
  ]
}
```

### Пример 2: Dashboard с Loki для логов

**Сценарий:** Создание dashboard для анализа логов

```json
{
  "datasources": [
    {
      "name": "Loki",
      "type": "loki",
      "url": "http://loki:3100",
      "access": "proxy"
    }
  ],
  "dashboards": [
    {
      "id": "logs-analysis",
      "name": "Logs Analysis",
      "panels": [
        {
          "id": "error-logs",
          "title": "Error Logs",
          "type": "table",
          "datasource": "Loki",
          "queries": [
            {
              "refId": "A",
              "expr": "{job=\"varlogs\"} |= \"error\""
            }
          ],
          "gridPos": { "x": 0, "y": 0, "w": 24, "h": 8 }
        },
        {
          "id": "log-rate",
          "title": "Log Rate by Level",
          "type": "bargraph",
          "datasource": "Loki",
          "queries": [
            {
              "refId": "A",
              "expr": "sum(rate({job=\"varlogs\"}[5m])) by (level)"
            }
          ],
          "gridPos": { "x": 0, "y": 8, "w": 12, "h": 8 }
        }
      ],
      "tags": ["logs"],
      "refresh": "1m"
    }
  ]
}
```

### Пример 3: Множественные DataSources с балансировкой

**Сценарий:** Использование множественных Prometheus instances для резервирования

```json
{
  "datasources": [
    {
      "name": "Prometheus-1",
      "type": "prometheus",
      "url": "http://prometheus-1:9090",
      "access": "proxy",
      "isDefault": true
    },
    {
      "name": "Prometheus-2",
      "type": "prometheus",
      "url": "http://prometheus-2:9090",
      "access": "proxy"
    }
  ],
  "dashboards": [
    {
      "id": "high-availability",
      "name": "High Availability Monitoring",
      "panels": [
        {
          "id": "panel-1",
          "title": "Request Rate",
          "type": "graph",
          "datasource": "Prometheus-1",
          "queries": [
            {
              "refId": "A",
              "expr": "rate(http_requests_total[5m])"
            }
          ],
          "gridPos": { "x": 0, "y": 0, "w": 12, "h": 8 }
        }
      ],
      "refresh": "30s"
    }
  ]
}
```

**Поведение:**
- Запросы распределяются между Prometheus-1 и Prometheus-2 (round-robin)
- При недоступности одного instance, запросы идут к другому
- Балансировка нагрузки уменьшает latency

### Пример 4: Alerting Rules

**Сценарий:** Настройка алертов для критичных метрик

```json
{
  "enableAlerting": true,
  "alertNotificationChannels": ["email", "slack", "pagerduty"],
  "alerts": [
    {
      "id": "high-cpu",
      "name": "High CPU Usage",
      "condition": {
        "query": "cpu_usage",
        "evaluator": {
          "type": "gt",
          "params": [0.8]
        },
        "reducer": {
          "type": "avg",
          "params": []
        }
      },
      "for": "5m",
      "annotations": {
        "summary": "High CPU usage detected",
        "description": "CPU usage is above 80% for more than 5 minutes"
      },
      "labels": {
        "severity": "warning"
      },
      "notificationChannels": ["email", "slack"]
    },
    {
      "id": "service-down",
      "name": "Service Down",
      "condition": {
        "query": "up",
        "evaluator": {
          "type": "eq",
          "params": [0]
        },
        "reducer": {
          "type": "last",
          "params": []
        }
      },
      "for": "1m",
      "annotations": {
        "summary": "Service is down",
        "description": "Service {{ $labels.instance }} is down"
      },
      "labels": {
        "severity": "critical"
      },
      "notificationChannels": ["email", "slack", "pagerduty"]
    }
  ]
}
```

### Пример 5: Dashboard с Variables

**Сценарий:** Использование переменных для фильтрации данных

```json
{
  "dashboards": [
    {
      "id": "filtered-dashboard",
      "name": "Filtered Dashboard",
      "variables": [
        {
          "name": "instance",
          "type": "query",
          "query": "label_values(up, instance)",
          "current": {
            "value": "node1",
            "text": "node1"
          }
        }
      ],
      "panels": [
        {
          "id": "panel-1",
          "title": "CPU Usage for $instance",
          "type": "graph",
          "datasource": "Prometheus",
          "queries": [
            {
              "refId": "A",
              "expr": "cpu_usage{instance=\"$instance\"}",
              "legendFormat": "{{instance}}"
            }
          ],
          "gridPos": { "x": 0, "y": 0, "w": 12, "h": 8 }
        }
      ],
      "refresh": "30s"
    }
  ]
}
```

---

## Часто задаваемые вопросы (FAQ)

### Что такое Grafana?

Grafana - это платформа для визуализации и аналитики метрик, логов и трейсов. Grafana подключается к различным datasources (Prometheus, Loki, InfluxDB и др.) и отображает данные в виде dashboards с панелями.

### Как работает Grafana?

1. Grafana подключается к datasources (Prometheus, Loki и т.д.)
2. Пользователи создают dashboards с панелями
3. Панели содержат queries (PromQL, LogQL и т.д.)
4. Grafana выполняет queries через HTTP API datasources
5. Данные визуализируются в панелях
6. Dashboards обновляются автоматически по заданному интервалу

### В чем разница между Grafana и Prometheus?

- **Prometheus**: Система сбора и хранения метрик (pull-based scraping)
- **Grafana**: Платформа визуализации метрик из различных источников (Prometheus, Loki и т.д.)

**Взаимодействие:**
- Prometheus собирает метрики от компонентов
- Grafana запрашивает метрики у Prometheus через HTTP API
- Grafana визуализирует метрики в dashboards

### Как работает HTTP Routing?

1. Grafana инициирует HTTP запрос к datasource
2. GrafanaRoutingEngine определяет правильный datasource
3. Запрос формируется в формате API datasource (Prometheus, Loki)
4. Запрос выполняется через PromQLEvaluator или Loki query executor
5. Результат возвращается в Grafana для визуализации
6. HTTP запросы визуализируются на canvas в реальном времени

### Что такое Query Caching?

Grafana кэширует результаты instant queries на 5 секунд для оптимизации производительности. Range queries не кэшируются, так как они всегда уникальны (разные временные диапазоны).

**Преимущества:**
- Уменьшение нагрузки на datasources
- Улучшение производительности dashboards
- Снижение latency для повторяющихся запросов

### Как работает Load Balancing?

Grafana поддерживает балансировку нагрузки между множественными instances datasources через round-robin алгоритм. Каждый datasource имеет свой round-robin счетчик, и запросы распределяются равномерно между доступными instances.

### Как настроить Alerting?

1. Включите alerting (`enableAlerting: true`)
2. Настройте notification channels (`alertNotificationChannels`)
3. Создайте alert rules с PromQL запросами
4. Укажите evaluator (gt, lt, eq, ne) и reducer (avg, sum, min, max, last)
5. Укажите `for` duration для оценки алерта
6. Алерты оцениваются автоматически и отправляют уведомления

### Как оптимизировать производительность?

- Используйте разумные refresh intervals (30s-5m)
- Используйте instant queries для текущих значений (кэшируются)
- Оптимизируйте PromQL выражения
- Используйте множественные instances datasources для балансировки нагрузки
- Мониторьте метрики Grafana (query latency, cache hit rate)

### Как мониторить Grafana?

Используйте метрики самого Grafana:
- **Queries Per Second** - нагрузка на datasources
- **Query Latency** - производительность запросов
- **Datasource Errors** - проблемы с подключением
- **Cache Hit Rate** - эффективность кэширования
- **Dashboard Refresh Rate** - частота обновлений
- **Rendering Latency** - производительность рендеринга

---

## Дополнительные ресурсы

- [Официальная документация Grafana](https://grafana.com/docs/)
- [Grafana Data Sources](https://grafana.com/docs/grafana/latest/datasources/)
- [Grafana Dashboards](https://grafana.com/docs/grafana/latest/dashboards/)
- [Grafana Alerting](https://grafana.com/docs/grafana/latest/alerting/)
- [Prometheus Query Language (PromQL)](https://prometheus.io/docs/prometheus/latest/querying/basics/)
- [Loki Query Language (LogQL)](https://grafana.com/docs/loki/latest/logql/)

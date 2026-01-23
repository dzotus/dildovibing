## Обзор

MuleSoft Anypoint Platform — это интеграционная платформа, предназначенная для соединения приложений, данных и устройств через API, коннекторы и потоки (flows). Компонент `MuleSoft` в системе симуляции моделирует Mule Runtime: приложения, коннекторы, потоки обработки, DataWeave‑трансформации, стратегию обработки ошибок и метрики производительности.

### Основные возможности

- ✅ **Applications** — эмуляция Mule приложений с runtime‑версией, worker‑ами и статусами деплоя
- ✅ **Flows** — цепочки обработки данных (источник → процессоры → цель) с ошибко‑обработчиками
- ✅ **Processors** — transform, validate, filter, enrich, logger, choice, try, set‑variable, set‑payload, async
- ✅ **Connectors** — подключение к БД, API, файловым системам, брокерам сообщений и кастомным системам
- ✅ **Error Handling** — стратегии `continue`, `rollback`, `propagate`, on‑error‑continue / on‑error‑propagate
- ✅ **Reconnection Strategy** — exponential, linear, none для коннекторов
- ✅ **DataWeave‑трансформации** — упрощённая эмуляция маппинга и преобразований данных
- ✅ **Интеграция с другими компонентами** — авто‑создание коннекторов по правилам соединений
- ✅ **Метрики в реальном времени** — requests, errors, latency по приложениям и коннекторам

---

## Основные функции

### 1. Applications (Mule приложения)

**Описание:** Приложения представляют развёрнутые Mule Runtime приложения (аналог раздела Runtime Manager).

**Параметры Application:**
- **name** — имя приложения (обязательно, уникальное)
- **runtimeVersion** — версия Mule Runtime (например, `4.6.0`)
- **workerCount** — количество worker‑ов (минимум 1)
- **status** — `running` | `stopped` | `deploying`
- **connectors** — список имён коннекторов, используемых приложением
- **errorStrategy** — стратегия обработки ошибок: `continue` | `rollback` | `propagate`
- **reconnectionStrategy** — стратегия реконнекта: `exponential` | `linear` | `none`
- **auditLogging** — включён ли аудиторский лог
- **flows** — список flows, определённых в приложении

**Метрики приложения (из `MuleSoftRoutingEngine`):**
- **requestCount** — количество обработанных запросов
- **errorCount** — количество ошибок
- **avgResponseTime** — среднее время обработки (ms)

```json
{
  "applications": [
    {
      "name": "orders-app",
      "runtimeVersion": "4.6.0",
      "workerCount": 2,
      "status": "running",
      "errorStrategy": "continue",
      "reconnectionStrategy": "exponential",
      "auditLogging": true
    }
  ]
}
```

### 2. Flows (потоки обработки)

**Описание:** Flow — это основная единица логики в Mule: последовательность шагов обработки сообщения.

**Структура Flow:**
- **id** — уникальный ID
- **name** — имя flow
- **source** — источник (`MuleSource`)
- **processors** — список процессоров (`MuleProcessor[]`)
- **target** — целевой endpoint (`MuleTarget`)
- **errorHandlers** — обработчики ошибок (`MuleErrorHandler[]`)
- **async** — флаг асинхронного выполнения

**MuleSource:**
- **type** — `http-listener` | `scheduler` | `file-reader` | `connector`
- **config** — объект конфигурации (путь/cron/подключение и т.п.)

**MuleTarget:**
- **type** — `http-request` | `database` | `file-writer` | `connector`
- **config** — объект конфигурации (URL, SQL, путь файла и т.п.)

```json
{
  "flows": [
    {
      "id": "flow-1",
      "name": "sync-orders",
      "source": {
        "type": "http-listener",
        "config": {
          "path": "/orders",
          "method": "POST",
          "port": 8081
        }
      },
      "processors": [],
      "target": {
        "type": "database",
        "config": {
          "query": "INSERT INTO orders ...",
          "connection": "orders-db"
        }
      }
    }
  ]
}
```

### 3. Processors (процессоры flow)

**Описание:** Процессоры описывают шаги обработки сообщения внутри flow.

**Поддерживаемые типы:**
- **transform** — DataWeave‑трансформация payload
- **validate** — валидация данных (форматы, диапазоны, обязательные поля)
- **filter** — фильтрация сообщений по условию
- **enrich** — обогащение данных (добавление полей, запрос к внешнему источнику)
- **logger** — логирование (уровень, сообщение, выражения)
- **choice** — условная маршрутизация (when‑условия)
- **try** — scope для управления ошибками
- **set-variable** — установка переменной
- **set-payload** — замена payload
- **async** — асинхронное выполнение части flow

```json
{
  "processors": [
    {
      "id": "p1",
      "type": "logger",
      "config": {
        "level": "INFO",
        "message": "Incoming order"
      }
    },
    {
      "id": "p2",
      "type": "transform",
      "dataweave": "%dw 2.0\noutput application/json\n---\n{\n  id: payload.orderId,\n  total: payload.totalAmount\n}"
    }
  ]
}
```

### 4. Error Handling

**MuleErrorHandler:**
- **type** — `on-error-continue` | `on-error-propagate`
- **errorType** — тип ошибки (например, `VALIDATION`, `CONNECTIVITY`)
- **processors** — процессоры, выполняемые при ошибке

**Стратегии приложения (из `MuleApplication`):**
- **continue** — логировать и продолжать выполнение
- **rollback** — откатить изменения и завершить с ошибкой
- **propagate** — пробросить ошибку наверх

В `MuleSoftRoutingEngine` ошибка обрабатывается через `handleError`, с учётом стратегии приложения и error handlers flow.

### 5. Connectors

**Описание:** Коннекторы обеспечивают подключение Mule к внешним системам.

**Параметры Connector:**
- **name** — имя коннектора (уникальное)
- **type** — `database` | `api` | `file` | `messaging` | `custom`
- **enabled** — активен ли коннектор
- **config** — конфигурация (зависит от типа)
- **targetComponentType** — тип компонента‑цели в симуляции
- **targetComponentId** — ID компонента‑цели

**Часть типичных полей `config`:**
- База данных: `connectionString`, `connectionPoolSize`, `queryTimeout`, `retryPolicy`
- API: `baseUrl`, `authentication`, `headers`, `timeout`
- Messaging: `brokerUrl`, `queueName`, `topicName`, `acknowledgmentMode`
- File: `path`, `pattern`, `encoding`, `bufferSize`

```json
{
  "connectors": [
    {
      "name": "orders-db-connector",
      "type": "database",
      "enabled": true,
      "config": {
        "connectionString": "jdbc:postgresql://db:5432/orders",
        "connectionPoolSize": 10,
        "queryTimeout": 3000,
        "retryPolicy": {
          "maxRetries": 3,
          "retryInterval": 1000,
          "exponentialBackoff": true
        }
      }
    }
  ]
}
```

### 6. Organization и Environment

**Параметры конфигурации:**
- **organization** — организация (по умолчанию `archiphoenix-org`)
- **environment** — окружение (по умолчанию `production`)
- **apiKey** — ключ доступа (опционально, для интеграций с Anypoint)

```json
{
  "organization": "my-org",
  "environment": "production",
  "apiKey": "********"
}
```

---

## Руководство пользователя

### Быстрый старт

1. Добавьте компонент `MuleSoft Integration` на canvas.
2. Откройте панель конфигурации (правый сайдбар).
3. На вкладке **Applications** создайте приложение.
4. Настройте коннекторы на вкладке **Connectors** или через соединения с другими компонентами.
5. Определите flows для приложения (источник, процессоры, цель).
6. Запустите симуляцию и наблюдайте метрики на вкладке **Monitoring**.

### Работа с Applications

- Перейдите во вкладку **Applications**.
- Нажмите **Add Application**, укажите:
  - `name`, `runtimeVersion`, `workerCount`
  - `errorStrategy`, `reconnectionStrategy`, `auditLogging`
- Сохраните приложение.
- Переключайте статус приложения (`running`, `stopped`, `deploying`) через UI — это влияет на симуляцию:
  - `running` — приложение обрабатывает трафик
  - `stopped` — запросы завершаются ошибкой

### Работа с Flows

- Внутри приложения откройте список flows.
- Создайте новый flow, укажите:
  - **Source** (HTTP Listener, Scheduler, File Reader или Connector)
  - **Processors** (transform, validate, logger и др.)
  - **Target** (HTTP Request, Database, File Writer, Connector)
- Для сложной логики используйте:
  - **choice** — ветвление по условиям (`when`)
  - **try** — обработка ошибок в пределах scope
  - **async** — асинхронные участки flow

### Работа с Connectors

- Вкладка **Connectors** позволяет:
  - Создавать коннекторы вручную
  - Включать/отключать коннекторы
  - Настраивать параметры подключения и retry политики
- При соединении MuleSoft с другими компонентами (БД, API, брокеры) по правилам `mulesoftRules`:
  - Автоматически создаются коннекторы корректного типа (`database`, `api`, `messaging`, `file`)
  - В `config` коннектора подставляются host/port из метаданных соединения

### Monitoring

- На вкладке **Monitoring** отображаются:
  - Метрики приложений: `requestCount`, `errorCount`, `avgResponseTime`
  - Метрики коннекторов: количество запросов, ошибок, latency, `healthStatus`
- Статусы коннекторов:
  - `connected` — трафик идёт, ошибок немного
  - `disconnected` — нет активности или давно не было запросов
  - `error` — высокий процент ошибок

---

## Руководство администратора

### Рекомендации по конфигурации Runtime

- **Runtime Version:** используйте актуальную поддерживаемую версию (например, `4.6.x`).
- **Worker Count:** подбирайте по нагрузке:
  - 1–2 для dev/stage
  - 2–4 для production начального уровня
  - 4+ для высоконагруженных сценариев
- **Error Strategy:**
  - `continue` — для не‑критичных интеграций
  - `rollback` — для транзакционных операций (БД, платёжные системы)
  - `propagate` — когда ошибки должны быть явно видны клиентам

### Настройка коннекторов

- Для **database connectors**:
  - Настраивайте пул соединений и тайм‑ауты исходя из времени ответов БД.
  - Включайте retry только при безопасных операциях (idempotent).
- Для **API connectors**:
  - Настройте `timeout` чуть выше ожидаемой latency сервисов.
  - Используйте аутентификацию (`oauth`, `basic`, `apikey`) при необходимости.
- Для **messaging connectors**:
  - Контролируйте `acknowledgmentMode` (`auto` vs `manual`) в зависимости от гарантии доставки.

### Обработка ошибок

- Явно задавайте `errorStrategy` для приложений.
- Используйте `try` scopes и `on-error-continue / propagate` для локальной обработки ошибок.
- Логируйте ошибки через `logger` и включайте `auditLogging` для критичных интеграций.

### Масштабирование и производительность

- Увеличивайте `workerCount` при росте `throughput` и `latency`.
- Оптимизируйте DataWeave‑выражения (избегайте лишних преобразований).
- Используйте асинхронные процессоры для долгих внешних вызовов.

---

## Метрики и мониторинг

### Основные метрики (узел MuleSoft)

- **throughput** — количество обработанных сообщений в секунду.
- **latency** — средняя задержка обработки (Mule runtime + коннекторы + трансформации).
- **errorRate** — доля сообщений, завершившихся ошибкой.
- **utilization** — загрузка worker‑ов (0–1).

### Кастомные метрики (из `simulateMuleSoft`)

- `applications` — количество приложений.
- `running_applications` — количество запущенных приложений.
- `connectors` — всего коннекторов.
- `enabled_connectors` — количество активных коннекторов.
- `total_requests` — суммарное количество обработанных запросов.
- `total_errors` — суммарное количество ошибок.
- `avg_latency` — средняя latency по всем приложениям.
- `total_workers` — суммарное количество worker‑ов.
- `runtime_latency` — базовая задержка Mule Runtime.
- `connector_latency` — задержка внешних систем.
- `transformation_latency` — задержка DataWeave‑трансформаций.

### Метрики приложений и коннекторов

- Для **приложения**:
  - `requestCount`, `errorCount`, `avgLatency`, `lastRequestTime`.
- Для **коннектора**:
  - `requestCount`, `errorCount`, `avgLatency`, `lastRequestTime`.
  - Производится оценка `healthStatus` по доле ошибок и давности активности.

---

## Примеры использования

### Пример 1: Синхронизация заказов из REST API в БД

```json
{
  "applications": [
    {
      "name": "orders-sync",
      "runtimeVersion": "4.6.0",
      "workerCount": 2,
      "status": "running",
      "errorStrategy": "rollback",
      "reconnectionStrategy": "exponential",
      "auditLogging": true,
      "flows": [
        {
          "id": "orders-flow",
          "name": "orders-rest-to-db",
          "source": {
            "type": "http-listener",
            "config": {
              "path": "/orders",
              "method": "POST",
              "port": 8081
            }
          },
          "processors": [
            {
              "id": "log-in",
              "type": "logger",
              "config": {
                "level": "INFO",
                "message": "New order received"
              }
            },
            {
              "id": "transform-order",
              "type": "transform",
              "dataweave": "%dw 2.0\noutput application/json\n---\n{\n  id: payload.id,\n  total: payload.total,\n  createdAt: now()\n}"
            }
          ],
          "target": {
            "type": "database",
            "config": {
              "query": "INSERT INTO orders (id, total, created_at) VALUES (:id, :total, :createdAt)",
              "connection": "orders-db-connector"
            }
          }
        }
      ]
    }
  ]
}
```

### Пример 2: Интеграция с Kafka через коннектор

```json
{
  "connectors": [
    {
      "name": "kafka-orders",
      "type": "messaging",
      "enabled": true,
      "config": {
        "brokerUrl": "kafka:9092",
        "topicName": "orders",
        "acknowledgmentMode": "auto"
      },
      "targetComponentType": "kafka",
      "targetComponentId": "kafka-1"
    }
  ]
}
```

### Пример 3: ETL из файловой системы в API

```json
{
  "applications": [
    {
      "name": "file-to-api-etl",
      "runtimeVersion": "4.6.0",
      "workerCount": 1,
      "status": "running",
      "flows": [
        {
          "id": "file-flow",
          "name": "csv-to-api",
          "source": {
            "type": "file-reader",
            "config": {
              "path": "/data/incoming",
              "pattern": "*.csv",
              "encoding": "utf-8"
            }
          },
          "processors": [
            {
              "id": "parse",
              "type": "transform",
              "dataweave": "%dw 2.0\noutput application/json\n---\n// CSV to JSON трансформация"
            }
          ],
          "target": {
            "type": "http-request",
            "config": {
              "method": "POST",
              "url": "https://api.example.com/import"
            }
          }
        }
      ]
    }
  ]
}
```

---

## FAQ

**Вопрос:** Что эмулирует компонент MuleSoft в системе?  
**Ответ:** Он моделирует Mule Runtime: приложения, flows, коннекторы, обработку ошибок и влияние этих настроек на метрики (throughput, latency, errorRate, utilization).

**Вопрос:** Как MuleSoft взаимодействует с другими компонентами (БД, Kafka, REST‑сервисы)?  
**Ответ:** Через коннекторы. При создании соединения с MuleSoft правила `mulesoftRules` автоматически добавляют коннекторы корректного типа и заполняют базовую конфигурацию (host, port, baseUrl, broker).

**Вопрос:** Влияет ли количество worker‑ов на симуляцию?  
**Ответ:** Да. В `simulateMuleSoft` пропускная способность и utilization зависят от `workerCount` и количества запущенных приложений.

**Вопрос:** Где настраивать сетевые параметры (latency, bandwidth и т.п.)?  
**Ответ:** Все сетевые параметры настраиваются в правом сайдбаре глобальных сетевых настроек, а не в конфиге компонента MuleSoft.

**Вопрос:** Какие реальные возможности MuleSoft не симулируются?  
**Ответ:** В текущей симуляции нет отдельных модулей API Manager, Exchange, Runtime Manager и DataGraph — фокус на runtime‑поведении приложений и интеграционных потоках.

---

## Дополнительные ресурсы

- [MuleSoft Anypoint Platform Overview](https://www.mulesoft.com/platform/anypoint-platform)
- [Mule Runtime Documentation](https://docs.mulesoft.com/mule-runtime/latest/)
- [DataWeave Documentation](https://docs.mulesoft.com/dataweave/latest/)
- [Anypoint Connectors](https://docs.mulesoft.com/connectors/)


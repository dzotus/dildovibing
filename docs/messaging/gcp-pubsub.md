# Google Cloud Pub/Sub - Документация компонента

## Обзор

Google Cloud Pub/Sub - это полностью управляемая служба обмена сообщениями от Google Cloud Platform, предназначенная для надежной доставки сообщений между компонентами распределенных систем в облаке. Компонент Google Pub/Sub в системе симуляции полностью эмулирует поведение реального Google Cloud Pub/Sub, включая топики, подписки, push/pull доставку, ack deadlines, message ordering, dead letter topics, exactly-once delivery, schemas и flow control.

### Основные возможности

- ✅ **Топики (Topics)** - Публикация сообщений
- ✅ **Подписки (Subscriptions)** - Pull и Push подписки для получения сообщений
- ✅ **Ack Deadlines** - Автоматический возврат сообщений при истечении deadline
- ✅ **Message Ordering** - Упорядоченная доставка по ordering keys
- ✅ **Dead Letter Topics** - Обработка недоставленных сообщений
- ✅ **Exactly-Once Delivery** - Гарантия доставки без дубликатов
- ✅ **Schemas** - Валидация сообщений по схемам (Avro, Protocol Buffers, JSON)
- ✅ **Flow Control** - Контроль количества необработанных сообщений
- ✅ **Push Subscriptions** - HTTP push доставка с retry logic
- ✅ **Expiration Policy** - Автоматическое удаление неактивных подписок
- ✅ **Retry Policy** - Политика повторных попыток с exponential backoff
- ✅ **Метрики в реальном времени** - Отслеживание сообщений, delivery attempts, push success rate

---

## Основные функции

### 1. Управление Project

**Описание:** Настройка Google Cloud проекта для Pub/Sub.

**Параметры:**
- **projectId** - Идентификатор GCP проекта (обязательно, по умолчанию: `archiphoenix-lab`)
- **credentials** - JSON credentials для аутентификации (опционально, для симуляции)

**Пример конфигурации:**
```json
{
  "projectId": "my-gcp-project",
  "credentials": "{\"type\":\"service_account\",\"project_id\":\"my-gcp-project\",...}"
}
```

### 2. Управление топиками (Topics)

**Описание:** Создание и настройка топиков для публикации сообщений.

**Параметры топика:**
- **name** - Имя топика (обязательно, 3-255 символов, `[a-z][a-z0-9-]*[a-z0-9]`, не может начинаться с `goog`)
- **projectId** - Идентификатор проекта (по умолчанию: из конфигурации)
- **messageRetentionDuration** - Время хранения сообщений в секундах (600-2678400, по умолчанию: 7 дней)
- **labels** - Метки для организации (key-value пары, опционально)
- **schema** - Схема для валидации сообщений (опционально):
  - **type** - Тип схемы: `AVRO`, `PROTOCOL_BUFFER`, `JSON`
  - **definition** - Определение схемы (Avro schema JSON, .proto файл, или JSON schema)

**Метрики топика (обновляются в реальном времени):**
- **messageCount** - Количество сообщений в топике
- **byteCount** - Размер топика в байтах
- **validationErrorCount** - Количество сообщений, не прошедших валидацию схемы

**Пример конфигурации:**
```json
{
  "topics": [
    {
      "name": "user-events",
      "projectId": "my-gcp-project",
      "messageRetentionDuration": 604800,
      "labels": {
        "environment": "production",
        "team": "analytics"
      },
      "schema": {
        "type": "AVRO",
        "definition": "{\"type\":\"record\",\"name\":\"UserEvent\",\"fields\":[{\"name\":\"userId\",\"type\":\"string\"}]}"
      }
    }
  ]
}
```

### 3. Управление подписками (Subscriptions)

**Описание:** Создание и настройка подписок для получения сообщений из топиков.

**Параметры подписки:**
- **name** - Имя подписки (обязательно, те же правила что и для топиков)
- **topic** - Имя топика для подписки (обязательно)
- **projectId** - Идентификатор проекта (по умолчанию: из конфигурации)
- **ackDeadlineSeconds** - Время для подтверждения сообщения в секундах (10-600, по умолчанию: 10)
- **messageRetentionDuration** - Время хранения сообщений в секундах (600-2678400, опционально)
- **enableMessageOrdering** - Включить упорядоченную доставку (по умолчанию: `false`)
- **pushEndpoint** - URL для push подписки (опционально, должен быть HTTPS)
- **pushAttributes** - Атрибуты для push запросов (опционально)
- **payloadFormat** - Формат payload для push: `WRAPPED` или `UNWRAPPED` (по умолчанию: `WRAPPED`)
- **deadLetterTopic** - Топик для недоставленных сообщений (опционально)
- **maxDeliveryAttempts** - Максимальное количество попыток доставки (по умолчанию: 5)
- **retryPolicy** - Политика повторных попыток:
  - `minimumBackoff` - Минимальная задержка в секундах (по умолчанию: 10)
  - `maximumBackoff` - Максимальная задержка в секундах (по умолчанию: 600)
- **enableExactlyOnceDelivery** - Включить exactly-once доставку (по умолчанию: `false`)
- **expirationPolicy** - Политика истечения подписки:
  - `ttl` - Time-to-live в секундах (подписка удаляется при неактивности)
- **flowControl** - Контроль потока:
  - `maxOutstandingMessages` - Максимум необработанных сообщений (0 = без ограничений, по умолчанию: 1000)
  - `maxOutstandingBytes` - Максимум необработанных байт (0 = без ограничений, по умолчанию: 0)

**Метрики подписки (обновляются в реальном времени):**
- **messageCount** - Количество доступных сообщений
- **unackedMessageCount** - Количество необработанных сообщений
- **deliveredCount** - Количество доставленных сообщений
- **acknowledgedCount** - Количество подтвержденных сообщений
- **nackedCount** - Количество отклоненных сообщений
- **deadLetterCount** - Количество сообщений в dead letter topic
- **pushDeliverySuccessRate** - Процент успешных push доставок (0-100)
- **expiredAckDeadlines** - Количество истекших ack deadlines
- **avgDeliveryAttempts** - Среднее количество попыток доставки

**Пример конфигурации:**
```json
{
  "subscriptions": [
    {
      "name": "analytics-subscription",
      "topic": "user-events",
      "projectId": "my-gcp-project",
      "ackDeadlineSeconds": 60,
      "enableMessageOrdering": false,
      "deadLetterTopic": "user-events-dlq",
      "maxDeliveryAttempts": 5,
      "retryPolicy": {
        "minimumBackoff": 10,
        "maximumBackoff": 600
      },
      "enableExactlyOnceDelivery": true,
      "flowControl": {
        "maxOutstandingMessages": 1000,
        "maxOutstandingBytes": 0
      }
    }
  ]
}
```

### 4. Pull и Push подписки

**Описание:** Два способа получения сообщений из подписок.

#### Pull Subscriptions

**Характеристики:**
- Клиент явно запрашивает сообщения через API
- Поддерживает batch получение (до 1000 сообщений за запрос)
- Контроль над скоростью получения
- Подходит для серверных приложений

**Использование:**
- Не указывайте `pushEndpoint` в конфигурации подписки
- Сообщения получаются через `pullFromSubscription()`
- Требуется явное подтверждение через `ack()` или `nack()`

#### Push Subscriptions

**Характеристики:**
- Pub/Sub автоматически отправляет сообщения на указанный endpoint
- HTTP POST запросы к `pushEndpoint`
- Автоматические retry при ошибках
- Подходит для веб-приложений и serverless функций

**Параметры:**
- **pushEndpoint** - HTTPS URL для получения сообщений (обязательно для push)
- **pushAttributes** - Дополнительные заголовки для push запросов
- **payloadFormat** - Формат payload:
  - `WRAPPED` - Полный Pub/Sub формат с оберткой (по умолчанию)
  - `UNWRAPPED` - Только данные сообщения

**Retry Logic:**
- При ошибке (4xx/5xx) сообщение возвращается в подписку
- Exponential backoff между попытками
- После `maxDeliveryAttempts` сообщение отправляется в dead letter topic

**Пример конфигурации:**
```json
{
  "subscriptions": [
    {
      "name": "webhook-subscription",
      "topic": "user-events",
      "pushEndpoint": "https://api.example.com/webhook",
      "payloadFormat": "WRAPPED",
      "maxDeliveryAttempts": 3
    }
  ]
}
```

### 5. Ack Deadlines

**Описание:** Время для подтверждения получения сообщения.

**Как работает:**
1. Сообщение получается из подписки
2. Сообщение блокируется на время `ackDeadlineSeconds`
3. Если сообщение подтверждено (`ack()`) в течение deadline - оно удаляется
4. Если deadline истек - сообщение снова становится доступным
5. Можно продлить deadline через `modifyAckDeadline()`

**Параметры:**
- **ackDeadlineSeconds** - Время для подтверждения в секундах (10-600, по умолчанию: 10)

**Рекомендации:**
- Установите deadline = время обработки × 2-3
- Слишком короткий - возможны дубликаты
- Слишком длинный - задержка при ошибках обработки

**Пример конфигурации:**
```json
{
  "ackDeadlineSeconds": 60
}
```

### 6. Message Ordering

**Описание:** Упорядоченная доставка сообщений по ordering keys.

**Как работает:**
- Сообщения с одинаковым `orderingKey` доставляются строго по порядку
- Разные ключи могут обрабатываться параллельно
- Требует `enableMessageOrdering: true` в подписке

**Использование:**
- Укажите `orderingKey` при публикации сообщения
- Сообщения с одинаковым ключом обрабатываются последовательно
- Полезно для упорядоченной обработки событий от одного источника

**Пример конфигурации:**
```json
{
  "subscriptions": [
    {
      "name": "ordered-subscription",
      "topic": "user-events",
      "enableMessageOrdering": true
    }
  ]
}
```

### 7. Dead Letter Topics

**Описание:** Топик для недоставленных сообщений.

**Как работает:**
1. Сообщение получается из подписки
2. Если обработка не удалась - сообщение возвращается в подписку
3. При каждой попытке увеличивается счетчик попыток
4. Когда попытки превышают `maxDeliveryAttempts` - сообщение отправляется в dead letter topic

**Параметры:**
- **deadLetterTopic** - Имя топика для недоставленных сообщений (опционально)
- **maxDeliveryAttempts** - Максимальное количество попыток (по умолчанию: 5)

**Использование:**
- Создайте отдельный топик для dead letter messages
- Мониторьте dead letter topic для анализа проблем
- Можно обработать сообщения из dead letter topic вручную

**Пример конфигурации:**
```json
{
  "topics": [
    {
      "name": "user-events-dlq"
    }
  ],
  "subscriptions": [
    {
      "name": "analytics-subscription",
      "topic": "user-events",
      "deadLetterTopic": "user-events-dlq",
      "maxDeliveryAttempts": 5
    }
  ]
}
```

### 8. Exactly-Once Delivery

**Описание:** Гарантия доставки сообщения ровно один раз.

**Как работает:**
- Отслеживание доставленных сообщений по `messageId`
- Предотвращение повторной доставки уже доставленных сообщений
- Требует `enableExactlyOnceDelivery: true` в подписке

**Особенности:**
- Увеличивает задержку доставки (проверка дубликатов)
- Требует дополнительных ресурсов для отслеживания
- Гарантирует отсутствие дубликатов даже при сбоях

**Пример конфигурации:**
```json
{
  "subscriptions": [
    {
      "name": "critical-subscription",
      "topic": "user-events",
      "enableExactlyOnceDelivery": true
    }
  ]
}
```

### 9. Schemas

**Описание:** Валидация сообщений по схемам при публикации.

**Типы схем:**
- **AVRO** - Apache Avro схема (JSON формат)
- **PROTOCOL_BUFFER** - Protocol Buffers схема (.proto файл)
- **JSON** - JSON Schema

**Как работает:**
1. Схема определяется для топика
2. При публикации сообщения валидируются по схеме
3. Сообщения, не прошедшие валидацию, отклоняются
4. Метрика `validationErrorCount` отслеживает ошибки валидации

**Пример конфигурации:**
```json
{
  "topics": [
    {
      "name": "user-events",
      "schema": {
        "type": "AVRO",
        "definition": "{\"type\":\"record\",\"name\":\"UserEvent\",\"fields\":[{\"name\":\"userId\",\"type\":\"string\"},{\"name\":\"eventType\",\"type\":\"string\"}]}"
      }
    }
  ]
}
```

### 10. Flow Control

**Описание:** Контроль количества необработанных сообщений.

**Параметры:**
- **maxOutstandingMessages** - Максимум необработанных сообщений (0 = без ограничений, по умолчанию: 1000)
- **maxOutstandingBytes** - Максимум необработанных байт (0 = без ограничений, по умолчанию: 0)

**Как работает:**
- Ограничивает количество сообщений, которые могут быть получены без подтверждения
- Предотвращает переполнение памяти потребителя
- При достижении лимита новые сообщения не доставляются до подтверждения существующих

**Пример конфигурации:**
```json
{
  "subscriptions": [
    {
      "name": "limited-subscription",
      "topic": "user-events",
      "flowControl": {
        "maxOutstandingMessages": 100,
        "maxOutstandingBytes": 10485760
      }
    }
  ]
}
```

### 11. Retry Policy

**Описание:** Политика повторных попыток доставки при ошибках.

**Параметры:**
- **minimumBackoff** - Минимальная задержка между попытками в секундах (по умолчанию: 10)
- **maximumBackoff** - Максимальная задержка между попытками в секундах (по умолчанию: 600)

**Как работает:**
- При ошибке доставки (push subscription) применяется exponential backoff
- Задержка увеличивается экспоненциально от `minimumBackoff` до `maximumBackoff`
- После `maxDeliveryAttempts` сообщение отправляется в dead letter topic

**Пример конфигурации:**
```json
{
  "subscriptions": [
    {
      "name": "retry-subscription",
      "topic": "user-events",
      "maxDeliveryAttempts": 5,
      "retryPolicy": {
        "minimumBackoff": 10,
        "maximumBackoff": 600
      }
    }
  ]
}
```

### 12. Expiration Policy

**Описание:** Автоматическое удаление неактивных подписок.

**Параметры:**
- **ttl** - Time-to-live в секундах (подписка удаляется при неактивности в течение этого времени)

**Как работает:**
- Отслеживается `lastActivity` timestamp для каждой подписки
- При неактивности в течение `ttl` подписка автоматически удаляется
- Полезно для временных подписок и тестирования

**Пример конфигурации:**
```json
{
  "subscriptions": [
    {
      "name": "temporary-subscription",
      "topic": "user-events",
      "expirationPolicy": {
        "ttl": 86400
      }
    }
  ]
}
```

---

## Руководство пользователя

### Быстрый старт

1. **Добавление компонента Google Pub/Sub:**
   - Перетащите компонент "Google Pub/Sub" из библиотеки компонентов на canvas
   - Откройте панель конфигурации компонента

2. **Базовая настройка:**
   - Укажите Project ID (например, `my-gcp-project`)
   - Создайте первый топик через вкладку "Topics"
   - Создайте первую подписку через вкладку "Subscriptions"

3. **Подключение к другим компонентам:**
   - Создайте соединение от компонента-производителя к Google Pub/Sub
   - Создайте соединение от Google Pub/Sub к компоненту-потребителю
   - Настройте имя топика/подписки в соединении

### Работа с топиками

#### Создание топика

1. Перейдите на вкладку **"Topics"**
2. Нажмите кнопку **"Create Topic"**
3. Заполните параметры:
   - **Name** - Имя топика (3-255 символов, `[a-z][a-z0-9-]*[a-z0-9]`)
   - **Project ID** - Идентификатор проекта
   - **Message Retention** - Время хранения сообщений (секунды)
4. Настройте дополнительные параметры (опционально):
   - Labels (key-value пары)
   - Schema (тип и определение)
5. Нажмите **"Save"**

#### Настройка Schema

1. Выберите топик из списка
2. Нажмите кнопку **"Edit"** (иконка карандаша)
3. В разделе **"Schema"**:
   - Выберите тип схемы (AVRO, PROTOCOL_BUFFER, JSON)
   - Введите определение схемы
4. Нажмите **"Save"**

**Примеры схем:**

**AVRO:**
```json
{
  "type": "record",
  "name": "UserEvent",
  "fields": [
    {"name": "userId", "type": "string"},
    {"name": "eventType", "type": "string"},
    {"name": "timestamp", "type": "long"}
  ]
}
```

**JSON Schema:**
```json
{
  "type": "object",
  "properties": {
    "userId": {"type": "string"},
    "eventType": {"type": "string"},
    "timestamp": {"type": "number"}
  },
  "required": ["userId", "eventType"]
}
```

#### Просмотр метрик топика

Во время симуляции на вкладке **"Topics"** отображаются:
- **Messages** - Количество сообщений в топике
- **Bytes** - Размер топика в байтах
- **Validation Errors** - Количество сообщений, не прошедших валидацию схемы

### Работа с подписками

#### Создание подписки

1. Перейдите на вкладку **"Subscriptions"**
2. Нажмите кнопку **"Create Subscription"**
3. Заполните параметры:
   - **Name** - Имя подписки
   - **Topic** - Выберите топик для подписки
   - **Project ID** - Идентификатор проекта
   - **Ack Deadline** - Время для подтверждения (секунды)
4. Настройте тип подписки:
   - **Pull** - Не указывайте push endpoint
   - **Push** - Укажите push endpoint URL (HTTPS)
5. Настройте дополнительные параметры (опционально):
   - Enable Message Ordering
   - Dead Letter Topic
   - Max Delivery Attempts
   - Retry Policy
   - Exactly-Once Delivery
   - Expiration Policy
   - Flow Control
6. Нажмите **"Save"**

#### Настройка Push подписки

1. При создании/редактировании подписки укажите:
   - **Push Endpoint** - HTTPS URL для получения сообщений
   - **Payload Format** - WRAPPED или UNWRAPPED
   - **Push Attributes** - Дополнительные заголовки (опционально)
2. Настройте retry policy:
   - **Max Delivery Attempts** - Максимальное количество попыток
   - **Retry Policy** - Minimum и Maximum backoff
3. Нажмите **"Save"**

#### Просмотр метрик подписки

Во время симуляции на вкладке **"Subscriptions"** отображаются:
- **Messages** - Количество доступных сообщений
- **Unacked** - Количество необработанных сообщений
- **Delivered** - Количество доставленных сообщений
- **Acknowledged** - Количество подтвержденных сообщений
- **Nacked** - Количество отклоненных сообщений
- **Dead Letter** - Количество сообщений в dead letter topic
- **Push Success Rate** - Процент успешных push доставок
- **Avg Delivery Attempts** - Среднее количество попыток доставки
- **Expired Acks** - Количество истекших ack deadlines

### Настройка Credentials

1. Перейдите на вкладку **"Credentials"**
2. Вставьте JSON credentials (service account key)
3. Изменения сохраняются автоматически

**Примечание:** В симуляции credentials используются для генерации идентификаторов, реальная аутентификация не выполняется.

---

## Руководство администратора

### Рекомендации по конфигурации

#### Production топик

```json
{
  "topics": [
    {
      "name": "production-events",
      "projectId": "production-project",
      "messageRetentionDuration": 604800,
      "labels": {
        "environment": "production",
        "team": "platform"
      },
      "schema": {
        "type": "AVRO",
        "definition": "{...}"
      }
    }
  ]
}
```

**Рекомендации:**
- Используйте схемы для валидации сообщений
- Настройте message retention в соответствии с требованиями
- Используйте labels для организации топиков
- Мониторьте validation errors

#### Production подписка

```json
{
  "subscriptions": [
    {
      "name": "production-subscription",
      "topic": "production-events",
      "ackDeadlineSeconds": 60,
      "enableMessageOrdering": false,
      "deadLetterTopic": "production-events-dlq",
      "maxDeliveryAttempts": 5,
      "retryPolicy": {
        "minimumBackoff": 10,
        "maximumBackoff": 600
      },
      "enableExactlyOnceDelivery": true,
      "flowControl": {
        "maxOutstandingMessages": 1000,
        "maxOutstandingBytes": 0
      }
    }
  ]
}
```

**Рекомендации:**
- Используйте dead letter topics для обработки ошибок
- Настройте ack deadline = время обработки × 2-3
- Используйте exactly-once delivery для критичных подписок
- Настройте flow control для предотвращения переполнения

### Оптимизация производительности

#### Ack Deadline

- **Слишком короткий:** Сообщения могут быть обработаны дважды
- **Слишком длинный:** Задержка при ошибках обработки
- **Рекомендация:** Время обработки сообщения × 2-3

#### Flow Control

- **maxOutstandingMessages:** Ограничивает количество необработанных сообщений
- **maxOutstandingBytes:** Ограничивает объем необработанных данных
- **Рекомендация:** Установите лимиты в соответствии с возможностями потребителя

#### Message Ordering

- Включайте только когда необходим порядок
- Увеличивает задержку доставки
- Используйте разные ordering keys для параллельной обработки

#### Exactly-Once Delivery

- Используйте для критичных подписок
- Увеличивает задержку доставки (проверка дубликатов)
- Требует дополнительных ресурсов

### Безопасность

#### Credentials

- Используйте service account keys для аутентификации
- Храните credentials в безопасном месте
- Используйте минимальные необходимые права доступа

#### Push Endpoints

- Используйте HTTPS для push endpoints
- Реализуйте аутентификацию на push endpoint
- Валидируйте запросы от Pub/Sub

### Мониторинг и алертинг

#### Ключевые метрики

1. **Message Count**
   - Нормальное значение: зависит от нагрузки
   - Алерт: постоянный рост или превышение порога

2. **Unacked Messages**
   - Нормальное значение: < 1000 для большинства случаев
   - Алерт: постоянно высокое значение (возможна проблема с обработкой)

3. **Dead Letter Count**
   - Нормальное значение: 0 или минимальное количество
   - Алерт: постоянный рост (проблемы с обработкой сообщений)

4. **Push Delivery Success Rate**
   - Нормальное значение: > 95%
   - Алерт: < 90% (проблемы с push endpoint)

5. **Expired Ack Deadlines**
   - Нормальное значение: < 1% от delivered messages
   - Алерт: > 5% (возможно, ack deadline слишком короткий)

6. **Validation Errors**
   - Нормальное значение: 0
   - Алерт: любое значение > 0 (проблемы с форматом сообщений)

#### Cloud Monitoring метрики

Мониторинг через Google Cloud Monitoring:
- **Pub/Sub Message Count** - Количество сообщений
- **Pub/Sub Byte Count** - Размер сообщений
- **Pub/Sub Ack Deadline** - Время до истечения deadline
- **Pub/Sub Delivery Attempts** - Количество попыток доставки
- **Pub/Sub Push Delivery** - Статус push доставки

---

## Метрики и мониторинг

### Основные метрики

#### Throughput
- **Описание:** Количество сообщений в секунду
- **Единица измерения:** msg/sec
- **Источник:** Рассчитывается на основе входящих соединений и конфигурации

#### Latency
- **Описание:** Задержка обработки сообщений
- **Единица измерения:** миллисекунды (ms)
- **Факторы влияния:**
  - Ack deadline
  - Message retention
  - Глубина подписки
  - Push/Pull тип подписки
  - Exactly-once delivery

#### Error Rate
- **Описание:** Процент ошибок при обработке
- **Единица измерения:** процент (0-1)
- **Причины ошибок:**
  - Превышение max delivery attempts
  - Истечение TTL
  - Ошибки валидации схемы
  - Push delivery failures

#### Utilization
- **Описание:** Загрузка Pub/Sub
- **Единица измерения:** процент (0-1)
- **Расчет:** На основе глубины подписок и пропускной способности

### Метрики топиков

Для каждого топика доступны:
- **Message Count** - Количество сообщений
- **Byte Count** - Размер в байтах
- **Validation Error Count** - Количество ошибок валидации схемы
- **Published Count** - Количество опубликованных сообщений

### Метрики подписок

Для каждой подписки доступны:
- **Message Count** - Количество доступных сообщений
- **Unacked Message Count** - Количество необработанных сообщений
- **Delivered Count** - Количество доставленных сообщений
- **Acknowledged Count** - Количество подтвержденных сообщений
- **Nacked Count** - Количество отклоненных сообщений
- **Dead Letter Count** - Количество сообщений в dead letter topic
- **Push Delivery Success Rate** - Процент успешных push доставок
- **Expired Ack Deadlines** - Количество истекших ack deadlines
- **Avg Delivery Attempts** - Среднее количество попыток доставки

### Мониторинг в реальном времени

Все метрики обновляются в реальном времени во время симуляции:
- Метрики топиков/подписок обновляются каждые 500ms
- Метрики операций обновляются при выполнении операций
- Throughput рассчитывается на основе входящих соединений

---

## Примеры использования

### Пример 1: Pull подписка с Dead Letter Topic

**Сценарий:** Обработка событий с обработкой ошибок

```json
{
  "topics": [
    {
      "name": "user-events"
    },
    {
      "name": "user-events-dlq"
    }
  ],
  "subscriptions": [
    {
      "name": "analytics-subscription",
      "topic": "user-events",
      "ackDeadlineSeconds": 60,
      "deadLetterTopic": "user-events-dlq",
      "maxDeliveryAttempts": 5,
      "retryPolicy": {
        "minimumBackoff": 10,
        "maximumBackoff": 600
      }
    }
  ]
}
```

### Пример 2: Push подписка с Retry Policy

**Сценарий:** Webhook доставка событий

```json
{
  "subscriptions": [
    {
      "name": "webhook-subscription",
      "topic": "user-events",
      "pushEndpoint": "https://api.example.com/webhook",
      "payloadFormat": "WRAPPED",
      "maxDeliveryAttempts": 3,
      "retryPolicy": {
        "minimumBackoff": 5,
        "maximumBackoff": 300
      }
    }
  ]
}
```

### Пример 3: Топик с Schema Validation

**Сценарий:** Валидация сообщений по схеме

```json
{
  "topics": [
    {
      "name": "validated-events",
      "schema": {
        "type": "AVRO",
        "definition": "{\"type\":\"record\",\"name\":\"UserEvent\",\"fields\":[{\"name\":\"userId\",\"type\":\"string\"},{\"name\":\"eventType\",\"type\":\"string\"}]}"
      }
    }
  ]
}
```

### Пример 4: Message Ordering

**Сценарий:** Упорядоченная обработка событий пользователя

```json
{
  "subscriptions": [
    {
      "name": "ordered-subscription",
      "topic": "user-events",
      "enableMessageOrdering": true,
      "ackDeadlineSeconds": 120
    }
  ]
}
```

Использование ordering keys:
- `orderingKey: "user-123"` - все сообщения для пользователя 123 обрабатываются по порядку
- `orderingKey: "user-456"` - все сообщения для пользователя 456 обрабатываются по порядку
- Разные ключи обрабатываются параллельно

### Пример 5: Exactly-Once Delivery

**Сценарий:** Критичная обработка без дубликатов

```json
{
  "subscriptions": [
    {
      "name": "critical-subscription",
      "topic": "payment-events",
      "enableExactlyOnceDelivery": true,
      "ackDeadlineSeconds": 60
    }
  ]
}
```

### Пример 6: Flow Control

**Сценарий:** Ограничение необработанных сообщений

```json
{
  "subscriptions": [
    {
      "name": "limited-subscription",
      "topic": "high-volume-events",
      "flowControl": {
        "maxOutstandingMessages": 100,
        "maxOutstandingBytes": 10485760
      }
    }
  ]
}
```

---

## Часто задаваемые вопросы (FAQ)

### Когда использовать Pull, а когда Push подписки?

- **Pull:** Для серверных приложений, когда нужен контроль над скоростью получения
- **Push:** Для веб-приложений и serverless функций, когда нужна автоматическая доставка

### Что такое Ack Deadline?

Ack Deadline - это время, в течение которого сообщение должно быть подтверждено после получения. Если deadline истек, сообщение снова становится доступным.

### Как выбрать Ack Deadline?

Рекомендуется: время обработки сообщения × 2-3. Слишком короткий - возможны дубликаты, слишком длинный - задержка при ошибках.

### Что такое Dead Letter Topic?

Dead Letter Topic - это топик для недоставленных сообщений. Сообщения отправляются в dead letter topic после превышения `maxDeliveryAttempts` попыток доставки.

### Как работает Message Ordering?

Message Ordering обеспечивает упорядоченную доставку сообщений с одинаковым `orderingKey`. Сообщения с разными ключами могут обрабатываться параллельно.

### Что такое Exactly-Once Delivery?

Exactly-Once Delivery гарантирует доставку сообщения ровно один раз, предотвращая дубликаты даже при сбоях. Требует дополнительных ресурсов и увеличивает задержку.

### Как работает Schema Validation?

Schema Validation проверяет сообщения при публикации в топик. Сообщения, не соответствующие схеме, отклоняются и не публикуются.

### Что такое Flow Control?

Flow Control ограничивает количество необработанных сообщений в подписке. Предотвращает переполнение памяти потребителя.

### Как работает Retry Policy?

Retry Policy определяет поведение при ошибках доставки:
- Exponential backoff между попытками
- От `minimumBackoff` до `maximumBackoff`
- После `maxDeliveryAttempts` сообщение отправляется в dead letter topic

### Что такое Expiration Policy?

Expiration Policy автоматически удаляет неактивные подписки после периода неактивности (TTL). Полезно для временных подписок.

---

## Дополнительные ресурсы

- [Официальная документация Google Cloud Pub/Sub](https://cloud.google.com/pubsub/docs)
- [Google Cloud Pub/Sub Best Practices](https://cloud.google.com/pubsub/docs/best-practices)
- [Google Cloud Pub/Sub API Reference](https://cloud.google.com/pubsub/docs/reference/rest)

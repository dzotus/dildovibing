# AWS SQS - Документация компонента

## Обзор

Amazon Simple Queue Service (SQS) - это полностью управляемая служба очередей сообщений от Amazon Web Services, предназначенная для надежной доставки сообщений между компонентами распределенных систем. Компонент AWS SQS в системе симуляции полностью эмулирует поведение реального AWS SQS, включая Standard и FIFO очереди, visibility timeout, message retention, Dead Letter Queues, batch операции, long polling и IAM policies.

### Основные возможности

- ✅ **Standard и FIFO очереди** - Два типа очередей с различными гарантиями
- ✅ **Visibility Timeout** - Временное скрытие сообщений при обработке
- ✅ **Message Retention** - Автоматическое удаление старых сообщений
- ✅ **Dead Letter Queue (DLQ)** - Обработка недоставленных сообщений
- ✅ **Batch операции** - Эффективная отправка и получение сообщений
- ✅ **Long Polling** - Оптимизация получения сообщений
- ✅ **IAM Policies** - Контроль доступа на уровне AWS IAM
- ✅ **CloudWatch метрики** - Полный набор метрик для мониторинга
- ✅ **Message Attributes** - Кастомные и системные атрибуты сообщений
- ✅ **FIFO возможности** - Message groups, deduplication, ordering

---

## Основные функции

### 1. Типы очередей

**Описание:** AWS SQS поддерживает два типа очередей с различными характеристиками.

#### Standard Queue

**Характеристики:**
- Неограниченная пропускная способность
- At-least-once доставка (возможны дубликаты)
- Best-effort ordering (порядок не гарантирован)
- Низкая задержка

**Использование:**
- Высоконагруженные системы
- Когда порядок не критичен
- Когда допустимы дубликаты

#### FIFO Queue

**Характеристики:**
- Exactly-once доставка (без дубликатов)
- Строгий порядок в message groups
- Ограниченная пропускная способность (300 msg/sec без batching, 3000 msg/sec с batching)
- Поддержка deduplication
- High-throughput mode для параллельной обработки

**Использование:**
- Когда важен порядок сообщений
- Когда дубликаты недопустимы
- Финансовые транзакции
- Критичные операции

**Особенности:**
- Имя очереди должно заканчиваться на `.fifo`
- Поддержка message groups для параллельной обработки
- Deduplication window: 5 минут

**Пример конфигурации:**
```json
{
  "queues": [
    {
      "name": "orders-queue",
      "type": "standard",
      "region": "us-east-1"
    },
    {
      "name": "transactions.fifo",
      "type": "fifo",
      "region": "us-east-1",
      "contentBasedDedup": true,
      "fifoThroughputLimit": "perMessageGroupId",
      "highThroughputFifo": true
    }
  ]
}
```

### 2. Управление очередями

**Описание:** Создание и настройка очередей с различными параметрами.

**Параметры очереди:**
- **name** - Имя очереди (обязательно)
  - Standard: 1-80 символов, alphanumeric, hyphens, underscores
  - FIFO: должно заканчиваться на `.fifo`
- **type** - Тип очереди: `standard` или `fifo` (обязательно)
- **region** - AWS регион (обязательно, по умолчанию: `us-east-1`)
- **visibilityTimeout** - Время скрытия сообщения при получении (секунды, 0-43200, по умолчанию: 30)
- **messageRetention** - Время хранения сообщений (дни, 1-14, по умолчанию: 4)
- **delaySeconds** - Задержка перед доступностью сообщения (секунды, 0-900, по умолчанию: 0)
- **maxReceiveCount** - Максимальное количество попыток получения перед отправкой в DLQ (1-1000, опционально)
- **deadLetterQueue** - Имя Dead Letter Queue (опционально)
- **accountId** - AWS Account ID для генерации URL/ARN (12 цифр, опционально)

**FIFO-специфичные параметры:**
- **contentBasedDedup** - Content-based deduplication (по умолчанию: `false`)
- **fifoThroughputLimit** - Лимит пропускной способности: `perQueue` или `perMessageGroupId` (по умолчанию: `perQueue`)
- **highThroughputFifo** - High-throughput FIFO mode (по умолчанию: `false`)

**Redrive Policy:**
- **redrivePolicy** - Политика для отправки в DLQ:
  - `deadLetterTargetArn` - ARN целевой DLQ
  - `maxReceiveCount` - Максимальное количество попыток
- **redriveAllowPolicy** - Политика для разрешения redrive из DLQ:
  - `sourceQueueArns` - ARN исходных очередей

**Пример конфигурации:**
```json
{
  "queues": [
    {
      "name": "processing-queue",
      "type": "standard",
      "region": "us-east-1",
      "visibilityTimeout": 30,
      "messageRetention": 4,
      "delaySeconds": 0,
      "maxReceiveCount": 3,
      "deadLetterQueue": "dlq"
    },
    {
      "name": "critical-queue.fifo",
      "type": "fifo",
      "region": "us-east-1",
      "visibilityTimeout": 60,
      "messageRetention": 14,
      "contentBasedDedup": true,
      "fifoThroughputLimit": "perMessageGroupId",
      "highThroughputFifo": true,
      "accountId": "123456789012"
    }
  ]
}
```

### 3. Visibility Timeout

**Описание:** Временное скрытие сообщения после получения для предотвращения повторной обработки.

**Как работает:**
1. Сообщение получается из очереди
2. Сообщение становится невидимым на время `visibilityTimeout`
3. Если сообщение удалено в течение timeout - оно обработано успешно
4. Если timeout истек - сообщение снова становится видимым

**Параметры:**
- **visibilityTimeout** - Время скрытия в секундах (0-43200 = 12 часов)
- Рекомендуется: время обработки сообщения × 2-3

**ChangeMessageVisibility:**
- Можно изменить visibility timeout для уже полученного сообщения
- Полезно для длительной обработки
- Поддерживается batch операция `ChangeMessageVisibilityBatch`

**Пример использования:**
```json
{
  "visibilityTimeout": 60
}
```

### 4. Message Retention

**Описание:** Автоматическое удаление сообщений после определенного времени.

**Параметры:**
- **messageRetention** - Время хранения в днях (1-14, по умолчанию: 4)
- Сообщения старше указанного времени автоматически удаляются
- Не влияет на сообщения в in-flight состоянии

**Особенности:**
- Expired messages не отправляются в DLQ (только удаляются)
- DLQ используется только для сообщений, превысивших `maxReceiveCount`

**Пример конфигурации:**
```json
{
  "messageRetention": 7
}
```

### 5. Dead Letter Queue (DLQ)

**Описание:** Очередь для недоставленных сообщений.

**Как работает:**
1. Сообщение получается из очереди
2. Если обработка не удалась - сообщение снова становится видимым
3. При каждом получении увеличивается `receiveCount`
4. Когда `receiveCount` превышает `maxReceiveCount` - сообщение отправляется в DLQ

**Параметры:**
- **maxReceiveCount** - Максимальное количество попыток (1-1000)
- **deadLetterQueue** - Имя DLQ (создается автоматически при необходимости)

**Redrive из DLQ:**
- Можно вернуть сообщения из DLQ обратно в source queue
- Используется метод `redriveFromDLQ`
- Требует настройки `redriveAllowPolicy` в source queue

**Пример конфигурации:**
```json
{
  "queues": [
    {
      "name": "main-queue",
      "type": "standard",
      "maxReceiveCount": 3,
      "deadLetterQueue": "dlq"
    },
    {
      "name": "dlq",
      "type": "standard"
    }
  ]
}
```

### 6. Batch операции

**Описание:** Эффективная отправка и получение множества сообщений за один запрос.

#### SendMessageBatch

**Характеристики:**
- До 10 сообщений за запрос
- Максимальный размер сообщения: 256 KB
- Максимальный размер batch: 256 KB
- Возвращает успешные и неуспешные записи

**Пример:**
```typescript
const result = routingEngine.sendMessageBatch('queue-name', [
  { payload: { orderId: 1 }, messageAttributes: {} },
  { payload: { orderId: 2 }, messageAttributes: {} }
]);
```

#### ReceiveMessage (Batch)

**Характеристики:**
- До 10 сообщений за запрос (`maxNumberOfMessages`)
- Поддержка long polling (`waitTimeSeconds`)
- Фильтрация по message attributes
- Фильтрация по system attributes

**Пример:**
```typescript
const messages = routingEngine.receiveMessage(
  'queue-name',
  10, // maxNumberOfMessages
  20, // waitTimeSeconds (long polling)
  30  // visibilityTimeout (опционально)
);
```

#### DeleteMessageBatch

**Характеристики:**
- До 10 сообщений за запрос
- Требует `receiptHandle` для каждого сообщения
- Возвращает успешные и неуспешные записи

**Пример:**
```typescript
const result = routingEngine.deleteMessageBatch('queue-name', [
  'receipt-handle-1',
  'receipt-handle-2'
]);
```

### 7. Long Polling

**Описание:** Оптимизация получения сообщений через ожидание доступных сообщений.

**Параметры:**
- **waitTimeSeconds** - Время ожидания в секундах (0-20)
  - `0` = Short polling (немедленный возврат)
  - `1-20` = Long polling (ожидание до указанного времени)

**Преимущества:**
- Снижение количества пустых запросов
- Снижение затрат (меньше API вызовов)
- Снижение задержки (сообщения доставляются быстрее)

**Рекомендации:**
- Используйте long polling (20 секунд) для большинства случаев
- Short polling только для real-time систем с низкой задержкой

**Пример конфигурации:**
```json
{
  "messaging": {
    "waitTimeSeconds": 20,
    "maxNumberOfMessages": 10
  }
}
```

### 8. FIFO возможности

**Описание:** Специальные возможности для FIFO очередей.

#### Message Groups

**Описание:** Группировка сообщений для параллельной обработки с сохранением порядка.

**Как работает:**
- Сообщения с одинаковым `messageGroupId` обрабатываются строго по порядку
- Разные группы могут обрабатываться параллельно
- Поддержка high-throughput mode для параллельной обработки внутри группы

**Пример:**
```json
{
  "messageGroupId": "user-123",
  "payload": { "action": "update" }
}
```

#### Deduplication

**Описание:** Предотвращение дубликатов сообщений.

**Типы:**
- **Content-based:** Автоматическая генерация `messageDeduplicationId` на основе содержимого
- **Explicit:** Указание `messageDeduplicationId` вручную

**Deduplication Window:**
- 5 минут (как в AWS SQS)
- Сообщения с одинаковым ID в течение 5 минут игнорируются

**Пример конфигурации:**
```json
{
  "contentBasedDedup": true
}
```

#### Throughput Limits

**Описание:** Ограничения пропускной способности для FIFO очередей.

**Типы:**
- **perQueue:** 300 msg/sec без batching, 3000 msg/sec с batching
- **perMessageGroupId:** 300 msg/sec на группу, неограниченно для очереди

**High-Throughput Mode:**
- Позволяет обрабатывать несколько сообщений из одной группы одновременно
- Требует `fifoThroughputLimit: "perMessageGroupId"`

**Пример конфигурации:**
```json
{
  "fifoThroughputLimit": "perMessageGroupId",
  "highThroughputFifo": true
}
```

### 9. Message Attributes

**Описание:** Метаданные сообщений для фильтрации и маршрутизации.

**Типы атрибутов:**
- **Custom attributes:** Пользовательские атрибуты
- **System attributes:** Системные атрибуты AWS (AWS.SQS.*)

**System Attributes:**
- `ApproximateFirstReceiveTimestamp` - Время первого получения
- `ApproximateReceiveCount` - Количество получений
- `SentTimestamp` - Время отправки

**Фильтрация:**
- `messageAttributeNames` - Фильтрация custom attributes
- `attributeNames` - Фильтрация system attributes (`All`, `ApproximateFirstReceiveTimestamp`, и т.д.)

**Пример:**
```json
{
  "messageAttributes": {
    "priority": { "dataType": "String", "stringValue": "high" },
    "source": { "dataType": "String", "stringValue": "api" }
  }
}
```

### 10. IAM Policies

**Описание:** Контроль доступа на уровне AWS IAM.

**Параметры IAM Policy:**
- **id** - Уникальный идентификатор политики
- **principal** - Идентификатор пользователя/роли (ARN или имя)
- **action** - Действие: `sqs:SendMessage`, `sqs:ReceiveMessage`, `sqs:DeleteMessage`, `sqs:GetQueueAttributes`, и т.д.
- **resource** - Ресурс (имя очереди или ARN)
- **effect** - Эффект: `Allow` или `Deny`

**Поддерживаемые действия:**
- `sqs:SendMessage` - Отправка сообщений
- `sqs:ReceiveMessage` - Получение сообщений
- `sqs:DeleteMessage` - Удаление сообщений
- `sqs:GetQueueAttributes` - Получение атрибутов очереди
- `sqs:ChangeMessageVisibility` - Изменение visibility timeout
- `sqs:*` - Все действия

**Пример конфигурации:**
```json
{
  "iamPolicies": [
    {
      "id": "producer-policy",
      "principal": "arn:aws:iam::123456789012:user/producer-app",
      "action": "sqs:SendMessage",
      "resource": "orders-queue",
      "effect": "Allow"
    },
    {
      "id": "consumer-policy",
      "principal": "arn:aws:iam::123456789012:user/consumer-app",
      "action": "sqs:ReceiveMessage",
      "resource": "orders-queue",
      "effect": "Allow"
    }
  ]
}
```

### 11. Queue URLs и ARNs

**Описание:** Формат идентификаторов очередей в AWS.

**Queue URL:**
- Формат: `https://sqs.{region}.amazonaws.com/{accountId}/{queueName}`
- Пример: `https://sqs.us-east-1.amazonaws.com/123456789012/orders-queue`

**Queue ARN:**
- Формат: `arn:aws:sqs:{region}:{accountId}:{queueName}`
- Пример: `arn:aws:sqs:us-east-1:123456789012:orders-queue`

**Валидация имен:**
- Standard: 1-80 символов, alphanumeric, hyphens, underscores
- FIFO: должно заканчиваться на `.fifo`
- Автоматическое исправление при смене типа очереди

---

## Руководство пользователя

### Быстрый старт

1. **Добавление компонента AWS SQS:**
   - Перетащите компонент "AWS SQS" из библиотеки компонентов на canvas
   - Откройте панель конфигурации компонента

2. **Базовая настройка:**
   - Укажите AWS регион (например, `us-east-1`)
   - Создайте первую очередь через вкладку "Queues"
   - Выберите тип очереди (Standard или FIFO)

3. **Подключение к другим компонентам:**
   - Создайте соединение от компонента-производителя к AWS SQS
   - Создайте соединение от AWS SQS к компоненту-потребителю
   - Настройте имя очереди в соединении

### Работа с очередями

#### Создание очереди

1. Перейдите на вкладку **"Queues"**
2. Нажмите кнопку **"Add Queue"**
3. Заполните параметры:
   - **Name** - Имя очереди (для FIFO должно заканчиваться на `.fifo`)
   - **Type** - Standard или FIFO
   - **Region** - AWS регион
   - **Visibility Timeout** - Время скрытия сообщения (секунды)
   - **Message Retention** - Время хранения (дни)
   - **Delay Seconds** - Задержка перед доступностью (секунды)
4. Настройте дополнительные параметры (опционально):
   - Max Receive Count (для DLQ)
   - Dead Letter Queue
   - FIFO параметры (для FIFO очередей)
5. Нажмите **"Create"**

#### Редактирование очереди

1. Выберите очередь из списка
2. Нажмите кнопку **"Edit"** (иконка карандаша)
3. Измените параметры
4. Нажмите **"Save"**

**Ограничения:**
- Нельзя изменить тип очереди (Standard ↔ FIFO)
- Нельзя изменить имя очереди
- Некоторые параметры могут быть недоступны для изменения

#### Удаление очереди

1. Выберите очередь из списка
2. Нажмите кнопку **"Delete"** (иконка корзины)
3. Подтвердите удаление

**Важно:** Удаление очереди необратимо. Все сообщения в очереди будут потеряны.

#### Просмотр метрик очереди

Во время симуляции на вкладке **"Queues"** отображаются:
- **Approximate Messages** - Приблизительное количество доступных сообщений
- **Approximate Messages Not Visible** - Приблизительное количество in-flight сообщений
- **Approximate Messages Delayed** - Приблизительное количество отложенных сообщений
- **Queue URL** - URL очереди в формате AWS
- **Queue ARN** - ARN очереди

### Настройка IAM Policies

1. Перейдите на вкладку **"IAM Policies"**
2. Нажмите кнопку **"Add Policy"**
3. Заполните параметры:
   - **Principal** - Идентификатор пользователя/роли (ARN или имя)
   - **Action** - Действие (например, `sqs:SendMessage`)
   - **Resource** - Имя очереди или ARN
   - **Effect** - Allow или Deny
4. Нажмите **"Save"**

**Важно:** Правила `Deny` имеют приоритет над `Allow`. Используйте `Deny` для явного запрета доступа.

### Настройка Credentials

1. Перейдите на вкладку **"Credentials"**
2. Укажите:
   - **Access Key ID** - AWS Access Key ID
   - **Secret Access Key** - AWS Secret Access Key
   - **Default Region** - Регион по умолчанию
   - **Default Account ID** - AWS Account ID (12 цифр)
3. Изменения сохраняются автоматически

**Примечание:** В симуляции credentials используются для генерации queue URLs и ARNs, а также для IAM policies.

### Мониторинг

1. Перейдите на вкладку **"Monitoring"**
2. Просмотрите метрики:
   - **Throughput** - Количество сообщений в секунду
   - **Latency** - Задержка обработки
   - **Error Rate** - Процент ошибок
   - **Utilization** - Загрузка очередей
3. Просмотрите CloudWatch метрики для каждой очереди:
   - NumberOfMessagesSent
   - NumberOfMessagesReceived
   - NumberOfMessagesDeleted
   - ApproximateNumberOfMessagesVisible
   - ApproximateNumberOfMessagesNotVisible
   - ApproximateNumberOfMessagesDelayed

### Поиск и фильтрация очередей

1. Используйте поле **"Search"** для поиска очередей по имени
2. Используйте фильтр **"Type"** для фильтрации:
   - All Types
   - Standard
   - FIFO

---

## Руководство администратора

### Рекомендации по конфигурации

#### Production Standard Queue

```json
{
  "queues": [
    {
      "name": "production-queue",
      "type": "standard",
      "region": "us-east-1",
      "visibilityTimeout": 60,
      "messageRetention": 7,
      "delaySeconds": 0,
      "maxReceiveCount": 3,
      "deadLetterQueue": "production-dlq",
      "accountId": "123456789012"
    }
  ]
}
```

**Рекомендации:**
- Используйте visibility timeout = время обработки × 2-3
- Настройте DLQ для обработки ошибок
- Используйте message retention 7-14 дней для production
- Настройте IAM policies для безопасности

#### Production FIFO Queue

```json
{
  "queues": [
    {
      "name": "transactions.fifo",
      "type": "fifo",
      "region": "us-east-1",
      "visibilityTimeout": 120,
      "messageRetention": 14,
      "contentBasedDedup": true,
      "fifoThroughputLimit": "perMessageGroupId",
      "highThroughputFifo": true,
      "maxReceiveCount": 5,
      "deadLetterQueue": "transactions-dlq.fifo"
    }
  ]
}
```

**Рекомендации:**
- Используйте high-throughput mode для параллельной обработки
- Используйте `perMessageGroupId` для максимальной пропускной способности
- Настройте content-based deduplication для предотвращения дубликатов
- Используйте message groups для логической группировки

### Оптимизация производительности

#### Visibility Timeout

- **Слишком короткий:** Сообщения могут быть обработаны дважды
- **Слишком длинный:** Задержка при ошибках обработки
- **Рекомендация:** Время обработки × 2-3

#### Long Polling

- **Short polling (0 сек):** Много пустых запросов, высокие затраты
- **Long polling (20 сек):** Меньше запросов, ниже затраты, ниже задержка
- **Рекомендация:** Используйте long polling (20 секунд) для большинства случаев

#### Batch операции

- **SendMessageBatch:** До 10 сообщений за запрос
- **ReceiveMessage:** До 10 сообщений за запрос
- **DeleteMessageBatch:** До 10 сообщений за запрос
- **Рекомендация:** Используйте batch операции для снижения количества API вызовов

#### FIFO Throughput

- **perQueue:** 300 msg/sec без batching, 3000 msg/sec с batching
- **perMessageGroupId:** 300 msg/sec на группу, неограниченно для очереди
- **Рекомендация:** Используйте `perMessageGroupId` с high-throughput mode для максимальной пропускной способности

### Безопасность

#### Настройка IAM Policies

**Рекомендуемый подход:**
1. Создайте правила `Deny` для неавторизованных пользователей
2. Создайте правила `Allow` для конкретных приложений
3. Используйте принцип наименьших привилегий

**Пример production IAM:**
```json
{
  "iamPolicies": [
    {
      "principal": "arn:aws:iam::123456789012:user/producer-app",
      "action": "sqs:SendMessage",
      "resource": "orders-queue",
      "effect": "Allow"
    },
    {
      "principal": "arn:aws:iam::123456789012:user/consumer-app",
      "action": "sqs:ReceiveMessage",
      "resource": "orders-queue",
      "effect": "Allow"
    },
    {
      "principal": "*",
      "action": "sqs:*",
      "resource": "*",
      "effect": "Deny"
    }
  ]
}
```

### Мониторинг и алертинг

#### Ключевые метрики

1. **Approximate Messages**
   - Нормальное значение: зависит от нагрузки
   - Алерт: постоянный рост или превышение порога

2. **Approximate Messages Not Visible**
   - Нормальное значение: < 100 для большинства случаев
   - Алерт: постоянно высокое значение (возможна проблема с обработкой)

3. **Visibility Timeout Expirations**
   - Нормальное значение: < 1% от received messages
   - Алерт: > 5% (возможно, visibility timeout слишком короткий)

4. **DLQ Messages**
   - Нормальное значение: 0 или минимальное количество
   - Алерт: постоянный рост (проблемы с обработкой сообщений)

5. **Throughput**
   - Нормальное значение: зависит от нагрузки
   - Алерт: резкое падение или превышение лимитов FIFO

#### CloudWatch метрики

Мониторинг через CloudWatch метрики:
- **NumberOfMessagesSent** - Количество отправленных сообщений
- **NumberOfMessagesReceived** - Количество полученных сообщений
- **NumberOfMessagesDeleted** - Количество удаленных сообщений
- **ApproximateNumberOfMessagesVisible** - Доступные сообщения
- **ApproximateNumberOfMessagesNotVisible** - In-flight сообщения
- **ApproximateNumberOfMessagesDelayed** - Отложенные сообщения

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
  - Visibility timeout
  - Message retention
  - Глубина очереди
  - Тип очереди (Standard vs FIFO)

#### Error Rate
- **Описание:** Процент ошибок при обработке
- **Единица измерения:** процент (0-1)
- **Причины ошибок:**
  - IAM блокировки
  - Превышение лимитов (размер сообщения, batch size)
  - Неверные параметры

#### Utilization
- **Описание:** Загрузка очередей
- **Единица измерения:** процент (0-1)
- **Расчет:** На основе глубины очередей и пропускной способности

### Approximate метрики

#### Approximate Messages (Visible)
- **Описание:** Приблизительное количество доступных сообщений
- **Особенности:** Приблизительное значение (как в AWS SQS)
- **Обновление:** В реальном времени

#### Approximate Messages Not Visible
- **Описание:** Приблизительное количество in-flight сообщений
- **Особенности:** Сообщения, полученные но еще не удаленные
- **Обновление:** В реальном времени

#### Approximate Messages Delayed
- **Описание:** Приблизительное количество отложенных сообщений
- **Особенности:** Сообщения с `delaySeconds` > 0
- **Обновление:** В реальном времени

### CloudWatch метрики

Для каждой очереди доступны:
- **NumberOfMessagesSent** - Количество отправленных сообщений
- **NumberOfMessagesReceived** - Количество полученных сообщений
- **NumberOfMessagesDeleted** - Количество удаленных сообщений
- **ApproximateNumberOfMessagesVisible** - Доступные сообщения
- **ApproximateNumberOfMessagesNotVisible** - In-flight сообщения
- **ApproximateNumberOfMessagesDelayed** - Отложенные сообщения
- **SentMessageSize** - Общий размер отправленных сообщений (байты)
- **ReceivedMessageSize** - Общий размер полученных сообщений (байты)
- **AverageMessageSize** - Средний размер сообщения (байты)

### Мониторинг в реальном времени

Все метрики обновляются в реальном времени во время симуляции:
- Approximate метрики обновляются каждые 500ms
- CloudWatch метрики обновляются при операциях (send, receive, delete)
- Throughput рассчитывается на основе входящих соединений

---

## Примеры использования

### Пример 1: Standard Queue с DLQ

**Сценарий:** Обработка заказов с обработкой ошибок

```json
{
  "queues": [
    {
      "name": "order-queue",
      "type": "standard",
      "region": "us-east-1",
      "visibilityTimeout": 60,
      "messageRetention": 7,
      "maxReceiveCount": 3,
      "deadLetterQueue": "order-dlq"
    },
    {
      "name": "order-dlq",
      "type": "standard",
      "region": "us-east-1"
    }
  ]
}
```

### Пример 2: FIFO Queue с High-Throughput

**Сценарий:** Обработка транзакций с гарантией порядка

```json
{
  "queues": [
    {
      "name": "transactions.fifo",
      "type": "fifo",
      "region": "us-east-1",
      "visibilityTimeout": 120,
      "messageRetention": 14,
      "contentBasedDedup": true,
      "fifoThroughputLimit": "perMessageGroupId",
      "highThroughputFifo": true,
      "maxReceiveCount": 5,
      "deadLetterQueue": "transactions-dlq.fifo"
    }
  ]
}
```

### Пример 3: Long Polling конфигурация

**Сценарий:** Оптимизация получения сообщений

```json
{
  "messaging": {
    "waitTimeSeconds": 20,
    "maxNumberOfMessages": 10
  }
}
```

### Пример 4: IAM Policies для безопасности

**Сценарий:** Разделение доступа между приложениями

```json
{
  "queues": [
    {
      "name": "secure-queue",
      "type": "standard",
      "region": "us-east-1"
    }
  ],
  "iamPolicies": [
    {
      "principal": "arn:aws:iam::123456789012:user/producer",
      "action": "sqs:SendMessage",
      "resource": "secure-queue",
      "effect": "Allow"
    },
    {
      "principal": "arn:aws:iam::123456789012:user/consumer",
      "action": "sqs:ReceiveMessage",
      "resource": "secure-queue",
      "effect": "Allow"
    }
  ]
}
```

### Пример 5: Message Groups для FIFO

**Сценарий:** Параллельная обработка с сохранением порядка

```json
{
  "queues": [
    {
      "name": "user-events.fifo",
      "type": "fifo",
      "region": "us-east-1",
      "fifoThroughputLimit": "perMessageGroupId",
      "highThroughputFifo": true
    }
  ]
}
```

Использование message groups:
- `messageGroupId: "user-123"` - все сообщения для пользователя 123 обрабатываются по порядку
- `messageGroupId: "user-456"` - все сообщения для пользователя 456 обрабатываются по порядку
- Разные группы обрабатываются параллельно

---

## Часто задаваемые вопросы (FAQ)

### Когда использовать Standard, а когда FIFO?

- **Standard:** Когда порядок не критичен, допустимы дубликаты, нужна высокая пропускная способность
- **FIFO:** Когда важен порядок, дубликаты недопустимы, нужна exactly-once доставка

### Что такое Visibility Timeout?

Visibility Timeout - это время, в течение которого сообщение скрыто после получения. Если сообщение не удалено в течение timeout, оно снова становится видимым.

### Как выбрать Visibility Timeout?

Рекомендуется: время обработки сообщения × 2-3. Слишком короткий - возможны дубликаты, слишком длинный - задержка при ошибках.

### Что такое Dead Letter Queue?

DLQ - это очередь для недоставленных сообщений. Сообщения отправляются в DLQ после превышения `maxReceiveCount` попыток получения.

### Как работает Long Polling?

Long Polling - это ожидание доступных сообщений до указанного времени (до 20 секунд). Снижает количество пустых запросов и затраты.

### Что такое Message Groups в FIFO?

Message Groups - это группировка сообщений для параллельной обработки с сохранением порядка. Сообщения с одинаковым `messageGroupId` обрабатываются строго по порядку, разные группы - параллельно.

### Как увеличить пропускную способность FIFO?

- Используйте `perMessageGroupId` throughput limit
- Включите high-throughput mode
- Используйте batch операции
- Используйте больше message groups

### Что такое Deduplication Window?

Deduplication Window - это период времени (5 минут), в течение которого сообщения с одинаковым `messageDeduplicationId` игнорируются для предотвращения дубликатов.

### Как работает Redrive из DLQ?

Redrive позволяет вернуть сообщения из DLQ обратно в source queue. Требует настройки `redriveAllowPolicy` в source queue.

### Что такое Queue URL и ARN?

- **Queue URL:** `https://sqs.{region}.amazonaws.com/{accountId}/{queueName}`
- **Queue ARN:** `arn:aws:sqs:{region}:{accountId}:{queueName}`

Используются для идентификации очередей в AWS.

---

## Дополнительные ресурсы

- [Официальная документация AWS SQS](https://docs.aws.amazon.com/sqs/)
- [AWS SQS Best Practices](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-best-practices.html)
- [AWS SQS API Reference](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/APIReference/Welcome.html)
- [AWS SQS FIFO Queues](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/FIFO-queues.html)

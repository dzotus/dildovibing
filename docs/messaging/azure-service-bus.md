# Azure Service Bus - Документация компонента

## Обзор

Azure Service Bus - это полностью управляемая платформа обмена сообщениями от Microsoft, предназначенная для надежной доставки сообщений между компонентами распределенных систем в облаке Azure. Компонент Azure Service Bus в системе симуляции полностью эмулирует поведение реального Azure Service Bus, включая очереди, топики, подписки, peek-lock паттерн, Dead Letter Queue, сессии, scheduled messages, duplicate detection, auto-forwarding и subscription filters.

### Основные возможности

- ✅ **Очереди (Queues)** - Point-to-point доставка сообщений
- ✅ **Топики и подписки (Topics & Subscriptions)** - Pub/Sub доставка сообщений
- ✅ **Peek-Lock паттерн** - Безопасная обработка сообщений с подтверждением
- ✅ **Dead Letter Queue (DLQ)** - Обработка недоставленных сообщений
- ✅ **Message Sessions** - Группировка сообщений для упорядоченной обработки
- ✅ **Scheduled Messages** - Отложенная отправка сообщений
- ✅ **Duplicate Detection** - Обнаружение и предотвращение дубликатов
- ✅ **Auto-forwarding** - Автоматическая пересылка между очередями/топиками
- ✅ **Subscription Filters** - SQL фильтры для подписок
- ✅ **Message Deferral** - Отложенные сообщения для последующей обработки
- ✅ **Partitioning** - Горизонтальное масштабирование
- ✅ **Метрики в реальном времени** - Отслеживание активных сообщений, DLQ, scheduled messages

---

## Основные функции

### 1. Управление Namespace

**Описание:** Настройка namespace Azure Service Bus.

**Параметры:**
- **namespace** - Имя namespace (например, `archiphoenix.servicebus.windows.net`)
- **connectionString** - Connection string для подключения (SAS или Managed Identity)
- **pricingTier** - Уровень цен: `basic`, `standard`, `premium` (по умолчанию: `standard`)
- **messagingUnits** - Количество messaging units для Premium tier (1-16, по умолчанию: 1)

**Pricing Tiers:**
- **Basic:** Базовые возможности, без topics/subscriptions
- **Standard:** Полный набор функций, topics/subscriptions
- **Premium:** Высокая производительность, изоляция, больше messaging units

**Пример конфигурации:**
```json
{
  "namespace": "my-namespace.servicebus.windows.net",
  "connectionString": "Endpoint=sb://my-namespace.servicebus.windows.net/;SharedAccessKeyName=RootManageSharedAccessKey;SharedAccessKey=...",
  "pricingTier": "standard",
  "messagingUnits": 1
}
```

### 2. Управление очередями (Queues)

**Описание:** Создание и настройка очередей для point-to-point доставки сообщений.

**Параметры очереди:**
- **name** - Имя очереди (обязательно, 1-260 символов, alphanumeric, hyphens, underscores, periods)
- **namespace** - Namespace очереди (по умолчанию: из конфигурации namespace)
- **maxSizeInMegabytes** - Максимальный размер очереди в MB (1-5120, по умолчанию: 1024)
- **defaultMessageTimeToLive** - TTL по умолчанию в секундах (по умолчанию: 2592000 = 30 дней)
- **lockDuration** - Длительность блокировки сообщения в секундах (5-300, по умолчанию: 30)
- **maxDeliveryCount** - Максимальное количество попыток доставки перед отправкой в DLQ (1-2147483647, по умолчанию: 10)
- **enablePartitioning** - Включить партиционирование (по умолчанию: `false`)
- **enableDeadLetteringOnMessageExpiration** - Отправлять expired сообщения в DLQ (по умолчанию: `true`)
- **enableSessions** - Включить сессии (по умолчанию: `false`)
- **enableDuplicateDetection** - Включить обнаружение дубликатов (по умолчанию: `false`)
- **duplicateDetectionHistoryTimeWindow** - Окно обнаружения дубликатов в секундах (20-604800, по умолчанию: 600 = 10 минут)
- **forwardTo** - Автоматическая пересылка в другую очередь/топик (опционально)
- **enableBatchedOperations** - Включить батчинг операций (по умолчанию: `false`)

**Метрики очереди (обновляются в реальном времени):**
- **activeMessageCount** - Количество активных сообщений
- **deadLetterMessageCount** - Количество сообщений в DLQ
- **scheduledMessageCount** - Количество запланированных сообщений
- **deferredMessageCount** - Количество отложенных сообщений

**Пример конфигурации:**
```json
{
  "queues": [
    {
      "name": "order-queue",
      "namespace": "my-namespace.servicebus.windows.net",
      "maxSizeInMegabytes": 1024,
      "defaultMessageTimeToLive": 2592000,
      "lockDuration": 30,
      "maxDeliveryCount": 10,
      "enablePartitioning": false,
      "enableDeadLetteringOnMessageExpiration": true,
      "enableSessions": false,
      "enableDuplicateDetection": true,
      "duplicateDetectionHistoryTimeWindow": 600,
      "forwardTo": "processed-orders-queue"
    }
  ]
}
```

### 3. Управление топиками и подписками (Topics & Subscriptions)

**Описание:** Создание и настройка топиков и подписок для pub/sub доставки сообщений.

**Параметры топика:**
- **name** - Имя топика (обязательно)
- **namespace** - Namespace топика
- **maxSizeInMegabytes** - Максимальный размер топика в MB
- **defaultMessageTimeToLive** - TTL по умолчанию в секундах
- **enablePartitioning** - Включить партиционирование
- **enableDuplicateDetection** - Включить обнаружение дубликатов
- **duplicateDetectionHistoryTimeWindow** - Окно обнаружения дубликатов
- **forwardTo** - Автоматическая пересылка
- **enableBatchedOperations** - Включить батчинг
- **subscriptions** - Список подписок

**Параметры подписки:**
- **name** - Имя подписки (обязательно)
- **maxDeliveryCount** - Максимальное количество попыток доставки
- **lockDuration** - Длительность блокировки сообщения
- **enableDeadLetteringOnMessageExpiration** - Отправлять expired сообщения в DLQ
- **requiresSession** - Требовать сессии (по умолчанию: `false`)
- **forwardTo** - Автоматическая пересылка
- **enableBatchedOperations** - Включить батчинг
- **rules** - Правила фильтрации (SQL или Correlation фильтры)

**Пример конфигурации:**
```json
{
  "topics": [
    {
      "name": "user-events",
      "namespace": "my-namespace.servicebus.windows.net",
      "maxSizeInMegabytes": 2048,
      "defaultMessageTimeToLive": 2592000,
      "enablePartitioning": true,
      "subscriptions": [
        {
          "name": "analytics-subscription",
          "maxDeliveryCount": 10,
          "lockDuration": 30,
          "enableDeadLetteringOnMessageExpiration": true,
          "rules": [
            {
              "name": "premium-users",
              "filterType": "SQL",
              "sqlFilter": "user.type = 'premium'"
            }
          ]
        }
      ]
    }
  ]
}
```

### 4. Peek-Lock паттерн

**Описание:** Безопасная обработка сообщений с подтверждением получения.

**Как работает:**
1. Сообщение получается из очереди/подписки (peek)
2. Сообщение блокируется на время `lockDuration` (lock)
3. Если сообщение обработано успешно - вызывается `complete()` для удаления
4. Если обработка не удалась - вызывается `abandon()` для возврата в очередь
5. Если `lockDuration` истек - сообщение автоматически возвращается в очередь

**Операции:**
- **Receive** - Получить сообщение с блокировкой
- **Complete** - Подтвердить обработку и удалить сообщение
- **Abandon** - Отменить обработку и вернуть сообщение в очередь
- **DeadLetter** - Отправить сообщение в DLQ

**Параметры:**
- **lockDuration** - Время блокировки в секундах (5-300, по умолчанию: 30)
- Можно изменить lock duration для уже заблокированного сообщения

**Пример использования:**
```typescript
// Получить сообщение
const message = routingEngine.receiveFromQueue('order-queue');

// Обработать сообщение
try {
  processMessage(message);
  // Подтвердить обработку
  routingEngine.completeMessage('order-queue', message.lockToken);
} catch (error) {
  // Отменить обработку
  routingEngine.abandonMessage('order-queue', message.lockToken);
}
```

### 5. Dead Letter Queue (DLQ)

**Описание:** Очередь для недоставленных сообщений.

**Как работает:**
1. Сообщение получается из очереди/подписки
2. Если обработка не удалась - сообщение возвращается в очередь
3. При каждом получении увеличивается `deliveryCount`
4. Когда `deliveryCount` превышает `maxDeliveryCount` - сообщение отправляется в DLQ
5. Expired сообщения также могут отправляться в DLQ (если `enableDeadLetteringOnMessageExpiration: true`)

**Параметры:**
- **maxDeliveryCount** - Максимальное количество попыток (1-2147483647, по умолчанию: 10)
- **enableDeadLetteringOnMessageExpiration** - Отправлять expired сообщения в DLQ (по умолчанию: `true`)

**Доступ к DLQ:**
- DLQ создается автоматически для каждой очереди/подписки
- Имя DLQ: `{queue-name}/$deadletterqueue` или `{topic-name}/subscriptions/{subscription-name}/$deadletterqueue`
- Можно получать сообщения из DLQ для анализа и повторной обработки

**Пример конфигурации:**
```json
{
  "queues": [
    {
      "name": "order-queue",
      "maxDeliveryCount": 5,
      "enableDeadLetteringOnMessageExpiration": true
    }
  ]
}
```

### 6. Message Sessions

**Описание:** Группировка сообщений для упорядоченной обработки.

**Как работает:**
- Сообщения с одинаковым `sessionId` обрабатываются строго по порядку
- Одно сообщение из сессии обрабатывается в каждый момент времени
- Полезно для упорядоченной обработки сообщений от одного источника

**Параметры:**
- **enableSessions** - Включить сессии для очереди (по умолчанию: `false`)
- **requiresSession** - Требовать сессии для подписки (по умолчанию: `false`)

**Использование:**
- Укажите `sessionId` при отправке сообщения
- При получении сообщений из очереди с сессиями - получаются сообщения из одной сессии
- Сессии обрабатываются последовательно

**Пример конфигурации:**
```json
{
  "queues": [
    {
      "name": "order-queue",
      "enableSessions": true
    }
  ]
}
```

### 7. Scheduled Messages

**Описание:** Отложенная отправка сообщений.

**Как работает:**
- Сообщение отправляется с `scheduledEnqueueTime` (время в будущем)
- Сообщение хранится до указанного времени
- После наступления времени сообщение становится доступным для получения

**Использование:**
- Укажите `scheduledEnqueueTime` при отправке сообщения
- Сообщение будет доступно только после указанного времени
- Можно отменить scheduled сообщение до наступления времени

**Пример:**
```typescript
// Отправить сообщение, которое будет доступно через 1 час
const scheduledTime = Date.now() + 3600000; // +1 час
routingEngine.sendToQueue('order-queue', payload, {
  scheduledEnqueueTime: scheduledTime
});
```

### 8. Duplicate Detection

**Описание:** Обнаружение и предотвращение дубликатов сообщений.

**Как работает:**
- Сообщения с одинаковым `messageId` в течение окна обнаружения игнорируются
- Окно обнаружения: `duplicateDetectionHistoryTimeWindow` (20-604800 секунд)
- Только последнее сообщение с данным `messageId` сохраняется

**Параметры:**
- **enableDuplicateDetection** - Включить обнаружение дубликатов (по умолчанию: `false`)
- **duplicateDetectionHistoryTimeWindow** - Окно обнаружения в секундах (20-604800, по умолчанию: 600 = 10 минут)

**Особенности:**
- Должно быть включено при создании очереди/топика (нельзя изменить позже)
- Используется `messageId` для идентификации дубликатов
- Метрика `duplicateMessagesDetected` отслеживает количество обнаруженных дубликатов

**Пример конфигурации:**
```json
{
  "queues": [
    {
      "name": "order-queue",
      "enableDuplicateDetection": true,
      "duplicateDetectionHistoryTimeWindow": 600
    }
  ]
}
```

### 9. Auto-forwarding

**Описание:** Автоматическая пересылка сообщений между очередями/топиками.

**Как работает:**
- После получения сообщения из очереди/подписки оно автоматически пересылается в указанное место
- Поддерживаются цепочки пересылки (queue -> topic -> queue)
- Полезно для создания сложных маршрутов сообщений

**Параметры:**
- **forwardTo** - Имя целевой очереди или топика (опционально)

**Ограничения:**
- Нельзя создать циклические цепочки
- Пересылка происходит после получения сообщения
- Метрика `forwardedMessages` отслеживает количество пересланных сообщений

**Пример конфигурации:**
```json
{
  "queues": [
    {
      "name": "input-queue",
      "forwardTo": "processing-queue"
    },
    {
      "name": "processing-queue",
      "forwardTo": "output-topic"
    }
  ],
  "topics": [
    {
      "name": "output-topic"
    }
  ]
}
```

### 10. Subscription Filters/Rules

**Описание:** Фильтрация сообщений в подписках с помощью SQL или Correlation фильтров.

**Типы фильтров:**
- **SQL Filter:** SQL-подобные выражения для фильтрации по свойствам сообщения
- **Correlation Filter:** Фильтрация по `correlationId` и свойствам

**SQL Filter примеры:**
- `user.type = 'premium'` - Точное совпадение
- `price > 100` - Сравнение
- `status IN ('active', 'pending')` - Список значений
- `name LIKE 'user-%'` - Паттерн

**Параметры правила:**
- **name** - Имя правила (обязательно)
- **filterType** - Тип фильтра: `SQL` или `Correlation`
- **sqlFilter** - SQL выражение (для SQL фильтра)
- **correlationFilter** - Correlation фильтр (для Correlation фильтра)
- **action** - SQL action для модификации сообщения (опционально)

**Особенности:**
- По умолчанию подписка имеет правило `$Default` (принимает все сообщения)
- Можно создать несколько правил для одной подписки
- Сообщения, соответствующие любому правилу, доставляются в подписку

**Пример конфигурации:**
```json
{
  "topics": [
    {
      "name": "user-events",
      "subscriptions": [
        {
          "name": "premium-subscription",
          "rules": [
            {
              "name": "premium-users",
              "filterType": "SQL",
              "sqlFilter": "user.type = 'premium' AND user.status = 'active'"
            }
          ]
        }
      ]
    }
  ]
}
```

### 11. Message Deferral

**Описание:** Отложенная обработка сообщений.

**Как работает:**
1. Сообщение получается из очереди/подписки
2. Вызывается `deferMessage(lockToken)` для отложения
3. Сообщение сохраняется с `sequenceNumber`
4. Позже можно получить отложенные сообщения по `sequenceNumber`
5. После обработки вызывается `completeDeferredMessage(sequenceNumber)`

**Использование:**
- Полезно для обработки сообщений в определенном порядке
- Позволяет пропустить сообщение и вернуться к нему позже
- Требует сохранения `sequenceNumber` для последующего получения

**Пример:**
```typescript
// Получить сообщение
const message = routingEngine.receiveFromQueue('order-queue');

// Отложить сообщение
const sequenceNumber = routingEngine.deferMessage('order-queue', message.lockToken);

// Позже получить отложенное сообщение
const deferredMessages = routingEngine.receiveDeferredMessages('order-queue', [sequenceNumber]);

// Обработать и завершить
routingEngine.completeDeferredMessage('order-queue', sequenceNumber);
```

### 12. Partitioning

**Описание:** Горизонтальное масштабирование очередей и топиков.

**Как работает:**
- Очередь/топик разделяется на несколько партиций
- Сообщения распределяются по партициям
- Увеличивает пропускную способность и отказоустойчивость

**Параметры:**
- **enablePartitioning** - Включить партиционирование (по умолчанию: `false`)

**Особенности:**
- Должно быть включено при создании очереди/топика (нельзя изменить позже)
- Увеличивает пропускную способность
- Улучшает отказоустойчивость

**Пример конфигурации:**
```json
{
  "queues": [
    {
      "name": "high-throughput-queue",
      "enablePartitioning": true
    }
  ]
}
```

---

## Руководство пользователя

### Быстрый старт

1. **Добавление компонента Azure Service Bus:**
   - Перетащите компонент "Azure Service Bus" из библиотеки компонентов на canvas
   - Откройте панель конфигурации компонента

2. **Базовая настройка:**
   - Укажите namespace (например, `my-namespace.servicebus.windows.net`)
   - Укажите connection string (опционально)
   - Выберите pricing tier (Basic, Standard, Premium)
   - Создайте первую очередь через вкладку "Queues"

3. **Подключение к другим компонентам:**
   - Создайте соединение от компонента-производителя к Azure Service Bus
   - Создайте соединение от Azure Service Bus к компоненту-потребителю
   - Настройте имя очереди/топика в соединении

### Работа с очередями

#### Создание очереди

1. Перейдите на вкладку **"Queues"**
2. Нажмите кнопку **"Add Queue"**
3. Заполните параметры:
   - **Name** - Имя очереди (1-260 символов)
   - **Namespace** - Namespace очереди
   - **Max Size (MB)** - Максимальный размер очереди
   - **Default Message TTL** - TTL по умолчанию (секунды)
   - **Lock Duration** - Длительность блокировки (секунды)
   - **Max Delivery Count** - Максимальное количество попыток
4. Настройте дополнительные параметры (опционально):
   - Enable Partitioning
   - Enable Dead Lettering on Message Expiration
   - Enable Sessions
   - Enable Duplicate Detection
   - Auto-forwarding
5. Нажмите **"Save"**

#### Редактирование очереди

1. Выберите очередь из списка
2. Нажмите кнопку **"Edit"** (иконка карандаша)
3. Измените параметры (некоторые параметры нельзя изменить после создания)
4. Нажмите **"Save"**

**Ограничения:**
- Нельзя изменить `enablePartitioning` после создания
- Нельзя изменить `enableDuplicateDetection` после создания
- Нельзя изменить имя очереди

#### Просмотр метрик очереди

Во время симуляции на вкладке **"Queues"** отображаются:
- **Active Messages** - Количество активных сообщений
- **Dead Letter Messages** - Количество сообщений в DLQ
- **Scheduled Messages** - Количество запланированных сообщений
- **Deferred Messages** - Количество отложенных сообщений

### Работа с топиками и подписками

#### Создание топика

1. Перейдите на вкладку **"Topics"**
2. Нажмите кнопку **"Add Topic"**
3. Заполните параметры (аналогично очереди)
4. Нажмите **"Save"**

#### Создание подписки

1. Выберите топик из списка
2. Нажмите кнопку **"Add Subscription"**
3. Заполните параметры:
   - **Name** - Имя подписки
   - **Max Delivery Count** - Максимальное количество попыток
   - **Lock Duration** - Длительность блокировки
   - **Requires Session** - Требовать сессии
4. Настройте правила фильтрации (опционально):
   - SQL Filter
   - Correlation Filter
5. Нажмите **"Save"**

#### Настройка Subscription Rules

1. Выберите подписку из списка
2. Нажмите кнопку **"Add Rule"**
3. Выберите тип фильтра:
   - **SQL Filter** - SQL выражение
   - **Correlation Filter** - Correlation ID и свойства
4. Заполните параметры фильтра
5. Нажмите **"Save"**

### Message Explorer

1. Перейдите на вкладку **"Message Explorer"**
2. Выберите тип сущности:
   - **Queue** - Просмотр сообщений в очереди
   - **Subscription** - Просмотр сообщений в подписке
3. Выберите очередь/топик и подписку (если нужно)
4. Просмотрите сообщения:
   - **Active** - Активные сообщения
   - **Dead Letter** - Сообщения в DLQ
   - **Scheduled** - Запланированные сообщения
   - **Deferred** - Отложенные сообщения
   - **Locked** - Заблокированные сообщения
5. Используйте поиск для фильтрации сообщений

### Настройка Connection

1. Перейдите на вкладку **"Connection"**
2. Укажите:
   - **Namespace** - Имя namespace
   - **Connection String** - Connection string (SAS или Managed Identity)
   - **Pricing Tier** - Уровень цен (Basic, Standard, Premium)
   - **Messaging Units** - Количество messaging units (для Premium)
3. Изменения сохраняются автоматически

---

## Руководство администратора

### Рекомендации по конфигурации

#### Production очередь

```json
{
  "namespace": "production.servicebus.windows.net",
  "pricingTier": "premium",
  "messagingUnits": 4,
  "queues": [
    {
      "name": "critical-queue",
      "maxSizeInMegabytes": 5120,
      "defaultMessageTimeToLive": 2592000,
      "lockDuration": 60,
      "maxDeliveryCount": 10,
      "enablePartitioning": true,
      "enableDeadLetteringOnMessageExpiration": true,
      "enableDuplicateDetection": true,
      "duplicateDetectionHistoryTimeWindow": 3600
    }
  ]
}
```

**Рекомендации:**
- Используйте Premium tier для production
- Включите partitioning для высокой пропускной способности
- Настройте duplicate detection для предотвращения дубликатов
- Используйте адекватный lock duration (время обработки × 2-3)
- Настройте DLQ для обработки ошибок

#### High-Throughput конфигурация

Для высоконагруженных систем:
- Используйте Premium tier с несколькими messaging units
- Включите partitioning
- Используйте batched operations
- Настройте auto-forwarding для распределения нагрузки

#### Отказоустойчивость

- Включите partitioning для отказоустойчивости
- Настройте DLQ для обработки ошибок
- Используйте duplicate detection для предотвращения дубликатов
- Настройте auto-forwarding для резервирования

### Оптимизация производительности

#### Lock Duration

- **Слишком короткий:** Сообщения могут быть обработаны дважды
- **Слишком длинный:** Задержка при ошибках обработки
- **Рекомендация:** Время обработки сообщения × 2-3

#### Max Delivery Count

- **Слишком низкий:** Сообщения могут попадать в DLQ преждевременно
- **Слишком высокий:** Задержка при обработке проблемных сообщений
- **Рекомендация:** 5-10 для большинства случаев

#### Duplicate Detection Window

- **Короткое окно:** Меньше дубликатов, но больше ложных срабатываний
- **Длинное окно:** Больше дубликатов, но меньше ложных срабатываний
- **Рекомендация:** 10-60 минут для большинства случаев

#### Partitioning

- Включайте для очередей/топиков с высокой нагрузкой
- Увеличивает пропускную способность
- Улучшает отказоустойчивость
- Нельзя изменить после создания

### Безопасность

#### Connection String

- Используйте SAS (Shared Access Signature) для аутентификации
- Храните connection strings в безопасном месте
- Используйте Managed Identities для приложений Azure

#### SAS Policies

- Создавайте отдельные SAS policies для разных приложений
- Используйте принцип наименьших привилегий
- Регулярно ротируйте ключи

#### RBAC

- Используйте Azure RBAC для управления доступом
- Назначайте роли на уровне namespace или entity
- Используйте Managed Identities для приложений

### Мониторинг и алертинг

#### Ключевые метрики

1. **Active Messages**
   - Нормальное значение: зависит от нагрузки
   - Алерт: постоянный рост или превышение порога

2. **Dead Letter Messages**
   - Нормальное значение: 0 или минимальное количество
   - Алерт: постоянный рост (проблемы с обработкой сообщений)

3. **Lock Expiration Rate**
   - Нормальное значение: < 1% от received messages
   - Алерт: > 5% (возможно, lock duration слишком короткий)

4. **Duplicate Messages Detected**
   - Нормальное значение: зависит от приложения
   - Алерт: резкое увеличение (возможны проблемы с отправкой)

5. **Forwarded Messages**
   - Мониторьте для отслеживания auto-forwarding
   - Алерт: неожиданное изменение

#### CloudWatch/Azure Monitor метрики

Мониторинг через Azure Monitor:
- **Incoming Messages** - Количество входящих сообщений
- **Outgoing Messages** - Количество исходящих сообщений
- **Active Messages** - Активные сообщения
- **Dead Letter Messages** - Сообщения в DLQ
- **Scheduled Messages** - Запланированные сообщения

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
  - Lock duration
  - Message retention
  - Глубина очереди
  - Pricing tier
  - Partitioning

#### Error Rate
- **Описание:** Процент ошибок при обработке
- **Единица измерения:** процент (0-1)
- **Причины ошибок:**
  - Превышение max delivery count
  - Истечение TTL
  - Проблемы с обработкой

#### Utilization
- **Описание:** Загрузка namespace
- **Единица измерения:** процент (0-1)
- **Расчет:** На основе глубины очередей/топиков и messaging units

### Метрики очередей

Для каждой очереди доступны:
- **Active Message Count** - Количество активных сообщений
- **Dead Letter Message Count** - Количество сообщений в DLQ
- **Scheduled Message Count** - Количество запланированных сообщений
- **Deferred Message Count** - Количество отложенных сообщений
- **Duplicate Messages Detected** - Количество обнаруженных дубликатов
- **Forwarded Messages** - Количество пересланных сообщений
- **Sent Count** - Количество отправленных сообщений
- **Received Count** - Количество полученных сообщений
- **Completed Count** - Количество завершенных сообщений
- **Abandoned Count** - Количество отмененных сообщений

### Метрики подписок

Для каждой подписки доступны:
- **Active Message Count** - Количество активных сообщений
- **Dead Letter Message Count** - Количество сообщений в DLQ
- **Deferred Message Count** - Количество отложенных сообщений
- **Filtered Messages** - Количество отфильтрованных сообщений
- **Forwarded Messages** - Количество пересланных сообщений
- **Sent Count** - Количество отправленных сообщений
- **Received Count** - Количество полученных сообщений
- **Completed Count** - Количество завершенных сообщений
- **Abandoned Count** - Количество отмененных сообщений

### Мониторинг в реальном времени

Все метрики обновляются в реальном времени во время симуляции:
- Метрики очередей/подписок обновляются каждую секунду
- Метрики операций обновляются при выполнении операций
- Throughput рассчитывается на основе входящих соединений

---

## Примеры использования

### Пример 1: Очередь с DLQ и Duplicate Detection

**Сценарий:** Обработка заказов с обработкой ошибок и предотвращением дубликатов

```json
{
  "queues": [
    {
      "name": "order-queue",
      "maxSizeInMegabytes": 1024,
      "defaultMessageTimeToLive": 2592000,
      "lockDuration": 60,
      "maxDeliveryCount": 5,
      "enableDeadLetteringOnMessageExpiration": true,
      "enableDuplicateDetection": true,
      "duplicateDetectionHistoryTimeWindow": 600
    }
  ]
}
```

### Пример 2: Топик с Subscription Filters

**Сценарий:** Фильтрация событий пользователей по типу

```json
{
  "topics": [
    {
      "name": "user-events",
      "subscriptions": [
        {
          "name": "premium-subscription",
          "maxDeliveryCount": 10,
          "rules": [
            {
              "name": "premium-users",
              "filterType": "SQL",
              "sqlFilter": "user.type = 'premium' AND user.status = 'active'"
            }
          ]
        },
        {
          "name": "standard-subscription",
          "maxDeliveryCount": 10,
          "rules": [
            {
              "name": "standard-users",
              "filterType": "SQL",
              "sqlFilter": "user.type = 'standard'"
            }
          ]
        }
      ]
    }
  ]
}
```

### Пример 3: Auto-forwarding Chain

**Сценарий:** Цепочка обработки сообщений

```json
{
  "queues": [
    {
      "name": "input-queue",
      "forwardTo": "processing-queue"
    },
    {
      "name": "processing-queue",
      "forwardTo": "output-topic"
    }
  ],
  "topics": [
    {
      "name": "output-topic"
    }
  ]
}
```

### Пример 4: Message Sessions

**Сценарий:** Упорядоченная обработка сообщений от одного источника

```json
{
  "queues": [
    {
      "name": "order-queue",
      "enableSessions": true,
      "lockDuration": 120
    }
  ]
}
```

### Пример 5: Scheduled Messages

**Сценарий:** Отложенная отправка уведомлений

```typescript
// Отправить сообщение, которое будет доступно через 1 час
const scheduledTime = Date.now() + 3600000;
routingEngine.sendToQueue('notification-queue', {
  userId: 123,
  message: 'Your order is ready'
}, {
  scheduledEnqueueTime: scheduledTime
});
```

---

## Часто задаваемые вопросы (FAQ)

### Когда использовать очереди, а когда топики?

- **Очереди (Queues):** Point-to-point доставка, одно сообщение обрабатывается одним потребителем
- **Топики (Topics):** Pub/Sub доставка, одно сообщение доставляется всем подписчикам

### Что такое Peek-Lock паттерн?

Peek-Lock - это паттерн безопасной обработки сообщений:
1. Сообщение получается и блокируется (peek-lock)
2. Сообщение обрабатывается
3. Если успешно - вызывается `complete()` для удаления
4. Если ошибка - вызывается `abandon()` для возврата в очередь

### Как выбрать Lock Duration?

Рекомендуется: время обработки сообщения × 2-3. Слишком короткий - возможны дубликаты, слишком длинный - задержка при ошибках.

### Что такое Dead Letter Queue?

DLQ - это очередь для недоставленных сообщений. Сообщения отправляются в DLQ после превышения `maxDeliveryCount` попыток доставки или при истечении TTL (если настроено).

### Как работает Duplicate Detection?

Duplicate Detection обнаруживает сообщения с одинаковым `messageId` в течение окна обнаружения (по умолчанию 10 минут). Только последнее сообщение сохраняется.

### Что такое Auto-forwarding?

Auto-forwarding автоматически пересылает сообщения из одной очереди/подписки в другую после получения. Полезно для создания цепочек обработки.

### Как работают Subscription Filters?

Subscription Filters фильтруют сообщения в подписках с помощью SQL или Correlation фильтров. Сообщения, соответствующие любому правилу, доставляются в подписку.

### Что такое Message Sessions?

Message Sessions группируют сообщения с одинаковым `sessionId` для упорядоченной обработки. Сообщения из одной сессии обрабатываются строго по порядку.

### Когда использовать Partitioning?

Используйте partitioning для:
- Высоконагруженных очередей/топиков
- Увеличения пропускной способности
- Улучшения отказоустойчивости

**Важно:** Partitioning нельзя изменить после создания очереди/топика.

### Как работает Message Deferral?

Message Deferral позволяет отложить обработку сообщения:
1. Получить сообщение
2. Вызвать `deferMessage()` для отложения
3. Позже получить отложенное сообщение по `sequenceNumber`
4. Обработать и вызвать `completeDeferredMessage()`

---

## Дополнительные ресурсы

- [Официальная документация Azure Service Bus](https://docs.microsoft.com/azure/service-bus-messaging/)
- [Azure Service Bus Best Practices](https://docs.microsoft.com/azure/service-bus-messaging/service-bus-performance-improvements)
- [Azure Service Bus API Reference](https://docs.microsoft.com/rest/api/servicebus/)

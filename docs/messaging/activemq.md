# ActiveMQ - Документация компонента

## Обзор

ActiveMQ - это мультипротокольный брокер сообщений с поддержкой множества протоколов (OpenWire, AMQP, MQTT, STOMP, WebSocket), предназначенный для надежной доставки сообщений в различных сценариях использования. Компонент ActiveMQ в системе симуляции полностью эмулирует поведение реального ActiveMQ брокера, включая очереди, топики, подписки, персистентность, ACL и управление памятью.

### Основные возможности

- ✅ **Мультипротокольная поддержка** - OpenWire, AMQP, MQTT, STOMP, WebSocket
- ✅ **Очереди (Queues)** - Point-to-point доставка сообщений
- ✅ **Топики (Topics)** - Pub/Sub доставка сообщений
- ✅ **Персистентность** - Сохранение сообщений на диск
- ✅ **Управление памятью** - Контроль использования памяти и store/temp usage
- ✅ **Dead Letter Queue** - Обработка недоставленных сообщений
- ✅ **Redelivery Policy** - Политика повторной доставки с exponential backoff
- ✅ **ACL (Access Control List)** - Контроль доступа на уровне очередей и топиков
- ✅ **Метрики в реальном времени** - Отслеживание глубины очередей, подписчиков, throughput

---

## Основные функции

### 1. Управление соединениями

**Описание:** Настройка подключения к брокеру ActiveMQ.

**Параметры соединения:**
- **brokerName** - Имя брокера (по умолчанию: `localhost`)
- **brokerUrl** - URL брокера (по умолчанию: `tcp://localhost:61616`)
- **protocol** - Протокол соединения: `openwire`, `amqp`, `mqtt`, `stomp`, `ws` (по умолчанию: `openwire`)
- **port** - Порт брокера (по умолчанию: `61616` для OpenWire)
- **username** - Имя пользователя (по умолчанию: `admin`)
- **password** - Пароль пользователя (по умолчанию: `admin`)

**Протоколы и порты:**
- **OpenWire:** `tcp://localhost:61616` (по умолчанию)
- **AMQP:** `amqp://localhost:5672`
- **MQTT:** `mqtt://localhost:1883`
- **STOMP:** `stomp://localhost:61613`
- **WebSocket:** `ws://localhost:61614`

**Пример конфигурации:**
```json
{
  "brokerName": "production-broker",
  "brokerUrl": "tcp://activemq.example.com:61616",
  "protocol": "openwire",
  "port": 61616,
  "username": "admin",
  "password": "secret"
}
```

### 2. Управление очередями (Queues)

**Описание:** Создание и настройка очередей для point-to-point доставки сообщений.

**Параметры очереди:**
- **name** - Имя очереди (обязательно)
- **prefetch** - Размер prefetch для потребителей (по умолчанию: 1000)
- **defaultPriority** - Приоритет по умолчанию (0-9, по умолчанию: 4)
- **defaultTTL** - TTL по умолчанию в секундах (по умолчанию: без ограничений)
- **maxRedeliveries** - Максимальное количество попыток доставки (по умолчанию: 6)
- **redeliveryPolicy** - Политика повторной доставки:
  - `maxRedeliveries` - Максимальное количество попыток
  - `initialRedeliveryDelay` - Начальная задержка в миллисекундах (по умолчанию: 1000)
  - `maximumRedeliveryDelay` - Максимальная задержка в миллисекундах (по умолчанию: 60000)
  - `useExponentialBackOff` - Использовать exponential backoff (по умолчанию: false)
  - `backOffMultiplier` - Множитель для exponential backoff (по умолчанию: 2)
- **memoryLimit** - Лимит памяти для очереди в MB (по умолчанию: без ограничений)

**Метрики очереди (обновляются в реальном времени):**
- **queueSize** - Количество сообщений в очереди
- **consumerCount** - Количество активных потребителей
- **enqueueCount** - Общее количество добавленных сообщений
- **dequeueCount** - Общее количество извлеченных сообщений
- **memoryUsage** - Использование памяти в MB
- **memoryPercent** - Процент использования памяти от лимита

**Пример конфигурации:**
```json
{
  "queues": [
    {
      "name": "order-queue",
      "prefetch": 100,
      "defaultPriority": 5,
      "defaultTTL": 3600,
      "redeliveryPolicy": {
        "maxRedeliveries": 6,
        "initialRedeliveryDelay": 1000,
        "maximumRedeliveryDelay": 60000,
        "useExponentialBackOff": true,
        "backOffMultiplier": 2
      },
      "memoryLimit": 512
    }
  ]
}
```

### 3. Управление топиками (Topics)

**Описание:** Создание и настройка топиков для pub/sub доставки сообщений.

**Параметры топика:**
- **name** - Имя топика (обязательно)
- **defaultPriority** - Приоритет по умолчанию (0-9, по умолчанию: 4)
- **defaultTTL** - TTL по умолчанию в секундах (по умолчанию: без ограничений)
- **maxRedeliveries** - Максимальное количество попыток доставки (по умолчанию: 6)
- **redeliveryPolicy** - Политика повторной доставки (аналогично очередям)
- **memoryLimit** - Лимит памяти для топика в MB (по умолчанию: без ограничений)

**Метрики топика (обновляются в реальном времени):**
- **subscriberCount** - Количество активных подписчиков
- **enqueueCount** - Общее количество опубликованных сообщений
- **dequeueCount** - Общее количество доставленных сообщений
- **memoryUsage** - Использование памяти в MB
- **memoryPercent** - Процент использования памяти от лимита

**Особенности:**
- Сообщения доставляются всем активным подписчикам
- Поддержка durable subscriptions (сохранение подписок)
- Селекторы сообщений для фильтрации

**Пример конфигурации:**
```json
{
  "topics": [
    {
      "name": "system-events",
      "defaultPriority": 7,
      "memoryLimit": 256
    },
    {
      "name": "user-notifications",
      "defaultTTL": 86400,
      "redeliveryPolicy": {
        "maxRedeliveries": 3,
        "initialRedeliveryDelay": 5000
      }
    }
  ]
}
```

### 4. Персистентность (Persistence)

**Описание:** Настройка сохранения сообщений на диск для обеспечения надежности.

**Параметры:**
- **persistenceEnabled** - Включить персистентность (по умолчанию: `true`)
- **storeUsage** - Использование постоянного хранилища в MB (обновляется автоматически)
- **tempUsage** - Использование временного хранилища в MB (обновляется автоматически)
- **memoryLimit** - Общий лимит памяти брокера в MB (по умолчанию: 1024)

**Особенности:**
- При `persistenceEnabled: true` сообщения сохраняются на диск
- Store usage увеличивается для persistent сообщений
- Temp usage используется для non-persistent сообщений
- При превышении `memoryLimit` может возникнуть блокировка producer flow control

**Пример конфигурации:**
```json
{
  "persistenceEnabled": true,
  "memoryLimit": 2048,
  "storeUsage": 0,
  "tempUsage": 0
}
```

### 5. Управление памятью

**Описание:** Контроль использования памяти брокером.

**Параметры:**
- **memoryLimit** - Общий лимит памяти в MB (по умолчанию: 1024)
- **memoryPressureThreshold** - Порог давления памяти (0-1, по умолчанию: 0.8)
- **avgMessageSize** - Средний размер сообщения в байтах (по умолчанию: 1024)

**Влияние на производительность:**
- При превышении `memoryPressureThreshold` увеличивается latency
- Producer flow control активируется при достижении `memoryLimit`
- Store и temp usage отслеживаются отдельно

**Пример конфигурации:**
```json
{
  "memoryLimit": 4096,
  "memoryPressureThreshold": 0.75,
  "avgMessageSize": 2048
}
```

### 6. Протоколы и задержки

**Описание:** Настройка задержек для различных протоколов.

**Параметры:**
- **protocolLatencies** - Задержки для каждого протокола в миллисекундах:
  - `openwire` - 2ms (по умолчанию)
  - `amqp` - 5ms (по умолчанию)
  - `mqtt` - 8ms (по умолчанию)
  - `stomp` - 10ms (по умолчанию)
  - `ws` - 12ms (по умолчанию)

**Влияние на latency:**
- Базовая задержка протокола добавляется к общей latency
- Учитывается при расчете метрик производительности

**Пример конфигурации:**
```json
{
  "protocol": "openwire",
  "protocolLatencies": {
    "openwire": 2,
    "amqp": 5,
    "mqtt": 8,
    "stomp": 10,
    "ws": 12
  }
}
```

### 7. Dead Letter Queue (DLQ)

**Описание:** Очередь для недоставленных сообщений.

**Параметры:**
- **deadLetterQueue** - Имя Dead Letter Queue (по умолчанию: `DLQ`)

**Поведение:**
- Сообщения отправляются в DLQ после исчерпания `maxRedeliveries`
- Сообщения с истекшим TTL также могут отправляться в DLQ
- DLQ создается автоматически при необходимости

**Пример конфигурации:**
```json
{
  "deadLetterQueue": "DLQ",
  "queues": [
    {
      "name": "order-queue",
      "redeliveryPolicy": {
        "maxRedeliveries": 6
      }
    }
  ]
}
```

### 8. ACL (Access Control List)

**Описание:** Контроль доступа на уровне очередей и топиков.

**Параметры ACL:**
- **principal** - Идентификатор пользователя/приложения (обязательно)
- **resource** - Имя ресурса (очередь или топик, например, `queue://orders` или `topic://events`)
- **operation** - Операция: `read`, `write`, `admin`, `create`
- **permission** - Разрешение: `allow`, `deny` (по умолчанию: `allow`)

**Формат ресурса:**
- Очереди: `queue://{queue-name}`
- Топики: `topic://{topic-name}`

**Пример конфигурации:**
```json
{
  "acls": [
    {
      "principal": "producer-app",
      "resource": "queue://orders",
      "operation": "write",
      "permission": "allow"
    },
    {
      "principal": "consumer-app",
      "resource": "queue://orders",
      "operation": "read",
      "permission": "allow"
    },
    {
      "principal": "unauthorized-app",
      "resource": "queue://orders",
      "operation": "all",
      "permission": "deny"
    }
  ]
}
```

### 9. Параметры производительности

**Описание:** Настройки, влияющие на производительность обработки сообщений.

**Параметры:**
- **consumptionRate** - Скорость потребления сообщений на одного потребителя (msg/sec, по умолчанию: 10)
- **queueLatencyBase** - Базовая задержка очереди в миллисекундах (по умолчанию: 0)
- **queueLatencyFactor** - Множитель задержки очереди (по умолчанию: 1)
- **maxConnections** - Максимальное количество соединений (по умолчанию: 1000)

**Влияние на метрики:**
- `consumptionRate` влияет на скорость уменьшения глубины очереди
- `queueLatencyBase` и `queueLatencyFactor` влияют на расчет latency
- Latency = protocolLatency + persistenceLatency + queueLatency + memoryPressureLatency

**Пример конфигурации:**
```json
{
  "consumptionRate": 50,
  "queueLatencyBase": 5,
  "queueLatencyFactor": 0.5,
  "maxConnections": 2000
}
```

---

## Руководство пользователя

### Быстрый старт

1. **Добавление компонента ActiveMQ:**
   - Перетащите компонент "ActiveMQ" из библиотеки компонентов на canvas
   - Откройте панель конфигурации компонента

2. **Базовая настройка:**
   - Выберите протокол (OpenWire рекомендуется для начала)
   - Укажите broker URL и порт
   - Создайте первую очередь через вкладку "Queues"
   - Создайте первый топик через вкладку "Topics"

3. **Подключение к другим компонентам:**
   - Создайте соединение от компонента-производителя к ActiveMQ
   - Создайте соединение от ActiveMQ к компоненту-потребителю
   - Настройте имя очереди/топика в соединении

### Работа с очередями

#### Создание очереди

1. Перейдите на вкладку **"Queues"**
2. Нажмите кнопку **"Add Queue"**
3. Заполните параметры:
   - **Name** - Уникальное имя очереди
   - **Prefetch** - Размер prefetch (рекомендуется: 100-1000)
   - **Default Priority** - Приоритет по умолчанию (0-9)
   - **Default TTL** - TTL по умолчанию в секундах
   - **Memory Limit** - Лимит памяти в MB
4. Настройте Redelivery Policy (опционально):
   - Max Redeliveries
   - Initial Redelivery Delay
   - Use Exponential Backoff
5. Нажмите **"Save"**

#### Настройка Redelivery Policy

Redelivery Policy определяет поведение при неудачной доставке:
- **Max Redeliveries** - Количество попыток перед отправкой в DLQ
- **Initial Redelivery Delay** - Начальная задержка между попытками
- **Maximum Redelivery Delay** - Максимальная задержка
- **Use Exponential Backoff** - Увеличивать задержку экспоненциально
- **Back Off Multiplier** - Множитель для exponential backoff

**Пример:**
```json
{
  "maxRedeliveries": 6,
  "initialRedeliveryDelay": 1000,
  "maximumRedeliveryDelay": 60000,
  "useExponentialBackOff": true,
  "backOffMultiplier": 2
}
```

Это означает:
- 6 попыток доставки
- Задержки: 1s, 2s, 4s, 8s, 16s, 32s (экспоненциальный рост)
- После 6 попыток сообщение отправляется в DLQ

#### Просмотр метрик очереди

Во время симуляции на вкладке **"Queues"** отображаются:
- **Queue Size** - Количество сообщений в очереди
- **Consumer Count** - Количество активных потребителей
- **Enqueue Count** - Всего добавлено сообщений
- **Dequeue Count** - Всего извлечено сообщений
- **Memory Usage** - Использование памяти в MB
- **Memory Percent** - Процент использования от лимита

### Работа с топиками

#### Создание топика

1. Перейдите на вкладку **"Topics"**
2. Нажмите кнопку **"Add Topic"**
3. Заполните параметры:
   - **Name** - Уникальное имя топика
   - **Default Priority** - Приоритет по умолчанию
   - **Default TTL** - TTL по умолчанию
   - **Memory Limit** - Лимит памяти
4. Настройте Redelivery Policy (опционально)
5. Нажмите **"Save"**

#### Особенности топиков

- Сообщения доставляются всем активным подписчикам
- Поддержка durable subscriptions (сохранение подписок)
- Селекторы для фильтрации сообщений
- Метрики отслеживаются отдельно для каждого подписчика

### Настройка персистентности

1. Перейдите на вкладку **"Broker Settings"**
2. Включите/выключите **"Persistence Enabled"**
3. Установите **"Memory Limit"** для брокера
4. Мониторьте **"Store Usage"** и **"Temp Usage"** во время симуляции

**Рекомендации:**
- Включите персистентность для критичных сообщений
- Отключите для высокопроизводительных сценариев с допустимой потерей сообщений
- Мониторьте store usage для предотвращения переполнения диска

### Настройка ACL

1. Перейдите на вкладку **"Security"**
2. Нажмите кнопку **"Add ACL"**
3. Заполните параметры:
   - **Principal** - Идентификатор пользователя/приложения
   - **Resource** - Имя ресурса (`queue://{name}` или `topic://{name}`)
   - **Operation** - Операция (read, write, admin, create)
   - **Permission** - Allow или Deny
4. Нажмите **"Save"**

**Важно:** Правила `Deny` имеют приоритет над `Allow`. Используйте `Deny` для явного запрета доступа.

### Выбор протокола

**OpenWire (рекомендуется):**
- Нативный протокол ActiveMQ
- Наименьшая задержка (2ms)
- Лучшая производительность
- Используйте для Java приложений

**AMQP:**
- Стандартный протокол
- Задержка: 5ms
- Используйте для межплатформенной интеграции

**MQTT:**
- Протокол для IoT
- Задержка: 8ms
- Используйте для устройств с ограниченными ресурсами

**STOMP:**
- Простой текстовый протокол
- Задержка: 10ms
- Используйте для веб-приложений

**WebSocket:**
- Протокол для браузеров
- Задержка: 12ms
- Используйте для real-time веб-приложений

---

## Руководство администратора

### Рекомендации по конфигурации

#### Production брокер

```json
{
  "brokerName": "production-broker",
  "brokerUrl": "tcp://activemq.production.com:61616",
  "protocol": "openwire",
  "persistenceEnabled": true,
  "memoryLimit": 4096,
  "maxConnections": 2000,
  "queues": [
    {
      "name": "critical-queue",
      "prefetch": 100,
      "memoryLimit": 512,
      "redeliveryPolicy": {
        "maxRedeliveries": 6,
        "useExponentialBackOff": true
      }
    }
  ]
}
```

**Рекомендации:**
- Используйте персистентность для критичных сообщений
- Установите адекватный memory limit
- Настройте redelivery policy для обработки ошибок
- Используйте memory limits для очередей/топиков

#### High-Throughput конфигурация

Для высоконагруженных систем:
- Увеличьте `consumptionRate` (50-100 msg/sec)
- Уменьшите `queueLatencyBase` и `queueLatencyFactor`
- Используйте OpenWire протокол
- Отключите персистентность (если допустима потеря сообщений)
- Увеличьте prefetch для очередей

#### Отказоустойчивость

- Включите персистентность
- Настройте Dead Letter Queue
- Используйте redelivery policy с exponential backoff
- Мониторьте memory usage
- Настройте ACL для безопасности

### Оптимизация производительности

#### Управление памятью

- **Memory Limit:**
  - Низкая нагрузка: 1024 MB
  - Средняя нагрузка: 2048-4096 MB
  - Высокая нагрузка: 4096-8192 MB

- **Memory Pressure Threshold:**
  - Рекомендуется: 0.75-0.8
  - При превышении увеличивается latency

- **Queue/Topic Memory Limits:**
  - Устанавливайте лимиты для предотвращения переполнения
  - Мониторьте memory percent для каждой очереди/топика

#### Выбор протокола

- **OpenWire:** Наилучшая производительность, наименьшая задержка
- **AMQP:** Хорошая производительность, стандартный протокол
- **MQTT:** Умеренная производительность, для IoT
- **STOMP/WebSocket:** Ниже производительность, для веб-приложений

#### Параметры производительности

- **consumptionRate:**
  - Низкая нагрузка: 10-20 msg/sec
  - Средняя нагрузка: 20-50 msg/sec
  - Высокая нагрузка: 50-100 msg/sec

- **Prefetch:**
  - Низкая нагрузка: 100-500
  - Средняя нагрузка: 500-1000
  - Высокая нагрузка: 1000-5000

### Безопасность

#### Настройка ACL

**Рекомендуемый подход:**
1. Создайте правила `Deny` для неавторизованных пользователей
2. Создайте правила `Allow` для конкретных приложений
3. Используйте специфичные ресурсы (queue://, topic://)

**Пример production ACL:**
```json
{
  "acls": [
    {
      "principal": "producer-app",
      "resource": "queue://orders",
      "operation": "write",
      "permission": "allow"
    },
    {
      "principal": "consumer-app",
      "resource": "queue://orders",
      "operation": "read",
      "permission": "allow"
    },
    {
      "principal": "*",
      "resource": "queue://orders",
      "operation": "all",
      "permission": "deny"
    }
  ]
}
```

### Мониторинг и алертинг

#### Ключевые метрики

1. **Queue/Topic Size**
   - Нормальное значение: зависит от нагрузки
   - Алерт: постоянный рост или превышение memory limit

2. **Memory Usage**
   - Нормальное значение: < 80% от memory limit
   - Алерт: memory usage > 90% или превышение memory limit

3. **Store/Temp Usage**
   - Мониторьте для предотвращения переполнения диска
   - Алерт: быстрое увеличение usage

4. **Consumer/Subscriber Count**
   - Мониторьте количество активных потребителей/подписчиков
   - Алерт: количество = 0 для критичных очередей/топиков

5. **Throughput**
   - Нормальное значение: зависит от нагрузки
   - Алерт: резкое падение throughput

6. **Error Rate**
   - Нормальное значение: < 0.1%
   - Алерт: error rate > 1% (возможны ACL блокировки)

#### Мониторинг Redelivery

- Отслеживайте количество сообщений, отправляемых в DLQ
- Анализируйте причины неудачной доставки
- Настройте алерты при превышении порога redeliveries

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
  - Протокол (protocolLatency)
  - Персистентность (persistenceLatency)
  - Глубина очереди/топика (queueLatency)
  - Давление памяти (memoryPressureLatency)

**Формула:**
```
Latency = protocolLatency + persistenceLatency + queueLatency + memoryPressureLatency + jitter
```

#### Error Rate
- **Описание:** Процент ошибок при обработке
- **Единица измерения:** процент (0-1)
- **Причины ошибок:**
  - ACL блокировки
  - Переполнение памяти
  - Превышение TTL
  - Исчерпание redeliveries

#### Utilization
- **Описание:** Загрузка брокера
- **Единица измерения:** процент (0-1)
- **Расчет:** На основе глубины очередей/топиков и memory usage

### Кастомные метрики

#### Queue Depth
- Общая глубина всех очередей (сумма queueSize)

#### Topic Messages
- Общее количество сообщений во всех топиках

#### Connections
- Количество активных соединений

#### Queues
- Количество очередей

#### Topics
- Количество топиков

#### Consumers
- Общее количество активных потребителей

#### Subscribers
- Общее количество активных подписчиков

#### Memory Usage
- Общее использование памяти (storeUsage + tempUsage)

#### Memory Percent
- Процент использования памяти от memoryLimit

### Метрики очередей

Для каждой очереди доступны:
- **Queue Size** - Количество сообщений
- **Consumer Count** - Количество потребителей
- **Enqueue Count** - Всего добавлено
- **Dequeue Count** - Всего извлечено
- **Memory Usage** - Использование памяти в MB
- **Memory Percent** - Процент использования от лимита

### Метрики топиков

Для каждого топика доступны:
- **Subscriber Count** - Количество подписчиков
- **Enqueue Count** - Всего опубликовано
- **Dequeue Count** - Всего доставлено
- **Memory Usage** - Использование памяти в MB
- **Memory Percent** - Процент использования от лимита

### Мониторинг в реальном времени

Все метрики обновляются в реальном времени во время симуляции:
- Глубина очередей/топиков обновляется каждую секунду
- Метрики потребителей/подписчиков синхронизируются с routing engine
- Memory usage рассчитывается на основе размера сообщений
- Throughput рассчитывается на основе входящих соединений

---

## Примеры использования

### Пример 1: Очередь с Redelivery Policy

**Сценарий:** Обработка заказов с повторными попытками при ошибках

```json
{
  "queues": [
    {
      "name": "order-queue",
      "prefetch": 100,
      "redeliveryPolicy": {
        "maxRedeliveries": 6,
        "initialRedeliveryDelay": 1000,
        "maximumRedeliveryDelay": 60000,
        "useExponentialBackOff": true,
        "backOffMultiplier": 2
      },
      "memoryLimit": 512
    }
  ],
  "deadLetterQueue": "DLQ"
}
```

### Пример 2: Топик для Pub/Sub

**Сценарий:** Рассылка системных событий всем подписчикам

```json
{
  "topics": [
    {
      "name": "system-events",
      "defaultPriority": 7,
      "defaultTTL": 3600,
      "memoryLimit": 256
    }
  ]
}
```

### Пример 3: Мультипротокольный брокер

**Сценарий:** Поддержка различных типов клиентов

```json
{
  "protocol": "openwire",
  "protocolLatencies": {
    "openwire": 2,
    "amqp": 5,
    "mqtt": 8,
    "stomp": 10,
    "ws": 12
  },
  "queues": [
    {
      "name": "universal-queue"
    }
  ]
}
```

### Пример 4: High-Throughput конфигурация

**Сценарий:** Высоконагруженная система обработки событий

```json
{
  "protocol": "openwire",
  "persistenceEnabled": false,
  "memoryLimit": 8192,
  "consumptionRate": 100,
  "queueLatencyBase": 0,
  "queueLatencyFactor": 0.1,
  "queues": [
    {
      "name": "events-queue",
      "prefetch": 5000,
      "memoryLimit": 2048
    }
  ]
}
```

### Пример 5: Безопасная конфигурация с ACL

**Сценарий:** Разделение доступа между приложениями

```json
{
  "queues": [
    {
      "name": "orders",
      "memoryLimit": 1024
    },
    {
      "name": "payments",
      "memoryLimit": 512
    }
  ],
  "acls": [
    {
      "principal": "order-service",
      "resource": "queue://orders",
      "operation": "write",
      "permission": "allow"
    },
    {
      "principal": "payment-service",
      "resource": "queue://payments",
      "operation": "write",
      "permission": "allow"
    },
    {
      "principal": "*",
      "resource": "queue://orders",
      "operation": "all",
      "permission": "deny"
    }
  ]
}
```

---

## Часто задаваемые вопросы (FAQ)

### Какой протокол выбрать?

- **OpenWire:** Для Java приложений, наилучшая производительность
- **AMQP:** Для межплатформенной интеграции
- **MQTT:** Для IoT устройств
- **STOMP:** Для простых текстовых протоколов
- **WebSocket:** Для веб-приложений в браузере

### Когда использовать очереди, а когда топики?

- **Очереди (Queues):** Point-to-point доставка, одно сообщение обрабатывается одним потребителем
- **Топики (Topics):** Pub/Sub доставка, одно сообщение доставляется всем подписчикам

### Что такое Redelivery Policy?

Redelivery Policy определяет поведение при неудачной доставке сообщения:
- Количество попыток перед отправкой в DLQ
- Задержки между попытками
- Использование exponential backoff

### Как работает Dead Letter Queue?

Сообщения отправляются в DLQ после:
- Исчерпания maxRedeliveries
- Истечения TTL (если настроено)
- Ошибок обработки

### Когда отключать персистентность?

Отключайте персистентность для:
- Высокопроизводительных сценариев
- Допустимой потери сообщений
- Временных данных
- Тестирования

Включайте персистентность для:
- Критичных сообщений
- Гарантии доставки
- Production окружений

### Как оптимизировать производительность?

- Используйте OpenWire протокол
- Увеличьте consumptionRate
- Уменьшите queueLatencyBase и queueLatencyFactor
- Увеличьте prefetch
- Отключите персистентность (если допустимо)
- Увеличьте memory limit

### Что такое Memory Pressure?

Memory Pressure возникает при превышении `memoryPressureThreshold` (по умолчанию 80% от memoryLimit). При этом:
- Увеличивается latency
- Может активироваться producer flow control
- Сообщения могут блокироваться

---

## Дополнительные ресурсы

- [Официальная документация ActiveMQ](https://activemq.apache.org/documentation)
- [ActiveMQ Best Practices](https://activemq.apache.org/best-practices)
- [ActiveMQ Performance Tuning](https://activemq.apache.org/performance-tuning)

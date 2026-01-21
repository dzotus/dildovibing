# RabbitMQ - Документация компонента

## Обзор

RabbitMQ - это брокер сообщений с поддержкой протокола AMQP (Advanced Message Queuing Protocol), предназначенный для надежной доставки сообщений между компонентами системы. Компонент RabbitMQ в системе симуляции полностью эмулирует поведение реального RabbitMQ брокера, включая очереди, exchanges, bindings, policies и различные типы маршрутизации.

### Основные возможности

- ✅ **Очереди (Queues)** - Надежное хранение и доставка сообщений
- ✅ **Exchanges** - Маршрутизация сообщений по различным алгоритмам
- ✅ **Bindings** - Связывание exchanges с очередями через routing keys
- ✅ **Policies** - Автоматическое применение настроек к очередям и exchanges
- ✅ **Dead Letter Exchange** - Обработка недоставленных сообщений
- ✅ **TTL и приоритеты** - Управление жизненным циклом сообщений
- ✅ **Метрики в реальном времени** - Отслеживание глубины очередей, потребителей, throughput

---

## Основные функции

### 1. Управление соединениями

**Описание:** Настройка подключения к брокеру RabbitMQ.

**Параметры соединения:**
- **host** - Адрес брокера (по умолчанию: `localhost`)
- **port** - Порт брокера (по умолчанию: `5672`)
- **username** - Имя пользователя (по умолчанию: `guest`)
- **password** - Пароль пользователя
- **vhost** - Виртуальный хост (по умолчанию: `/`)

**Пример конфигурации:**
```json
{
  "host": "rabbitmq.example.com",
  "port": 5672,
  "username": "admin",
  "password": "secret",
  "vhost": "/production"
}
```

### 2. Управление очередями (Queues)

**Описание:** Создание и настройка очередей для хранения сообщений.

**Параметры очереди:**
- **name** - Имя очереди (обязательно)
- **durable** - Сохранять очередь после перезапуска брокера (по умолчанию: `true`)
- **exclusive** - Очередь доступна только одному соединению (по умолчанию: `false`)
- **autoDelete** - Удалять очередь при отсутствии потребителей (по умолчанию: `false`)
- **arguments** - Дополнительные аргументы:
  - `x-dead-letter-exchange` - Exchange для недоставленных сообщений
  - `x-dead-letter-routing-key` - Routing key для недоставленных сообщений
  - `x-message-ttl` - Время жизни сообщений в миллисекундах
  - `x-max-length` - Максимальное количество сообщений в очереди
  - `x-max-priority` - Максимальный приоритет сообщений (0-255)
  - `x-queue-type` - Тип очереди: `classic`, `quorum`, `stream`
  - `x-single-active-consumer` - Только один активный потребитель

**Метрики очереди (обновляются в реальном времени):**
- **messages** - Общее количество сообщений
- **ready** - Количество готовых к доставке сообщений
- **unacked** - Количество неподтвержденных сообщений
- **consumers** - Количество активных потребителей

**Пример конфигурации:**
```json
{
  "queues": [
    {
      "name": "order-queue",
      "durable": true,
      "exclusive": false,
      "autoDelete": false,
      "arguments": {
        "x-dead-letter-exchange": "dlx",
        "x-message-ttl": 3600000,
        "x-max-length": 10000,
        "x-max-priority": 10
      }
    },
    {
      "name": "priority-queue",
      "durable": true,
      "arguments": {
        "x-max-priority": 255,
        "x-single-active-consumer": true
      }
    }
  ]
}
```

### 3. Управление Exchanges

**Описание:** Создание exchanges для маршрутизации сообщений.

**Типы exchanges:**
- **direct** - Маршрутизация по точному совпадению routing key
- **topic** - Маршрутизация по паттерну routing key (wildcards: `*`, `#`)
- **fanout** - Рассылка во все связанные очереди (игнорирует routing key)
- **headers** - Маршрутизация по заголовкам сообщений

**Параметры exchange:**
- **name** - Имя exchange (обязательно)
- **type** - Тип exchange (обязательно)
- **durable** - Сохранять exchange после перезапуска (по умолчанию: `true`)
- **autoDelete** - Удалять exchange при отсутствии bindings (по умолчанию: `false`)
- **internal** - Exchange не принимает сообщения от producers (по умолчанию: `false`)
- **alternateExchange** - Exchange для сообщений без совпадений

**Системные exchanges (создаются автоматически):**
- `amq.direct` - Direct exchange
- `amq.topic` - Topic exchange
- `amq.fanout` - Fanout exchange

**Пример конфигурации:**
```json
{
  "exchanges": [
    {
      "name": "orders-exchange",
      "type": "direct",
      "durable": true,
      "autoDelete": false,
      "internal": false
    },
    {
      "name": "events-exchange",
      "type": "topic",
      "durable": true
    },
    {
      "name": "broadcast-exchange",
      "type": "fanout",
      "durable": true
    }
  ]
}
```

### 4. Управление Bindings

**Описание:** Связывание exchanges с очередями через routing keys.

**Параметры binding:**
- **id** - Уникальный идентификатор binding (генерируется автоматически)
- **source** - Имя exchange (обязательно)
- **destination** - Имя очереди (обязательно)
- **routingKey** - Routing key для маршрутизации (обязательно)
- **arguments** - Дополнительные аргументы (для headers exchange)

**Особенности маршрутизации:**
- **Direct:** Точное совпадение routing key
- **Topic:** Паттерны с wildcards:
  - `*` - Одно слово
  - `#` - Ноль или более слов
- **Fanout:** Игнорирует routing key, рассылает во все очереди
- **Headers:** Маршрутизация по заголовкам (x-match: all/any)

**Пример конфигурации:**
```json
{
  "bindings": [
    {
      "source": "orders-exchange",
      "destination": "order-queue",
      "routingKey": "order.created"
    },
    {
      "source": "events-exchange",
      "destination": "notification-queue",
      "routingKey": "user.*.created"
    },
    {
      "source": "broadcast-exchange",
      "destination": "all-users-queue",
      "routingKey": ""
    }
  ]
}
```

### 5. Управление Policies

**Описание:** Автоматическое применение настроек к очередям и exchanges по паттернам.

**Параметры policy:**
- **name** - Имя политики (обязательно)
- **pattern** - Регулярное выражение для сопоставления имен (обязательно)
- **definition** - Определение политики (JSON объект)
- **priority** - Приоритет политики (чем выше, тем приоритетнее)
- **applyTo** - Применение: `queues`, `exchanges`, `all` (по умолчанию: `all`)

**Примеры определений политик:**
- **TTL для всех очередей:**
```json
{
  "name": "ttl-policy",
  "pattern": ".*",
  "definition": {
    "message-ttl": 3600000
  },
  "priority": 0,
  "applyTo": "queues"
}
```

- **HA (High Availability) для очередей:**
```json
{
  "name": "ha-policy",
  "pattern": "important-.*",
  "definition": {
    "ha-mode": "all",
    "ha-sync-mode": "automatic"
  },
  "priority": 10,
  "applyTo": "queues"
}
```

- **Max Length:**
```json
{
  "name": "max-length-policy",
  "pattern": "buffer-.*",
  "definition": {
    "max-length": 1000
  },
  "priority": 5,
  "applyTo": "queues"
}
```

### 6. Параметры производительности

**Описание:** Настройки, влияющие на производительность обработки сообщений.

**Параметры:**
- **consumptionRate** - Скорость потребления сообщений на одного потребителя (msg/sec, по умолчанию: 10)
- **processingTime** - Время обработки одного сообщения (ms, по умолчанию: 100)

**Влияние на метрики:**
- `consumptionRate` влияет на скорость уменьшения глубины очереди
- `processingTime` влияет на latency обработки сообщений

**Пример конфигурации:**
```json
{
  "consumptionRate": 50,
  "processingTime": 50
}
```

---

## Руководство пользователя

### Быстрый старт

1. **Добавление компонента RabbitMQ:**
   - Перетащите компонент "RabbitMQ" из библиотеки компонентов на canvas
   - Откройте панель конфигурации компонента

2. **Базовая настройка:**
   - Укажите host и port брокера
   - Создайте первую очередь через вкладку "Queues"
   - Создайте exchange через вкладку "Exchanges"
   - Создайте binding через вкладку "Bindings"

3. **Подключение к другим компонентам:**
   - Создайте соединение от компонента-производителя к RabbitMQ
   - Создайте соединение от RabbitMQ к компоненту-потребителю
   - Настройте routing key в соединении

### Работа с очередями

#### Создание очереди

1. Перейдите на вкладку **"Queues"**
2. Нажмите кнопку **"Add Queue"**
3. Заполните параметры:
   - **Name** - Уникальное имя очереди
   - **Durable** - Сохранять после перезапуска
   - **Exclusive** - Только для одного соединения
   - **Auto Delete** - Удалять при отсутствии потребителей
4. Настройте дополнительные аргументы (опционально):
   - Dead Letter Exchange
   - Message TTL
   - Max Length
   - Max Priority
5. Нажмите **"Save"**

#### Настройка очереди

1. Выберите очередь из списка
2. Нажмите кнопку **"Edit"** (иконка карандаша)
3. Измените параметры
4. Сохраните изменения

#### Просмотр метрик очереди

Во время симуляции на вкладке **"Queues"** отображаются:
- **Messages** - Общее количество сообщений
- **Ready** - Готовые к доставке сообщения
- **Unacked** - Неподтвержденные сообщения
- **Consumers** - Количество активных потребителей

### Работа с Exchanges

#### Создание Exchange

1. Перейдите на вкладку **"Exchanges"**
2. Нажмите кнопку **"Create Exchange"**
3. Заполните параметры:
   - **Name** - Уникальное имя exchange
   - **Type** - Тип exchange (direct, topic, fanout, headers)
   - **Durable** - Сохранять после перезапуска
   - **Auto Delete** - Удалять при отсутствии bindings
   - **Internal** - Не принимать сообщения от producers
4. Нажмите **"Create"**

#### Выбор типа Exchange

- **Direct:** Используйте для точной маршрутизации (например, `order.created`)
- **Topic:** Используйте для паттернов (например, `user.*.created`)
- **Fanout:** Используйте для broadcast (рассылка во все очереди)
- **Headers:** Используйте для маршрутизации по заголовкам

### Работа с Bindings

#### Создание Binding

1. Перейдите на вкладку **"Bindings"**
2. Нажмите кнопку **"Create Binding"**
3. Заполните параметры:
   - **Source** - Выберите exchange
   - **Destination** - Выберите очередь
   - **Routing Key** - Укажите routing key
4. Нажмите **"Create"**

#### Routing Key Patterns (для Topic Exchange)

- `order.created` - Точное совпадение
- `order.*` - Любое одно слово (например, `order.created`, `order.updated`)
- `order.#` - Ноль или более слов (например, `order`, `order.created`, `order.created.priority`)
- `*.created` - Любое слово перед `.created`
- `#.created` - Ноль или более слов перед `.created`

### Работа с Policies

#### Создание Policy

1. Перейдите на вкладку **"Policies"**
2. Нажмите кнопку **"Create Policy"**
3. Заполните параметры:
   - **Name** - Имя политики
   - **Pattern** - Регулярное выражение (например, `.*`, `important-.*`)
   - **Definition** - JSON объект с настройками
   - **Priority** - Приоритет (чем выше, тем приоритетнее)
   - **Apply To** - Применение (queues, exchanges, all)
4. Нажмите **"Create"**

#### Примеры Policies

**TTL для всех очередей:**
```json
{
  "name": "default-ttl",
  "pattern": ".*",
  "definition": {
    "message-ttl": 3600000
  },
  "priority": 0,
  "applyTo": "queues"
}
```

**Max Length для буферных очередей:**
```json
{
  "name": "buffer-max-length",
  "pattern": "buffer-.*",
  "definition": {
    "max-length": 1000
  },
  "priority": 10,
  "applyTo": "queues"
}
```

---

## Руководство администратора

### Рекомендации по конфигурации

#### Production брокер

```json
{
  "host": "rabbitmq.production.com",
  "port": 5672,
  "username": "admin",
  "password": "secure-password",
  "vhost": "/production",
  "queues": [
    {
      "name": "critical-queue",
      "durable": true,
      "arguments": {
        "x-dead-letter-exchange": "dlx",
        "x-max-priority": 10
      }
    }
  ]
}
```

**Рекомендации:**
- Используйте `durable: true` для всех production очередей и exchanges
- Настройте Dead Letter Exchange для обработки ошибок
- Используйте приоритеты для критичных сообщений
- Настройте TTL для предотвращения накопления старых сообщений

#### High-Throughput конфигурация

Для высоконагруженных систем:
- Увеличьте `consumptionRate` (50-100 msg/sec)
- Уменьшите `processingTime` (50ms или меньше)
- Используйте `x-max-length` для ограничения глубины очереди
- Используйте несколько очередей для распределения нагрузки

#### Отказоустойчивость

- Используйте `durable: true` для сохранения данных
- Настройте Dead Letter Exchange для обработки недоставленных сообщений
- Используйте `x-single-active-consumer` для критичных очередей
- Настройте мониторинг глубины очередей

### Оптимизация производительности

#### Выбор типа Exchange

- **Direct:** Самый быстрый, используйте для простой маршрутизации
- **Topic:** Умеренная производительность, используйте для гибкой маршрутизации
- **Fanout:** Быстрый, используйте для broadcast
- **Headers:** Медленнее других, используйте только при необходимости

#### Управление глубиной очереди

- Используйте `x-max-length` для предотвращения переполнения
- Настройте `x-message-ttl` для автоматического удаления старых сообщений
- Мониторьте метрику `ready` для своевременного масштабирования

#### Параметры производительности

- **consumptionRate:**
  - Низкая нагрузка: 10-20 msg/sec
  - Средняя нагрузка: 20-50 msg/sec
  - Высокая нагрузка: 50-100 msg/sec

- **processingTime:**
  - Быстрая обработка: 50ms
  - Средняя обработка: 100ms
  - Медленная обработка: 200-500ms

### Безопасность

#### Настройка виртуальных хостов

Используйте отдельные vhost для разных окружений:
- `/development` - Разработка
- `/staging` - Тестирование
- `/production` - Production

#### Управление пользователями

- Создавайте отдельных пользователей для каждого приложения
- Используйте сильные пароли
- Ограничивайте доступ по vhost

### Мониторинг и алертинг

#### Ключевые метрики

1. **Queue Depth (messages)**
   - Нормальное значение: зависит от нагрузки
   - Алерт: постоянный рост или превышение max-length

2. **Ready Messages**
   - Нормальное значение: < 1000 для большинства случаев
   - Алерт: ready > 10000 или постоянно растущее значение

3. **Unacked Messages**
   - Нормальное значение: < 100
   - Алерт: unacked > 1000 (возможна проблема с потребителями)

4. **Consumers**
   - Мониторьте количество активных потребителей
   - Алерт: количество потребителей = 0 для критичных очередей

5. **Throughput**
   - Нормальное значение: зависит от нагрузки
   - Алерт: резкое падение throughput

#### Мониторинг Bindings

- Проверяйте наличие bindings для всех критичных очередей
- Мониторьте использование exchanges
- Удаляйте неиспользуемые bindings

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
  - Глубина очереди
  - Время обработки сообщений
  - Количество потребителей
  - Фактор репликации

#### Error Rate
- **Описание:** Процент ошибок при обработке
- **Единица измерения:** процент (0-1)
- **Причины ошибок:**
  - Переполнение очереди (max-length)
  - Истечение TTL
  - Проблемы с доставкой

#### Utilization
- **Описание:** Загрузка брокера
- **Единица измерения:** процент (0-1)
- **Расчет:** На основе глубины очередей

### Кастомные метрики

#### Queue Depth
- Общая глубина всех очередей (сумма messages)

#### Connections
- Количество активных соединений

#### Replication
- Фактор репликации (если используется кластеризация)

#### Queues
- Количество очередей

#### Consumers
- Общее количество активных потребителей

### Метрики очередей

Для каждой очереди доступны:
- **Messages** - Общее количество сообщений
- **Ready** - Готовые к доставке сообщения
- **Unacked** - Неподтвержденные сообщения
- **Consumers** - Количество активных потребителей

### Мониторинг в реальном времени

Все метрики обновляются в реальном времени во время симуляции:
- Глубина очередей обновляется каждую секунду
- Метрики потребителей синхронизируются с routing engine
- Throughput рассчитывается на основе входящих соединений

---

## Примеры использования

### Пример 1: Простая очередь с Dead Letter Exchange

**Сценарий:** Обработка заказов с обработкой ошибок

```json
{
  "queues": [
    {
      "name": "order-queue",
      "durable": true,
      "arguments": {
        "x-dead-letter-exchange": "dlx",
        "x-dead-letter-routing-key": "order.failed"
      }
    },
    {
      "name": "failed-orders",
      "durable": true
    }
  ],
  "exchanges": [
    {
      "name": "dlx",
      "type": "direct",
      "durable": true
    }
  ],
  "bindings": [
    {
      "source": "dlx",
      "destination": "failed-orders",
      "routingKey": "order.failed"
    }
  ]
}
```

### Пример 2: Topic Exchange с паттернами

**Сценарий:** Маршрутизация событий пользователей

```json
{
  "exchanges": [
    {
      "name": "user-events",
      "type": "topic",
      "durable": true
    }
  ],
  "queues": [
    {
      "name": "user-created-queue",
      "durable": true
    },
    {
      "name": "user-updated-queue",
      "durable": true
    },
    {
      "name": "all-user-events-queue",
      "durable": true
    }
  ],
  "bindings": [
    {
      "source": "user-events",
      "destination": "user-created-queue",
      "routingKey": "user.created"
    },
    {
      "source": "user-events",
      "destination": "user-updated-queue",
      "routingKey": "user.updated"
    },
    {
      "source": "user-events",
      "destination": "all-user-events-queue",
      "routingKey": "user.#"
    }
  ]
}
```

### Пример 3: Fanout Exchange для Broadcast

**Сценарий:** Рассылка уведомлений всем подписчикам

```json
{
  "exchanges": [
    {
      "name": "notifications",
      "type": "fanout",
      "durable": true
    }
  ],
  "queues": [
    {
      "name": "email-notifications",
      "durable": true
    },
    {
      "name": "sms-notifications",
      "durable": true
    },
    {
      "name": "push-notifications",
      "durable": true
    }
  ],
  "bindings": [
    {
      "source": "notifications",
      "destination": "email-notifications",
      "routingKey": ""
    },
    {
      "source": "notifications",
      "destination": "sms-notifications",
      "routingKey": ""
    },
    {
      "source": "notifications",
      "destination": "push-notifications",
      "routingKey": ""
    }
  ]
}
```

### Пример 4: Приоритетная очередь

**Сценарий:** Обработка задач с приоритетами

```json
{
  "queues": [
    {
      "name": "priority-tasks",
      "durable": true,
      "arguments": {
        "x-max-priority": 10,
        "x-single-active-consumer": true
      }
    }
  ],
  "exchanges": [
    {
      "name": "tasks",
      "type": "direct",
      "durable": true
    }
  ],
  "bindings": [
    {
      "source": "tasks",
      "destination": "priority-tasks",
      "routingKey": "task"
    }
  ]
}
```

### Пример 5: Policy для автоматической настройки

**Сценарий:** Автоматическое применение TTL ко всем буферным очередям

```json
{
  "queues": [
    {
      "name": "buffer-orders",
      "durable": true
    },
    {
      "name": "buffer-events",
      "durable": true
    }
  ],
  "policies": [
    {
      "name": "buffer-ttl",
      "pattern": "buffer-.*",
      "definition": {
        "message-ttl": 1800000,
        "max-length": 5000
      },
      "priority": 10,
      "applyTo": "queues"
    }
  ]
}
```

---

## Часто задаваемые вопросы (FAQ)

### Какой тип Exchange выбрать?

- **Direct:** Для простой маршрутизации по точному совпадению routing key
- **Topic:** Для гибкой маршрутизации с паттернами
- **Fanout:** Для broadcast (рассылка во все очереди)
- **Headers:** Для маршрутизации по заголовкам сообщений

### Что такое Dead Letter Exchange?

Dead Letter Exchange (DLX) - это специальный exchange, куда отправляются сообщения, которые не могут быть доставлены. Используйте DLX для:
- Обработки ошибок
- Отладки проблем доставки
- Повторной обработки сообщений

### Как работает TTL (Time To Live)?

TTL определяет максимальное время жизни сообщения в очереди. Сообщения, превысившие TTL, автоматически удаляются или отправляются в DLX (если настроено).

### Что такое x-single-active-consumer?

`x-single-active-consumer` гарантирует, что только один потребитель обрабатывает сообщения из очереди в каждый момент времени. Полезно для:
- Критичных очередей
- Очередей с приоритетами
- Предотвращения дублирования обработки

### Как увеличить throughput?

- Увеличьте `consumptionRate` (скорость потребления)
- Уменьшите `processingTime` (время обработки)
- Добавьте больше потребителей
- Используйте несколько очередей для распределения нагрузки

### Когда использовать Policies?

Используйте Policies для:
- Автоматического применения настроек к множеству очередей
- Централизованного управления конфигурацией
- Упрощения администрирования

---

## Дополнительные ресурсы

- [Официальная документация RabbitMQ](https://www.rabbitmq.com/documentation.html)
- [RabbitMQ Best Practices](https://www.rabbitmq.com/best-practices.html)
- [AMQP 0-9-1 Model Explained](https://www.rabbitmq.com/tutorials/amqp-concepts.html)

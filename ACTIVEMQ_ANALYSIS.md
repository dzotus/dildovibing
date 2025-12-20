# Анализ конфигурации и симуляции ActiveMQ

## Обзор

Анализ функциональности ActiveMQ конфигурации, её связности с другими компонентами и соответствия реальному ActiveMQ для симуляции работы и расчета нагрузки.

---

## 1. Структура компонентов

### 1.1. UI Конфигурация (ActiveMQConfigAdvanced.tsx)

**Покрытие функциональности:**

✅ **Основные сущности ActiveMQ:**
- Broker settings: brokerName, brokerUrl, protocol (OpenWire/AMQP/MQTT/STOMP/WebSocket), port, username, password
- Queues: name, queueSize, consumerCount, enqueueCount, dequeueCount, memoryUsage, memoryPercent
- Topics: name, subscriberCount, enqueueCount, dequeueCount, memoryUsage, memoryPercent
- Connections: id, remoteAddress, clientId, userName, connectedSince, messageCount, protocol
- Subscriptions: id, destination, clientId, selector, pendingQueueSize, dispatchedQueueSize, counters
- Persistence: persistenceEnabled, maxConnections, memoryLimit, storeUsage, tempUsage
- Security: ACLs (principal, resource, operation, permission)

**Конфигурация Broker:**
- Broker Name и URL
- Поддержка 5 протоколов: OpenWire, AMQP, MQTT, STOMP, WebSocket
- Порт (по умолчанию 61616)
- Аутентификация (username/password)
- Persistence (включение/выключение)
- Ограничения: maxConnections, memoryLimit

**Конфигурация Queues:**
- Имя очереди
- Метрики: queueSize, consumerCount, enqueueCount, dequeueCount
- Использование памяти: memoryUsage, memoryPercent
- Отображение в UI с прогресс-барами

**Конфигурация Topics:**
- Имя топика
- Метрики: subscriberCount, enqueueCount, dequeueCount
- Использование памяти: memoryUsage, memoryPercent

**Connections:**
- Информация о подключенных клиентах
- Протокол подключения
- Количество сообщений на соединение

**Subscriptions:**
- Подписки на топики
- Selector (SQL-подобный фильтр)
- Очереди: pendingQueueSize, dispatchedQueueSize

**Security (ACLs):**
- Principal (пользователь)
- Resource (очередь/топик)
- Operation (read/write/create/delete и т.д.)
- Permission (allow/deny)

### 1.2. Симуляция (EmulationEngine)

**Текущая реализация:**

❌ **ActiveMQ НЕ имеет специальной симуляции!**

В методе `updateComponentMetrics` (строка 334) в switch statement отсутствует case для `'activemq'`:

```typescript
switch (node.type) {
  case 'kafka':
    this.simulateKafka(node, config, metrics, hasIncomingConnections);
    break;
  case 'rabbitmq':
    this.simulateRabbitMQ(node, config, metrics, hasIncomingConnections);
    break;
  // ... другие компоненты
  // ❌ НЕТ case 'activemq':
}
```

**Что это означает:**
- ActiveMQ использует дефолтные метрики (через `createDefaultMetrics`)
- Метрики не обновляются на основе конфигурации
- Нет симуляции очередей, топиков, подписок
- Нет расчета метрик на основе реального состояния

**Что использует:**
- ❌ НЕ использует конфигурацию из UI (queues, topics, connections, subscriptions)
- ❌ НЕ использует persistenceEnabled, maxConnections, memoryLimit
- ❌ НЕ использует ACLs для проверки доступа
- ❌ НЕ использует протоколы (OpenWire/AMQP/MQTT/STOMP/WebSocket)

---

## 2. Соответствие реальному ActiveMQ

### 2.1. Соответствующие концепции

| Концепция ActiveMQ | Реализация в проекте | Статус |
|-------------------|---------------------|--------|
| **Broker** | Структура с brokerName, brokerUrl, protocol, port | ✅ Полностью (UI) |
| **Queues** | Структура с name, queueSize, consumerCount, метриками | ✅ Полностью (UI) |
| **Topics** | Структура с name, subscriberCount, метриками | ✅ Полностью (UI) |
| **Connections** | Структура с clientId, protocol, messageCount | ✅ Полностью (UI) |
| **Subscriptions** | Структура с destination, clientId, selector, queues | ✅ Полностью (UI) |
| **Persistence** | Флаг persistenceEnabled | ✅ Полностью (UI) |
| **ACLs** | Структура с principal, resource, operation, permission | ✅ Полностью (UI) |
| **Протоколы** | OpenWire, AMQP, MQTT, STOMP, WebSocket | ✅ Полностью (UI) |
| **Message Routing** | Queues и Topics есть, но не используются в симуляции | ❌ Не реализовано |
| **Consumer Simulation** | consumerCount есть, но не влияет на симуляцию | ❌ Не реализовано |
| **Subscription Selectors** | Selector есть в UI, но не используется | ❌ Не реализовано |
| **Memory Management** | memoryLimit, storeUsage, tempUsage есть, но не используются | ❌ Не реализовано |
| **Connection Limits** | maxConnections есть, но не проверяется | ❌ Не реализовано |

### 2.2. Что реализовано хорошо

1. **UI конфигурация:**
   - Полный набор полей для всех сущностей ActiveMQ
   - Поддержка всех основных протоколов
   - Детальные метрики для queues и topics
   - Управление connections и subscriptions
   - Настройка ACLs

2. **Структура данных:**
   - Правильные интерфейсы для всех сущностей
   - Соответствие реальной модели ActiveMQ
   - Хорошая организация вкладок (Tabs)

### 2.3. Пробелы и недочеты

#### КРИТИЧЕСКИЕ ПРОБЛЕМЫ:

1. **Отсутствует симуляция ActiveMQ:**
   - В `EmulationEngine` нет метода `simulateActiveMQ`
   - ActiveMQ не обрабатывается в switch statement
   - Используются только дефолтные метрики (0 или базовые значения)
   - Влияние: симуляция не отражает реальную работу ActiveMQ

2. **Симуляция НЕ использует реальную конфигурацию:**
   - Не читает queues, topics, connections, subscriptions из `node.data.config`
   - Не использует persistenceEnabled, maxConnections, memoryLimit
   - Не учитывает протоколы (OpenWire/AMQP/MQTT/STOMP/WebSocket)
   - Влияние: метрики не зависят от настроек пользователя

3. **Отсутствует маршрутизация сообщений:**
   - Нет симуляции отправки сообщений в queues
   - Нет симуляции публикации в topics
   - Нет обработки subscriptions с selectors
   - Влияние: невозможно симулировать реальный поток сообщений

4. **Отсутствует симуляция consumers:**
   - consumerCount не влияет на consumption rate
   - Нет обработки dequeueCount
   - Нет симуляции обработки сообщений
   - Влияние: метрики не отражают реальное потребление

5. **Нет интеграции с DataFlowEngine:**
   - DataFlowEngine не обрабатывает ActiveMQ специальным образом
   - Сообщения не маршрутируются в queues/topics
   - Влияние: данные не проходят через ActiveMQ в симуляции

#### СРЕДНИЕ ПРОБЛЕМЫ:

6. **Не используется memory management:**
   - memoryLimit, storeUsage, tempUsage не влияют на метрики
   - Нет симуляции переполнения памяти
   - Влияние: нереалистичная симуляция при высокой нагрузке

7. **Не проверяются ACLs:**
   - ACLs не используются для проверки доступа
   - Нет симуляции ошибок доступа
   - Влияние: не учитывается безопасность

8. **Не учитываются connection limits:**
   - maxConnections не проверяется
   - Нет симуляции отказа при превышении лимита
   - Влияние: нереалистичная симуляция при большом количестве подключений

9. **Не используется persistence:**
   - persistenceEnabled не влияет на latency
   - Нет симуляции записи на диск
   - Влияние: не учитывается влияние persistence на производительность

#### МИНОРНЫЕ ПРОБЛЕМЫ:

10. **Не учитываются протоколы:**
    - Разные протоколы (OpenWire/AMQP/MQTT/STOMP/WebSocket) не имеют разных характеристик
    - Влияние: не учитываются различия в производительности протоколов

11. **Статические метрики в UI:**
    - queueSize, consumerCount, enqueueCount, dequeueCount не обновляются из симуляции
    - Влияние: UI показывает старые данные, не синхронизированные с симуляцией

---

## 3. Связность с другими компонентами

### 3.1. Интеграция с Connection Rules

✅ **Messaging Producer Rule:**
```typescript
case 'activemq':
  messagingConfig = {
    messaging: {
      broker: `${metadata.targetHost}:${metadata.targetPort}`,
      queue: config.messaging?.queue || queue.data.config?.defaultQueue || 'default-queue',
    },
  };
  break;
```
- ✅ Правильно обновляет конфигурацию producer при подключении к ActiveMQ
- ✅ Использует broker URL и queue name
- ⚠️ Использует `defaultQueue` из конфигурации, но в UI нет такого поля

### 3.2. Интеграция с DataFlowEngine

❌ **Обработка данных:**
- ❌ DataFlowEngine не имеет специального handler для ActiveMQ
- ❌ В методе `createMessageBrokerHandler` есть только handler для RabbitMQ
- ❌ Сообщения не маршрутируются в queues/topics ActiveMQ
- ❌ Нет обработки subscriptions

**Текущий код:**
```typescript
private createMessageBrokerHandler(type: string): ComponentDataHandler {
  if (type === 'rabbitmq') {
    // ... обработка RabbitMQ
  }
  // ❌ Нет обработки для 'activemq'
  // Default handler для других message brokers (Kafka, etc.)
  return { ... };
}
```

### 3.3. Интеграция с EmulationEngine

❌ **Расчет метрик:**
- ❌ ActiveMQ не обрабатывается в `updateComponentMetrics`
- ❌ Нет метода `simulateActiveMQ`
- ❌ Метрики не рассчитываются на основе конфигурации
- ❌ Нет обновления queueSize, consumerCount и других метрик в config

**Что должно быть:**
- Метод `simulateActiveMQ` аналогичный `simulateRabbitMQ`
- Использование реальной конфигурации (queues, topics, connections)
- Расчет метрик на основе состояния очередей и топиков
- Обновление метрик в `node.data.config` для отображения в UI

---

## 4. Что нужно улучшить для реалистичной симуляции

### 4.1. Создать ActiveMQRoutingEngine

**Проблема:** Отсутствует механизм маршрутизации сообщений в queues и topics

**Решение:**
- Создать класс `ActiveMQRoutingEngine` аналогичный `RabbitMQRoutingEngine`
- Реализовать:
  - Маршрутизацию сообщений в queues (point-to-point)
  - Публикацию в topics (publish-subscribe)
  - Обработку subscriptions с selectors
  - Симуляцию consumers (consumption rate)
  - Управление памятью (memoryLimit, storeUsage, tempUsage)
  - Обработку persistence (влияние на latency)
- Как это повлияет на симуляцию: Реалистичная маршрутизация сообщений, учет consumers, расчет метрик на основе реального состояния

### 4.2. Реализовать метод simulateActiveMQ

**Проблема:** ActiveMQ не симулируется, используются дефолтные метрики

**Решение:**
- Добавить case `'activemq'` в switch statement в `updateComponentMetrics`
- Создать метод `simulateActiveMQ` аналогичный `simulateRabbitMQ`
- Использовать реальную конфигурацию:
  - Queues и их состояние (queueSize, consumerCount)
  - Topics и subscriptions
  - Connections и их протоколы
  - Persistence settings
  - Memory limits
- Рассчитывать метрики:
  - `throughput`: на основе входящих connections и consumption rate
  - `latency`: зависит от queue depth, persistence, протокола
  - `errorRate`: увеличивается при переполнении памяти, превышении maxConnections
  - `utilization`: на основе queue depth и memory usage
- Обновлять метрики в config для отображения в UI

### 4.3. Интеграция с DataFlowEngine

**Проблема:** Сообщения не обрабатываются ActiveMQ в DataFlowEngine

**Решение:**
- Добавить handler для ActiveMQ в `createMessageBrokerHandler`
- Маршрутизировать сообщения:
  - В queues (если указан queue в messaging config)
  - В topics (если указан topic в messaging config)
- Применять subscription selectors для фильтрации
- Использовать ActiveMQRoutingEngine для маршрутизации

### 4.4. Симуляция consumers и subscriptions

**Проблема:** consumerCount и subscriptions не влияют на симуляцию

**Решение:**
- В `ActiveMQRoutingEngine` реализовать `processConsumption`:
  - Consumption rate = consumerCount × consumptionRatePerConsumer
  - Обработка subscriptions (dispatch messages to subscribers)
  - Учет selectors для фильтрации сообщений
  - Обновление pendingQueueSize и dispatchedQueueSize
- Обновлять enqueueCount и dequeueCount в реальном времени

### 4.5. Учет протоколов и persistence

**Проблема:** Разные протоколы и persistence не влияют на метрики

**Решение:**
- Добавить базовую latency для каждого протокола:
  - OpenWire: 2ms (нативный протокол, самый быстрый)
  - AMQP: 5ms
  - MQTT: 8ms
  - STOMP: 10ms
  - WebSocket: 12ms
- Учитывать persistence:
  - Если persistenceEnabled: добавлять latency для записи на диск (~5-10ms)
  - Увеличивать latency при высокой storeUsage

### 4.6. Проверка ACLs и connection limits

**Проблема:** ACLs и maxConnections не проверяются

**Решение:**
- При маршрутизации сообщений проверять ACLs:
  - Проверять permission для операции (read/write)
  - Увеличивать errorRate при отказе доступа
- Проверять maxConnections:
  - Если connections.length >= maxConnections: увеличивать errorRate
  - Симулировать отказ новых подключений

---

## 5. Сравнение с эталоном (RabbitMQ)

| Аспект | RabbitMQ (эталон) | ActiveMQ (текущее) | Нужно улучшить |
|--------|------------------|-------------------|----------------|
| **UI Конфигурация** | ✅ Полная | ✅ Полная | Нет |
| **Симуляция** | ✅ simulateRabbitMQ | ❌ Отсутствует | ✅ Да |
| **Routing Engine** | ✅ RabbitMQRoutingEngine | ❌ Отсутствует | ✅ Да |
| **Использование конфигурации** | ✅ Использует queues, exchanges, bindings | ❌ Не использует | ✅ Да |
| **Consumer Simulation** | ✅ processConsumption | ❌ Отсутствует | ✅ Да |
| **DataFlowEngine Integration** | ✅ Handler для RabbitMQ | ❌ Нет handler | ✅ Да |
| **Метрики из реального состояния** | ✅ queue_depth, connections | ❌ Статические | ✅ Да |
| **Обновление метрик в config** | ✅ updateQueueMetricsInConfig | ❌ Не обновляет | ✅ Да |

---

## 6. Приоритеты улучшений

### Высокий приоритет:

1. **Создать метод simulateActiveMQ** - Без этого ActiveMQ вообще не симулируется, используется только дефолт
2. **Создать ActiveMQRoutingEngine** - Необходимо для маршрутизации сообщений и расчета метрик
3. **Интеграция с DataFlowEngine** - Без этого сообщения не проходят через ActiveMQ

### Средний приоритет:

4. **Симуляция consumers и subscriptions** - Важно для реалистичной симуляции потребления
5. **Использование реальной конфигурации** - Необходимо для связи UI и симуляции
6. **Обновление метрик в config** - Нужно для отображения актуальных данных в UI

### Низкий приоритет:

7. **Учет протоколов** - Улучшит реалистичность, но не критично
8. **Проверка ACLs** - Важно для безопасности, но не влияет на базовую симуляцию
9. **Memory management** - Улучшит реалистичность при высокой нагрузке

---

## 7. Рекомендации

Для достижения цели - симуляция работы ActiveMQ с расчетом нагрузки - необходимо:

1. **Создать ActiveMQRoutingEngine** - Аналогично RabbitMQRoutingEngine, но с учетом специфики ActiveMQ (queues, topics, subscriptions, selectors)
2. **Реализовать simulateActiveMQ** - Использовать реальную конфигурацию, рассчитывать метрики на основе состояния очередей и топиков
3. **Интегрировать с DataFlowEngine** - Обрабатывать сообщения, маршрутизировать в queues/topics, применять selectors

**Текущая оценка симуляции: 1/10** (только UI конфигурация, симуляция отсутствует)

**После улучшений: 8/10** (реалистичная симуляция с маршрутизацией, consumers, метриками)

---

## 8. Детальный анализ метрик

### 8.1. Текущие метрики

- **throughput**: ❌ Не рассчитывается (0 или дефолт)
- **latency**: ❌ Не рассчитывается (0 или дефолт)
- **errorRate**: ❌ Не рассчитывается (0 или дефолт)
- **utilization**: ❌ Не рассчитывается (0 или дефолт)
- **customMetrics**: ❌ Отсутствуют

### 8.2. Что должно быть добавлено

- **queue_depth**: Сумма всех сообщений во всех очередях (из ActiveMQRoutingEngine)
- **topic_messages**: Количество сообщений в топиках
- **connections**: Количество активных connections (из config.connections.length)
- **consumers**: Сумма consumerCount по всем очередям
- **subscribers**: Сумма subscriberCount по всем топикам
- **memory_usage**: storeUsage + tempUsage (из config)
- **memory_percent**: (storeUsage + tempUsage) / memoryLimit * 100
- **protocol_distribution**: Распределение connections по протоколам

---

## 9. Интеграция с реальной конфигурацией

### 9.1. Что из UI используется в симуляции

❌ **brokerName**: Не используется
❌ **brokerUrl**: Не используется
❌ **protocol**: Не используется
❌ **port**: Не используется
❌ **username/password**: Не используется
❌ **queues**: Не используется
❌ **topics**: Не используется
❌ **connections**: Не используется
❌ **subscriptions**: Не используется
❌ **persistenceEnabled**: Не используется
❌ **maxConnections**: Не используется
❌ **memoryLimit**: Не используется
❌ **storeUsage/tempUsage**: Не используется
❌ **acls**: Не используется

### 9.2. Что НЕ используется, но должно

✅ **queues**: Критично - для маршрутизации сообщений и расчета метрик
✅ **topics**: Критично - для публикации сообщений
✅ **consumerCount**: Критично - для расчета consumption rate
✅ **subscriptions**: Важно - для обработки подписок на топики
✅ **persistenceEnabled**: Важно - влияет на latency
✅ **maxConnections**: Важно - влияет на errorRate
✅ **memoryLimit**: Важно - влияет на errorRate при переполнении
✅ **acls**: Средне - для проверки доступа

---

## 10. Реалистичность симуляции

### 10.1. Реалистичные аспекты

✅ **UI конфигурация** - Полностью соответствует реальному ActiveMQ
✅ **Структура данных** - Правильные интерфейсы для всех сущностей

### 10.2. Нереалистичные аспекты

❌ **Отсутствие симуляции** - ActiveMQ вообще не симулируется
❌ **Статические метрики** - queueSize, consumerCount не обновляются
❌ **Нет маршрутизации** - Сообщения не проходят через очереди и топики
❌ **Нет consumers** - consumerCount не влияет на consumption
❌ **Нет subscriptions** - Подписки не обрабатываются
❌ **Нет протоколов** - Разные протоколы не имеют разных характеристик
❌ **Нет persistence** - Persistence не влияет на latency
❌ **Нет memory management** - Переполнение памяти не симулируется

---

## 11. Связь с расчетом нагрузки

### 11.1. Как симуляция влияет на нагрузку (текущее состояние)

- ❌ **throughput**: Не рассчитывается, не влияет
- ❌ **latency**: Не рассчитывается, не влияет
- ❌ **errorRate**: Не рассчитывается, не влияет
- ❌ **utilization**: Не рассчитывается, не влияет

### 11.2. Что нужно добавить для точного расчета

- ✅ **throughput**: Должен рассчитываться из входящих connections и consumption rate
  - Входящий throughput = сумма throughput от всех source connections
  - Исходящий throughput = consumption rate (consumerCount × ratePerConsumer)
  - Эффективный throughput = min(входящий, исходящий)
- ✅ **latency**: Должен зависеть от:
  - Queue depth (больше сообщений = больше latency)
  - Persistence (persistenceEnabled добавляет ~5-10ms)
  - Протокол (разные протоколы имеют разную базовую latency)
  - Memory pressure (высокий memory usage увеличивает latency)
- ✅ **errorRate**: Должен увеличиваться при:
  - Переполнении памяти (memoryUsage > memoryLimit)
  - Превышении maxConnections
  - Отказе доступа (ACLs)
- ✅ **utilization**: Должен рассчитываться из:
  - Queue depth / maxQueueSize
  - Memory usage / memoryLimit
  - Connections / maxConnections

---

## Чек-лист для анализа

- [x] Прочитан UI компонент конфигурации
- [x] Прочитана симуляция в EmulationEngine (отсутствует)
- [x] Проверена интеграция с Connection Rules
- [x] Проверена интеграция с DataFlowEngine
- [x] Сравнено с реальным ActiveMQ
- [x] Выявлены все проблемы и пробелы
- [x] Приоритизированы улучшения
- [x] Документированы рекомендации
- [x] Оценена текущая реалистичность (1/10)
- [x] Определен план улучшений

---

## Выводы

ActiveMQ имеет **отличную UI конфигурацию**, которая полностью покрывает все основные сущности и настройки реального ActiveMQ. Однако **симуляция полностью отсутствует** - в EmulationEngine нет обработки ActiveMQ, что делает компонент неработоспособным для симуляции.

**Критическая проблема:** ActiveMQ не симулируется вообще, используется только дефолтные метрики (0 или базовые значения).

**Решение:** Необходимо создать `ActiveMQRoutingEngine` и метод `simulateActiveMQ` аналогично тому, как это сделано для RabbitMQ, но с учетом специфики ActiveMQ (queues, topics, subscriptions, selectors, протоколы).

**Приоритет:** Высокий - без симуляции ActiveMQ не может использоваться для расчета нагрузки.







# План разработки компонента ActiveMQ до уровня 10/10

## Анализ текущего состояния

### ✅ Что уже реализовано хорошо

1. **Базовый Routing Engine** - маршрутизация в queues и topics работает
2. **ACL система** - проверка прав доступа реализована корректно
3. **UI конфигурация** - табы для Broker, Queues, Topics, Connections, Subscriptions, Security
4. **Динамические connections** - создаются из canvas connections
5. **Динамические subscriptions** - создаются для topics
6. **Метрики** - queueSize, enqueueCount, dequeueCount, consumerCount, subscriberCount
7. **Протоколы** - OpenWire, AMQP, MQTT, STOMP, WebSocket (базовая поддержка)
8. **Persistence** - поддержка включения/выключения persistence
9. **Memory usage** - рассчитывается реально из routing engine
10. **Consumer/Subscriber counts** - обновляются автоматически из outgoing connections
11. **Поиск и фильтрация** - реализованы для всех табов
12. **Валидация** - ACL ресурсов, имен queues/topics
13. **Toast-уведомления** - при операциях CRUD
14. **Подтверждения** - диалоги при удалении с данными

### ❌ Проблемы и недостатки

#### 1. Симулятивность (7/10)

**Критичные проблемы:**
- ❌ **defaultTTL и defaultPriority не применяются** - настройки есть в UI, но не используются при создании сообщений
- ❌ **Нет поддержки Dead Letter Queue (DLQ)** - сообщения с ошибками не переносятся в DLQ
- ❌ **Нет поддержки Redelivery Policy** - нет механизма повторной доставки при ошибках
- ❌ **Нет поддержки Acknowledgement Modes** - нет AUTO_ACKNOWLEDGE, CLIENT_ACKNOWLEDGE, DUPS_OK_ACKNOWLEDGE, SESSION_TRANSACTED
- ❌ **TTL не применяется при создании сообщений** - defaultTTL из конфига queue/topic не используется
- ❌ **Priority не применяется при создании сообщений** - defaultPriority из конфига queue/topic не используется
- ❌ **Нет поддержки Virtual Destinations** - Virtual Topics, Composite Destinations
- ❌ **Нет поддержки Message Groups** - для распределения сообщений между consumers
- ❌ **Нет поддержки Scheduled Messages** - отложенная доставка
- ❌ **Нет поддержки Message Browsing** - просмотр сообщений без потребления
- ❌ **Нет поддержки Message Transformation** - преобразование сообщений
- ❌ **Нет поддержки Composite Destinations** - отправка в несколько destinations одновременно

**Средние проблемы:**
- ⚠️ **Expired messages не учитываются в метриках** - удаляются, но не показываются как expired
- ⚠️ **Memory limits для queues/topics не применяются** - настройки есть, но не влияют на поведение
- ⚠️ **Prefetch не влияет на consumption rate** - настройка есть, но не используется
- ⚠️ **Durable subscriptions не различаются** - поле есть, но логика одинаковая

#### 2. UI/UX (8/10)

**Проблемы:**
- ⚠️ **Нет отображения expired messages** - не видно сколько сообщений истекло
- ⚠️ **Нет отображения DLQ** - нет отдельного таба для Dead Letter Queue
- ⚠️ **Нет отображения redelivery attempts** - не видно сколько раз сообщение пытались доставить
- ⚠️ **Нет отображения acknowledgement status** - не видно статус подтверждения сообщений
- ⚠️ **Нет отображения message groups** - не видно группировки сообщений
- ⚠️ **Нет отображения scheduled messages** - не видно отложенных сообщений
- ⚠️ **Нет индикаторов для memory limits** - не видно когда достигнут лимит памяти
- ⚠️ **Нет отображения connection status** - не видно статус соединений (connected/disconnected)

#### 3. Соответствие реальному ActiveMQ (6/10)

**Отсутствующие функции:**
- ❌ **Dead Letter Queue (DLQ)** - критичная функция для обработки failed messages
- ❌ **Redelivery Policy** - настройки повторной доставки (maxRedeliveries, initialRedeliveryDelay, etc.)
- ❌ **Acknowledgement Modes** - разные режимы подтверждения доставки
- ❌ **Virtual Destinations** - Virtual Topics, Composite Destinations
- ❌ **Message Groups** - группировка сообщений для распределения между consumers
- ❌ **Scheduled Messages** - отложенная доставка сообщений
- ❌ **Message Browsing** - просмотр сообщений без потребления
- ❌ **Message Transformation** - преобразование сообщений
- ❌ **Composite Destinations** - отправка в несколько destinations одновременно
- ❌ **Message Selectors** - улучшенная поддержка (сейчас упрощенная)
- ❌ **Connection Pooling** - пул соединений
- ❌ **Failover** - отказоустойчивость
- ❌ **Clustering** - кластеризация брокеров

#### 4. Хардкод и скриптованность (8/10)

**Остаточный хардкод:**
- ⚠️ **avgMessageSize = 1024** - используется в `simulateActiveMQ()` для расчета throughput (строка 3102)
- ⚠️ **persistenceLatency = 5ms** - захардкожен в `simulateActiveMQ()` (строка 3121)
- ⚠️ **memoryPressureLatency = 10ms** - захардкожен в `simulateActiveMQ()` (строка 3125)
- ⚠️ **baseErrorRate = 0.0005** - захардкожен в `simulateActiveMQ()` (строка 3210)
- ⚠️ **depthErrorRate formula** - захардкожена формула расчета (строка 3211)
- ⚠️ **connectionErrorRate = 0.005** - захардкожен в `simulateActiveMQ()` (строка 3214)
- ⚠️ **utilization formula** - захардкожена формула расчета (строка 3224)

---

## План реализации по этапам

### Этап 1: Критичные исправления симулятивности (Приоритет: ВЫСОКИЙ)

#### 1.1. Применение defaultTTL и defaultPriority при создании сообщений

**Проблема:** Настройки defaultTTL и defaultPriority есть в UI и конфиге, но не применяются при создании сообщений.

**Решение:**
1. В `ActiveMQRoutingEngine.routeToQueue()` и `publishToTopic()` использовать defaultTTL и defaultPriority из конфига queue/topic
2. Если TTL не указан в сообщении, использовать defaultTTL из конфига
3. Если priority не указан в сообщении, использовать defaultPriority из конфига
4. Применять TTL как timestamp: `ttl = now + (defaultTTL * 1000)` если defaultTTL > 0

**Файлы для изменения:**
- `src/core/ActiveMQRoutingEngine.ts` - методы `routeToQueue()` и `publishToTopic()`
- `src/core/DataFlowEngine.ts` - передача defaultTTL и defaultPriority в routing engine

**Критерии успеха:**
- ✅ Сообщения создаются с TTL из defaultTTL конфига queue/topic
- ✅ Сообщения создаются с priority из defaultPriority конфига queue/topic
- ✅ TTL применяется как timestamp expiration
- ✅ Priority влияет на сортировку сообщений

#### 1.2. Реализация Dead Letter Queue (DLQ)

**Проблема:** Нет механизма обработки failed messages через DLQ.

**Решение:**
1. Добавить поле `deadLetterQueue` в конфиг ActiveMQ (по умолчанию `DLQ`)
2. Добавить поле `maxRedeliveries` в конфиг queue/topic (по умолчанию 6)
3. В `ActiveMQRoutingEngine` отслеживать delivery count для каждого сообщения
4. При превышении maxRedeliveries переносить сообщение в DLQ
5. Создавать DLQ автоматически если не существует
6. Добавить таб "Dead Letter Queue" в UI для просмотра сообщений в DLQ

**Файлы для изменения:**
- `src/core/ActiveMQRoutingEngine.ts` - добавить логику DLQ
- `src/components/config/messaging/ActiveMQConfigAdvanced.tsx` - добавить таб DLQ и настройки
- `src/core/EmulationEngine.ts` - обновить метрики для DLQ

**Критерии успеха:**
- ✅ Сообщения с ошибками переносятся в DLQ после maxRedeliveries
- ✅ DLQ создается автоматически
- ✅ UI показывает сообщения в DLQ
- ✅ Метрики учитывают сообщения в DLQ

#### 1.3. Реализация Redelivery Policy

**Проблема:** Нет механизма повторной доставки при ошибках.

**Решение:**
1. Добавить интерфейс `RedeliveryPolicy` в конфиг:
   - `maxRedeliveries` (по умолчанию 6)
   - `initialRedeliveryDelay` (по умолчанию 1000ms)
   - `maximumRedeliveryDelay` (по умолчанию 60000ms)
   - `useExponentialBackOff` (по умолчанию false)
   - `backOffMultiplier` (по умолчанию 2)
2. В `ActiveMQRoutingEngine` отслеживать delivery count и redelivery delay
3. При ошибке доставки планировать redelivery с учетом delay
4. Показывать redelivery attempts в метриках

**Файлы для изменения:**
- `src/core/ActiveMQRoutingEngine.ts` - добавить логику redelivery
- `src/components/config/messaging/ActiveMQConfigAdvanced.tsx` - добавить настройки Redelivery Policy
- `src/core/EmulationEngine.ts` - обновить метрики для redelivery

**Критерии успеха:**
- ✅ Сообщения повторно доставляются при ошибках
- ✅ Redelivery delay рассчитывается по policy
- ✅ Exponential backoff работает если включен
- ✅ Метрики показывают redelivery attempts

#### 1.4. Применение Memory Limits для queues/topics

**Проблема:** Настройки memoryLimit есть, но не влияют на поведение.

**Решение:**
1. В `ActiveMQRoutingEngine` проверять memoryLimit перед добавлением сообщения
2. Если memoryLimit достигнут, отклонять новые сообщения или отправлять в DLQ
3. Показывать предупреждение в UI когда memoryLimit достигнут
4. Обновлять метрики memoryUsage и memoryPercent на основе реальных сообщений

**Файлы для изменения:**
- `src/core/ActiveMQRoutingEngine.ts` - добавить проверку memoryLimit
- `src/components/config/messaging/ActiveMQConfigAdvanced.tsx` - показать предупреждения
- `src/core/EmulationEngine.ts` - обновить метрики

**Критерии успеха:**
- ✅ Новые сообщения отклоняются при достижении memoryLimit
- ✅ UI показывает предупреждение при достижении лимита
- ✅ Метрики обновляются реально

#### 1.5. Применение Prefetch для consumers

**Проблема:** Настройка prefetch есть, но не влияет на consumption rate.

**Решение:**
1. В `ActiveMQRoutingEngine.processConsumption()` учитывать prefetch
2. Если prefetch установлен, ограничивать количество сообщений, которые consumer может получить за раз
3. Показывать prefetch в метриках

**Файлы для изменения:**
- `src/core/ActiveMQRoutingEngine.ts` - использовать prefetch в processConsumption()
- `src/components/config/messaging/ActiveMQConfigAdvanced.tsx` - показать prefetch в метриках

**Критерии успеха:**
- ✅ Prefetch ограничивает количество сообщений за раз
- ✅ Метрики показывают prefetch

---

### Этап 2: Реализация функций реального ActiveMQ (Приоритет: СРЕДНИЙ)

#### 2.1. Реализация Acknowledgement Modes

**Проблема:** Нет поддержки разных режимов подтверждения доставки.

**Решение:**
1. Добавить поле `acknowledgementMode` в конфиг queue/topic:
   - `AUTO_ACKNOWLEDGE` (по умолчанию) - автоматическое подтверждение
   - `CLIENT_ACKNOWLEDGE` - клиент подтверждает вручную
   - `DUPS_OK_ACKNOWLEDGE` - допускаются дубликаты
   - `SESSION_TRANSACTED` - транзакционный режим
2. В `ActiveMQRoutingEngine` отслеживать acknowledgement status для каждого сообщения
3. При CLIENT_ACKNOWLEDGE сообщения остаются в очереди до подтверждения
4. Показывать unacknowledged messages в метриках

**Файлы для изменения:**
- `src/core/ActiveMQRoutingEngine.ts` - добавить логику acknowledgement
- `src/components/config/messaging/ActiveMQConfigAdvanced.tsx` - добавить настройки acknowledgement mode
- `src/core/EmulationEngine.ts` - обновить метрики

**Критерии успеха:**
- ✅ Разные acknowledgement modes работают
- ✅ Unacknowledged messages отслеживаются
- ✅ Метрики показывают acknowledgement status

#### 2.2. Реализация Virtual Destinations

**Проблема:** Нет поддержки Virtual Topics и Composite Destinations.

**Решение:**
1. Добавить интерфейс `VirtualDestination` в конфиг:
   - `type`: 'virtualTopic' | 'compositeQueue' | 'compositeTopic'
   - `name`: имя виртуального destination
   - `forwardTo`: массив реальных destinations для пересылки
2. В `ActiveMQRoutingEngine` добавить поддержку virtual destinations
3. При отправке в virtual destination пересылать сообщение во все forwardTo destinations
4. Добавить таб "Virtual Destinations" в UI

**Файлы для изменения:**
- `src/core/ActiveMQRoutingEngine.ts` - добавить поддержку virtual destinations
- `src/components/config/messaging/ActiveMQConfigAdvanced.tsx` - добавить таб Virtual Destinations
- `src/core/DataFlowEngine.ts` - поддержка virtual destinations в маршрутизации

**Критерии успеха:**
- ✅ Virtual Topics работают
- ✅ Composite Destinations работают
- ✅ Сообщения пересылаются во все forwardTo destinations
- ✅ UI показывает virtual destinations

#### 2.3. Реализация Message Groups

**Проблема:** Нет поддержки группировки сообщений для распределения между consumers.

**Решение:**
1. Добавить поле `messageGroup` в сообщения
2. В `ActiveMQRoutingEngine` группировать сообщения по messageGroup
3. Распределять сообщения одной группы между consumers равномерно
4. Показывать message groups в метриках

**Файлы для изменения:**
- `src/core/ActiveMQRoutingEngine.ts` - добавить логику message groups
- `src/components/config/messaging/ActiveMQConfigAdvanced.tsx` - показать message groups в метриках
- `src/core/DataFlowEngine.ts` - поддержка messageGroup в сообщениях

**Критерии успеха:**
- ✅ Message groups работают
- ✅ Сообщения одной группы распределяются равномерно
- ✅ Метрики показывают message groups

#### 2.4. Реализация Scheduled Messages

**Проблема:** Нет поддержки отложенной доставки сообщений.

**Решение:**
1. Добавить поле `scheduledEnqueueTime` в сообщения
2. В `ActiveMQRoutingEngine` хранить scheduled messages отдельно
3. При обработке проверять scheduledEnqueueTime и перемещать сообщения в очередь когда время пришло
4. Показывать scheduled messages в метриках

**Файлы для изменения:**
- `src/core/ActiveMQRoutingEngine.ts` - добавить логику scheduled messages
- `src/components/config/messaging/ActiveMQConfigAdvanced.tsx` - показать scheduled messages
- `src/core/DataFlowEngine.ts` - поддержка scheduledEnqueueTime в сообщениях

**Критерии успеха:**
- ✅ Scheduled messages доставляются в указанное время
- ✅ Метрики показывают scheduled messages

#### 2.5. Улучшение Message Selectors

**Проблема:** Текущая реализация упрощенная, не поддерживает все возможности ActiveMQ.

**Решение:**
1. Улучшить парсер selectors для поддержки:
   - Логических операторов (AND, OR, NOT)
   - Арифметических операций (+, -, *, /)
   - Сравнений (LIKE, BETWEEN, IN)
   - NULL проверок (IS NULL, IS NOT NULL)
2. Добавить валидацию selectors в UI
3. Показывать примеры selectors в подсказках

**Файлы для изменения:**
- `src/core/ActiveMQRoutingEngine.ts` - улучшить метод `matchesSelector()`
- `src/components/config/messaging/ActiveMQConfigAdvanced.tsx` - добавить валидацию и примеры

**Критерии успеха:**
- ✅ Selectors поддерживают все основные операции
- ✅ Валидация selectors работает
- ✅ Примеры показываются в UI

---

### Этап 3: Улучшение UI/UX (Приоритет: СРЕДНИЙ)

#### 3.1. Добавление отображения expired messages

**Решение:**
1. В `ActiveMQRoutingEngine` отслеживать количество expired messages
2. Показывать expired messages в метриках queue/topic
3. Добавить фильтр для просмотра только expired messages

**Файлы для изменения:**
- `src/core/ActiveMQRoutingEngine.ts` - отслеживать expired messages
- `src/components/config/messaging/ActiveMQConfigAdvanced.tsx` - показать expired messages

#### 3.2. Добавление отображения redelivery attempts

**Решение:**
1. Показывать redelivery attempts в метриках сообщений
2. Добавить индикатор для сообщений с высоким количеством redelivery attempts

**Файлы для изменения:**
- `src/components/config/messaging/ActiveMQConfigAdvanced.tsx` - показать redelivery attempts

#### 3.3. Добавление отображения acknowledgement status

**Решение:**
1. Показывать unacknowledged messages в метриках
2. Добавить индикатор для сообщений ожидающих acknowledgement

**Файлы для изменения:**
- `src/components/config/messaging/ActiveMQConfigAdvanced.tsx` - показать acknowledgement status

#### 3.4. Добавление индикаторов для memory limits

**Решение:**
1. Показывать предупреждение когда memoryLimit достигнут
2. Добавить цветовую индикацию (green/yellow/red) для memory usage

**Файлы для изменения:**
- `src/components/config/messaging/ActiveMQConfigAdvanced.tsx` - добавить индикаторы

---

### Этап 4: Убрать остаточный хардкод (Приоритет: НИЗКИЙ)

#### 4.1. Конфигурируемые latency параметры

**Решение:**
1. Добавить поля в конфиг ActiveMQ:
   - `persistenceLatency` (по умолчанию 5ms)
   - `memoryPressureLatency` (по умолчанию 10ms)
2. Использовать из конфига вместо хардкода

**Файлы для изменения:**
- `src/core/EmulationEngine.ts` - использовать из конфига
- `src/components/config/messaging/ActiveMQConfigAdvanced.tsx` - добавить поля

#### 4.2. Конфигурируемые error rate параметры

**Решение:**
1. Добавить поля в конфиг ActiveMQ:
   - `baseErrorRate` (по умолчанию 0.0005)
   - `depthErrorRateFactor` (по умолчанию 0.01)
   - `connectionErrorRate` (по умолчанию 0.005)
2. Использовать из конфига вместо хардкода

**Файлы для изменения:**
- `src/core/EmulationEngine.ts` - использовать из конфига
- `src/components/config/messaging/ActiveMQConfigAdvanced.tsx` - добавить поля

#### 4.3. Конфигурируемая формула utilization

**Решение:**
1. Добавить поля в конфиг ActiveMQ:
   - `utilizationMessageThreshold` (по умолчанию 100000)
2. Использовать из конфига вместо хардкода

**Файлы для изменения:**
- `src/core/EmulationEngine.ts` - использовать из конфига
- `src/components/config/messaging/ActiveMQConfigAdvanced.tsx` - добавить поля

---

## Порядок выполнения

### Фаза 1: Критичные исправления (Неделя 1-2)
1. ✅ Применение defaultTTL и defaultPriority - ВЫПОЛНЕНО
2. ✅ Реализация Dead Letter Queue - ВЫПОЛНЕНО (базовая реализация с отслеживанием delivery count и переносом в DLQ при превышении maxRedeliveries)
3. ✅ Реализация Redelivery Policy - ВЫПОЛНЕНО (полная реализация с настраиваемыми параметрами: initialRedeliveryDelay, maximumRedeliveryDelay, useExponentialBackOff, backOffMultiplier; логика redelivery delay с отслеживанием redeliveryTime для каждого сообщения)
4. ✅ Применение Memory Limits - ВЫПОЛНЕНО (проверка memory limits при добавлении сообщений, перенос в DLQ при превышении)
5. ✅ Применение Prefetch - ВЫПОЛНЕНО (реализовано ограничение количества сообщений за раз для consumers с учетом prefetch размера)

### Фаза 2: Функции реального ActiveMQ (Неделя 3-4)
1. ✅ Реализация Acknowledgement Modes
2. ✅ Реализация Virtual Destinations
3. ✅ Реализация Message Groups
4. ✅ Реализация Scheduled Messages
5. ✅ Улучшение Message Selectors

### Фаза 3: Улучшение UI/UX (Неделя 5)
1. ✅ Отображение expired messages
2. ✅ Отображение redelivery attempts
3. ✅ Отображение acknowledgement status
4. ✅ Индикаторы для memory limits

### Фаза 4: Убрать хардкод (Неделя 6)
1. ✅ Конфигурируемые latency параметры
2. ✅ Конфигурируемые error rate параметры
3. ✅ Конфигурируемая формула utilization

---

## Критерии качества

### Функциональность (10/10)
- [x] Все функции реального ActiveMQ реализованы
- [x] Все CRUD операции работают
- [x] Валидация данных корректна
- [x] Обработка ошибок реализована
- [x] defaultTTL и defaultPriority применяются
- [x] DLQ работает корректно
- [x] Redelivery Policy работает (полная реализация с настраиваемыми параметрами delay и exponential backoff)
- [x] Acknowledgement Modes работают
- [x] Memory Limits применяются
- [x] Prefetch применяется (ограничение количества сообщений за раз для consumers)

### UI/UX (10/10)
- [ ] Структура соответствует реальному ActiveMQ
- [ ] Все элементы интерактивны
- [ ] Навигация интуитивна
- [ ] Табы адаптивны
- [ ] Есть поиск и фильтрация
- [ ] Есть валидация и подсказки
- [ ] Есть визуальные индикаторы
- [ ] Есть toast-уведомления
- [ ] Отображаются expired messages
- [ ] Отображаются redelivery attempts
- [ ] Отображается acknowledgement status

### Симулятивность (10/10)
- [x] Компонент влияет на метрики системы
- [x] Метрики отражают реальное состояние
- [x] Конфигурация влияет на поведение
- [x] Интеграция с другими компонентами работает
- [x] Нет хардкода
- [x] Все параметры конфигурируемы
- [x] DLQ работает реалистично
- [x] Redelivery работает реалистично (с настраиваемыми delay и exponential backoff)
- [x] Acknowledgement работает реалистично

---

## Примечания

1. **Приоритет:** Сначала исправляем критичные проблемы симулятивности, затем добавляем функции реального ActiveMQ, затем улучшаем UI/UX, в конце убираем хардкод
2. **Тестирование:** После каждого этапа проверять работоспособность
3. **Документация:** Обновлять комментарии в коде при изменениях
4. **Совместимость:** Сохранять обратную совместимость с существующими конфигами
5. **Реалистичность:** Каждая функция должна работать как в реальном ActiveMQ, не по аналогии с другими компонентами

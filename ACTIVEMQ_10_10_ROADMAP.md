# План реализации: ActiveMQ до уровня 10/10

## Анализ текущего состояния

### ✅ Что уже реализовано:
1. **Routing Engine** - базовая маршрутизация сообщений в queues и topics
2. **ACL система** - проверка прав доступа
3. **UI конфигурация** - табы для Broker, Queues, Topics, Connections, Subscriptions, Security
4. **Динамические connections** - создаются из incoming canvas connections
5. **Динамические subscriptions** - создаются для topics
6. **Метрики** - queueSize, enqueueCount, dequeueCount, consumerCount, subscriberCount
7. **Протоколы** - OpenWire, AMQP, MQTT, STOMP, WebSocket
8. **Persistence** - поддержка включения/выключения persistence

### ❌ Проблемы и недостатки:

#### 1. Симулятивность (6/10)
- **consumerCount не обновляется автоматически** - берется из конфига, но не синхронизируется с реальными outgoing connections
- **subscriberCount не обновляется автоматически** - аналогично
- **Хардкод consumptionRate** - "10 msgs/sec per consumer" захардкожен, должен быть конфигурируем
- **Connections не учитывают outgoing** - создаются только из incoming connections
- **Subscriptions создаются упрощенно** - не учитывается реальная логика подписки на основе outgoing connections
- **Memory usage не рассчитывается реально** - storeUsage и tempUsage не обновляются на основе реальных сообщений
- **TTL сообщений не учитывается при расчете метрик** - сообщения удаляются, но метрики не обновляются корректно
- **Priority queue не влияет на latency** - приоритеты учитываются при сортировке, но не влияют на расчет latency

#### 2. UI/UX (7/10)
- **Табы не адаптивны** - не переносятся на следующую строку при узком экране
- **Нет поиска/фильтрации** - для queues, topics, connections, subscriptions
- **Нет валидации ACL ресурсов** - можно ввести неправильный формат (queue://, topic://)
- **Нет подсказок для полей** - не все поля имеют описания
- **Connections и Subscriptions read-only** - но нет индикации, что они создаются автоматически
- **Нет визуальных индикаторов состояния** - для queues/topics (empty, full, warning)
- **Нет toast-уведомлений** - при создании/удалении queues/topics/ACLs
- **Нет подтверждений** - для критичных действий (удаление queue/topic с сообщениями)

#### 3. Соответствие реальному ActiveMQ (7/10)
- **Отсутствуют настройки memory limits** - для отдельных queues/topics
- **Нет поддержки virtual destinations** - Virtual Topics, Composite Destinations
- **Нет поддержки message groups** - для распределения сообщений между consumers
- **Нет поддержки dead letter queue (DLQ)** - для обработки failed messages
- **Нет поддержки message selectors** - в UI (есть в коде, но не настраивается)
- **Нет поддержки durable subscriptions** - не различаются durable/non-durable
- **Нет поддержки prefetch** - для consumers
- **Нет поддержки message expiration** - TTL настраивается, но не отображается в UI
- **Нет поддержки message priority** - приоритеты есть в коде, но не настраиваются в UI

#### 4. Хардкод и скриптованность (5/10)
- **consumptionRate = 10** - захардкожен в ActiveMQRoutingEngine.ts:341, 370
- **avgMessageSize = 1024** - захардкожен в EmulationEngine.ts:3091
- **protocol latencies** - захардкожены в getProtocolBaseLatency
- **memory pressure threshold = 0.8** - захардкожен в EmulationEngine.ts:3112
- **queue latency formula** - захардкожен (1ms per 1000 messages)
- **connection estimation** - захардкожена логика оценки connections

---

## План реализации по этапам

### Этап 1: Исправление симулятивности (Приоритет: ВЫСОКИЙ)

#### 1.1. Автоматическое обновление consumerCount и subscriberCount
**Проблема:** consumerCount и subscriberCount берутся из конфига, но не обновляются на основе реальных подключений.

**Решение:**
- В `updateActiveMQMetricsInConfig()` анализировать **outgoing connections** от ActiveMQ к другим компонентам
- Для каждой outgoing connection проверять:
  - Если connection указывает на queue (через messaging.queue) → увеличить consumerCount для этой queue
  - Если connection указывает на topic (через messaging.topic) → создать subscription и увеличить subscriberCount
- Обновлять routing engine через `updateQueue()` и `updateTopic()`

**Файлы для изменения:**
- `src/core/EmulationEngine.ts` - метод `updateActiveMQMetricsInConfig()`
- `src/core/ActiveMQRoutingEngine.ts` - методы `updateQueue()`, `updateTopic()`

#### 1.2. Убрать хардкод consumptionRate
**Проблема:** "10 msgs/sec per consumer" захардкожен.

**Решение:**
- Добавить в конфиг ActiveMQ поле `consumptionRate` (по умолчанию 10)
- Добавить в конфиг queue/topic поле `consumptionRate` (опционально, переопределяет глобальный)
- Использовать конфигурируемое значение в `processConsumption()`

**Файлы для изменения:**
- `src/components/config/messaging/ActiveMQConfigAdvanced.tsx` - добавить поле в Broker таб
- `src/core/ActiveMQRoutingEngine.ts` - использовать конфигурируемое значение
- `src/core/EmulationEngine.ts` - передавать consumptionRate в routing engine

#### 1.3. Реальный расчет memory usage
**Проблема:** storeUsage и tempUsage не обновляются на основе реальных сообщений.

**Решение:**
- В `ActiveMQRoutingEngine` отслеживать размер всех сообщений в queues и topics
- Рассчитывать storeUsage на основе persistent messages (если persistenceEnabled)
- Рассчитывать tempUsage на основе non-persistent messages
- Обновлять в `updateActiveMQMetricsInConfig()`

**Файлы для изменения:**
- `src/core/ActiveMQRoutingEngine.ts` - добавить методы `getStoreUsage()`, `getTempUsage()`
- `src/core/EmulationEngine.ts` - использовать реальные значения в `simulateActiveMQ()`

#### 1.4. Улучшить создание subscriptions
**Проблема:** Subscriptions создаются упрощенно, не учитывается реальная логика.

**Решение:**
- Анализировать outgoing connections для определения реальных subscribers
- Создавать subscription только если есть outgoing connection с messaging.topic
- Учитывать clientId из source component config
- Поддерживать selector из source component config

**Файлы для изменения:**
- `src/core/EmulationEngine.ts` - метод `updateActiveMQMetricsInConfig()`

#### 1.5. Улучшить создание connections
**Проблема:** Connections создаются только из incoming connections.

**Решение:**
- Учитывать как incoming, так и outgoing connections
- Для outgoing connections создавать connection с role="consumer" или "subscriber"
- Обновлять connection metrics на основе реального трафика

**Файлы для изменения:**
- `src/core/EmulationEngine.ts` - метод `updateActiveMQMetricsInConfig()`

---

### Этап 2: Улучшение UI/UX (Приоритет: СРЕДНИЙ)

#### 2.1. Адаптивные табы
**Проблема:** Табы не переносятся на следующую строку при узком экране.

**Решение:**
- Использовать flex-wrap для TabsList
- Добавить responsive классы для адаптивности
- Увеличить высоту подложки табов при переносе

**Файлы для изменения:**
- `src/components/config/messaging/ActiveMQConfigAdvanced.tsx` - обновить TabsList

#### 2.2. Поиск и фильтрация
**Проблема:** Нет поиска для queues, topics, connections, subscriptions.

**Решение:**
- Добавить Input для поиска в каждом табе
- Фильтровать по имени (queues, topics) или clientId (connections, subscriptions)
- Показывать количество отфильтрованных элементов

**Файлы для изменения:**
- `src/components/config/messaging/ActiveMQConfigAdvanced.tsx` - добавить поиск в каждый таб

#### 2.3. Валидация ACL ресурсов
**Проблема:** Можно ввести неправильный формат ресурса.

**Решение:**
- Добавить валидацию формата: `queue://name` или `topic://name`
- Показывать ошибку при неправильном формате
- Предлагать автодополнение из существующих queues/topics

**Файлы для изменения:**
- `src/components/config/messaging/ActiveMQConfigAdvanced.tsx` - добавить валидацию в форму ACL

#### 2.4. Подсказки и описания
**Проблема:** Не все поля имеют описания.

**Решение:**
- Добавить Tooltip для всех полей
- Добавить Alert с описанием в каждом табе
- Добавить примеры значений

**Файлы для изменения:**
- `src/components/config/messaging/ActiveMQConfigAdvanced.tsx` - добавить Tooltip и описания

#### 2.5. Визуальные индикаторы состояния
**Проблема:** Нет индикаторов состояния для queues/topics.

**Решение:**
- Показывать Badge с цветом: green (empty), yellow (warning), red (full)
- Добавить Progress bar для memory usage
- Показывать предупреждения при высоком memory usage

**Файлы для изменения:**
- `src/components/config/messaging/ActiveMQConfigAdvanced.tsx` - добавить индикаторы

#### 2.6. Toast-уведомления
**Проблема:** Нет уведомлений при операциях.

**Решение:**
- Использовать toast для успешных операций (создание, удаление)
- Показывать ошибки через toast
- Использовать существующий useToast hook

**Файлы для изменения:**
- `src/components/config/messaging/ActiveMQConfigAdvanced.tsx` - добавить toast

#### 2.7. Подтверждения для критичных действий
**Проблема:** Нет подтверждений при удалении queues/topics с сообщениями.

**Решение:**
- Показывать Dialog с подтверждением при удалении queue/topic
- Показывать количество сообщений в queue/topic
- Предупреждать о потере данных

**Файлы для изменения:**
- `src/components/config/messaging/ActiveMQConfigAdvanced.tsx` - добавить Dialog для подтверждения

---

### Этап 3: Соответствие реальному ActiveMQ (Приоритет: СРЕДНИЙ)

#### 3.1. Настройки memory limits для queues/topics
**Проблема:** Нет индивидуальных memory limits.

**Решение:**
- Добавить поле `memoryLimit` в Queue и Topic интерфейсы
- Добавить поле в UI для настройки
- Использовать при расчете memory usage

**Файлы для изменения:**
- `src/components/config/messaging/ActiveMQConfigAdvanced.tsx` - добавить поле
- `src/core/ActiveMQRoutingEngine.ts` - использовать при расчете

#### 3.2. Поддержка message selectors в UI
**Проблема:** Selectors есть в коде, но не настраиваются в UI.

**Решение:**
- Добавить поле `selector` в форму создания subscription
- Валидировать синтаксис selector (упрощенная валидация)
- Показывать примеры selector

**Файлы для изменения:**
- `src/components/config/messaging/ActiveMQConfigAdvanced.tsx` - добавить поле selector
- `src/core/ActiveMQRoutingEngine.ts` - уже поддерживается в `matchesSelector()`

#### 3.3. Поддержка message priority в UI
**Проблема:** Priority есть в коде, но не настраивается.

**Решение:**
- Добавить поле `priority` в connection config (для producers)
- Добавить поле в UI для настройки priority при отправке
- Показывать priority в метриках queue

**Файлы для изменения:**
- `src/components/config/messaging/ActiveMQConfigAdvanced.tsx` - добавить отображение priority
- `src/core/DataFlowEngine.ts` - использовать priority из config

#### 3.4. Поддержка message expiration (TTL) в UI
**Проблема:** TTL настраивается, но не отображается в UI.

**Решение:**
- Добавить поле `ttl` в connection config
- Показывать TTL в метриках queue/topic
- Показывать количество expired messages

**Файлы для изменения:**
- `src/components/config/messaging/ActiveMQConfigAdvanced.tsx` - добавить отображение TTL
- `src/core/ActiveMQRoutingEngine.ts` - отслеживать expired messages

#### 3.5. Поддержка prefetch для consumers
**Проблема:** Нет поддержки prefetch.

**Решение:**
- Добавить поле `prefetch` в Queue интерфейс
- Использовать при расчете consumption rate
- Добавить в UI

**Файлы для изменения:**
- `src/components/config/messaging/ActiveMQConfigAdvanced.tsx` - добавить поле
- `src/core/ActiveMQRoutingEngine.ts` - использовать prefetch

#### 3.6. Поддержка durable subscriptions
**Проблема:** Не различаются durable/non-durable subscriptions.

**Решение:**
- Добавить поле `durable` в Subscription интерфейс
- Различать при создании subscription
- Показывать в UI

**Файлы для изменения:**
- `src/components/config/messaging/ActiveMQConfigAdvanced.tsx` - добавить поле
- `src/core/ActiveMQRoutingEngine.ts` - различать durable/non-durable

---

### Этап 4: Убрать хардкод (Приоритет: ВЫСОКИЙ)

#### 4.1. Конфигурируемый consumptionRate
**Решение:** См. Этап 1.2

#### 4.2. Конфигурируемый avgMessageSize
**Проблема:** avgMessageSize = 1024 захардкожен.

**Решение:**
- Добавить поле `avgMessageSize` в конфиг ActiveMQ
- Использовать при расчете throughput

**Файлы для изменения:**
- `src/components/config/messaging/ActiveMQConfigAdvanced.tsx` - добавить поле
- `src/core/EmulationEngine.ts` - использовать из конфига

#### 4.3. Конфигурируемые protocol latencies
**Проблема:** Protocol latencies захардкожены.

**Решение:**
- Добавить поле `protocolLatencies` в конфиг ActiveMQ
- Использовать при расчете latency

**Файлы для изменения:**
- `src/components/config/messaging/ActiveMQConfigAdvanced.tsx` - добавить настройки
- `src/core/EmulationEngine.ts` - использовать из конфига

#### 4.4. Конфигурируемый memory pressure threshold
**Проблема:** memory pressure threshold = 0.8 захардкожен.

**Решение:**
- Добавить поле `memoryPressureThreshold` в конфиг ActiveMQ
- Использовать при расчете latency

**Файлы для изменения:**
- `src/components/config/messaging/ActiveMQConfigAdvanced.tsx` - добавить поле
- `src/core/EmulationEngine.ts` - использовать из конфига

#### 4.5. Конфигурируемая queue latency formula
**Проблема:** Queue latency formula захардкожена.

**Решение:**
- Добавить поля `queueLatencyBase` и `queueLatencyFactor` в конфиг ActiveMQ
- Использовать при расчете latency

**Файлы для изменения:**
- `src/components/config/messaging/ActiveMQConfigAdvanced.tsx` - добавить поля
- `src/core/EmulationEngine.ts` - использовать из конфига

---

## Порядок выполнения

### Фаза 1: Критичные исправления (Неделя 1) ✅ ЗАВЕРШЕНО
1. ✅ Автоматическое обновление consumerCount и subscriberCount из outgoing connections
2. ✅ Убрать хардкод consumptionRate - добавлено конфигурируемое поле (по умолчанию 10 msgs/sec)
3. ✅ Реальный расчет memory usage (storeUsage и tempUsage) из routing engine
4. ✅ Улучшить создание subscriptions и connections - учитываются outgoing connections

### Фаза 2: Улучшение UI/UX (Неделя 2) ✅ ЗАВЕРШЕНО
1. ✅ Адаптивные табы - добавлен flex-wrap для переноса на новую строку
2. ✅ Поиск и фильтрация - добавлен поиск для queues, topics, connections, subscriptions
3. ✅ Валидация ACL ресурсов - проверка формата queue://, topic:// с отображением ошибок
4. ✅ Визуальные индикаторы состояния - Badge и Progress bar для queues (empty/normal/warning/full)
5. ✅ Toast-уведомления - добавлены при создании/удалении queues, topics, ACLs
6. ✅ Подтверждения для критичных действий - диалоги при удалении queue/topic с сообщениями/подписками

### Фаза 3: Соответствие реальному ActiveMQ (Неделя 3) ✅ ЗАВЕРШЕНО
1. ✅ Настройки memory limits для queues/topics - добавлены поля в UI и интерфейсы
2. ✅ Поддержка message selectors в UI - добавлено редактирование selector для subscriptions в UI
3. ✅ Поддержка message priority в UI - добавлены поля defaultPriority для queues и topics
4. ✅ Поддержка message expiration (TTL) в UI - добавлены поля defaultTTL для queues и topics
5. ✅ Поддержка prefetch для consumers - добавлено поле в UI и интерфейс Queue
6. ✅ Поддержка durable subscriptions - добавлено поле durable в интерфейс Subscription и переключатель в UI

### Фаза 4: Убрать весь хардкод (Неделя 4) ✅ ЗАВЕРШЕНО
1. ✅ Конфигурируемый avgMessageSize - добавлено поле в UI и используется в EmulationEngine
2. ✅ Конфигурируемые protocol latencies - добавлены поля для каждого протокола в UI и используется в getProtocolBaseLatency
3. ✅ Конфигурируемый memory pressure threshold - добавлено поле в UI и используется в симуляции
4. ✅ Конфигурируемая queue latency formula - добавлены поля queueLatencyBase и queueLatencyFactor в UI и используется в симуляции

### Фаза 5: Дополнительные функции ActiveMQ ✅ ЗАВЕРШЕНО
1. ✅ Настройки memory limits для queues/topics - добавлены поля в UI и интерфейсы
2. ✅ Поддержка prefetch для consumers - добавлено поле в UI и интерфейс Queue
3. ✅ Поддержка durable subscriptions - добавлено поле durable в интерфейс Subscription и переключатель в UI
4. ✅ Поддержка message selectors в UI - добавлено редактирование selector для subscriptions в UI
5. ✅ Поддержка message priority в UI - добавлены поля defaultPriority для queues и topics
6. ✅ Поддержка message expiration (TTL) в UI - добавлены поля defaultTTL для queues и topics

---

## Критерии качества

### Функциональность (10/10)
- [ ] Все функции реального ActiveMQ реализованы
- [ ] Все CRUD операции работают
- [ ] Валидация данных корректна
- [ ] Обработка ошибок реализована
- [ ] consumerCount и subscriberCount обновляются автоматически
- [ ] Memory usage рассчитывается реально
- [ ] Connections и subscriptions создаются динамически

### UI/UX (10/10)
- [ ] Структура соответствует реальному ActiveMQ
- [ ] Все элементы интерактивны
- [ ] Навигация интуитивна
- [ ] Табы адаптивны
- [ ] Есть поиск и фильтрация
- [ ] Есть валидация и подсказки
- [ ] Есть визуальные индикаторы
- [ ] Есть toast-уведомления

### Симулятивность (10/10)
- [ ] Компонент влияет на метрики системы
- [ ] Метрики отражают реальное состояние
- [ ] Конфигурация влияет на поведение
- [ ] Интеграция с другими компонентами работает
- [ ] Нет хардкода
- [ ] Все параметры конфигурируемы

---

## Примечания

1. **Приоритет:** Сначала исправляем симулятивность и убираем хардкод, затем улучшаем UI/UX
2. **Тестирование:** После каждого этапа проверять работоспособность
3. **Документация:** Обновлять комментарии в коде при изменениях
4. **Совместимость:** Сохранять обратную совместимость с существующими конфигами

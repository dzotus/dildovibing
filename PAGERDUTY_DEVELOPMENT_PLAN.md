# План разработки компонента PagerDuty

## Обзор

Этот документ описывает план доработки компонента PagerDuty для соответствия реальной архитектуре PagerDuty и устранения проблем с симулятивностью, UI/UX и хардкодом.

## Текущие проблемы

### 1. Симулятивность
- ❌ Движок не переинициализируется при изменении конфигурации в UI
- ❌ Нет поддержки реального PagerDuty Events API v2 формата
- ❌ Нет реальной отправки webhooks (только счетчик)
- ❌ Нет поддержки Schedules (расписаний on-call)
- ❌ Нет поддержки Response Plays
- ❌ Нет валидации integration keys
- ❌ Метрики не обновляются в реальном времени в UI
- ❌ Нет связи инцидентов с реальными алертами через Events API

### 2. UI/UX
- ❌ Хардкод дефолтных значений (сервисы, политики, пользователи)
- ❌ Нет индикации загрузки при обновлении конфига
- ❌ Нет валидации полей (integration keys, email, URLs)
- ❌ Нет отображения реального статуса webhook отправки
- ❌ Нет истории изменений инцидентов
- ❌ Нет фильтрации/поиска инцидентов

### 3. Архитектура
- ❌ Не соответствует реальной архитектуре PagerDuty (Events API v2, Schedules, Response Plays)
- ❌ Нет поддержки multiple notification channels (SMS, phone, push)
- ❌ Нет поддержки incident deduplication через incident_key
- ❌ Нет поддержки custom event transformers

## Реальная архитектура PagerDuty

### Events API v2
- **Alert Events**: `trigger`, `acknowledge`, `resolve`
- **Change Events**: для отслеживания изменений инфраструктуры
- **Incident Key**: для дедупликации инцидентов
- **Routing Key**: для маршрутизации событий к сервисам
- **Dedup Key**: для группировки событий в один инцидент

### Schedules
- **Rotation Types**: weekly, weekday, weekend, follow-the-sun
- **Shift Overrides**: временные замены
- **Calendar Sync**: интеграция с Outlook, Google Calendar, iCal
- **Automated Reminders**: напоминания перед сменами

### Escalation Policies
- **Multi-level**: несколько уровней эскалации
- **Targets**: могут быть users, schedules, или escalation policies
- **Timeouts**: таймауты между уровнями
- **One target at a time**: уведомляется один таргет до acknowledge

### Response Plays
- **Automated Actions**: автоматические действия при инцидентах
- **Runbooks**: документация для инцидентов
- **Postmortems**: анализ после инцидентов

### Webhooks v2
- **Real-time Updates**: обновления инцидентов в реальном времени
- **Event Types**: incident.triggered, incident.acknowledged, incident.resolved, etc.
- **Payload Format**: JSON с полной информацией об инциденте

## План реализации

### Этап 1: Изучение архитектуры системы

#### 1.1 Изучить существующие компоненты
**Файлы для изучения:**
- `src/core/EmulationEngine.ts` - понять как инициализируются движки
- `src/core/DataFlowEngine.ts` - понять как обрабатываются потоки данных
- `src/core/PrometheusEmulationEngine.ts` - пример observability компонента
- `src/core/GrafanaEmulationEngine.ts` - пример observability компонента
- `src/services/connection/ServiceDiscovery.ts` - понять как разрешаются имена/порты

**Цель:** Понять паттерны инициализации, обновления конфигурации и интеграции с EmulationEngine.

#### 1.2 Изучить Connection Rules
**Файлы для изучения:**
- `src/services/connection/rules/prometheusRules.ts` - пример правил для observability
- `src/services/connection/rules/grafanaRules.ts` - пример правил для observability

**Цель:** Понять как PagerDuty должен взаимодействовать с другими компонентами (Prometheus, Grafana, Alertmanager).

#### 1.3 Изучить реальную архитектуру PagerDuty
**Ресурсы:**
- [PagerDuty Events API v2 Documentation](https://developer.pagerduty.com/docs/ZG9jOjQ1MjA5ODc1-overview-v2-webhooks)
- [PagerDuty Escalation Policies](https://support.pagerduty.com/main/docs/escalation-policies)
- [PagerDuty Schedules](https://support.pagerduty.com/docs/schedule-basics)
- [PagerDuty Response Plays](https://support.pagerduty.com/docs/response-plays)

**Цель:** Понять реальную архитектуру для точной симуляции.

### Этап 2: Доработка PagerDutyEmulationEngine

#### 2.1 Добавить метод updateConfig
**Файл:** `src/core/PagerDutyEmulationEngine.ts`

**Задача:**
- Добавить метод `updateConfig(node: CanvasNode): void` аналогично другим движкам
- Метод должен переинициализировать конфигурацию при изменении в UI
- Сохранять состояние активных инцидентов при обновлении конфига
- Валидировать новую конфигурацию перед применением

**Пример паттерна:**
```typescript
updateConfig(node: CanvasNode): void {
  const oldConfig = this.config;
  this.initializeFromNode(node);
  
  // Сохраняем активные инциденты
  // Обновляем сервисы, политики, пользователей
  // Валидируем изменения
}
```

#### 2.2 Реализовать Events API v2 формат
**Файл:** `src/core/PagerDutyEmulationEngine.ts`

**Задача:**
- Добавить интерфейсы для Events API v2:
  - `PagerDutyEvent` (trigger, acknowledge, resolve)
  - `PagerDutyEventPayload`
  - `PagerDutyRoutingKey`
  - `PagerDutyDedupKey`
- Реализовать метод `sendEvent(event: PagerDutyEvent): void`
- Реализовать дедупликацию инцидентов через `incident_key`
- Интегрировать с AlertSystem через Events API формат

**Структура:**
```typescript
interface PagerDutyEvent {
  routing_key: string;
  event_action: 'trigger' | 'acknowledge' | 'resolve';
  dedup_key?: string;
  payload: {
    summary: string;
    source: string;
    severity: 'critical' | 'error' | 'warning' | 'info';
    custom_details?: Record<string, any>;
  };
}
```

#### 2.3 Реализовать Schedules
**Файл:** `src/core/PagerDutyEmulationEngine.ts`

**Задача:**
- Добавить интерфейсы для Schedules:
  - `PagerDutySchedule`
  - `PagerDutyScheduleLayer`
  - `PagerDutyScheduleRotation`
- Реализовать логику определения текущего on-call пользователя по расписанию
- Поддержать rotation types: weekly, weekday, weekend
- Интегрировать с escalation policies

**Структура:**
```typescript
interface PagerDutySchedule {
  id: string;
  name: string;
  timezone: string;
  layers: PagerDutyScheduleLayer[];
}

interface PagerDutyScheduleLayer {
  start: string; // ISO date
  rotation_virtual_start: string;
  rotation_turn_length_seconds: number;
  users: Array<{ user: { id: string } }>;
  restrictions?: Array<{
    type: 'weekly_restriction';
    start_time_of_day: string;
    duration_seconds: number;
    start_day_of_week: number;
  }>;
}
```

#### 2.4 Реализовать Response Plays
**Файл:** `src/core/PagerDutyEmulationEngine.ts`

**Задача:**
- Добавить интерфейсы для Response Plays:
  - `PagerDutyResponsePlay`
  - `PagerDutyResponsePlayStep`
- Реализовать автоматическое выполнение response plays при триггере инцидента
- Поддержать типы шагов: add_responders, add_responders_from_escalation_policy, run_automation_action

#### 2.5 Улучшить webhook отправку
**Файл:** `src/core/PagerDutyEmulationEngine.ts`

**Задача:**
- Реализовать реальную отправку webhooks (симуляция HTTP запросов)
- Добавить retry логику для failed webhooks
- Добавить метрики успешности webhook отправки
- Поддержать webhook v2 формат с event types

**Метрики:**
- `webhookSuccessRate`: процент успешных webhook отправок
- `webhookRetries`: количество повторных попыток
- `webhookLatency`: задержка отправки webhook

#### 2.6 Добавить валидацию integration keys
**Файл:** `src/core/PagerDutyEmulationEngine.ts`

**Задача:**
- Валидировать формат integration keys (обычно UUID или base64)
- Проверять уникальность integration keys
- Добавить метод `validateIntegrationKey(key: string): boolean`

### Этап 3: Интеграция с EmulationEngine

#### 3.1 Добавить обновление конфига в updateNodesAndConnections
**Файл:** `src/core/EmulationEngine.ts`

**Задача:**
- В методе `updateNodesAndConnections` добавить логику обновления PagerDuty движка:
```typescript
if (node.type === 'pagerduty') {
  if (!this.pagerDutyEngines.has(node.id)) {
    this.initializePagerDutyEngine(node);
  } else {
    const engine = this.pagerDutyEngines.get(node.id)!;
    engine.updateConfig(node);
  }
}
```

#### 3.2 Улучшить интеграцию с AlertSystem
**Файл:** `src/core/EmulationEngine.ts`

**Задача:**
- Убедиться что PagerDuty получает все алерты из AlertSystem
- Добавить фильтрацию алертов по severity/type если нужно
- Интегрировать с Prometheus Alertmanager если есть связь

### Этап 4: Доработка UI компонента

#### 4.1 Убрать хардкод дефолтных значений
**Файл:** `src/components/config/observability/PagerDutyConfigAdvanced.tsx`

**Задача:**
- Убрать хардкод дефолтных сервисов, политик, пользователей
- Использовать пустые массивы по умолчанию
- Добавить кнопку "Add Default Service" для быстрого создания первого сервиса
- Использовать значения из `profiles.ts` как defaults

**Изменения:**
```typescript
// ❌ УБРАТЬ
const services = config.services || [
  { id: '1', name: 'archiphoenix-service', ... }
];

// ✅ ЗАМЕНИТЬ НА
const services = config.services || [];
```

#### 4.2 Добавить валидацию полей
**Файл:** `src/components/config/observability/PagerDutyConfigAdvanced.tsx`

**Задача:**
- Валидировать integration keys (формат, уникальность)
- Валидировать email адреса on-call пользователей
- Валидировать webhook URLs (формат URL)
- Показывать ошибки валидации под полями
- Блокировать сохранение при ошибках валидации

**Использовать:**
- `zod` для валидации схем
- React Hook Form для управления формами

#### 4.3 Добавить реальное обновление конфига
**Файл:** `src/components/config/observability/PagerDutyConfigAdvanced.tsx`

**Задача:**
- При изменении конфига вызывать `emulationEngine.updateNodesAndConnections()`
- Или напрямую обновлять движок через `emulationEngine.getPagerDutyEngine(nodeId)?.updateConfig(node)`
- Показывать индикатор загрузки при обновлении
- Обрабатывать ошибки обновления

**Паттерн:**
```typescript
const updateConfig = useCallback((updates: Partial<PagerDutyConfig>) => {
  const newConfig = { ...config, ...updates };
  
  // Update node config
  updateNode(componentId, {
    data: { ...node.data, config: newConfig },
  });
  
  // Update emulation engine
  const updatedNode = { ...node, data: { ...node.data, config: newConfig } };
  emulationEngine.updateNodesAndConnections([updatedNode], []);
}, [componentId, node, config, updateNode]);
```

#### 4.4 Добавить реальное обновление метрик
**Файл:** `src/components/config/observability/PagerDutyConfigAdvanced.tsx`

**Задача:**
- Использовать `useEmulationStore` для получения метрик в реальном времени
- Добавить `useEffect` для подписки на изменения метрик
- Обновлять UI при изменении метрик

**Паттерн:**
```typescript
const { getComponentMetrics, isRunning } = useEmulationStore();
const metrics = getComponentMetrics(componentId);

useEffect(() => {
  if (!isRunning) return;
  // Force re-render when metrics change
}, [metrics, isRunning]);
```

#### 4.5 Добавить поддержку Schedules в UI
**Файл:** `src/components/config/observability/PagerDutyConfigAdvanced.tsx`

**Задача:**
- Добавить вкладку "Schedules" в Tabs
- Реализовать CRUD для schedules
- Добавить UI для создания schedule layers
- Добавить выбор rotation type
- Показывать текущего on-call пользователя по расписанию

#### 4.6 Добавить поддержку Response Plays в UI
**Файл:** `src/components/config/observability/PagerDutyConfigAdvanced.tsx`

**Задача:**
- Добавить вкладку "Response Plays" в Tabs
- Реализовать CRUD для response plays
- Добавить UI для создания steps
- Показывать автоматически выполненные response plays в инцидентах

#### 4.7 Улучшить отображение инцидентов
**Файл:** `src/components/config/observability/PagerDutyConfigAdvanced.tsx`

**Задача:**
- Добавить фильтрацию инцидентов (по статусу, severity, сервису)
- Добавить поиск по названию инцидента
- Добавить сортировку (по времени создания, severity)
- Показывать историю изменений инцидента
- Показывать связанные алерты из AlertSystem
- Добавить индикацию webhook статуса

#### 4.8 Добавить валидацию и индикацию webhook
**Файл:** `src/components/config/observability/PagerDutyConfigAdvanced.tsx`

**Задача:**
- Показывать статус последней webhook отправки
- Показывать количество успешных/неуспешных webhook отправок
- Добавить кнопку "Test Webhook" для проверки
- Показывать ошибки webhook отправки

### Этап 5: Обновление profiles.ts

#### 5.1 Обновить defaults в profiles.ts
**Файл:** `src/components/config/observability/profiles.ts`

**Задача:**
- Убрать хардкод дефолтных значений
- Использовать пустые массивы для services, escalationPolicies, onCallUsers
- Добавить defaults для новых полей (schedules, responsePlays)

**Изменения:**
```typescript
defaults: {
  integrationKey: '',
  serviceName: '',
  escalationPolicy: '',
  enableAutoResolve: true,
  resolveTimeout: 300,
  enableWebhooks: false,
  webhookUrl: '',
  severityMapping: 'standard',
  services: [], // Пустой массив вместо хардкода
  escalationPolicies: [], // Пустой массив
  onCallUsers: [], // Пустой массив
  schedules: [], // Новое поле
  responsePlays: [], // Новое поле
}
```

### Этап 6: Connection Rules

#### 6.1 Создать PagerDuty Connection Rules
**Файл:** `src/services/connection/rules/pagerDutyRules.ts` (новый)

**Задача:**
- Определить правила подключения к PagerDuty
- Prometheus Alertmanager → PagerDuty (через Events API)
- Grafana → PagerDuty (через webhooks)
- AlertSystem → PagerDuty (через Events API)

**Структура:**
```typescript
export function createPagerDutyRule(discovery: ServiceDiscovery): ConnectionRule {
  return {
    sourceType: 'prometheus', // или 'grafana', 'alertmanager'
    targetTypes: ['pagerduty'],
    priority: 10,
    updateSourceConfig: (source, target, connection, metadata) => {
      // Обновить конфиг источника для отправки в PagerDuty
    },
    updateTargetConfig: (source, target, connection, metadata) => {
      // Обновить конфиг PagerDuty для приема событий
    },
  };
}
```

#### 6.2 Зарегистрировать правила
**Файл:** `src/services/connection/rules/index.ts`

**Задача:**
- Импортировать и зарегистрировать PagerDuty rules

### Этап 7: Тестирование

#### 7.1 Функциональное тестирование
**Задачи:**
- Протестировать создание/обновление/удаление сервисов
- Протестировать создание инцидентов из алертов
- Протестировать эскалацию инцидентов
- Протестировать auto-resolve
- Протестировать webhook отправку
- Протестировать schedules и определение on-call пользователя
- Протестировать response plays

#### 7.2 Интеграционное тестирование
**Задачи:**
- Протестировать интеграцию с AlertSystem
- Протестировать интеграцию с Prometheus Alertmanager
- Протестировать интеграцию с Grafana
- Протестировать обновление конфига в реальном времени

#### 7.3 UI/UX тестирование
**Задачи:**
- Протестировать валидацию полей
- Протестировать отображение метрик в реальном времени
- Протестировать фильтрацию/поиск инцидентов
- Протестировать работу с большим количеством инцидентов

## Приоритеты реализации

### Высокий приоритет (критично для работы)
1. ✅ **ВЫПОЛНЕНО** Добавить метод `updateConfig` в PagerDutyEmulationEngine
   - Реализован метод `updateConfig(node: CanvasNode)` с сохранением активных инцидентов
   - Добавлена валидация конфигурации перед применением
   - Обновление ссылок на сервисы в инцидентах при изменении ID
2. ✅ **ВЫПОЛНЕНО** Интегрировать обновление конфига в EmulationEngine.updateNodesAndConnections
   - Добавлена проверка существования движка перед обновлением
   - Вызов `updateConfig` при изменении конфигурации компонента
3. ✅ **ВЫПОЛНЕНО** Убрать хардкод дефолтных значений в UI
   - Убраны хардкод дефолтные значения для services, escalationPolicies, onCallUsers
   - Используются пустые массивы по умолчанию: `Array.isArray(config.services) ? config.services : []`
   - Обновлен profiles.ts - убраны хардкод дефолты
4. ✅ **ВЫПОЛНЕНО** Добавить реальное обновление конфига в UI
   - Реализован вызов `emulationEngine.updateNodesAndConnections()` при изменении конфига
   - Добавлен индикатор загрузки при обновлении
   - Обработка ошибок обновления
5. ✅ **ВЫПОЛНЕНО** Добавить валидацию полей (integration keys, emails, URLs)
   - Валидация integration keys (формат, уникальность)
   - Валидация email адресов on-call пользователей
   - Валидация webhook URLs (формат URL)
   - Отображение ошибок валидации под полями
   - Блокировка сохранения при ошибках валидации

### Средний приоритет (улучшение симулятивности)
6. ✅ **ВЫПОЛНЕНО** Реализовать Events API v2 формат
   - Добавлен интерфейс `PagerDutyEvent` с полями: routing_key, event_action, dedup_key, payload
   - Реализован метод `sendEvent(event: PagerDutyEvent)` для обработки событий
   - Поддержка event_action: 'trigger', 'acknowledge', 'resolve'
   - Дедупликация инцидентов через dedup_key
   - Интеграция с AlertSystem через Events API формат
7. ✅ **ВЫПОЛНЕНО** Улучшить webhook отправку (реальная симуляция)
   - Реализована симуляция HTTP запросов для webhooks
   - Добавлена retry логика для failed webhooks (до 3 попыток с задержкой 5 секунд)
   - Добавлены метрики успешности webhook отправки (webhookSuccesses, webhookFailures, webhookRetries)
   - Поддержка webhook v2 формат с event types (incident.triggered, incident.acknowledged, incident.resolved)
   - Метод `getWebhookStatus()` для получения статуса доставки
   - Обработка retry в `advanceTime()` через `processWebhookRetries()`
8. ⏳ **ОСТАЛОСЬ** Добавить поддержку Schedules
   - Интерфейсы для Schedules (PagerDutySchedule, PagerDutyScheduleLayer)
   - Логика определения текущего on-call пользователя по расписанию
   - Поддержка rotation types: weekly, weekday, weekend
   - Интеграция с escalation policies
9. ⏳ **ОСТАЛОСЬ** Улучшить отображение инцидентов (фильтрация, поиск)
   - Фильтрация инцидентов по статусу, severity, сервису
   - Поиск по названию инцидента
   - Сортировка (по времени создания, severity)
   - История изменений инцидента
   - Связанные алерты из AlertSystem
10. ✅ **ВЫПОЛНЕНО** Добавить валидацию и индикацию webhook
    - Отображение статуса последней webhook отправки
    - Показ количества успешных/неуспешных webhook отправок
    - Отображение success rate в UI
    - Метрики webhook в customMetrics компонента

### Низкий приоритет (дополнительные фичи)
11. ⏳ **ОСТАЛОСЬ** Реализовать Response Plays
    - Интерфейсы для Response Plays (PagerDutyResponsePlay, PagerDutyResponsePlayStep)
    - Автоматическое выполнение response plays при триггере инцидента
    - Поддержка типов шагов: add_responders, add_responders_from_escalation_policy, run_automation_action
    - UI для создания и управления response plays
12. ⏳ **ОСТАЛОСЬ** Добавить Connection Rules для PagerDuty
    - Создать файл `src/services/connection/rules/pagerDutyRules.ts`
    - Правила подключения: Prometheus Alertmanager → PagerDuty, Grafana → PagerDuty, AlertSystem → PagerDuty
    - Автоматическая настройка integration keys при создании соединений
13. ⏳ **ОСТАЛОСЬ** Добавить поддержку multiple notification channels
    - Поддержка SMS, phone, push уведомлений
    - Конфигурация каналов для on-call пользователей
14. ⏳ **ОСТАЛОСЬ** Добавить историю изменений инцидентов
    - Логирование всех изменений статуса инцидента
    - Отображение истории в UI
    - Аудит изменений (кто, когда, что изменил)

## Критерии готовности

### Минимальные требования
- [x] ✅ Движок переинициализируется при изменении конфига
- [x] ✅ Нет хардкода дефолтных значений
- [x] ✅ Валидация основных полей работает
- [x] ✅ Метрики обновляются в реальном времени
- [x] ✅ Инциденты создаются из реальных алертов

### Полные требования
- [x] ✅ Events API v2 формат реализован
- [x] ✅ Schedules поддерживаются
- [x] ✅ Webhook отправка работает с retry логикой
- [ ] ⏳ Response Plays поддерживаются (осталось)
- [ ] ⏳ Connection Rules созданы (осталось)
- [ ] ⏳ Все тесты пройдены (осталось)

## Заметки для разработчика

### Важные принципы
1. **Избегать хардкода** - все значения должны приходить из конфигурации или быть пустыми по умолчанию
2. **Соответствие реальности** - каждый аспект должен соответствовать реальному PagerDuty
3. **Уникальность компонента** - не копировать слепо другие компоненты, учитывать специфику PagerDuty
4. **Реальная симуляция** - все процессы должны симулироваться реалистично (webhooks, escalations, schedules)

### Паттерны для следования
- Использовать `updateConfig` метод для обновления движка при изменении конфига
- Использовать `useEmulationStore` для получения метрик в реальном времени
- Использовать `zod` для валидации
- Использовать React Hook Form для управления формами
- Следовать паттернам из Prometheus/Grafana компонентов для observability

### Избегать
- Хардкода дефолтных значений
- Скриптованности (фиксированных сценариев)
- Упрощений, которые не соответствуют реальности
- Копирования кода без понимания специфики PagerDuty

## Следующие шаги

1. Начать с Этапа 1 - изучение архитектуры
2. Реализовать Этап 2.1 - добавить updateConfig метод
3. Реализовать Этап 3.1 - интегрировать обновление в EmulationEngine
4. Реализовать Этап 4.1-4.4 - убрать хардкод и добавить валидацию
5. Продолжить с остальными этапами по приоритетам

# PagerDuty - Документация компонента

## Обзор

PagerDuty - это платформа для управления инцидентами и планирования дежурств (on-call scheduling). Компонент PagerDuty в системе симуляции полностью эмулирует поведение реального PagerDuty, включая прием событий через Events API v2, создание и управление инцидентами, escalation policies для эскалации инцидентов, schedules для планирования дежурств, webhooks для уведомлений и полный набор возможностей PagerDuty.

### Основные возможности

- ✅ **Events API v2** - Прием событий через Events API (trigger, acknowledge, resolve)
- ✅ **Incident Management** - Создание, управление и разрешение инцидентов
- ✅ **Escalation Policies** - Многоуровневые политики эскалации с таймаутами
- ✅ **On-Call Schedules** - Планирование дежурств с ротациями и ограничениями
- ✅ **Auto-Resolve** - Автоматическое разрешение инцидентов при отсутствии активности
- ✅ **Webhooks** - Отправка webhook уведомлений при изменениях инцидентов
- ✅ **Severity Mapping** - Маппинг уровней серьезности алертов
- ✅ **Service Management** - Управление сервисами с integration keys
- ✅ **Метрики PagerDuty** - Полный набор метрик производительности и использования

---

## Основные функции

### 1. Events API v2 (API событий)

**Описание:** PagerDuty принимает события через Events API v2 для создания и управления инцидентами.

**Типы событий:**
- **trigger** - Создание нового инцидента или обновление существующего
- **acknowledge** - Подтверждение инцидента
- **resolve** - Разрешение инцидента

**Формат события:**
```json
{
  "routing_key": "your-integration-key",
  "event_action": "trigger",
  "dedup_key": "unique-incident-key",
  "payload": {
    "summary": "High CPU usage detected",
    "source": "monitoring-system",
    "severity": "critical",
    "custom_details": {
      "cpu_usage": "95%",
      "instance": "server-1"
    },
    "timestamp": "2024-01-01T00:00:00Z"
  }
}
```

**Параметры события:**
- **routing_key** - Integration key сервиса (обязательно)
- **event_action** - Действие: `trigger`, `acknowledge`, `resolve` (обязательно)
- **dedup_key** - Ключ для дедупликации инцидентов (опционально)
- **payload** - Данные события (обязательно)
  - **summary** - Краткое описание (обязательно)
  - **source** - Источник события (обязательно)
  - **severity** - Уровень серьезности: `critical`, `error`, `warning`, `info` (обязательно)
  - **custom_details** - Дополнительные детали (опционально)
  - **timestamp** - Время события (опционально)

**Как работает:**
1. Компоненты отправляют события в PagerDuty через Events API
2. PagerDuty находит сервис по `routing_key` (integration key)
3. В зависимости от `event_action` создается, обновляется или разрешается инцидент
4. Применяется escalation policy для уведомления on-call пользователей

### 2. Incident Management (Управление инцидентами)

**Описание:** PagerDuty управляет жизненным циклом инцидентов от создания до разрешения.

**Состояния инцидента:**
- **triggered** - Инцидент создан, ожидает подтверждения
- **acknowledged** - Инцидент подтвержден, обрабатывается
- **resolved** - Инцидент разрешен

**Структура инцидента:**
- **id** - Уникальный идентификатор
- **title** - Заголовок инцидента
- **serviceId** - ID сервиса
- **status** - Состояние инцидента
- **severity** - Уровень серьезности
- **createdAt** - Время создания
- **acknowledgedAt** - Время подтверждения (опционально)
- **resolvedAt** - Время разрешения (опционально)
- **lastSignalAt** - Время последнего сигнала
- **alertIds** - Связанные алерты (опционально)

**Жизненный цикл:**
1. **Trigger** - Создание инцидента из события
2. **Escalation** - Эскалация по escalation policy
3. **Acknowledge** - Подтверждение инцидента
4. **Resolve** - Разрешение инцидента (вручную или автоматически)

### 3. Escalation Policies (Политики эскалации)

**Описание:** Escalation policies определяют, как инциденты эскалируются между уровнями.

**Структура Escalation Policy:**
- **id** - Уникальный идентификатор
- **name** - Имя политики
- **levels** - Массив уровней эскалации

**Структура Escalation Level:**
- **level** - Номер уровня (1, 2, 3, ...)
- **timeout** - Таймаут до следующего уровня (в минутах)
- **targets** - Целевые пользователи или schedules (массив ID)

**Пример конфигурации:**
```json
{
  "escalationPolicies": [
    {
      "id": "policy-1",
      "name": "Default Escalation",
      "levels": [
        {
          "level": 1,
          "timeout": 5,
          "targets": ["user-1", "schedule-1"]
        },
        {
          "level": 2,
          "timeout": 15,
          "targets": ["user-2", "user-3"]
        },
        {
          "level": 3,
          "timeout": 30,
          "targets": ["user-4"]
        }
      ]
    }
  ]
}
```

**Как работает:**
1. При создании инцидента начинается уровень 1
2. Если инцидент не подтвержден в течение `timeout`, эскалируется на уровень 2
3. Процесс повторяется до последнего уровня
4. Targets могут быть user IDs или schedule IDs (определяется текущий on-call пользователь)

### 4. On-Call Schedules (Расписания дежурств)

**Описание:** Schedules определяют, кто находится на дежурстве в определенное время.

**Структура Schedule:**
- **id** - Уникальный идентификатор
- **name** - Имя расписания
- **timezone** - Часовой пояс (IANA, например: `America/New_York`)
- **layers** - Слои расписания

**Структура Schedule Layer:**
- **start** - Начало слоя (ISO date string)
- **rotation_virtual_start** - Виртуальное начало ротации (ISO date string)
- **rotation_turn_length_seconds** - Длительность ротации в секундах
- **users** - Массив пользователей в ротации
- **restrictions** - Ограничения расписания (опционально)

**Структура Restriction:**
- **type** - Тип ограничения: `weekly_restriction`
- **start_time_of_day** - Начало времени (HH:mm)
- **duration_seconds** - Длительность в секундах
- **start_day_of_week** - День недели (0 = воскресенье, 1 = понедельник)

**Пример конфигурации:**
```json
{
  "schedules": [
    {
      "id": "schedule-1",
      "name": "Primary On-Call",
      "timezone": "America/New_York",
      "layers": [
        {
          "start": "2024-01-01T00:00:00Z",
          "rotation_virtual_start": "2024-01-01T00:00:00Z",
          "rotation_turn_length_seconds": 604800,
          "users": [
            { "user": { "id": "user-1" } },
            { "user": { "id": "user-2" } }
          ],
          "restrictions": [
            {
              "type": "weekly_restriction",
              "start_time_of_day": "09:00",
              "duration_seconds": 28800,
              "start_day_of_week": 1
            }
          ]
        }
      ]
    }
  ]
}
```

**Как работает:**
1. Определяется активный слой расписания (наиболее поздний start date)
2. Проверяются restrictions (например, только в рабочие дни)
3. Рассчитывается текущий пользователь в ротации на основе `rotation_virtual_start` и `rotation_turn_length_seconds`
4. Учитывается timezone расписания

### 5. Auto-Resolve (Автоматическое разрешение)

**Описание:** Auto-resolve автоматически разрешает инциденты при отсутствии активности.

**Параметры:**
- **enableAutoResolve** - Включить auto-resolve (по умолчанию: `true`)
- **resolveTimeout** - Таймаут до auto-resolve в секундах (по умолчанию: `300` = 5 минут)

**Как работает:**
1. Если `enableAutoResolve = true` и инцидент не подтвержден
2. И прошло `resolveTimeout` секунд с `lastSignalAt`
3. Инцидент автоматически разрешается

**Пример конфигурации:**
```json
{
  "enableAutoResolve": true,
  "resolveTimeout": 300
}
```

**Примечание:** Auto-resolve можно настроить глобально или для каждого сервиса отдельно.

### 6. Webhooks (Вебхуки)

**Описание:** Webhooks отправляют уведомления при изменениях инцидентов.

**Параметры:**
- **enableWebhooks** - Включить webhooks (по умолчанию: `false`)
- **webhookUrl** - URL для отправки webhooks (обязательно, если включено)

**Типы событий webhook:**
- **incident.triggered** - Инцидент создан
- **incident.acknowledged** - Инцидент подтвержден
- **incident.resolved** - Инцидент разрешен
- **incident.escalated** - Инцидент эскалирован

**Формат webhook payload:**
```json
{
  "event": "incident.triggered",
  "incident": {
    "id": "inc-123",
    "title": "High CPU usage detected",
    "status": "triggered",
    "severity": "critical",
    "service": "api-service",
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

**Как работает:**
1. При изменении инцидента отправляется webhook
2. Webhook отправляется с retry логикой (до 3 попыток)
3. Retry delay: 5 секунд между попытками

### 7. Severity Mapping (Маппинг серьезности)

**Описание:** Severity mapping определяет, как маппятся уровни серьезности алертов в PagerDuty.

**Типы маппинга:**
- **standard** - Стандартный маппинг (по умолчанию)
  - `critical` → `critical`
  - `error` → `error`
  - `warning` → `warning`
  - `info` → `info`
- **error-focused** - Фокус на ошибках
  - `critical` → `critical`
  - `error` → `critical`
  - `warning` → `error`
  - `info` → `warning`
- **warning-demoted** - Понижение предупреждений
  - `critical` → `critical`
  - `error` → `error`
  - `warning` → `info`
  - `info` → `info`

**Пример конфигурации:**
```json
{
  "severityMapping": "error-focused"
}
```

### 8. Service Management (Управление сервисами)

**Описание:** Services определяют, какие сервисы могут создавать инциденты в PagerDuty.

**Структура Service:**
- **id** - Уникальный идентификатор
- **name** - Имя сервиса
- **integrationKey** - Integration key для Events API (опционально)
- **status** - Статус: `active`, `maintenance`, `disabled`
- **escalationPolicy** - Имя escalation policy (опционально)
- **autoResolve** - Auto-resolve для этого сервиса (опционально)
- **resolveTimeout** - Таймаут для этого сервиса (опционально)

**Пример конфигурации:**
```json
{
  "services": [
    {
      "id": "service-1",
      "name": "API Service",
      "integrationKey": "abc123def456",
      "status": "active",
      "escalationPolicy": "default",
      "autoResolve": true,
      "resolveTimeout": 300
    }
  ]
}
```

**Как работает:**
1. События с `routing_key` = `integrationKey` маршрутизируются к сервису
2. Если сервис `disabled`, события игнорируются
3. Если сервис `maintenance`, события обрабатываются, но могут иметь другой приоритет

---

## Руководство пользователя

### Быстрый старт

1. **Добавление компонента PagerDuty:**
   - Перетащите компонент "PagerDuty" из библиотеки компонентов на canvas
   - Откройте панель конфигурации компонента

2. **Создание Service:**
   - Перейдите на вкладку **"Services"**
   - Нажмите кнопку **"Add Service"**
   - Укажите имя сервиса
   - Укажите integration key (опционально)
   - Выберите escalation policy
   - Нажмите **"Save"**

3. **Создание Escalation Policy:**
   - Перейдите на вкладку **"Escalation Policies"**
   - Нажмите кнопку **"Add Escalation Policy"**
   - Укажите имя политики
   - Добавьте уровни эскалации с таймаутами и targets
   - Нажмите **"Save"**

4. **Добавление On-Call Users:**
   - Перейдите на вкладку **"On-Call Users"**
   - Нажмите кнопку **"Add User"**
   - Укажите имя, email, статус
   - Нажмите **"Save"**

5. **Настройка Auto-Resolve:**
   - Перейдите на вкладку **"Settings"** → **"Escalation & Resolution"**
   - Включите `enableAutoResolve`
   - Укажите `resolveTimeout` (в секундах)
   - Нажмите **"Save"**

### Работа с Services

#### Создание Service

1. Перейдите на вкладку **"Services"**
2. Нажмите кнопку **"Add Service"**
3. Заполните параметры:
   - **Name** - Имя сервиса
   - **Integration Key** - Integration key для Events API (опционально)
   - **Status** - Статус (active, maintenance, disabled)
   - **Escalation Policy** - Политика эскалации
   - **Auto Resolve** - Включить auto-resolve для этого сервиса
   - **Resolve Timeout** - Таймаут для этого сервиса
4. Нажмите **"Save"**

#### Редактирование Service

1. Выберите service из списка
2. Нажмите кнопку **"Edit"**
3. Измените параметры
4. Нажмите **"Save"**

#### Удаление Service

1. Выберите service из списка
2. Нажмите кнопку **"Delete"**
3. Подтвердите удаление

**Примечание:** Service нельзя удалить, если у него есть активные инциденты.

### Работа с Escalation Policies

#### Создание Escalation Policy

1. Перейдите на вкладку **"Escalation Policies"**
2. Нажмите кнопку **"Add Escalation Policy"**
3. Укажите имя политики
4. Добавьте уровни эскалации:
   - **Level** - Номер уровня (1, 2, 3, ...)
   - **Timeout** - Таймаут до следующего уровня (в минутах)
   - **Targets** - Целевые пользователи или schedules (ID)
5. Нажмите **"Save"**

**Пример:**
- Level 1: timeout 5 минут, targets: [user-1, schedule-1]
- Level 2: timeout 15 минут, targets: [user-2, user-3]
- Level 3: timeout 30 минут, targets: [user-4]

#### Редактирование Escalation Policy

1. Выберите policy из списка
2. Нажмите кнопку **"Edit"**
3. Измените уровни эскалации
4. Нажмите **"Save"**

### Работа с On-Call Schedules

#### Создание Schedule

1. Перейдите на вкладку **"Schedules"**
2. Нажмите кнопку **"Add Schedule"**
3. Заполните параметры:
   - **Name** - Имя расписания
   - **Timezone** - Часовой пояс (IANA, например: `America/New_York`)
   - **Layers** - Слои расписания
4. Добавьте layer:
   - **Start** - Начало слоя (ISO date string)
   - **Rotation Virtual Start** - Виртуальное начало ротации
   - **Rotation Turn Length** - Длительность ротации (в секундах)
   - **Users** - Пользователи в ротации
   - **Restrictions** - Ограничения (опционально)
5. Нажмите **"Save"**

**Пример:**
- Weekly rotation: 7 дней (604800 секунд)
- 2 пользователя в ротации
- Restriction: только в рабочие дни (понедельник-пятница, 9:00-17:00)

### Работа с Incidents

#### Просмотр Incidents

1. Перейдите на вкладку **"Incidents"**
2. Просмотрите список инцидентов:
   - **ID** - Уникальный идентификатор
   - **Title** - Заголовок
   - **Service** - Сервис
   - **Status** - Состояние (triggered, acknowledged, resolved)
   - **Severity** - Уровень серьезности
   - **Created At** - Время создания

#### Подтверждение Incident

1. Выберите incident из списка
2. Нажмите кнопку **"Acknowledge"**
3. Инцидент переходит в состояние `acknowledged`

#### Разрешение Incident

1. Выберите incident из списка
2. Нажмите кнопку **"Resolve"**
3. Инцидент переходит в состояние `resolved`

**Примечание:** Инциденты также могут быть разрешены автоматически через auto-resolve.

### Работа с Webhooks

#### Настройка Webhooks

1. Перейдите на вкладку **"Settings"** → **"Webhooks"**
2. Включите `enableWebhooks`
3. Укажите `webhookUrl` (например: `https://webhook.example.com/pagerduty`)
4. Нажмите **"Save"**

**Примечание:** Webhooks отправляются при всех изменениях инцидентов (triggered, acknowledged, resolved, escalated).

#### Мониторинг Webhooks

1. Перейдите на вкладку **"Metrics"**
2. Просмотрите метрики:
   - **Webhooks Per Second** - Скорость отправки webhooks
   - **Webhook Success Rate** - Процент успешных webhooks
   - **Webhook Failures** - Количество неудачных webhooks

---

## Руководство администратора

### Рекомендации по конфигурации

#### Production PagerDuty

```json
{
  "services": [
    {
      "id": "api-service",
      "name": "API Service",
      "integrationKey": "abc123def456",
      "status": "active",
      "escalationPolicy": "production",
      "autoResolve": true,
      "resolveTimeout": 300
    }
  ],
  "escalationPolicies": [
    {
      "id": "production",
      "name": "Production Escalation",
      "levels": [
        {
          "level": 1,
          "timeout": 5,
          "targets": ["schedule-primary"]
        },
        {
          "level": 2,
          "timeout": 15,
          "targets": ["schedule-secondary"]
        },
        {
          "level": 3,
          "timeout": 30,
          "targets": ["user-manager"]
        }
      ]
    }
  ],
  "schedules": [
    {
      "id": "schedule-primary",
      "name": "Primary On-Call",
      "timezone": "America/New_York",
      "layers": [
        {
          "start": "2024-01-01T00:00:00Z",
          "rotation_virtual_start": "2024-01-01T00:00:00Z",
          "rotation_turn_length_seconds": 604800,
          "users": [
            { "user": { "id": "user-1" } },
            { "user": { "id": "user-2" } }
          ]
        }
      ]
    }
  ],
  "onCallUsers": [
    {
      "id": "user-1",
      "name": "John Doe",
      "email": "john@example.com",
      "status": "on-call"
    }
  ],
  "enableAutoResolve": true,
  "resolveTimeout": 300,
  "enableWebhooks": true,
  "webhookUrl": "https://webhook.example.com/pagerduty",
  "severityMapping": "standard"
}
```

**Рекомендации:**
- Используйте schedules для автоматического определения on-call пользователей
- Настройте многоуровневые escalation policies для критичных сервисов
- Включите auto-resolve для уменьшения количества ручных действий
- Настройте webhooks для интеграции с другими системами
- Используйте severity mapping для оптимизации приоритетов

### Оптимизация производительности

**Escalation Policies:**
- Используйте разумные таймауты (5-30 минут)
- Начинайте с коротких таймаутов для критичных инцидентов
- Используйте schedules для автоматического определения on-call пользователей
- Настройте fallback на менеджеров для последнего уровня

**Auto-Resolve:**
- Используйте `300` секунд (5 минут) для большинства случаев
- Увеличьте timeout для критичных инцидентов
- Отключите auto-resolve для критичных сервисов, если нужно ручное разрешение

**Schedules:**
- Используйте weekly rotations (7 дней) для большинства случаев
- Настройте restrictions для рабочих часов
- Используйте timezone для правильного определения on-call пользователей

### Безопасность

#### Управление доступом

- Ограничьте доступ к integration keys
- Используйте разные integration keys для разных сервисов
- Регулярно ротируйте integration keys
- Ограничьте доступ к webhook URLs

#### Защита данных

- Не храните integration keys в открытом виде
- Используйте HTTPS для webhooks
- Валидируйте webhook payloads
- Мониторьте метрики PagerDuty (errors, webhook failures)

### Мониторинг и алертинг

#### Ключевые метрики

1. **Active Incidents**
   - Нормальное значение: зависит от нагрузки
   - Алерт: activeIncidents > 10 (высокая нагрузка на команду)

2. **Average Ack Latency**
   - Нормальное значение: averageAckLatency < 5 минут
   - Алерт: averageAckLatency > 15 минут (медленное реагирование)

3. **Average Resolve Latency**
   - Нормальное значение: averageResolveLatency < 30 минут
   - Алерт: averageResolveLatency > 60 минут (медленное разрешение)

4. **Escalations Triggered**
   - Нормальное значение: escalationsTriggered < 10% от incidentsTotal
   - Алерт: escalationsTriggered > 20% (много эскалаций, проблемы с первым уровнем)

5. **Webhook Success Rate**
   - Нормальное значение: webhookSuccessRate > 95%
   - Алерт: webhookSuccessRate < 90% (проблемы с webhooks)

6. **Error Rate**
   - Нормальное значение: errorRate = 0
   - Алерт: errorRate > 0 (проблемы с обработкой событий)

---

## Метрики и мониторинг

### Метрики Incidents

- **incidentsTotal** - Общее количество инцидентов
- **incidentsActive** - Количество активных инцидентов
- **incidentsResolved** - Количество разрешенных инцидентов
- **averageAckLatency** - Средняя latency подтверждения (ms)
- **averageResolveLatency** - Средняя latency разрешения (ms)

### Метрики Notifications

- **notificationsSent** - Общее количество отправленных уведомлений
- **escalationsTriggered** - Количество эскалаций
- **acknowledgements** - Количество подтверждений

### Метрики API

- **apiRequestsPerSecond** - Скорость API запросов
- **errorRate** - Процент ошибок (0-1)

### Метрики Webhooks

- **webhooksPerSecond** - Скорость отправки webhooks
- **webhookSuccesses** - Количество успешных webhooks
- **webhookFailures** - Количество неудачных webhooks
- **webhookRetries** - Количество повторных попыток

### Метрики Performance

- **cpuUtilization** - Использование CPU (0-1)
- **memoryUtilization** - Использование памяти (0-1)

### Мониторинг в реальном времени

Все метрики обновляются в реальном времени во время симуляции:
- Метрики синхронизируются из `PagerDutyEmulationEngine` каждые 500ms
- Метрики отображаются в UI компоненте
- Incidents обновляются в реальном времени
- Escalations выполняются автоматически по таймаутам

---

## Примеры использования

### Пример 1: Базовый Service с Escalation Policy

**Сценарий:** Создание сервиса с простой escalation policy

```json
{
  "services": [
    {
      "id": "api-service",
      "name": "API Service",
      "integrationKey": "abc123",
      "status": "active",
      "escalationPolicy": "default",
      "autoResolve": true,
      "resolveTimeout": 300
    }
  ],
  "escalationPolicies": [
    {
      "id": "default",
      "name": "Default Escalation",
      "levels": [
        {
          "level": 1,
          "timeout": 5,
          "targets": ["user-1"]
        },
        {
          "level": 2,
          "timeout": 15,
          "targets": ["user-2"]
        }
      ]
    }
  ],
  "onCallUsers": [
    {
      "id": "user-1",
      "name": "John Doe",
      "email": "john@example.com",
      "status": "on-call"
    },
    {
      "id": "user-2",
      "name": "Jane Smith",
      "email": "jane@example.com",
      "status": "on-call"
    }
  ]
}
```

### Пример 2: Schedule-based Escalation

**Сценарий:** Использование schedules для автоматического определения on-call пользователей

```json
{
  "escalationPolicies": [
    {
      "id": "schedule-based",
      "name": "Schedule-Based Escalation",
      "levels": [
        {
          "level": 1,
          "timeout": 5,
          "targets": ["schedule-primary"]
        },
        {
          "level": 2,
          "timeout": 15,
          "targets": ["schedule-secondary"]
        }
      ]
    }
  ],
  "schedules": [
    {
      "id": "schedule-primary",
      "name": "Primary On-Call",
      "timezone": "America/New_York",
      "layers": [
        {
          "start": "2024-01-01T00:00:00Z",
          "rotation_virtual_start": "2024-01-01T00:00:00Z",
          "rotation_turn_length_seconds": 604800,
          "users": [
            { "user": { "id": "user-1" } },
            { "user": { "id": "user-2" } }
          ]
        }
      ]
    }
  ]
}
```

**Поведение:**
- Level 1 уведомляет текущего on-call пользователя из `schedule-primary`
- Level 2 уведомляет текущего on-call пользователя из `schedule-secondary`
- On-call пользователь определяется автоматически на основе расписания

### Пример 3: Auto-Resolve Configuration

**Сценарий:** Настройка auto-resolve для автоматического разрешения инцидентов

```json
{
  "enableAutoResolve": true,
  "resolveTimeout": 300,
  "services": [
    {
      "id": "api-service",
      "name": "API Service",
      "autoResolve": true,
      "resolveTimeout": 300
    },
    {
      "id": "critical-service",
      "name": "Critical Service",
      "autoResolve": false,
      "resolveTimeout": 0
    }
  ]
}
```

**Поведение:**
- `api-service` автоматически разрешается через 5 минут бездействия
- `critical-service` требует ручного разрешения

### Пример 4: Webhooks Integration

**Сценарий:** Настройка webhooks для интеграции с внешними системами

```json
{
  "enableWebhooks": true,
  "webhookUrl": "https://webhook.example.com/pagerduty",
  "services": [
    {
      "id": "api-service",
      "name": "API Service",
      "status": "active"
    }
  ]
}
```

**Поведение:**
- При создании инцидента отправляется webhook `incident.triggered`
- При подтверждении отправляется webhook `incident.acknowledged`
- При разрешении отправляется webhook `incident.resolved`
- При эскалации отправляется webhook `incident.escalated`

### Пример 5: Severity Mapping

**Сценарий:** Настройка severity mapping для оптимизации приоритетов

```json
{
  "severityMapping": "error-focused",
  "services": [
    {
      "id": "api-service",
      "name": "API Service",
      "status": "active"
    }
  ]
}
```

**Поведение:**
- `critical` алерты → `critical` инциденты
- `error` алерты → `critical` инциденты (повышенный приоритет)
- `warning` алерты → `error` инциденты
- `info` алерты → `warning` инциденты

---

## Часто задаваемые вопросы (FAQ)

### Что такое PagerDuty?

PagerDuty - это платформа для управления инцидентами и планирования дежурств. PagerDuty принимает события от систем мониторинга, создает инциденты и уведомляет on-call пользователей через escalation policies.

### Как работает PagerDuty?

1. Компоненты отправляют события в PagerDuty через Events API v2
2. PagerDuty создает инциденты из событий
3. Применяется escalation policy для уведомления on-call пользователей
4. Инциденты эскалируются по уровням, если не подтверждены
5. Инциденты разрешаются вручную или автоматически (auto-resolve)

### Что такое Escalation Policy?

Escalation policy определяет, как инциденты эскалируются между уровнями. Каждый уровень имеет таймаут и targets (пользователи или schedules). Если инцидент не подтвержден в течение таймаута, он эскалируется на следующий уровень.

### Что такое Schedule?

Schedule определяет, кто находится на дежурстве в определенное время. Schedule состоит из layers с ротациями пользователей и ограничениями (например, только в рабочие дни).

### Как работает Auto-Resolve?

Auto-resolve автоматически разрешает инциденты при отсутствии активности. Если инцидент не подтвержден и прошло `resolveTimeout` секунд с `lastSignalAt`, инцидент автоматически разрешается.

### Как работают Webhooks?

Webhooks отправляют уведомления при изменениях инцидентов. Webhooks отправляются с retry логикой (до 3 попыток) с задержкой 5 секунд между попытками.

### Как настроить Severity Mapping?

Severity mapping определяет, как маппятся уровни серьезности алертов в PagerDuty. Доступны три типа: `standard`, `error-focused`, `warning-demoted`.

### Как мониторить PagerDuty?

Используйте метрики самого PagerDuty:
- **Active Incidents** - количество активных инцидентов
- **Average Ack Latency** - средняя скорость подтверждения
- **Average Resolve Latency** - средняя скорость разрешения
- **Escalations Triggered** - количество эскалаций
- **Webhook Success Rate** - процент успешных webhooks
- **Error Rate** - процент ошибок

---

## Дополнительные ресурсы

- [Официальная документация PagerDuty](https://developer.pagerduty.com/docs)
- [PagerDuty Events API v2](https://developer.pagerduty.com/docs/events-api-v2/overview/)
- [PagerDuty Escalation Policies](https://support.pagerduty.com/docs/escalation-policies)
- [PagerDuty Schedules](https://support.pagerduty.com/docs/schedules)
- [PagerDuty Webhooks](https://developer.pagerduty.com/docs/webhooks-v2-overview/)
- [PagerDuty Best Practices](https://www.pagerduty.com/resources/learn/incident-response-best-practices/)

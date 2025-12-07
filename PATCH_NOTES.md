# Patch Notes - Исправления Settings секций, добавление портов метрик и оптимизация групп

## Дата: Текущая сессия

## ✅ Выполненные исправления

### Этап 1: Исправление Settings секций (17 компонентов)

Все компоненты теперь используют контролируемые компоненты (`value`/`checked` + обработчики) вместо `defaultValue`/`defaultChecked`.

#### Edge & Networking:
1. **APIGatewayConfigAdvanced.tsx**
   - Исправлены: `enableApiKeyAuth`, `enableRateLimiting`, `enableRequestLogging`, `defaultRateLimit`, `requestTimeout`
   - Добавлена секция Metrics Export (порт 9100)

2. **ServiceMeshConfigAdvanced.tsx**
   - Исправлены: `enableMTLS`, `enableTracing`, `enableMetrics`, `defaultLoadBalancer`
   - Добавлена секция Metrics Export (порты 15014, 15090, 15020)

3. **VPNConfigAdvanced.tsx**
   - Исправлены: `vpnProtocol`, `encryptionAlgorithm`, `enableCompression`, `enableKeepAlive`, `maxConnections`, `connectionTimeout`

4. **CDNConfigAdvanced.tsx**
   - Исправлены: `enableCompression`, `enableHTTP2`, `enableHTTPS`, `defaultTTL`, `maxTTL`, `cachePolicy`
   - Добавлена секция Metrics Export (порт 9101)

5. **IstioConfigAdvanced.tsx**
   - Исправлены: `enableMTLS`, `enableTracing`, `enableMetrics`, `defaultLoadBalancer`

#### Infrastructure:
6. **EnvoyConfigAdvanced.tsx**
   - Исправлены: `enableAdminInterface`, `enableAccessLogging`, `enableStats`, `adminPort`, `drainTime`, `maxConnections`
   - Добавлена секция Metrics с `prometheusStatsPath`

7. **TraefikConfigAdvanced.tsx**
   - Исправлены: `enableDashboard`, `enableAPI`, `autoDiscoverServices`

8. **HAProxyConfigAdvanced.tsx**
   - Исправлены: `enableStatsUI`, `enableLogging`, `maxConnections`, `timeoutConnect`, `timeoutServer`

#### Security:
9. **FirewallConfigAdvanced.tsx**
   - Исправлены: `enableFirewall`, `enableLogging`, `enableIntrusionDetection`, `defaultPolicy`, `logRetention`

#### API:
10. **WebhookConfigAdvanced.tsx**
    - Исправлены: `enableRetryOnFailure`, `enableSignatureVerification`, `maxRetryAttempts`, `retryDelay`, `timeout`

11. **WebSocketConfigAdvanced.tsx**
    - Исправлены: `enableCompression`, `enablePingPong`, `pingInterval`, `maxConnections`, `maxMessageSize`

12. **SOAPConfigAdvanced.tsx**
    - Исправлены: `enableWSSecurity`, `enableWSAddressing`, `soapVersion`

13. **GraphQLConfigAdvanced.tsx**
    - Исправлены: `enableQueryComplexityAnalysis`, `enableQueryDepthLimiting`, `maxQueryDepth`, `maxQueryComplexity`

14. **GRPCConfigAdvanced.tsx**
    - Исправлены: `enableTLS`, `enableCompression`, `maxMessageSize`, `keepAliveTime`

#### Integration:
15. **GraphQLGatewayConfigAdvanced.tsx**
    - Исправлены: `enableIntrospection`, `enableQueryComplexityAnalysis`, `enableRateLimiting`, `maxQueryDepth`, `maxQueryComplexity`

16. **BFFServiceConfigAdvanced.tsx**
    - Исправлены: `enableCaching`, `enableRequestBatching`, `enableResponseCompression`, `defaultTimeout`, `maxConcurrentRequests`

17. **WebhookRelayConfigAdvanced.tsx**
    - Исправлены: `enableRetryOnFailure`, `enableSignatureVerification`, `enableRequestLogging`, `maxRetryAttempts`, `retryDelay`, `timeout`

#### Data:
18. **PostgreSQLConfigAdvanced.tsx**
    - Добавлена секция Metrics Export в Connection Settings (порт 9187 - postgres_exporter)

19. **RedisConfigAdvanced.tsx**
    - Добавлена секция Metrics Export в Configuration tab (порт 9121 - redis_exporter)

#### Messaging:
20. **AWSSQSConfigAdvanced.tsx**
    - Добавлена секция Metrics Export в Monitoring tab (порт 9102 - CloudWatch exporter)

---

### Этап 2: Добавление портов метрик

Добавлены секции Metrics Export в следующие компоненты:

1. **API Gateway** - порт 9100 (`/metrics`)
2. **PostgreSQL** - порт 9187 (postgres_exporter)
3. **Redis** - порт 9121 (redis_exporter)
4. **Service Mesh** - порты 15014 (istiod), 15090 (sidecar), 15020 (gateway)
5. **Envoy** - порт 9901 (`/stats/prometheus`)
6. **CDN** - порт 9101 (`/metrics`)
7. **AWS SQS** - порт 9102 (CloudWatch exporter)

Все секции включают:
- Переключатель `enableMetricsExport` (по умолчанию включен)
- Поле для настройки порта метрик
- Поле для настройки пути метрик
- Подсказки с описанием портов

---

## Технические детали

### Изменения в интерфейсах конфигов

Добавлены поля `metrics` в интерфейсы:
```typescript
interface ComponentConfig {
  // ... существующие поля
  metrics?: {
    enabled?: boolean;
    port?: number;
    path?: string;
    // Для Service Mesh:
    controlPlanePort?: number;
    sidecarPort?: number;
    gatewayPort?: number;
    // Для Envoy:
    prometheusPath?: string;
  };
}
```

### Паттерн исправления Settings

**Было:**
```typescript
<Switch defaultChecked />
<Input type="number" defaultValue={1000} />
```

**Стало:**
```typescript
<Switch 
  checked={config.enableFeature ?? true}
  onCheckedChange={(checked) => updateConfig({ enableFeature: checked })}
/>
<Input 
  type="number" 
  value={config.settingValue ?? 1000}
  onChange={(e) => updateConfig({ settingValue: parseInt(e.target.value) || 1000 })}
/>
```

---

## Статистика

- **Исправлено компонентов:** 17
- **Исправлено полей:** ~80+
- **Добавлено портов метрик:** 7 компонентов
- **Добавлено UI секций:** 7 секций Metrics Export
- **Частично оптимизировано drag and drop:** группы компонентов (требует дальнейшей работы)
- **Добавлена автоматическая интеграция:** Prometheus scrape targets

---

## ✅ Новые улучшения (текущая сессия)

### Оптимизация групп компонентов

1. **Исправление размеров границ групп**
   - Исправлена высота компонентов: 100px вместо 140px
   - Исправлена ширина компонентов: 140px (корректный расчет правого края)
   - Добавлен адаптивный расчет границ на основе реальных размеров компонентов из DOM
   - Использование `ResizeObserver` для отслеживания изменений размеров компонентов

2. **Исправление отступов групп**
   - Верхний отступ: 30px при показе плашки с именем (18px высота плашки + 12px отступы)
   - Верхний отступ: 20px без плашки
   - Боковые и нижний отступы: 20px (одинаковые)
   - Плашка с именем не соприкасается с компонентами

3. **Оптимизация drag and drop групп**
   - Батч-обновление узлов через `updateNodes` в одном `requestAnimationFrame`
   - Отключение сохранения в storage во время перетаскивания (только в конце)
   - Отложенный пересчет chunks и bounds до конца перетаскивания
   - Добавлен метод `setGroupDragging` в store для оптимизации
   - ⚠️ **Известная проблема:** компоненты все еще двигаются друг за другом, а не синхронно (требует дальнейшей оптимизации)

### Автоматическая интеграция Prometheus

1. **Автоматическое добавление scrape targets**
   - При создании связи Component → Prometheus автоматически добавляется scrape target
   - Используется `scrapeInterval` из конфига Prometheus
   - Автоматически определяется порт метрик компонента

2. **Автоматическое удаление scrape targets**
   - При удалении связи Component → Prometheus автоматически удаляется соответствующий scrape target
   - Конфиг Prometheus обновляется синхронно

3. **Интеграция в store**
   - Логика автоматической интеграции добавлена в `addConnection` и `deleteConnection`
   - Используется Connection System через `prometheusRules.ts`
   - Правило автоматически определяет порт метрик компонента через ServiceDiscovery

---

## ✅ Новые улучшения (текущая сессия) - Connection System

### Умная система автоматического обновления конфигов

**Вместо хардкода** для каждой пары компонентов реализована **декларативная система правил** (rules-based system).

#### Архитектура:

1. **ServiceDiscovery** - автоматическое разрешение имен и портов компонентов
   - Автоматически определяет хост из label/ID компонента
   - Автоматически определяет порты (main, metrics, admin)
   - Формирует endpoints для подключения

2. **ConnectionRuleRegistry** - реестр правил подключения
   - Централизованное хранилище всех правил
   - Поиск правил по типу компонента
   - Поддержка приоритетов правил

3. **ConnectionHandler** - главный обработчик связей
   - Автоматически находит подходящие правила
   - Обновляет конфиги обоих компонентов при создании связи
   - Поддержка cleanup при удалении связи

4. **Rules** - набор правил для разных типов компонентов:
   - **Envoy Proxy** → автоматически добавляет clusters при подключении к сервисам
   - **API Gateway** → автоматически создает API endpoints
   - **Service Mesh / Istio** → автоматически добавляет сервисы в mesh
   - **NGINX / HAProxy / Traefik** → автоматически добавляет upstream/backend servers
   - **Database Clients** → автоматически обновляет connection strings
   - **Messaging Producers** → автоматически настраивает broker/topic конфиги

#### Преимущества:

- ✅ **Нет хардкода** - все правила декларативные
- ✅ **Расширяемость** - легко добавить новые правила
- ✅ **Переиспользование** - общие паттерны для похожих компонентов
- ✅ **Типобезопасность** - TypeScript проверяет типы
- ✅ **Автоматизация** - минимум ручной настройки

#### Структура файлов:

```
src/services/connection/
├── types.ts                    # Типы и интерфейсы
├── ServiceDiscovery.ts         # Разрешение имен/портов
├── ConnectionRuleRegistry.ts  # Реестр правил
├── ConnectionHandler.ts        # Обработчик связей
├── connectionHandlerInstance.ts # Singleton
├── rules/                      # Правила для компонентов
│   ├── envoyRules.ts
│   ├── apiGatewayRules.ts
│   ├── serviceMeshRules.ts
│   ├── loadBalancerRules.ts
│   ├── databaseRules.ts
│   └── messagingRules.ts
└── README.md                   # Документация
```

#### Интеграция:

- Интегрировано в `useCanvasStore.addConnection()` и `deleteConnection()`
- Автоматически срабатывает при создании/удалении связей
- Обновляет конфиги компонентов без ручного вмешательства

---

## ✅ Новые улучшения (текущая сессия) - Валидация портов и хостов

### Система валидации портов и хостов

Реализована система валидации для предотвращения ошибок при вводе портов и хостов в компонентах.

#### Архитектура:

1. **Утилиты валидации** (`src/utils/validation.ts`):
   - `validatePort()` - проверка диапазона 1-65535
   - `validateHost()` - проверка формата hostname (RFC 1123)
   - `validateHostPort()` - проверка формата `host:port`
   - `checkPortConflict()` - проверка конфликтов `host:port` между компонентами
   - `getPortValidationError()` - сообщения об ошибках порта
   - `getHostValidationError()` - сообщения об ошибках хоста

2. **Хук для валидации** (`src/hooks/usePortValidation.ts`):
   - Переиспользуемый хук для компонентов
   - Автоматическая валидация при изменении host/port
   - Проверка конфликтов портов в реальном времени

3. **Интеграция в компоненты**:
   - ✅ PostgreSQLConfigAdvanced
   - ✅ DatabaseConfig
   - ✅ DatabaseConfigAdvanced
   - ✅ RabbitMQConfigAdvanced
   - ✅ MongoDBConfigAdvanced
   - ✅ ClickHouseConfigAdvanced

#### Что проверяется:

1. **Формат порта** - должен быть в диапазоне 1-65535
2. **Формат хоста** - корректный hostname (RFC 1123)
3. **Конфликты портов** - предупреждение, если два компонента с одинаковым label используют один `host:port`

#### Визуальные индикаторы:

- Красная рамка у полей с ошибками
- Сообщения об ошибках под полями
- Предупреждения о конфликтах (желтый цвет)
- Не блокирует работу - только предупреждения

#### Преимущества:

- ✅ Предотвращение ошибок на этапе ввода
- ✅ Лучший UX - пользователь сразу видит ошибки
- ✅ Предотвращение проблем в Connection System
- ✅ Защита от некорректных конфигов
- ✅ Не ломает существующую функциональность

---

## ✅ Новые улучшения (текущая сессия) - Обработка ошибок и улучшение UX

### Система обработки ошибок и toast-уведомлений

Реализована система для улучшения пользовательского опыта и обработки ошибок.

#### Архитектура:

1. **Утилиты toast-уведомлений** (`src/utils/toast.ts`):
   - `showSuccess()` - успешные операции
   - `showError()` - ошибки
   - `showInfo()` - информационные сообщения
   - `showWarning()` - предупреждения
   - `showSaveSuccess()` - успешное сохранение
   - `showSaveError()` - ошибка сохранения
   - `showValidationError()` - ошибки валидации

2. **Исправлена обработка ошибок**:
   - ✅ MongoDBConfigAdvanced - JSON парсинг показывает ошибки через toast (3 места, заменен alert на toast)
   - ✅ PrometheusConfigAdvanced - JSON парсинг показывает ошибки (4 места)
   - ✅ KongConfigAdvanced - JSON парсинг показывает ошибки
   - ✅ RedisConfigAdvanced - улучшена обработка ошибок (добавлено предупреждение с fallback на строку)
   - ✅ Заменены все `catch {}` на показ ошибок пользователю
   - ✅ Заменен `alert()` на toast-уведомления
   - ✅ Полная проверка всех компонентов: все 9 использований `JSON.parse` имеют обработку ошибок

3. **Toast-уведомления для важных действий**:
   - ✅ Создание таблиц, схем, представлений, ролей
   - ✅ Удаление таблиц, колонок
   - ✅ Добавление колонок
   - ✅ Ошибки валидации JSON

4. **Disabled состояния для кнопок**:
   - ✅ Create Table - disabled при пустом имени
   - ✅ Удаление колонок - disabled если это последняя колонка
   - ✅ Удаление колонок в форме создания - disabled если это последняя колонка

#### Преимущества:

- ✅ Пользователь видит ошибки сразу
- ✅ Обратная связь для важных действий
- ✅ Предотвращение ошибок через disabled состояния
- ✅ Лучший UX - понятно что происходит

---

## ✅ Новые улучшения (текущая сессия) - Валидация обязательных полей

### Система валидации обязательных полей

Реализована система валидации обязательных полей для компонентов с подключениями к базам данных и сервисам.

#### Архитектура:

1. **Утилиты валидации** (`src/utils/requiredFields.ts`):
   - `validateRequiredFields()` - валидация обязательных полей
   - `getFieldError()` - получение ошибки для поля
   - `hasValidationErrors()` - проверка наличия ошибок
   - Поддержка кастомных валидаторов

2. **Визуальные индикаторы**:
   - Красная звездочка (*) для обязательных полей
   - Красная рамка у полей с ошибками
   - Сообщения об ошибках под полями
   - Валидация в реальном времени (onBlur)

3. **Интеграция в компоненты**:
   - ✅ PostgreSQLConfigAdvanced - host, port, database, username
   - ✅ MongoDBConfigAdvanced - host, port, database
   - ✅ RedisConfigAdvanced - host, port
   - ✅ ClickHouseConfigAdvanced - host, port, database
   - ✅ DatabaseConfig - host, port, database
   - ✅ RabbitMQConfigAdvanced - host, port

4. **Кнопки валидации**:
   - "Сохранить настройки" - валидация перед сохранением
   - "Проверить подключение" - валидация параметров подключения
   - Toast-уведомления об успехе/ошибке

#### Преимущества:

- ✅ Предотвращение ошибок - пользователь видит обязательные поля
- ✅ Лучший UX - понятная обратная связь
- ✅ Валидация в реальном времени - ошибки показываются сразу
- ✅ Не блокирует работу - только предупреждения
- ✅ Работает вместе с валидацией портов/хостов

---

## Осталось сделать

1. ✅ Автоматическая интеграция Prometheus (Этап 3) - **ВЫПОЛНЕНО** (через Connection System)
2. ❌ Динамическая связь Grafana с Prometheus (Этап 4) - **СКИПНУТО**
3. ✅ Валидация портов и хостов (Этап 5) - **ВЫПОЛНЕНО**
4. ✅ Автоматическое обновление конфигов при создании связей (Этап 6) - **ВЫПОЛНЕНО** (через Connection System)
5. ✅ Обработка ошибок и улучшение UX (Этап 7) - **ВЫПОЛНЕНО** (частично)
6. ⚠️ Business/ML/DevOps компоненты (опционально - 12 файлов)
7. ✅ Стандартизация UI компонентов - **ВЫПОЛНЕНО** (частично - заменен нативный select)
8. ✅ Валидация обязательных полей - **ВЫПОЛНЕНО** (8 компонентов)
9. ✅ Улучшение форм создания элементов - **ВЫПОЛНЕНО** (частично - 4 компонента)

---

## Файлы изменены

### Оптимизация групп:
- `src/components/canvas/ComponentGroup.tsx` - адаптивные размеры, оптимизация drag and drop
- `src/store/useCanvasStore.ts` - добавлен метод `updateNodes` и `setGroupDragging`
- `src/components/canvas/CanvasNode.tsx` - добавлен `data-node-id` для идентификации в DOM

### Connection System (умная система правил):
- `src/services/connection/types.ts` - типы и интерфейсы для правил
- `src/services/connection/ServiceDiscovery.ts` - автоматическое разрешение имен и портов
- `src/services/connection/ConnectionRuleRegistry.ts` - реестр правил подключения
- `src/services/connection/ConnectionHandler.ts` - главный обработчик связей
- `src/services/connection/connectionHandlerInstance.ts` - singleton instance
- `src/services/connection/rules/envoyRules.ts` - правила для Envoy Proxy
- `src/services/connection/rules/apiGatewayRules.ts` - правила для API Gateway
- `src/services/connection/rules/serviceMeshRules.ts` - правила для Service Mesh/Istio
- `src/services/connection/rules/loadBalancerRules.ts` - правила для NGINX/HAProxy/Traefik
- `src/services/connection/rules/databaseRules.ts` - правила для Database клиентов
- `src/services/connection/rules/messagingRules.ts` - правила для Messaging producers
- `src/services/connection/rules/index.ts` - инициализация всех правил
- `src/services/connection/index.ts` - экспорты
- `src/services/connection/README.md` - документация
- `src/store/useCanvasStore.ts` - интеграция ConnectionHandler в addConnection/deleteConnection

### Валидация портов и хостов:
- `src/utils/validation.ts` - утилиты валидации (validatePort, validateHost, checkPortConflict)
- `src/hooks/usePortValidation.ts` - переиспользуемый хук для валидации
- `src/components/config/data/PostgreSQLConfigAdvanced.tsx` - добавлена валидация
- `src/components/config/DatabaseConfig.tsx` - добавлена валидация
- `src/components/config/DatabaseConfigAdvanced.tsx` - добавлена валидация
- `src/components/config/RabbitMQConfigAdvanced.tsx` - добавлена валидация
- `src/components/config/data/MongoDBConfigAdvanced.tsx` - добавлена валидация
- `src/components/config/data/ClickHouseConfigAdvanced.tsx` - добавлена валидация

### Обработка ошибок и UX:
- `src/utils/toast.ts` - утилиты для toast-уведомлений
- `src/hooks/useConfigUpdate.ts` - хук для обновления конфигов с toast (создан, но не используется везде)
- `src/components/config/data/MongoDBConfigAdvanced.tsx` - исправлена обработка ошибок JSON парсинга (3 места, заменен alert на toast)
- `src/components/config/observability/PrometheusConfigAdvanced.tsx` - исправлена обработка ошибок JSON парсинга (4 места)
- `src/components/config/integration/KongConfigAdvanced.tsx` - исправлена обработка ошибок JSON парсинга
- `src/components/config/data/PostgreSQLConfigAdvanced.tsx` - добавлены toast уведомления и disabled состояния
- `src/components/config/data/RedisConfigAdvanced.tsx` - улучшена обработка ошибок JSON парсинга (добавлено предупреждение с fallback)
- `src/components/config/shared/ProfileConfigRenderer.tsx` - заменен нативный `<select>` на UI-компонент `Select`
- `src/components/config/edge/APIGatewayConfigAdvanced.tsx` - добавлена форма создания API с валидацией
- `src/components/config/data/MongoDBConfigAdvanced.tsx` - улучшена форма создания коллекций
- `src/components/config/data/ClickHouseConfigAdvanced.tsx` - улучшена форма создания таблиц

### Валидация обязательных полей:
- `src/utils/requiredFields.ts` - утилиты для валидации обязательных полей
- `src/components/config/data/PostgreSQLConfigAdvanced.tsx` - валидация обязательных полей (host, port, database, username)
- `src/components/config/data/MongoDBConfigAdvanced.tsx` - валидация обязательных полей (host, port, database)
- `src/components/config/data/RedisConfigAdvanced.tsx` - валидация обязательных полей (host, port)
- `src/components/config/data/ClickHouseConfigAdvanced.tsx` - валидация обязательных полей (host, port, database)
- `src/components/config/DatabaseConfig.tsx` - валидация обязательных полей (host, port, database)
- `src/components/config/RabbitMQConfigAdvanced.tsx` - валидация обязательных полей (host, port)
- `src/components/config/KafkaConfigAdvanced.tsx` - валидация обязательных полей (brokers - массив host:port)
- `src/components/config/data/ElasticsearchConfigAdvanced.tsx` - валидация обязательных полей (nodes - массив host:port)

**Статистика обработки ошибок:**
- Всего использований `JSON.parse`: 9
- Все имеют обработку ошибок: 9/9 ✅
- Используют `showError`: 8
- Используют `showWarning` (с fallback): 1
- Заменено `alert()` на toast: 1

### Исправленные компоненты:
- `src/components/config/edge/APIGatewayConfigAdvanced.tsx`
- `src/components/config/edge/ServiceMeshConfigAdvanced.tsx`
- `src/components/config/edge/VPNConfigAdvanced.tsx`
- `src/components/config/edge/CDNConfigAdvanced.tsx`
- `src/components/config/edge/IstioConfigAdvanced.tsx`
- `src/components/config/infrastructure/EnvoyConfigAdvanced.tsx`
- `src/components/config/infrastructure/TraefikConfigAdvanced.tsx`
- `src/components/config/infrastructure/HAProxyConfigAdvanced.tsx`
- `src/components/config/security/FirewallConfigAdvanced.tsx`
- `src/components/config/api/WebhookConfigAdvanced.tsx`
- `src/components/config/api/WebSocketConfigAdvanced.tsx`
- `src/components/config/api/SOAPConfigAdvanced.tsx`
- `src/components/config/api/GraphQLConfigAdvanced.tsx`
- `src/components/config/api/GRPCConfigAdvanced.tsx`
- `src/components/config/integration/GraphQLGatewayConfigAdvanced.tsx`
- `src/components/config/integration/BFFServiceConfigAdvanced.tsx`
- `src/components/config/integration/WebhookRelayConfigAdvanced.tsx`
- `src/components/config/data/PostgreSQLConfigAdvanced.tsx`
- `src/components/config/data/RedisConfigAdvanced.tsx`
- `src/components/config/messaging/AWSSQSConfigAdvanced.tsx`

### Обновленные файлы анализа:
- `ANALYSIS_REPORT.md`
- `UI_FUNCTIONALITY_ANALYSIS.md`

---

## Тестирование

Рекомендуется протестировать:
1. ✅ Сохранение настроек в Settings секциях всех исправленных компонентов
2. ✅ Отображение портов метрик в UI
3. ✅ Переключение enableMetricsExport
4. ✅ Изменение портов и путей метрик

---

## Breaking Changes

Нет breaking changes. Все изменения обратно совместимы.

---

## Примечания

- Все изменения сохраняют обратную совместимость
- Значения по умолчанию остаются теми же
- Новые поля опциональны (используют `??` для значений по умолчанию)

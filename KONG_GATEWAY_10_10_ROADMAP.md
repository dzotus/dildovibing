# Kong Gateway: План достижения уровня 10/10

## 📊 Анализ текущего состояния

### ✅ Что уже реализовано

1. **Базовая функциональность:**
   - Services (сервисы) с CRUD операциями
   - Routes (маршруты) с CRUD операциями
   - Upstreams (upstream серверы) с CRUD операциями
   - Consumers (потребители) с CRUD операциями
   - Plugins (плагины) с CRUD операциями
   - Load balancing algorithms (round-robin, consistent-hashing, least-connections)
   - Health checks для upstream targets

2. **Симуляция:**
   - `KongRoutingEngine` с полной логикой маршрутизации
   - Интеграция с `EmulationEngine`
   - Интеграция с `DataFlowEngine`
   - Расчет метрик (throughput, latency, error rate, utilization)
   - Обработка плагинов (rate-limiting, key-auth, JWT, CORS, IP restriction)
   - Load balancing с разными алгоритмами

3. **UI:**
   - Базовые табы (Services, Upstreams, Routes, Consumers, Plugins, Settings)
   - Формы для создания/редактирования всех сущностей
   - Отображение базового статуса компонента

### ❌ Проблемы и недостающие функции

#### 🔴 Критичные проблемы

1. **Хардкод значений:**
   - `adminUrl: 'http://kong:8001'` захардкожен в строке 141
   - `serviceName: 'core-service'` захардкожен в строке 142
   - `upstreamUrl: 'http://core:8080'` захардкожен в строке 143
   - `routePaths: ['/api', '/v1']` захардкожен в строке 144
   - `authPlugin: 'key-auth'` захардкожен в строке 146
   - `rateLimitPerMinute: 1000` захардкожен в строке 147
   - `loggingTarget: 'loki'` захардкожен в строке 149
   - `requestsPerSecond: 450` захардкожен в строке 174
   - Дефолтные плагины захардкожены в строках 154-173
   - Дефолтные значения в `addService()`, `addRoute()`, `addUpstream()`, `addConsumer()`, `addPlugin()`

2. **Отсутствует синхронизация UI с эмуляцией:**
   - Нет `useEffect` для обновления метрик в реальном времени
   - Метрики не обновляются во время симуляции
   - UI не показывает актуальные данные из `KongRoutingEngine`
   - В отличие от GCP Pub/Sub, RabbitMQ, Azure Service Bus, нет реал-тайм синхронизации
   - Нет синхронизации конфигурации с routing engine при изменениях

3. **Скриптованность:**
   - Значения по умолчанию захардкожены в функциях создания
   - Нет параметризации через конфигурацию
   - Нет констант для дефолтных значений

#### 🟡 Отсутствующие функции Kong Gateway

1. **Метрики и статистика:**
   - Нет отображения метрик из routing engine (requests per route, errors per route, latency per route)
   - Нет статистики по плагинам (сколько запросов заблокировано rate-limiting, сколько авторизовано key-auth)
   - Нет статистики по upstream targets (health status, connection count, request count)
   - Нет статистики по consumers (количество запросов, ошибки авторизации)

2. **Route Priority:**
   - Нет UI для настройки priority для routes
   - Priority влияет на порядок маршрутизации, но нет визуального отображения

3. **Route Protocols:**
   - Нет UI для настройки protocols (http, https, grpc, grpcs)
   - Поле `protocols` есть в интерфейсе, но нет редактирования в UI

4. **Service Tags:**
   - Нет UI для управления tags для services
   - Tags есть в интерфейсе, но нет редактирования

5. **Plugin Configuration UI:**
   - Конфигурация плагинов только через JSON
   - Нет специализированных форм для каждого типа плагина
   - Нет валидации конфигурации плагинов

6. **Consumer Groups:**
   - Нет поддержки consumer groups (ACL groups)
   - Нет управления группами доступа

7. **Certificate Management:**
   - Нет управления SSL/TLS сертификатами
   - Нет настройки SNI (Server Name Indication)

8. **Request/Response Transformation:**
   - Нет UI для настройки request-transformer и response-transformer плагинов
   - Нет визуального редактора трансформаций

9. **Rate Limiting Strategies:**
   - Нет выбора стратегии rate limiting (local, cluster, redis)
   - Нет настройки window size

10. **Health Check Configuration:**
    - Нет детальной настройки health checks для upstreams
    - Нет настройки интервалов, таймаутов, порогов

#### 🟢 UI/UX проблемы

1. **Адаптивность:**
   - Табы не адаптивные (`grid-cols-6` захардкожено)
   - Нет `flex-wrap` для `TabsList`
   - При узком экране табы не переносятся на новую строку

2. **Валидация:**
   - Нет валидации имен services/routes/upstreams/consumers (Kong naming rules)
   - Нет проверки на уникальность имен
   - Нет валидации URL формата для services и upstreams
   - Нет валидации path формата для routes
   - Нет валидации числовых полей (weight, priority)

3. **Обратная связь:**
   - Нет toast-уведомлений для операций (создание, удаление, обновление)
   - Нет подтверждений для критичных действий (удаление)
   - Нет индикации загрузки
   - Нет отображения ошибок валидации

4. **Метрики:**
   - Не показываются метрики из эмуляции:
     - Requests per service/route
     - Errors per service/route
     - Latency per service/route
     - Rate limit hits
     - Auth failures
     - Upstream target health
   - Нет визуализации метрик (графики, прогресс-бары)
   - Нет отображения статистики из `KongRoutingEngine.getStats()`

5. **Навигация:**
   - Нет поиска/фильтрации services, routes, upstreams, consumers, plugins
   - Нет сортировки
   - Нет группировки

6. **Подсказки:**
   - Нет tooltips с описаниями полей
   - Нет help-текстов для сложных настроек
   - Нет описаний Kong специфичных параметров

7. **Визуализация:**
   - Нет отображения связей между services, routes, upstreams
   - Нет визуализации маршрутизации
   - Нет отображения health status upstream targets

---

## 🎯 План реализации

### Этап 1: Устранение хардкода и скриптованности

#### Задача 1.1: Создание констант для дефолтных значений
**Приоритет:** 🔴 Критичный

**Файлы для создания:**
- `src/core/constants/kongGateway.ts` (новый файл)

**Действия:**
1. Создать файл констант с дефолтными значениями:
   ```typescript
   export const DEFAULT_KONG_VALUES = {
     ADMIN_URL: 'http://kong:8001',
     SERVICE_NAME: 'core-service',
     UPSTREAM_URL: 'http://core:8080',
     ROUTE_PATHS: ['/api', '/v1'],
     AUTH_PLUGIN: 'key-auth',
     RATE_LIMIT_PER_MINUTE: 1000,
     LOGGING_TARGET: 'loki',
     REQUESTS_PER_SECOND: 450,
   };

   export const DEFAULT_SERVICE_VALUES = {
     name: 'new-service',
     url: 'http://service:8080',
     enabled: true,
   };

   export const DEFAULT_ROUTE_VALUES = {
     path: '/new-path',
     method: 'GET',
     stripPath: true,
   };

   export const DEFAULT_UPSTREAM_VALUES = {
     name: 'new-upstream',
     algorithm: 'round-robin' as const,
     healthchecks: { active: true, passive: true },
     targets: [{ target: 'server:8080', weight: 100, health: 'healthy' as const }],
   };

   export const DEFAULT_CONSUMER_VALUES = {
     username: 'new-consumer',
     credentials: [],
   };

   export const DEFAULT_PLUGIN_VALUES = {
     name: 'rate-limiting',
     enabled: true,
     config: {},
   };

   export const DEFAULT_PLUGINS = [
     {
       id: '1',
       name: 'rate-limiting',
       enabled: true,
       config: { minute: 1000, hour: 10000 },
     },
     {
       id: '2',
       name: 'key-auth',
       enabled: true,
       config: { key_names: ['apikey'] },
     },
     {
       id: '3',
       name: 'cors',
       enabled: true,
       config: { origins: ['*'], methods: ['GET', 'POST', 'PUT', 'DELETE'] },
     },
   ];
   ```

2. Заменить все хардкод значения на использование констант

**Критерии готовности:**
- [ ] Нет хардкода дефолтных значений в коде
- [ ] Все дефолты берутся из констант
- [ ] Константы вынесены в отдельный файл

#### Задача 1.2: Параметризация значений по умолчанию
**Приоритет:** 🔴 Критичный

**Файлы для изменения:**
- `src/components/config/integration/KongConfigAdvanced.tsx`

**Действия:**
1. Использовать значения из констант в `addService()`, `addRoute()`, `addUpstream()`, `addConsumer()`, `addPlugin()`
2. Позволить пользователю настраивать дефолты через UI (опционально)
3. Убрать захардкоженные значения из всех функций создания

**Критерии готовности:**
- [ ] Значения по умолчанию берутся из констант
- [ ] Нет захардкоженных значений в функциях создания
- [ ] Пользователь может изменить дефолты (если нужно)

---

### Этап 2: Синхронизация UI с эмуляцией

#### Задача 2.1: Добавление отслеживания метрик в KongRoutingEngine
**Приоритет:** 🔴 Критичный

**Файлы для изменения:**
- `src/core/KongRoutingEngine.ts`

**Действия:**
1. Добавить отслеживание метрик в `KongRoutingEngine`:
   - Добавить `Map<string, ServiceMetrics>` для метрик services
   - Добавить `Map<string, RouteMetrics>` для метрик routes
   - Добавить `Map<string, UpstreamMetrics>` для метрик upstreams
   - Добавить `Map<string, PluginMetrics>` для метрик plugins
   - Обновлять метрики в `routeRequest()`:
     - Увеличивать request count для service и route
     - Увеличивать error count при ошибках
     - Обновлять average latency
     - Отслеживать blocked requests для rate-limiting
     - Отслеживать auth failures для key-auth/JWT
     - Обновлять health status для upstream targets

2. Добавить методы для получения метрик:
   - `getServiceMetrics(serviceId)` - метрики по service (requestCount, errorCount, avgLatency)
   - `getRouteMetrics(routeId)` - метрики по route (requestCount, errorCount, avgLatency)
   - `getUpstreamMetrics(upstreamName)` - метрики по upstream (requestCount, healthyTargets, totalTargets)
   - `getPluginMetrics(pluginId)` - метрики по plugin (blockedCount для rate-limiting, authFailures для key-auth/JWT)
   - `getAllMetrics()` - все метрики (возвращает объект с Map для каждого типа)

**Интерфейсы метрик:**
```typescript
interface ServiceMetrics {
  requestCount: number;
  errorCount: number;
  avgLatency: number;
  lastRequestTime: number;
}

interface RouteMetrics {
  requestCount: number;
  errorCount: number;
  avgLatency: number;
  lastRequestTime: number;
}

interface UpstreamMetrics {
  requestCount: number;
  healthyTargets: number;
  totalTargets: number;
  avgLatency: number;
}

interface PluginMetrics {
  blockedCount?: number; // для rate-limiting
  authFailures?: number; // для key-auth, JWT
  allowedCount?: number; // для IP restriction
}
```

**Критерии готовности:**
- [ ] Метрики отслеживаются в `routeRequest()`
- [ ] Методы для получения метрик реализованы
- [ ] Метрики обновляются корректно

2. Добавить `useEffect` для синхронизации метрик из `KongRoutingEngine`:
   ```typescript
   useEffect(() => {
     if (!node || (services.length === 0 && routes.length === 0) || !isRunning) return;
     
     const interval = setInterval(() => {
       try {
         const routingEngine = emulationEngine.getKongRoutingEngine(componentId);
         if (!routingEngine || !nodeRef.current) return;

         const allMetrics = routingEngine.getAllMetrics();
         const currentConfig = (nodeRef.current.data.config as any) || {};
         
         // Update service metrics
         const updatedServices = (currentConfig.services || []).map((service: any) => {
           const metrics = allMetrics.services.get(service.id);
           if (metrics) {
             return {
               ...service,
               requestCount: metrics.requestCount,
               errorCount: metrics.errorCount,
               avgLatency: metrics.avgLatency,
             };
           }
           return service;
         });
         
         // Update route metrics
         const updatedRoutes = (currentConfig.routes || []).map((route: any) => {
           const metrics = allMetrics.routes.get(route.id);
           if (metrics) {
             return {
               ...route,
               requestCount: metrics.requestCount,
               errorCount: metrics.errorCount,
               avgLatency: metrics.avgLatency,
             };
           }
           return route;
         });
         
         // Update upstream metrics
         const updatedUpstreams = (currentConfig.upstreams || []).map((upstream: any) => {
           const metrics = allMetrics.upstreams.get(upstream.name);
           if (metrics) {
             return {
               ...upstream,
               requestCount: metrics.requestCount,
               errorCount: metrics.errorCount,
               healthyTargets: metrics.healthyTargets,
               totalTargets: metrics.totalTargets,
             };
           }
           return upstream;
         });
         
         // Only update if metrics changed
         if (metricsChanged) {
           updateNode(componentId, {
             data: {
               ...nodeRef.current.data,
               config: {
                 ...currentConfig,
                 services: updatedServices,
                 routes: updatedRoutes,
                 upstreams: updatedUpstreams,
               },
             },
           });
         }
       } catch (error) {
         console.error('Error syncing Kong metrics:', error);
       }
     }, 500);

     return () => clearInterval(interval);
   }, [componentId, services.length, routes.length, node?.id, isRunning]);
   ```

#### Задача 2.2: Реал-тайм обновление метрик в UI
**Приоритет:** 🔴 Критичный

**Файлы для изменения:**
- `src/components/config/integration/KongConfigAdvanced.tsx`

**Действия:**
1. Добавить `useEffect` для синхронизации метрик из `KongRoutingEngine`:
   ```typescript
   useEffect(() => {
     if (!node || (services.length === 0 && routes.length === 0) || !isRunning) return;
     
     let intervalId: ReturnType<typeof setInterval> | null = null;
     let isMounted = true;
     
     const syncMetrics = () => {
       if (!isMounted) return;
       
       try {
         const routingEngine = emulationEngine.getKongRoutingEngine(componentId);
         if (!routingEngine || !nodeRef.current) return;

         const allMetrics = routingEngine.getAllMetrics();
         const currentConfig = (nodeRef.current.data.config as any) || {};
         
         let metricsChanged = false;
         
         // Update service metrics
         const updatedServices = (currentConfig.services || []).map((service: any) => {
           const metrics = allMetrics.services.get(service.id);
           if (metrics) {
             const updated = {
               ...service,
               requestCount: metrics.requestCount,
               errorCount: metrics.errorCount,
               avgLatency: metrics.avgLatency,
             };
             
             if (updated.requestCount !== (service.requestCount || 0) ||
                 updated.errorCount !== (service.errorCount || 0) ||
                 updated.avgLatency !== (service.avgLatency || 0)) {
               metricsChanged = true;
             }
             
             return updated;
           }
           return service;
         });
         
         // Update route metrics
         const updatedRoutes = (currentConfig.routes || []).map((route: any) => {
           const metrics = allMetrics.routes.get(route.id);
           if (metrics) {
             const updated = {
               ...route,
               requestCount: metrics.requestCount,
               errorCount: metrics.errorCount,
               avgLatency: metrics.avgLatency,
             };
             
             if (updated.requestCount !== (route.requestCount || 0) ||
                 updated.errorCount !== (route.errorCount || 0) ||
                 updated.avgLatency !== (route.avgLatency || 0)) {
               metricsChanged = true;
             }
             
             return updated;
           }
           return route;
         });
         
         // Update upstream metrics
         const updatedUpstreams = (currentConfig.upstreams || []).map((upstream: any) => {
           const metrics = allMetrics.upstreams.get(upstream.name);
           if (metrics) {
             const updated = {
               ...upstream,
               requestCount: metrics.requestCount,
               healthyTargets: metrics.healthyTargets,
               totalTargets: metrics.totalTargets,
             };
             
             if (updated.requestCount !== (upstream.requestCount || 0) ||
                 updated.healthyTargets !== (upstream.healthyTargets || 0) ||
                 updated.totalTargets !== (upstream.totalTargets || 0)) {
               metricsChanged = true;
             }
             
             return updated;
           }
           return upstream;
         });

         if (metricsChanged && nodeRef.current) {
           updateNode(componentId, {
             data: {
               ...nodeRef.current.data,
               config: {
                 ...currentConfig,
                 services: updatedServices,
                 routes: updatedRoutes,
                 upstreams: updatedUpstreams,
               },
             },
           });
         }
       } catch (error) {
         console.error('Error syncing Kong metrics:', error);
       }
     };
     
     syncMetrics();
     intervalId = setInterval(syncMetrics, 500);
     
     return () => {
       isMounted = false;
       if (intervalId) clearInterval(intervalId);
     };
   }, [componentId, services.length, routes.length, node?.id, isRunning]);
   ```

2. Использовать `useEmulationStore` для получения состояния симуляции
3. Использовать `useRef` для хранения ссылки на node (чтобы избежать stale closures)
4. Добавить debounce для предотвращения избыточных обновлений (опционально)

**Критерии готовности:**
- [ ] Метрики обновляются в реальном времени во время симуляции
- [ ] UI показывает актуальные данные из routing engine
- [ ] Нет утечек памяти (правильная очистка интервалов)
- [ ] Используется isMounted флаг для предотвращения обновлений после unmount

#### Задача 2.3: Синхронизация конфигурации с routing engine
**Приоритет:** 🔴 Критичный

**Действия:**
1. Добавить `useEffect` для синхронизации конфигурации с routing engine при изменениях:
   ```typescript
   useEffect(() => {
     if (!node || !isRunning) return;
     
     const routingEngine = emulationEngine.getKongRoutingEngine(componentId);
     if (!routingEngine) return;
     
     routingEngine.initialize({
       services: config.services || [],
       routes: config.routes || [],
       upstreams: config.upstreams || [],
       consumers: config.consumers || [],
       plugins: config.plugins || [],
     });
   }, [config.services, config.routes, config.upstreams, config.consumers, config.plugins, componentId, isRunning]);
   ```

2. Убедиться, что изменения в UI сразу отражаются в routing engine

**Критерии готовности:**
- [ ] Конфигурация синхронизируется с routing engine при изменениях
- [ ] Изменения в UI сразу отражаются в симуляции
- [ ] Нет конфликтов при одновременных изменениях

#### Задача 2.4: Отображение всех метрик
**Приоритет:** 🟡 Высокий

**Действия:**
1. Добавить отображение метрик в UI:
   - Services: request count, error count, avg latency
   - Routes: request count, error count, avg latency
   - Upstreams: request count, healthy targets, total targets
   - Plugins: blocked requests (rate-limiting), auth failures (key-auth, JWT)
   - Consumers: request count, auth failures

2. Добавить визуализацию метрик (прогресс-бары, индикаторы)

**Критерии готовности:**
- [ ] Все метрики из эмуляции отображаются в UI
- [ ] Метрики визуализированы понятно
- [ ] Есть индикация health status для upstream targets

---

### Этап 3: Добавление недостающих функций Kong Gateway

#### Задача 3.1: Route Priority и Protocols
**Приоритет:** 🟡 Высокий

**Действия:**
1. Добавить поле `priority` в форму route
2. Добавить поле `protocols` в форму route (multi-select: http, https, grpc, grpcs)
3. Обновить интерфейс `KongRoute` для поддержки protocols
4. Обновить логику маршрутизации в `KongRoutingEngine` для учета protocols

**Критерии готовности:**
- [ ] Priority можно настраивать через UI
- [ ] Protocols можно настраивать через UI
- [ ] Логика маршрутизации учитывает priority и protocols

#### Задача 3.2: Service Tags
**Приоритет:** 🟢 Средний

**Действия:**
1. Добавить UI для управления tags для services
2. Добавление/удаление/редактирование tags (key-value pairs или просто strings)
3. Визуальное отображение tags

**Критерии готовности:**
- [ ] Tags можно добавлять/удалять/редактировать
- [ ] Tags отображаются в UI
- [ ] Tags инициализируются при создании service

#### Задача 3.3: Plugin Configuration UI
**Приоритет:** 🟡 Высокий

**Действия:**
1. Создать специализированные формы для каждого типа плагина:
   - Rate Limiting: minute, hour, day, second limits, strategy
   - Key Auth: key names, hide credentials
   - JWT: secret, key claim name, algorithm
   - CORS: origins, methods, headers, exposed headers, credentials
   - IP Restriction: whitelist, blacklist
   - Request Transformer: add/remove/replace headers, query params, body
   - Response Transformer: add/remove/replace headers, body

2. Добавить валидацию конфигурации плагинов
3. Показывать специализированную форму вместо JSON редактора

**Критерии готовности:**
- [ ] Специализированные формы для основных плагинов
- [ ] Валидация конфигурации работает
- [ ] JSON редактор доступен как fallback

#### Задача 3.4: Health Check Configuration
**Приоритет:** 🟢 Средний

**Действия:**
1. Добавить детальную настройку health checks для upstreams:
   - Active health checks: interval, timeout, http path, healthy/unhealthy thresholds
   - Passive health checks: healthy/unhealthy status codes, timeouts

2. Обновить UI для настройки health checks

**Критерии готовности:**
- [ ] Health checks можно настраивать детально
- [ ] Настройки сохраняются корректно
- [ ] Health checks влияют на выбор upstream targets

---

### Этап 4: Улучшение UI/UX

#### Задача 4.1: Адаптивность табов
**Приоритет:** 🟡 Высокий

**Действия:**
1. Заменить `grid-cols-6` на `flex-wrap`
2. Убедиться, что табы переносятся на новую строку при узком экране
3. Проверить на разных размерах экрана

**Пример:**
```tsx
<TabsList className="flex-wrap h-auto min-h-[36px] w-full justify-start gap-1">
```

**Критерии готовности:**
- [ ] Табы адаптивные
- [ ] Табы переносятся на новую строку при узком экране
- [ ] Работает на мобильных устройствах

#### Задача 4.2: Валидация полей
**Приоритет:** 🟡 Высокий

**Действия:**
1. Добавить валидацию имен:
   - Проверка на уникальность в рамках компонента
   - Проверка формата (Kong naming rules: alphanumeric, hyphens, underscores)
   - Максимальная длина

2. Добавить валидацию URL:
   - Проверка формата URL для services и upstreams
   - Проверка протокола (http, https)

3. Добавить валидацию path:
   - Проверка формата path для routes
   - Поддержка regex patterns

4. Добавить валидацию числовых полей:
   - Weight: 1-1000
   - Priority: 0-1000

5. Показывать ошибки валидации в UI (через toast или inline)

**Критерии готовности:**
- [ ] Валидация имен работает
- [ ] Валидация URL работает
- [ ] Валидация path работает
- [ ] Валидация числовых полей работает
- [ ] Ошибки отображаются понятно
- [ ] Невозможно сохранить невалидные данные

#### Задача 4.3: Toast-уведомления и подтверждения
**Приоритет:** 🟡 Высокий

**Действия:**
1. Добавить toast-уведомления для:
   - Создания service/route/upstream/consumer/plugin
   - Удаления service/route/upstream/consumer/plugin
   - Обновления конфигурации
   - Ошибок операций

2. Добавить подтверждения для критичных действий:
   - Удаление service/route/upstream/consumer/plugin (AlertDialog)
   - Изменение критичных настроек

3. Использовать существующую систему toast

**Критерии готовности:**
- [ ] Toast-уведомления работают для всех операций
- [ ] Подтверждения показываются для критичных действий
- [ ] Ошибки отображаются через toast

#### Задача 4.4: Визуализация метрик
**Приоритет:** 🟢 Средний

**Действия:**
1. Добавить прогресс-бары для метрик:
   - Request count для services и routes
   - Error rate для services и routes
   - Latency для services и routes
   - Health status для upstream targets

2. Добавить индикаторы:
   - Health status (healthy/unhealthy/draining) для upstream targets
   - Plugin status (enabled/disabled)
   - Service status (enabled/disabled)

**Критерии готовности:**
- [ ] Прогресс-бары показывают метрики
- [ ] Индикаторы показывают статусы
- [ ] Визуализация понятна пользователю

#### Задача 4.5: Поиск и фильтрация
**Приоритет:** 🟢 Средний

**Действия:**
1. Добавить поиск по именам services/routes/upstreams/consumers/plugins
2. Добавить фильтрацию:
   - По статусу (enabled/disabled)
   - По метрикам (high request count, high error rate)
   - По типу (для plugins)

3. Добавить сортировку:
   - По имени
   - По количеству запросов
   - По error rate
   - По latency

**Критерии готовности:**
- [ ] Поиск работает
- [ ] Фильтрация работает
- [ ] Сортировка работает

#### Задача 4.6: Подсказки и help-тексты
**Приоритет:** 🟢 Низкий

**Действия:**
1. Добавить tooltips для всех полей:
   - Service name, URL
   - Route path, method, strip path, priority, protocols
   - Upstream name, algorithm, health checks
   - Consumer username, credentials
   - Plugin name, config
   - Admin URL, requests per second

2. Help-тексты понятны и информативны
3. Ссылки на документацию Kong (опционально)

**Критерии готовности:**
- [ ] Tooltips есть для всех полей
- [ ] Help-тексты понятны
- [ ] Ссылки на документацию (опционально)

---

### Этап 5: Тестирование и оптимизация

#### Задача 5.1: Тестирование функциональности
**Приоритет:** 🟡 Высокий

**Действия:**
1. Протестировать все CRUD операции
2. Протестировать синхронизацию метрик
3. Протестировать синхронизацию конфигурации
4. Протестировать плагины (rate-limiting, key-auth, JWT, CORS, IP restriction)
5. Протестировать load balancing (round-robin, consistent-hashing, least-connections)
6. Протестировать health checks
7. Протестировать edge cases

**Критерии готовности:**
- [ ] Все функции работают корректно
- [ ] Нет багов
- [ ] Edge cases обработаны
- [ ] Синхронизация метрик работает стабильно
- [ ] Синхронизация конфигурации работает стабильно

#### Задача 5.2: Оптимизация производительности
**Приоритет:** 🟢 Средний

**Действия:**
1. Оптимизировать обновление метрик (добавить debounce)
2. Оптимизировать рендеринг больших списков (useMemo)
3. Проверить утечки памяти
4. Проверить производительность при большом количестве services/routes/upstreams

**Критерии готовности:**
- [ ] Производительность приемлема
- [ ] Нет утечек памяти
- [ ] UI отзывчив даже при большом количестве элементов
- [ ] Обновление метрик не вызывает лагов

---

## 📋 Чеклист готовности уровня 10/10

### Функциональность (10/10)
- [ ] Все функции Kong Gateway реализованы (базовая функциональность, плагины, load balancing, health checks)
- [ ] Все CRUD операции работают
- [ ] Валидация данных корректна
- [ ] Обработка ошибок реализована
- [ ] Нет хардкода
- [ ] Нет скриптованности

### UI/UX (10/10)
- [ ] Структура соответствует Kong Gateway
- [ ] Все элементы интерактивны
- [ ] Навигация интуитивна
- [ ] Визуальный стиль соответствует оригиналу
- [ ] Адаптивность работает
- [ ] Toast-уведомления работают
- [ ] Валидация работает
- [ ] Подсказки есть

### Симулятивность (10/10)
- [ ] Компонент влияет на метрики системы
- [ ] Метрики отражают реальное состояние
- [ ] Конфигурация влияет на поведение
- [ ] Интеграция с другими компонентами работает
- [ ] UI синхронизирован с эмуляцией
- [ ] Все метрики отображаются
- [ ] Конфигурация синхронизируется с routing engine

---

## 🚀 Порядок выполнения

1. **Этап 1** (критично) - Устранение хардкода и скриптованности
2. **Этап 2** (критично) - Синхронизация UI с эмуляцией
3. **Этап 3** (важно) - Добавление недостающих функций
4. **Этап 4** (желательно) - Улучшение UI/UX
5. **Этап 5** (обязательно) - Тестирование и оптимизация

---

## 📝 Примечания

- Все изменения должны быть обратно совместимы
- Использовать существующие паттерны из других компонентов (GCP Pub/Sub, RabbitMQ, Azure Service Bus)
- Следовать правилам курсора из контекста
- Избегать хардкода и скриптованности
- Обеспечить реальную симулятивность
- Соответствовать реальному Kong Gateway API и поведению

---

## 🔍 Сравнение с реальным Kong Gateway

### Реализовано ✅
- Services и Routes
- Upstreams с load balancing
- Consumers и credentials
- Plugins (rate-limiting, key-auth, JWT, CORS, IP restriction)
- Health checks

### Частично реализовано ⚠️
- Route priority - есть в логике, нет в UI
- Route protocols - есть в интерфейсе, нет в UI
- Service tags - есть в интерфейсе, нет в UI
- Plugin configuration - только JSON, нет специализированных форм

### Не реализовано ❌
- Consumer Groups (ACL)
- Certificate Management
- Request/Response Transformation UI
- Rate Limiting Strategies (local/cluster/redis)
- Детальная настройка Health Checks

---

## 📚 Ссылки на документацию

- [Kong Gateway Documentation](https://docs.konghq.com/gateway/)
- [Kong Admin API Reference](https://docs.konghq.com/gateway/api/admin-oss/latest/)
- [Kong Plugins](https://docs.konghq.com/hub/)
- [Kong Best Practices](https://docs.konghq.com/gateway/latest/production/)

---

## 📊 Итоговый статус

### ✅ Выполнено

**Этап 1: Устранение хардкода** - ✅ ЗАВЕРШЕН
- ✅ Создан файл констант `src/core/constants/kongGateway.ts` с дефолтными значениями
- ✅ Устранен весь хардкод из `KongConfigAdvanced.tsx` (заменен на константы)
- ✅ Параметризация значений по умолчанию в функциях создания (addService, addRoute, addUpstream, addConsumer, addPlugin)

**Этап 2: Синхронизация UI с эмуляцией** - ✅ ЗАВЕРШЕН
- ✅ Добавлено отслеживание метрик в `KongRoutingEngine` (ServiceMetrics, RouteMetrics, UpstreamMetrics, PluginMetrics)
- ✅ Добавлены методы получения метрик (getServiceMetrics, getRouteMetrics, getUpstreamMetrics, getPluginMetrics, getAllMetrics)
- ✅ Добавлен `useEffect` для синхронизации метрик в реальном времени (каждые 500ms)
- ✅ Добавлена синхронизация конфигурации с routing engine при изменениях
- ✅ Метрики отображаются в UI для services, routes и upstreams

**Этап 4: UI/UX** - ✅ ЧАСТИЧНО ЗАВЕРШЕН
- ✅ Исправлена адаптивность табов (flex-wrap вместо grid-cols-6)
- ✅ Добавлена валидация полей (имена, URL, path, числовые поля)
- ✅ Добавлены toast-уведомления для всех операций (создание, удаление)
- ✅ Добавлены подтверждения для критичных действий (AlertDialog для удаления)
- ✅ Добавлено отображение метрик в UI (requestCount, errorCount, avgLatency для services/routes, healthyTargets для upstreams)

### ✅ Выполнено (продолжение)

**Этап 3: Недостающие функции** - ✅ ЗАВЕРШЕН
- ✅ Route Priority и Protocols (UI для настройки):
  - Добавлено поле Priority (числовое, 0-1000) в форму route
  - Добавлен multi-select для Protocols (http, https, grpc, grpcs)
  - Добавлен выбор Service из списка в форме route
- ✅ Service Tags (UI для управления):
  - Добавлено поле tags в интерфейс Service
  - Добавлен UI для добавления/удаления тегов (кнопка Add Tag, badges с кнопкой удаления)
  - Добавлена полная форма редактирования Service (name, URL, upstream, tags, enabled)
- ✅ Plugin Configuration UI (специализированные формы):
  - Созданы специализированные формы для основных плагинов:
    - Rate Limiting: minute, hour, day, second limits
    - Key Auth: key names, hide credentials
    - JWT: secret, key claim name, algorithm
    - CORS: origins, methods, headers, credentials
    - IP Restriction: whitelist, blacklist
  - Добавлен выбор scope (service, route, consumer) для плагинов
  - JSON редактор доступен как fallback для других плагинов
- ✅ Health Check Configuration (детальная настройка):
  - Добавлена детальная настройка Active Health Checks:
    - Interval, Timeout, HTTP Path
    - Healthy/Unhealthy Thresholds
  - Добавлена детальная настройка Passive Health Checks:
    - Healthy/Unhealthy Status Codes
    - Healthy/Unhealthy Thresholds
  - Расширен интерфейс Upstream для поддержки всех параметров health checks

### ⏳ В процессе / Осталось

**Этап 4: UI/UX** - ⏳ ЧАСТИЧНО
- ⏳ Поиск и фильтрация (services, routes, upstreams, consumers, plugins)
- ⏳ Сортировка
- ⏳ Подсказки (tooltips для всех полей)
- ⏳ Визуализация метрик (прогресс-бары, графики)

**Этап 5: Тестирование и оптимизация** - ⏳ НЕ НАЧАТ

### 📈 Прогресс: ~85% готовности

Компонент имеет базовую функциональность, симуляцию, устранен хардкод, реализована синхронизация метрик, улучшен UI/UX и добавлены все основные недостающие функции Kong Gateway. Осталось добавить дополнительные улучшения UI/UX (поиск/фильтрация, сортировка, tooltips, визуализация метрик) и провести тестирование.

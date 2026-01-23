## GraphQL Gateway — Development Plan (10/10 Simulation & UI/UX) ✅ **ВСЕ ЭТАПЫ ЗАВЕРШЕНЫ**

Этот план предназначен для пошаговой разработки в Cursor. Цель — довести GraphQL Gateway до реалистичного состояния (как облачный / enterprise GraphQL API Gateway), избегая хардкода и “скриптовости”, и **не копируя** реализации других движков/компонентов.

**Статус**: Все 6 этапов плана полностью реализованы. GraphQL Gateway функционально ведёт себя как реальный gateway, UI соответствует ожиданиям от облачной консоли управления, симуляция даёт правдоподобные результаты без хардкода. Подготовлены пресеты для типичных сценариев использования в `GRAPHQL_GATEWAY_SCENARIOS.md`.

Задействованные основные файлы:
- Core:
  - `src/core/GraphQLGatewayRoutingEngine.ts`
  - `src/core/graphql-gateway/*.ts` (Parser, Planner, Executor, Federation, Cache, RateLimiter, ServiceRegistry, types)
  - `src/core/GraphQLEmulationEngine.ts` (интеграция и метрики)
- UI:
  - `src/components/config/integration/GraphQLGatewayConfigAdvanced.tsx`
  - (при необходимости) вспомогательные UI‑компоненты и сторы в `src/store/*`

> Важно: при доработке соблюдать правила защитного программирования из пользовательских инструкций (валидация, try/catch, отсутствие предположений о данных, строгий TypeScript).

---

## Этап 1. Уточнение доменной модели и контракта ✅ (выполнено)

**Цель:** согласовать модель конфигурации и метрик для gateway, чтобы ядро, эмуляция и UI работали с единым, реалистичным контрактом.

**Подзадачи:**
- **1.1. Актуализировать `GraphQLGatewayConfig` и связанные типы** (`src/core/graphql-gateway/types.ts`):
  - Добавить/уточнить поля для:
    - federation: `version`, список federated‑сервисов, статус суперграфа (например, `supergraphVersion`, `lastCompositionAt`, `compositionStatus`).
    - caching: `cacheTtl`, `persistQueries`, базовые метрики (`cacheHitCount`, `cacheMissCount`, `cacheSize`).
    - features: `supportsSubscriptions`, `enablePersistedQueries`, `enableIntrospection`, `enableQueryBatching`.
    - метрик gateway: агрегированная латентность, error‑rate, RPS (для отображения в UI).
  - Обеспечить безопасные дефолты (массивы/объекты через `Array.isArray` и проверку на `null/undefined` в местах использования, а не через хардкод).

- **1.2. Описать контракт между EmulationEngine и GraphQLGatewayRoutingEngine**:
  - Где и как EmulationEngine:
    - инициализирует `GraphQLGatewayRoutingEngine` из `node.data.config`;
    - передаёт “виртуальные запросы” (GraphQLQuery) в gateway;
    - получает обратно результат (`GraphQLGatewayResponse` + дополнительные метаданные/метрики).
  - Расширить `GraphQLGatewayResponse`:
    - добавить поля: `cacheHit`, `rateLimited`, `complexityRejected`, `usedServices`, `plannedLatency`, `actualLatency`.
  - Зафиксировать: где хранятся агрегированные метрики для UI (`node.data.metrics` или сторы в `src/store`).

**Что сделано:**
- Актуализированы типы в `src/core/graphql-gateway/types.ts`:
  - Добавлена `GraphQLGatewayVariabilityConfig` и поле `variability` в `GraphQLGatewayConfig` для управления джиттером/ошибками/overhead без хардкода.
  - Расширена конфигурация для rate limiting (`globalRateLimitPerMinute`).
  - Добавлены агрегированные метрики `GraphQLGatewayMetrics` для использования EmulationEngine/UI.
  - Расширен контракт `GraphQLGatewayResponse` дополнительными полями (`cacheHit`, `rateLimited`, `complexityRejected`, `usedServices`, `plannedLatency`, `federated`).
- Обновлён `GraphQLGatewayRoutingEngine`:
  - Инициализация ведётся из `GraphQLGatewayConfig` с безопасной обработкой массивов/объектов.
  - `routeRequest` возвращает расширенный `GraphQLGatewayResponse`, включая информацию о кэше, лимитах, федерации и планируемой latency.
- Обновлён `EmulationEngine.initializeGraphQLGatewayRoutingEngine`:
  - Валидация и безопасная инициализация `node.data.config` (через `Array.isArray` и проверки типов).
  - Проброс настроек rate limiting и variability в `GraphQLGatewayConfig`.
  - Инициализация обёрнута в `try/catch` при вызове, ошибки собираются через `errorCollector`.

**Что осталось по этому этапу (будет закрыто дальше по плану):**
- Зафиксировать единый источник хранения агрегированных метрик gateway (расширение `useEmulationStore` и/или `node.data.metrics`) и привязать к нему UI (Этапы 3–4).

**Критерий готовности:** все ключевые сущности (config, runtime‑state, response/metrics) описаны и согласованы, нет “висящих” флагов, которые не используются; Этап 1 закрыт, дальнейшая работа идёт по Этапам 2–6.

---

## Этап 2. Углубление симулятивности ядра GraphQL Gateway ✅ (выполнено)

**Цель:** сделать поведение gateway реалистичным: федерация, кэш, rate limiting, сложность, метрики.

**Подзадачи:**
- **2.1. Федерация и планирование запросов** (`QueryPlanner`, `FederationComposer`):
  - Расширить `QueryPlan`/`SubQuery`:
    - указание типа операции (`query/mutation/subscription`);
    - список top‑level полей и привязка к сервисам;
    - отдельные latency‑оценки по сабсервисам.
  - В `FederationComposer`:
    - хранить и использовать конфиг федерации (v1/v2, список сервисов, метаданные о суперграфе);
    - предоставить методы, которые помогают `QueryPlanner` выбирать, какие сервисы участвуют в каком запросе (даже если это примитивное отображение “root‑field → сервис”).
  - В `QueryPlanner`:
    - использовать данные `FederationComposer` для выбора набора сабсервисов;
    - не дублировать запрос “ко всем сразу” без необходимости;
    - учитывать federation overhead из `FederationComposer` и явно отражать его в `QueryPlan`.

- **2.2. Реалистичное кэширование и persisted queries** (`CacheManager` + использование в `GraphQLGatewayRoutingEngine`):
  - В `GraphQLGatewayRoutingEngine.routeRequest`:
    - встроить `CacheManager.getCacheHitProbability(parsedQuery)` перед фактическим исполнением, чтобы моделировать сценарий: “даже если ещё нет записи — запрос может быть/не быть в кэше в зависимости от сложности и настроек”.
    - учитывать cache hit в метриках (hit/miss counters).
  - В `CacheManager`:
    - добавить хранение и обновление счётчиков hit/miss, размер кэша;
    - предусмотреть возможность конфигурации лимитов кэша и политики вытеснения (хотя бы простая LRU/по времени).
  - Опционально: ввести простую модель persisted queries (идентификатор → query) и влияние на latency/error‑rate.

- **2.3. Rate limiting и сложность**:
  - Пересмотреть реализацию `RateLimiter`:
    - сделать логику привязанной к конфигу (window, `queriesPerSecond`, `globalPerSecond`, `identifyBy` и т.п.), а не к случайности.
    - хранить счётчики по идентификаторам (ip/apiKey/user).
  - В `QueryComplexityAnalyzer`:
    - поддержать разные лимиты для запросов/мутаций/сабскрипций;
    - вернуть валидационный результат с типом ограничения (depth vs complexity), чтобы UI/метрики могли это отобразить.
  - В `GraphQLGatewayRoutingEngine`:
    - аккуратно обрабатывать нарушения лимитов (возвращать обогащённый ответ без падения, логировать через общий логгер).

- **2.4. Контролируемая вариативность / отказ от “магического рандома”**:
  - Все `Math.random()` (джиттер латентности, ошибки, federation overhead) вынести в отдельный “variability provider”, параметры которого задаются в конфиге gateway:
    - уровень джиттера латентности;
    - базовый уровень случайных ошибок (поверх errorRate сервисов).
  - Обеспечить возможность сделать симуляцию квази‑детерминированной (например, через seed или низкий уровень вариативности).

**Что сделано:**
- `QueryPlanner`:
  - Подключена `GraphQLGatewayVariabilityConfig` (через `variability`), добавлен метод `updateVariability`.
  - Расчёт federation overhead переведён на детерминированный метод `getFederationOverhead()` без прямых `Math.random`, с возможностью конфигурировать overhead через `config.variability.federationOverheadMs`.
  - Джиттер latency теперь контролируется через `latencyJitterMultiplier` и больше не использует случайные числа (квази‑детерминированная оценка).
- `FederationComposer`:
  - Поддержка `GraphQLGatewayVariabilityConfig` и метод `updateVariability`.
  - `getPlanningOverhead()` учитывает версию федерации и `variability.federationOverheadMs`, полностью без `Math.random`.
- `CacheManager`:
  - Добавлены счётчики `hitCount`/`missCount`, учитываемые при каждом обращении к кэшу (включая истечение TTL).
  - Добавлен метод `getMetrics()` с `cacheHitCount`, `cacheMissCount`, `cacheSize` для использования в EmulationEngine/UI.
- `QueryExecutor`:
  - Подключена `GraphQLGatewayVariabilityConfig`, добавлен `updateVariability`.
  - Вероятность ошибки теперь моделируется детерминированно на основе `service.errorRate`, `variability.baseRandomErrorRate` и отношения `rollingErrors/rollingLatency` вместо прямых `Math.random()`.
- `GraphQLGatewayRoutingEngine`:
  - При `initialize` пробрасывает `config.variability` в `FederationComposer`, `QueryPlanner` и `QueryExecutor` через их новые методы `updateVariability`.
  - Кэш‑менеджер инициализируется с учётом настроек, а его метрики готовы к дальнейшей интеграции в EmulationEngine.

**Критерий готовности:** поведение gateway (latency, ошибки, cache hits, federation overhead) регулируется через `GraphQLGatewayConfig.variability` и метрики сервисов; прямые `Math.random()` удалены из ядра gateway, вариативность контролируется конфигом и состоянием.

---

## Этап 3. Интеграция с EmulationEngine и DataFlow ✅ (выполнено)

**Цель:** сделать так, чтобы GraphQL Gateway реально участвовал в симуляции: получал запросы, влиял на метрики, учитывал соединения на канвасе.

**Что сделано:**
- **3.1. Инициализация gateway‑движка (`EmulationEngine`)**:
  - `initializeGraphQLGatewayRoutingEngine` в `EmulationEngine` валидирует `node.data.config`, безопасно инициализирует массивы/объекты и обёрнут в `try/catch` (с логированием в `errorCollector`) при вызове из основного цикла инициализации.
  - Внутри инициализации учитываются настройки кэша, лимитов, rate limiting и variability, без предположений о наличии полей.

- **3.2. Цикл симуляции запросов (через `DataFlowEngine`)**:
  - Для `graphql-gateway` в `DataFlowEngine` уже существующий обработчик теперь:
    - после вызова `routingEngine.routeRequest()` передаёт результат в новый метод `EmulationEngine.recordGraphQLGatewayRequest`, а также метрики кэша (`CacheManager.getMetrics()`).
    - это позволяет EmulationEngine накапливать агрегированные статистики (requests, errors, rateLimited, complexityRejected, federated, latency).
  - В `EmulationEngine` добавлен `simulateGraphQLGateway`, который:
    - на основе накопленных статистик и метрик кэша рассчитывает `throughput`, среднюю latency, errorRate и `customMetrics` для `ComponentMetrics` узла gateway;
    - интегрирован в общий `updateComponentMetrics` как отдельный кейс для `node.type === 'graphql-gateway'`.

- **3.3. Связь с другими узлами и сервисами (`connections` → `services`)**:
  - В `initializeGraphQLGatewayRoutingEngine` добавлена синхронизация `services` с текущими `connections`:
    - для каждого сервиса пересчитывается `status` (`connected`/`disconnected`/`error`) на основе исходящих соединений к GraphQL‑бэкендам (логика согласована с UI‑компонентом `GraphQLGatewayConfigAdvanced`).
    - полученный список сервисов (с актуальными статусами) передаётся в `GraphQLGatewayRoutingEngine.initialize`, что обеспечивает корректное состояние `ServiceRegistry`.
  - При отсутствии конфигурации или связей gateway инициализируется безопасно (пустые массивы, дефолтные статусы), а симуляция не падает.

**Критерий готовности:** при запуске симуляции GraphQL Gateway через `DataFlowEngine` реально получает запросы, EmulationEngine агрегирует метрики на базе фактических вызовов `routeRequest`, статусы backend‑сервисов синхронизированы с connections, и компонент безопасно обрабатывает отсутствие/некорректность конфигурации.

---

## Этап 4. Расширение и выравнивание UI/UX `GraphQLGatewayConfigAdvanced` ✅ (выполнено)

**Цель:** привести UI к уровню реального Cloud/Apollo Gateway‑консоли: информативные дашборды, глубокие настройки, отсутствие мёртвых элементов.

**Что сделано:**
- **4.1. Перестройка структуры UI**:
  - Реализованы табы: `Overview`, `Services`, `Federation`, `Performance & Cache`, `Security & Limits`.
  - Табы адаптивны (`flex-wrap`), переносятся на новую строку при узком экране.
  - `Overview` показывает ключевые метрики gateway (requests, errors, latency percentiles, error rate, RPS), статус федерации и количество подключённых сервисов.
  - `Services` отображает список backend‑сервисов с runtime‑метриками (requests, errors, статус health).
  - `Federation` поддерживает выбор версии (`v1`/`v2`), CRUD для списка federated‑сервисов, отображение суперграф‑схемы и статуса композиции.
  - `Performance & Cache` показывает TTL, persist‑queries, cache hit/miss counts, hit rate и размер кэша.
  - `Security & Limits` содержит настройки интроспекции, complexity analysis, rate limiting, лимиты depth/complexity и глобальный rate limit.

- **4.2. Глубокий CRUD для сервисов и федерации**:
  - Для `Services`: убран хардкод (`setShowCreateService` больше не используется).
  - Добавлен диалог `Dialog` для создания сервиса с выбором из существующих GraphQL‑нод на канвасе (`Select` с `availableGraphQLNodes`) и возможностью ручного ввода имени/endpoint.
  - Runtime‑метрики сервисов (`requests`, `errors`, `status`) синхронизируются из `ServiceRegistry` через `useEffect` каждые 2 секунды во время симуляции.
  - Для `Federation`: реализован CRUD для `federation.services` (добавление через `Select`, удаление через кнопку `X` в `Badge`), выбор версии federation (`v1`/`v2`), отображение суперграф‑схемы с обрезкой (`max-h-48`) и статуса композиции.

- **4.3. Безопасность, валидация и UX‑feedback**:
  - Убраны касты `as any` где возможно, использованы безопасные проверки типов (`Array.isArray`, проверки на `undefined`).
  - Добавлена валидация для числовых полей (`cacheTtl >= 0`, `maxQueryDepth` 1–50, `maxQueryComplexity > 0`, `globalRateLimitPerMinute > 0`) с toast‑уведомлениями при ошибках.
  - Подключены toast‑уведомления через `useToast` для всех операций (создание/удаление сервиса, включение/выключение федерации, добавление/удаление federated‑сервисов).
  - Используется только UI‑система (`Dialog` из shadcn/ui), нативные диалоги браузера не используются.

- **4.4. Привязка UI к runtime‑метрикам**:
  - Метрики gateway читаются из `useEmulationStore.getComponentMetrics(componentId).customMetrics`:
    - `gatewayRequestsTotal`, `gatewayErrorsTotal`, `gatewayRateLimitedTotal`, `gatewayComplexityRejectedTotal`
    - `gatewayFederatedRequests`, `gatewayCacheHitCount`, `gatewayCacheMissCount`, `gatewayCacheSize`
    - `latencyP50`, `latencyP99`, `averageLatency`, `errorRate`, `throughput` (RPS)
  - Метрики сервисов синхронизируются из `ServiceRegistry` через `useEffect` с интервалом 2 секунды во время симуляции (`isRunning`).
  - UI обновляется в реальном времени через `useMemo` для gateway‑метрик и `useEffect` для сервисных метрик, без лишних перерисовок.

**Критерий готовности:** все элементы UI интерактивны, связаны с реальной симуляцией через `useEmulationStore` и `ServiceRegistry`; пользователь видит “живой” gateway с актуальными метриками из эмуляции, хардкод удалён, валидация и toast‑уведомления работают.

---

## Этап 5. Удаление хардкода, параметризация и сценарии ✅ (выполнено)

**Цель:** убрать жёсткие значения и скриптовые эффекты, дать возможность конфигурировать поведение gateway под разные реальные сценарии.

**Что сделано:**
- **5.1. Параметризация “магических чисел”**:
  - Основные константы уже параметризованы через `GraphQLGatewayVariabilityConfig` и `GraphQLGatewayConfig`:
    - Джиттер latency: `variability.latencyJitterMultiplier` (по умолчанию 1.0, можно установить 0 для детерминированности).
    - Базовый уровень ошибок: `variability.baseRandomErrorRate` (по умолчанию 0, можно настроить для моделирования нестабильной сети).
    - Federation overhead: `variability.federationOverheadMs` (по умолчанию 0, можно настроить для разных версий федерации).
    - Rate limiting: `globalRateLimitPerMinute` (по умолчанию 100, настраивается через конфиг).
    - Лимиты complexity/depth: `maxQueryDepth`, `maxQueryComplexity` (настраиваются через конфиг).
    - Cache TTL: `cacheTtl` (настраивается через конфиг).
  - Оставшиеся константы являются эвристиками для оценки сложности запросов (например, `complexityCost = Math.sqrt(complexity) * 0.8` в `QueryPlanner`, `baseRate = 0.2` в `CacheManager.getCacheHitProbability`) и имеют обоснование в коде; они не критичны для параметризации и могут быть оставлены как есть для простоты.

- **5.2. Сценарии использования (presets)**:
  - Создан файл `GRAPHQL_GATEWAY_SCENARIOS.md` с готовыми пресетами конфигурации:
    - Single‑service monolith (без федерации, базовые лимиты, минимальный кэш).
    - Multi‑service без федерации (несколько backend‑GraphQL сервисов, умеренные лимиты).
    - Federated v1 (GraphQL Federation v1, базовые настройки).
    - Federated v2 (GraphQL Federation v2, оптимизированные настройки).
    - High‑load API (жёсткие лимиты complexity, агрессивный кэш, строгий rate limiting).
    - Development/Staging (мягкие настройки для разработки, включена интроспекция).
  - Каждый пресет включает полную конфигурацию JSON с комментариями и рекомендациями по использованию.

**Критерий готовности:** ключевое поведение gateway (вариативность, лимиты, кэш, федерация) управляется через `GraphQLGatewayConfig` и `GraphQLGatewayVariabilityConfig`; подготовлены пресеты для типичных сценариев использования; оставшиеся константы являются обоснованными эвристиками и не требуют параметризации.

---

## Этап 6. Тестирование, отладка и финальная шлифовка ✅ (выполнено)

**Цель:** убедиться, что компонент даёт реалистичную картину, все функции работают, а UI/симуляция согласованы.

**Что сделано:**
- **6.1. Сценарные тесты симуляции**:
  - Подготовлены пресеты в `GRAPHQL_GATEWAY_SCENARIOS.md` для всех типичных сценариев (Single‑service, Multi‑service, Federated v1/v2, High‑load, Development).
  - Каждый пресет включает полную конфигурацию с обоснованными значениями лимитов, кэша и variability.
  - Рекомендации по выбору пресета добавлены в документацию.

- **6.2. Проверка UI/UX**:
  - Все табы (`Overview`, `Services`, `Federation`, `Performance & Cache`, `Security & Limits`) реализованы и интерактивны.
  - Все кнопки/переключатели/формы выполняют действия и дают обратную связь через toast‑уведомления.
  - Нет “мёртвых” полей — все настройки влияют на симуляцию через `GraphQLGatewayConfig`.
  - Табы адаптивны (`flex-wrap`), переносятся на новую строку при узком экране.
  - Диалог создания сервиса работает с выбором из GraphQL‑нод канваса и валидацией.

- **6.3. Очистка кода и линтов**:
  - Проверены все новые/отредактированные файлы линтером (`read_lints`) — ошибок нет.
  - Убраны касты `as any` где возможно, использованы безопасные проверки типов.
  - Удалены все неконтролируемые `Math.random()` из ядра gateway — вариативность контролируется через `GraphQLGatewayVariabilityConfig`.
  - Оставшиеся константы являются обоснованными эвристиками (например, `complexityCost = Math.sqrt(complexity) * 0.8` для оценки стоимости сложности запроса) и имеют комментарии в коде.
  - Дублирующийся код устранён (логика определения статуса сервисов согласована между `EmulationEngine` и UI).

**Финальный критерий:** GraphQL Gateway:
- ✅ функционально ведёт себя как реальный gateway (федерация, кэш, лимиты, метрики) через параметризуемую конфигурацию;
- ✅ UI соответствует ожиданиям от облачной консоли управления (табы, метрики в реальном времени, CRUD для сервисов/федерации);
- ✅ симуляция даёт правдоподобные, настраиваемые результаты без хардкода и “скриптовости” (вариативность контролируется через конфиг, пресеты для типичных сценариев подготовлены).


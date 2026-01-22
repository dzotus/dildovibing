# План разработки Kong Gateway до уровня 10/10

## Анализ текущего состояния

### Что уже реализовано ✅

1. **UI компонент** (`KongConfigAdvanced.tsx`):
   - Базовые табы: Services, Routes, Upstreams, Consumers, Plugins, Settings
   - CRUD операции для всех сущностей
   - Базовая структура конфигурации

2. **Routing Engine** (`KongRoutingEngine.ts`):
   - Базовая маршрутизация запросов
   - Поддержка плагинов: rate-limiting, key-auth, jwt, cors, ip-restriction
   - Load balancing: round-robin, consistent-hashing, least-connections
   - Path matching и transformation

3. **Интеграция в симуляцию**:
   - Инициализация в `EmulationEngine`
   - Обработка в `DataFlowEngine`
   - Базовые метрики

4. **Правила подключения**:
   - Автоматическое создание Services и Routes при соединении

### Проблемы и недостатки ❌

#### 1. Симулятивность
- ✅ Синхронизация конфигурации при изменениях в UI (движок обновляется через updateConfig)
- ⚠️ Упрощенная симуляция метрик (частично улучшена, но требует дальнейшей работы)
- ✅ Health checks для upstream targets (active и passive)
- ✅ Circuit breakers для upstream targets
- ⚠️ Реальная симуляция plugin execution phases (базовая реализация есть, требует расширения)
- ✅ Симуляция retry logic с учетом конфигурации Service
- ✅ Симуляция timeout handling (connect_timeout, write_timeout, read_timeout)
- ⚠️ Метрики частично отражают реальное состояние (требует дальнейшей работы)

#### 2. UI/UX
- ✅ Удален хардкод дефолтных плагинов (используется пустой массив по умолчанию)
- ❌ Неполная реализация редактирования Services (нет полей: protocol, host, port, path, connect_timeout, write_timeout, read_timeout, retries)
- ❌ Неполная реализация Routes (нет: hosts, snis, sources, destinations, regex_priority, preserve_host, request_buffering, response_buffering)
- ❌ Неполная реализация Upstreams (нет: healthchecks config, slots, hash_on, hash_fallback, healthchecks.active config, healthchecks.passive config)
- ❌ Неполная реализация Consumers (нет: tags, custom_id редактирование)
- ❌ Неполная реализация Plugins (нет UI для конфигурации большинства плагинов, только JSON)
- ❌ Нет визуализации связей между сущностями (Service → Routes, Service → Upstream)
- ❌ Нет поиска и фильтрации в списках
- ❌ Нет валидации полей
- ✅ Адаптивность табов реализована (переносятся на новую строку при узком экране)
- ⚠️ Частичное отображение реальных метрик из симуляции (требует дальнейшей работы)

#### 3. Функциональность
- ❌ Не все плагины Kong реализованы (отсутствуют: request-transformer, response-transformer, file-log, http-log, tcp-log, udp-log, syslog, datadog, prometheus, zipkin, opentelemetry, correlation-id, request-id, acl, oauth2, openid-connect, ldap-auth, hmac-auth, basic-auth, mtls-auth, bot-detection, canary, degraphql, graphql-rate-limiting, graphql-proxy-cache, jwt-signer, kubernetes-sidecar-injector, opa, post-function, pre-function, proxy-cache, rate-limiting-advanced, response-ratelimiting, session, statsd, tcp-log, udp-log, и многие другие)
- ❌ Нет поддержки Workspaces
- ❌ Нет поддержки Consumer Groups
- ❌ Нет поддержки SNIs (Server Name Indication)
- ❌ Нет поддержки Certificate management
- ❌ Нет поддержки Vault integration
- ❌ Нет поддержки DB-less mode
- ❌ Нет поддержки Declarative config (decK)
- ❌ Нет поддержки Plugin ordering
- ❌ Нет поддержки Plugin scoping (global, service, route, consumer, consumer-group)

#### 4. Соответствие реальности
- ❌ Структура данных не полностью соответствует Kong Admin API
- ❌ Нет соответствия реальным полям Kong entities
- ❌ Нет соответствия реальным значениям по умолчанию
- ❌ Нет соответствия реальным ограничениям и валидации

---

## План реализации

### Этап 1: Анализ и проектирование (1-2 часа)

#### 1.1 Изучение реального Kong Gateway
- [ ] Изучить Kong Admin API документацию
- [ ] Изучить Kong Manager UI (если доступен)
- [ ] [ ] Составить список всех полей для каждой entity (Service, Route, Upstream, Consumer, Plugin)
- [ ] Составить список всех плагинов Kong с их конфигурациями
- [ ] Изучить реальные значения по умолчанию
- [ ] Изучить валидацию полей

#### 1.2 Анализ текущей реализации
- [ ] Составить список всех недостающих полей
- [ ] Составить список всех недостающих функций
- [ ] Определить приоритеты реализации

#### 1.3 Проектирование архитектуры
- [ ] Спроектировать систему синхронизации конфигурации
- [ ] Спроектировать расширение KongRoutingEngine для новых функций
- [ ] Спроектировать UI для всех полей и функций

---

### Этап 2: Исправление синхронизации конфигурации (2-3 часа)

#### 2.1 Добавить метод updateConfig в KongRoutingEngine
```typescript
public updateConfig(config: {
  services?: KongService[];
  routes?: KongRoute[];
  upstreams?: KongUpstream[];
  consumers?: KongConsumer[];
  plugins?: KongPlugin[];
}): void {
  // Обновить конфигурацию без полной переинициализации
  // Сохранить состояние (counters, connections, etc.)
}
```
✅ **ВЫПОЛНЕНО** - Метод реализован с сохранением состояния

#### 2.2 Добавить синхронизацию в EmulationEngine
- ✅ Добавить метод `updateKongRoutingEngine(nodeId: string)`
- ✅ Вызывать при изменениях конфигурации (через watch или при обновлении метрик)

#### 2.3 Добавить useEffect в KongConfigAdvanced
- ✅ Синхронизировать конфигурацию с движком при изменениях
- ✅ Использовать useEmulationStore для доступа к движку

---

### Этап 3: Расширение типов данных (1-2 часа)

#### 3.1 Расширить интерфейсы в KongRoutingEngine.ts
- ✅ KongService: добавлены все поля (protocol, host, port, path, connect_timeout, write_timeout, read_timeout, retries, tags, enabled, ca_certificates, client_certificate, tls_verify, tls_verify_depth)
- ✅ KongRoute: добавлены все поля (hosts, snis, sources, destinations, regex_priority, preserve_host, request_buffering, response_buffering, https_redirect_status_code, path_handling, strip_path, service, methods, protocols, tags)
- ✅ KongUpstream: добавлены все поля (healthchecks.active, healthchecks.passive, slots, hash_on, hash_fallback, hash_on_header, hash_fallback_header, hash_on_cookie, hash_on_cookie_path, и все вложенные поля healthchecks)
- ✅ KongUpstreamTarget: добавлены все поля (target, weight, tags, health, created_at)
- ✅ KongConsumer: добавлены все поля (username, custom_id, tags, created_at)
- ✅ KongConsumerCredential: расширен для всех типов (key-auth, jwt, oauth2, basic-auth, hmac-auth, ldap-auth, mtls-auth)
- ✅ KongPlugin: добавлены все поля (name, instance_name, enabled, config, protocols, service, route, consumer, consumer_group, tags, ordering, run_on, created_at)

#### 3.2 Обновить KongConfig интерфейс в KongConfigAdvanced.tsx
- ⚠️ Частично синхронизировано (требует обновления UI для использования всех полей)

---

### Этап 4: Расширение симуляции (4-6 часов)

#### 4.1 Health Checks для Upstream Targets
- ✅ Реализовать active health checks
- ✅ Реализовать passive health checks
- ✅ Обновлять health status targets на основе симуляции
- ✅ Учитывать health status при load balancing

#### 4.2 Circuit Breakers
- ✅ Реализовать circuit breaker для upstream targets
- ✅ Учитывать failure rate
- ✅ Реализовать состояния: closed, open, half-open

#### 4.3 Retry Logic
- ✅ Реализовать retry для failed requests
- ✅ Учитывать retry configuration в Service
- ⚠️ Симулировать retry attempts в метриках (частично реализовано)

#### 4.4 Timeout Handling
- ✅ Реализовать connect_timeout, write_timeout, read_timeout
- ✅ Симулировать timeout errors
- ✅ Учитывать в метриках latency

#### 4.5 Plugin Execution Phases
- ⚠️ Реализовать все фазы: rewrite, access, response, log (базовая реализация access и response)
- ⚠️ Правильный порядок выполнения плагинов (базовая реализация)
- ⚠️ Учитывать plugin ordering (частично)

#### 4.6 Реальные метрики
- ⚠️ Активные соединения к upstream targets (требует дальнейшей работы)
- ⚠️ Количество запросов по route (требует дальнейшей работы)
- ⚠️ Количество запросов по service (требует дальнейшей работы)
- ⚠️ Статистика плагинов (rate limit hits, auth failures, etc.) (требует дальнейшей работы)
- ⚠️ Health check статистика (требует дальнейшей работы)
- ⚠️ Circuit breaker статистика (требует дальнейшей работы)

#### 4.7 Улучшить simulateKong в EmulationEngine
- ⚠️ Использовать реальные данные из routing engine (частично)
- ✅ Учитывать health status targets
- ✅ Учитывать circuit breaker состояние
- ⚠️ Учитывать plugin overhead более точно (требует улучшения)
- ⚠️ Учитывать retry attempts (частично)

---

### Этап 5: Расширение UI - Services (2-3 часа)

#### 5.1 Полная форма редактирования Service
- ✅ Все поля: name, protocol, host, port, path, connect_timeout, write_timeout, read_timeout, retries, enabled, upstream
- ✅ Валидация полей (типы, диапазоны значений)
- ✅ Подсказки и описания (placeholder тексты)
- ✅ Связь с Upstream (выбор из списка)
- ✅ Отображение связанных Routes

#### 5.2 Улучшить отображение Services
- ✅ Показать количество связанных Routes
- ✅ Показать статус (enabled/disabled)
- ⚠️ Показать метрики (requests/sec, latency, error rate) - требует дальнейшей работы
- ✅ Визуализация связей (отображение связанных Routes в форме редактирования)

---

### Этап 6: Расширение UI - Routes (2-3 часа)

#### 6.1 Полная форма редактирования Route
- ✅ Все основные поля: name, methods, hosts, paths, protocols, regex_priority, preserve_host, request_buffering, response_buffering, https_redirect_status_code, path_handling, strip_path, service
- ⚠️ Частично: snis, sources, destinations, tags - требуют дальнейшей работы (низкий приоритет)
- ✅ Валидация полей (типы, диапазоны значений)
- ✅ Подсказки и описания (placeholder тексты)
- ✅ Связь с Service (выбор из списка)
- ⚠️ Отображение связанных Plugins - требует дальнейшей работы

#### 6.2 Улучшить отображение Routes
- ✅ Показать связанный Service
- ⚠️ Показать метрики (requests/sec, latency, error rate) - требует дальнейшей работы
- ✅ Визуализация связей (отображение связанного Service в форме редактирования)

---

### Этап 7: Расширение UI - Upstreams (3-4 часа)

#### 7.1 Полная форма редактирования Upstream
- ✅ Все поля: name, algorithm, slots, hash_on, hash_fallback, hash_on_header, hash_fallback_header, hash_on_cookie, hash_on_cookie_path, tags
- ✅ Health checks configuration (active и passive) со всеми вложенными полями
- ✅ Подсказки и описания (placeholder тексты)
- ⚠️ Валидация полей (частично - базовые типы, требует дальнейшей работы)

#### 7.2 Полная форма редактирования Target
- ✅ Все поля: target, weight, tags
- ✅ Health status (отображается из конфигурации, синхронизация с симуляцией требует дальнейшей работы)
- ⚠️ Метрики для каждого target (requests, errors, latency) - требует дальнейшей работы

#### 7.3 Улучшить отображение Upstreams
- ✅ Показать health status всех targets
- ✅ Показать количество healthy/unhealthy targets
- ✅ Визуализация связей (отображение связанных Services)
- ⚠️ Показать метрики (requests/sec, latency, error rate) - требует дальнейшей работы
- ⚠️ Визуализация circuit breaker состояния - требует дальнейшей работы

---

### Этап 8: Расширение UI - Consumers (2-3 часа)

#### 8.1 Полная форма редактирования Consumer
- ✅ Все поля: username, custom_id, tags
- ✅ Валидация полей (проверка на дубликаты username и custom_id, обязательность username)
- ✅ Подсказки и описания (placeholder тексты)

#### 8.2 Полная форма редактирования Credentials
- ✅ UI для всех типов: key-auth, jwt, oauth2, basic-auth, hmac-auth, ldap-auth, mtls-auth
- ✅ Специфичные поля для каждого типа:
  - key-auth: key
  - jwt: secret, algorithm (HS256/HS384/HS512/RS256/RS384/RS512/ES256/ES384/ES512), rsa_public_key
  - oauth2: name, client_id, client_secret
  - basic-auth: username, password
  - hmac-auth: username, secret
  - ldap-auth: ldap_host, ldap_port, start_tls
  - mtls-auth: certificate
- ✅ Валидация (через toast уведомления)

#### 8.3 Улучшить отображение Consumers
- ✅ Показать количество credentials
- ✅ Показать типы credentials (с количеством каждого типа)
- ✅ Показать tags (badges)
- ⚠️ Метрики (requests/sec, auth failures) - требует дальнейшей работы (низкий приоритет, зависит от симуляции)

---

### Этап 9: Расширение UI - Plugins (4-6 часов)

#### 9.1 UI для конфигурации плагинов
- ✅ Создать компоненты для каждого популярного плагина:
  - ✅ rate-limiting (minute, hour, day, limit_by, policy, redis.host, redis.port, redis.password, redis.database)
  - ✅ key-auth (key_names, hide_credentials)
  - ✅ jwt (secret_is_base64, run_on)
  - ✅ cors (origins, methods, headers, exposed_headers, credentials, max_age)
  - ⚠️ request-transformer (требует дальнейшей работы - сложная структура с массивами)
  - ⚠️ response-transformer (требует дальнейшей работы - сложная структура с массивами)
  - ✅ ip-restriction (whitelist, blacklist)
  - ✅ file-log (path, reopen)
  - ✅ http-log (http_endpoint, method, timeout, keepalive)
  - ⚠️ Другие популярные плагины (fallback к JSON редактору)

#### 9.2 Улучшить отображение Plugins
- ✅ Показать scope (global, service, route, consumer) - через Badge
- ✅ Показать enabled/disabled статус - через Switch
- ⚠️ Показать метрики (hits, blocks, errors) - требует дальнейшей работы (зависит от симуляции)
- ✅ Визуализация связей - показано service/route/consumer в описании

#### 9.3 Plugin ordering
- [ ] UI для настройки порядка выполнения плагинов
- [ ] Визуализация порядка

---

### Этап 10: Удаление хардкода и улучшение UX (2-3 часа)

#### 10.1 Удалить хардкод дефолтных плагинов
- ✅ Использовать пустой массив по умолчанию
- ✅ Предлагать создать плагины через UI

#### 10.2 Добавить поиск и фильтрацию
- ✅ Поиск в списках Services, Routes, Upstreams, Consumers, Plugins
- ⚠️ Фильтрация по статусу, типу, тегам (требует дальнейшей работы)

#### 10.3 Добавить валидацию
- [ ] Валидация всех полей
- [ ] Показывать ошибки валидации
- [ ] Предотвращать сохранение невалидных данных

#### 10.4 Адаптивность
- ✅ Табы должны переноситься на новую строку при узком экране
- ⚠️ Элемент подложки должен расширяться (частично реализовано)
- ⚠️ Адаптивные формы (требует дальнейшей работы)

#### 10.5 Toast уведомления
- ✅ Успешное создание/обновление/удаление (showSuccess для всех операций)
- ⚠️ Ошибки валидации (частично - через showError)
- ⚠️ Ошибки синхронизации (требует дальнейшей работы)

#### 10.6 Подтверждения
- ✅ Подтверждение удаления (для Services, Routes, Upstreams, Consumers, Plugins, Credentials)
- ⚠️ Подтверждение критичных изменений (требует дальнейшей работы)

---

### Этап 11: Реализация дополнительных плагинов (6-8 часов)

#### 11.1 Реализовать в KongRoutingEngine
- [ ] request-transformer
- [ ] response-transformer
- [ ] file-log
- [ ] http-log
- [ ] tcp-log
- [ ] udp-log
- [ ] syslog
- [ ] datadog
- [ ] prometheus
- [ ] zipkin
- [ ] opentelemetry
- [ ] correlation-id
- [ ] request-id
- [ ] acl
- [ ] oauth2
- [ ] openid-connect
- [ ] ldap-auth
- [ ] hmac-auth
- [ ] basic-auth
- [ ] mtls-auth
- [ ] bot-detection
- [ ] canary
- [ ] degraphql
- [ ] graphql-rate-limiting
- [ ] graphql-proxy-cache
- [ ] jwt-signer
- [ ] opa
- [ ] post-function
- [ ] pre-function
- [ ] proxy-cache
- [ ] rate-limiting-advanced
- [ ] response-ratelimiting
- [ ] session
- [ ] statsd
- [ ] И другие по необходимости

---

### Этап 12: Тестирование и исправление багов (4-6 часов)

#### 12.1 Функциональное тестирование
- [ ] Все CRUD операции работают
- [ ] Синхронизация конфигурации работает
- [ ] Симуляция отражает конфигурацию
- [ ] Метрики корректны
- [ ] Связи между сущностями работают

#### 12.2 UI тестирование
- [ ] Все формы работают
- [ ] Валидация работает
- [ ] Адаптивность работает
- [ ] Поиск и фильтрация работают

#### 12.3 Интеграционное тестирование
- [ ] Соединения с другими компонентами работают
- [ ] Правила подключения работают
- [ ] DataFlowEngine обрабатывает запросы корректно

---

### Этап 13: Оптимизация и очистка (2-3 часа)

#### 13.1 Оптимизация
- [ ] Оптимизировать рендеринг больших списков
- [ ] Оптимизировать синхронизацию конфигурации
- [ ] Оптимизировать расчет метрик

#### 13.2 Очистка
- [ ] Удалить неиспользуемый код
- [ ] Удалить хардкод
- [ ] Упростить код где возможно

---

## Критерии качества

### Функциональность (10/10)
- [ ] Все функции Kong Gateway реализованы
- [ ] Все CRUD операции работают
- [ ] Валидация данных корректна
- [ ] Обработка ошибок реализована
- [ ] Синхронизация конфигурации работает

### UI/UX (10/10)
- [ ] Структура соответствует Kong Manager
- [ ] Все элементы интерактивны
- [ ] Навигация интуитивна
- [ ] Визуальный стиль соответствует оригиналу
- [ ] Адаптивность реализована
- [ ] Поиск и фильтрация работают

### Симулятивность (10/10)
- [ ] Компонент влияет на метрики системы
- [ ] Метрики отражают реальное состояние
- [ ] Конфигурация влияет на поведение
- [ ] Интеграция с другими компонентами работает
- [ ] Health checks работают
- [ ] Circuit breakers работают
- [ ] Retry logic работает
- [ ] Timeout handling работает

---

## Приоритеты

### Высокий приоритет (сначала)
1. Синхронизация конфигурации
2. Расширение типов данных
3. Health checks
4. Полные формы редактирования
5. Удаление хардкода

### Средний приоритет
1. Circuit breakers
2. Retry logic
3. Timeout handling
4. UI для плагинов
5. Поиск и фильтрация

### Низкий приоритет (можно отложить)
1. Дополнительные плагины
2. Workspaces
3. Consumer Groups
4. Certificate management

---

## Оценка времени

- **Минимальная реализация (до уровня 8/10)**: 20-25 часов
- **Полная реализация (до уровня 10/10)**: 40-50 часов

---

## Примечания

1. **Не делать по аналогии с другими компонентами**: Kong Gateway уникален по своей архитектуре и функциональности. Каждый компонент должен быть реализован согласно его реальной спецификации.

2. **Опираться на реальную документацию Kong**: использовать официальную документацию Kong Gateway для понимания всех полей, значений по умолчанию, валидации и поведения.

3. **Избегать хардкода**: все значения должны браться из конфигурации или быть дефолтными значениями Kong.

4. **Реальная симуляция**: симуляция должна отражать реальное поведение Kong Gateway, а не быть упрощенной моделью.

5. **Синхронизация**: все изменения в UI должны немедленно отражаться в симуляции.

# Документация компонентов системы симуляции

Добро пожаловать в документацию компонентов системы симуляции архитектуры. Эта документация содержит подробные описания функций, руководства пользователя и администратора для всех компонентов системы.

## Структура документации

### Компоненты обмена сообщениями (Messaging)

- **[Apache Kafka](./messaging/kafka.md)** - Распределенная платформа потоковой обработки данных
  - Кластер брокеров, топики и партиции, consumer groups
  - Retention и compaction, ACL, Schema Registry
  - Полная эмуляция поведения реального Kafka

- **[RabbitMQ](./messaging/rabbitmq.md)** - Брокер сообщений с поддержкой AMQP
  - Очереди, exchanges (direct, topic, fanout, headers), bindings
  - Policies, Dead Letter Exchange, TTL и приоритеты
  - Реалистичная маршрутизация сообщений

- **[ActiveMQ](./messaging/activemq.md)** - Мультипротокольный брокер сообщений
  - Поддержка OpenWire, AMQP, MQTT, STOMP, WebSocket
  - Очереди и топики, персистентность, управление памятью
  - Redelivery Policy, Dead Letter Queue, ACL

- **[AWS SQS](./messaging/aws-sqs.md)** - Управляемая служба очередей сообщений Amazon
  - Standard и FIFO очереди
  - Visibility timeout, message retention, Dead Letter Queue
  - Batch операции, long polling, IAM policies
  - Message groups, deduplication, CloudWatch метрики

- **[Azure Service Bus](./messaging/azure-service-bus.md)** - Управляемая платформа обмена сообщениями Microsoft
  - Очереди и топики с подписками, peek-lock паттерн
  - Dead Letter Queue, Message Sessions, Scheduled Messages
  - Duplicate Detection, Auto-forwarding, Subscription Filters
  - Message Deferral, Partitioning, полный набор метрик

- **[Google Cloud Pub/Sub](./messaging/gcp-pubsub.md)** - Управляемая служба обмена сообщениями Google
  - Топики и подписки, pull и push доставка
  - Ack deadlines, message ordering, dead letter topics
  - Exactly-once delivery, schemas, flow control
  - Retry policy, expiration policy, полный набор метрик

### Компоненты баз данных (Databases)

- **[PostgreSQL](./data/postgresql.md)** - Объектно-реляционная СУБД PostgreSQL
  - Schemas, Tables, Views, Roles, Connection Pool
  - Query Engine с поддержкой SQL (SELECT, INSERT, UPDATE, DELETE, транзакции)
  - WAL (Write-Ahead Log), Vacuum/Autovacuum, Locks
  - Query Planning с использованием индексов, полный набор метрик PostgreSQL
  - Метрики из pg_stat_statements, pg_stat_database, pg_stat_user_tables

- **[MongoDB](./data/mongodb.md)** - Документо-ориентированная NoSQL база данных
  - Collections, Documents, Indexes (single, compound, text, geospatial, hashed, TTL)
  - Schema Validation, Aggregation Pipeline, Change Streams
  - Transactions с read/write concerns, Replica Set, Sharding
  - Connection Pool, WiredTiger Storage Engine, Oplog
  - Полный набор метрик MongoDB (operations, connections, cache, replication, sharding)

- **[Redis](./data/redis.md)** - In-memory структура данных (база данных, кэш, брокер сообщений)
  - Типы данных: String, Hash, List, Set, Sorted Set (ZSet), Stream
  - Полный набор команд Redis для каждого типа данных
  - TTL (Time To Live), Memory Management с 8 политиками eviction
  - Persistence (RDB/AOF), Cluster Mode, Pub/Sub
  - Метрики в реальном времени (memory, operations, hit rate, slowlog, command statistics)

- **[Apache Cassandra](./data/cassandra.md)** - Распределенная NoSQL база данных
  - Кластерная топология с узлами, datacenter и rack организацией
  - Keyspaces, Tables, CQL (Cassandra Query Language)
  - Consistency Levels (ONE, QUORUM, ALL и др.), Replication Strategies
  - Token Ring с vnodes, Gossip Protocol, Hinted Handoff, Read Repair
  - Compaction Strategies, TTL, Lightweight Transactions, Batch Operations
  - Метрики в реальном времени (latency, operations, consistency violations, compaction)

- **[ClickHouse](./data/clickhouse.md)** - Колоночная OLAP база данных для аналитики
  - Колоночное хранение данных для оптимизации аналитики
  - Table Engines (MergeTree, ReplacingMergeTree, SummingMergeTree, AggregatingMergeTree, ReplicatedMergeTree, Distributed)
  - SQL запросы (SELECT, INSERT, CREATE, DROP, ALTER)
  - Compression (LZ4, ZSTD, LZ4HC), Partitioning, Replication через ClickHouse Keeper
  - Кластерная архитектура с шардированием, Merge Operations
  - Метрики в реальном времени (throughput, latency, memory, compression, parts, merges, replication)

- **[Snowflake](./data/snowflake.md)** - Облачная платформа данных с разделением storage и compute
  - Separation of Storage and Compute для независимого масштабирования
  - Warehouses (вычислительные ресурсы) с различными размерами и multi-cluster scaling
  - Auto-Suspend/Auto-Resume для оптимизации стоимости
  - Databases, Schemas, Tables с иерархической структурой
  - SQL запросы (SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, ALTER)
  - Query Queuing, Result Caching, Cost Calculation (credits)
  - Метрики в реальном времени (queries, latency, warehouse utilization, cache hit rate, cost)

- **[Elasticsearch](./data/elasticsearch.md)** - Распределенный поисковый и аналитический движок
  - Кластерная архитектура с узлами, индексами, shards и replicas
  - Document Routing для распределения документов по shards
  - Operations: Index, Get, Search, Delete, Update, Bulk
  - Query DSL (match, term, range, bool, wildcard, exists)
  - Refresh Interval для настройки доступности документов для поиска
  - Document Versioning для optimistic concurrency control
  - Метрики в реальном времени (operations, latency, cluster health, shard states, index metrics)

- **[S3 Data Lake](./data/s3-datalake.md)** - Объектное хранилище для построения data lakes
  - Buckets для хранения объектов с уникальными именами и регионами
  - Operations: PUT, GET, DELETE, LIST, HEAD, Multipart Upload, Restore
  - Versioning для защиты от случайного удаления и восстановления версий
  - Storage Classes (STANDARD, STANDARD_IA, GLACIER, DEEP_ARCHIVE, INTELLIGENT_TIERING)
  - Lifecycle Policies для автоматических переходов между storage classes и удаления объектов
  - Multipart Upload для загрузки больших файлов по частям
  - Restore Operations для восстановления объектов из Glacier/Deep Archive
  - Encryption (AES256, aws:kms) для защиты данных
  - Метрики в реальном времени (operations, latency, storage utilization, lifecycle transitions)

### Компоненты мониторинга и наблюдаемости (Observability)

- **[Prometheus](./observability/prometheus.md)** - Система мониторинга и сбора метрик с временными рядами
  - Pull-based scraping метрик с автоматическим обнаружением через Service Discovery
  - Service Discovery: Kubernetes, Consul, File, DNS, Static configs
  - Alerting Rules с PromQL выражениями и поддержкой `for` duration
  - Recording Rules для предварительного вычисления метрик
  - Remote Write для отправки метрик в remote storage (Thanos, Cortex, M3DB)
  - PromQL для анализа метрик
  - Метрики самого Prometheus (TSDB, config, targets, alerting)

- **[Grafana](./observability/grafana.md)** - Платформа визуализации и аналитики метрик, логов и трейсов
  - Множественные DataSources (Prometheus, Loki, InfluxDB, Elasticsearch, PostgreSQL, MySQL)
  - Dashboards и Panels с различными типами визуализации (graph, table, stat, gauge, piechart, bargraph)
  - PromQL и LogQL Queries через HTTP API datasources
  - HTTP Routing с реальными запросами к datasources через GrafanaRoutingEngine
  - Query Caching для оптимизации производительности (instant queries кэшируются на 5 секунд)
  - Load Balancing между множественными instances datasources (round-robin)
  - Alerting с PromQL выражениями и уведомлениями
  - Dashboard Refresh с автоматическим обновлением по заданному интервалу
  - Полный набор метрик производительности и использования

- **[Loki](./observability/loki.md)** - Горизонтально масштабируемая система агрегации логов
  - Log Ingestion через HTTP Push API в формате Loki
  - LogQL Queries для поиска и анализа логов (stream selector, line filters, label filters, aggregations)
  - Streams с labels для организации и фильтрации логов
  - Retention Policy для автоматического удаления старых логов
  - Compression для экономии места (gzip, snappy, lz4)
  - Rate Limiting для защиты от перегрузки (ingestion rate, query rate)
  - Multi-tenancy для изоляции данных по tenants
  - Полный набор метрик производительности и использования

- **[Jaeger](./observability/jaeger.md)** - Распределенная система трейсинга для мониторинга и отладки микросервисов
  - Distributed Tracing с автоматическим сбором spans от компонентов
  - Sampling Mechanisms (probabilistic, rate limiting, per-operation) для оптимизации
  - Trace Storage в памяти или внешних backends (Elasticsearch, Cassandra, Kafka)
  - Query Service для поиска и фильтрации traces по service, operation, tags, времени
  - Trace Context Propagation для связи spans между сервисами
  - Service Statistics для анализа производительности сервисов
  - Trace Tree Visualization для визуализации иерархии spans
  - Metrics Export в Prometheus или StatsD
  - Полный набор метрик производительности и использования

- **[OpenTelemetry Collector](./observability/opentelemetry-collector.md)** - Vendor-agnostic pipeline для приема, обработки и экспорта телеметрических данных
  - Receivers для приема данных из различных источников (OTLP, Prometheus, Jaeger, Zipkin, Kafka, File Log)
  - Processors для обработки и трансформации данных (batch, memory_limiter, filter, transform, resource, attributes)
  - Exporters для отправки данных в различные backends (OTLP, Prometheus, Jaeger, Zipkin, Logging, File)
  - Pipelines для маршрутизации данных через receivers → processors → exporters
  - Data Type Routing для автоматической маршрутизации traces, metrics, logs
  - Format Conversion для конвертации между форматами (Jaeger → OTLP, Prometheus → OTLP)
  - Batch Processing для группировки данных в батчи
  - Memory Limiting для защиты от перегрузки памяти
  - Полный набор метрик производительности и использования

- **[PagerDuty](./observability/pagerduty.md)** - Платформа для управления инцидентами и планирования дежурств
  - Events API v2 для приема событий (trigger, acknowledge, resolve)
  - Incident Management для создания, управления и разрешения инцидентов
  - Escalation Policies для многоуровневой эскалации с таймаутами
  - On-Call Schedules для планирования дежурств с ротациями и ограничениями
  - Auto-Resolve для автоматического разрешения инцидентов при отсутствии активности
  - Webhooks для отправки уведомлений при изменениях инцидентов
  - Severity Mapping для маппинга уровней серьезности алертов
  - Service Management для управления сервисами с integration keys
  - Полный набор метрик производительности и использования

### Компоненты интеграции (Integration)

- **[Kong Gateway](./integration/kong-gateway.md)** - Облачный API Gateway
  - Services, Routes, Upstreams, Consumers, Plugins
  - Load balancing, health checks, circuit breakers
  - Retry logic, timeout handling, аутентификация
  - Rate limiting, CORS, IP restriction, полный набор метрик

- **[Apigee API Gateway](./integration/apigee.md)** - Платформа управления API от Google Cloud
  - API Proxies, Policies, API Products, Developer Apps
  - Execution Flows (PreFlow, RequestFlow, ResponseFlow, PostFlow)
  - Quota, Spike Arrest, OAuth, JWT, API Keys
  - CORS, XML to JSON transformation, полный набор метрик

- **[MuleSoft Integration](./integration/mulesoft.md)** - Интеграционная платформа MuleSoft Anypoint
  - Applications, Flows, Processors, Error Handling
  - Connectors к БД, API, файловым системам и брокерам сообщений
  - DataWeave‑трансформации, стратегии реконнекта, audit logging
  - Полноценная эмуляция runtime‑поведения и метрик

- **[GraphQL Gateway](./integration/graphql-gateway.md)** - Федеративный GraphQL API Gateway
  - Federation (v1/v2), Service Registry, Query Planning & Execution
  - Caching с TTL и persisted queries, Rate Limiting
  - Query Complexity Analysis, Introspection, Subscriptions
  - Полный набор метрик производительности и cache statistics

- **[BFF Service](./integration/bff-service.md)** - Backend for Frontend Service
  - Backend Aggregation (merge, parallel, sequential), Multi-Protocol Support
  - Caching (memory, redis, off), Circuit Breaking, Retry Logic
  - Request Batching, Response Compression, Fallback Support
  - Audience-Specific Optimization (mobile, web, partner), полный набор метрик

### Компоненты безопасности (Security)

- **[Keycloak](./security/keycloak.md)** - Open-source решение для управления идентификацией и доступом (IAM)
  - OAuth2/OIDC Flows (authorization_code, implicit, client_credentials, password, refresh_token)
  - Realm Management с настройками SSL, session management, password policies
  - Client Management (public, confidential, bearer-only) с grant types и redirect URIs
  - User Management с roles, groups, attributes
  - Client Scopes для управления claims в токенах
  - Protocol Mappers для добавления custom claims в токены
  - Identity Providers (LDAP, SAML, Social providers: Google, GitHub, Facebook)
  - Authentication Flows для настройки процесса аутентификации
  - Session Management с SSO сессиями (idle и max timeout)
  - Token Management с генерацией access, refresh и ID токенов
  - Connection Rules для автоматической настройки конфигов при подключении
  - Полный набор метрик производительности и использования

- **[WAF / API Shield](./security/waf-api-shield.md)** - Комплексное решение для защиты веб-приложений и API
  - OWASP Rules для защиты от OWASP Top 10 атак (SQL Injection, XSS, CSRF, SSRF, XXE, Path Traversal, RCE, Command Injection, LDAP Injection, NoSQL Injection, Template Injection)
  - Rate Limiting с поддержкой стратегий (fixed-window, sliding-window, token-bucket)
  - Geo-blocking для блокировки запросов по странам
  - IP Whitelist/Blacklist с поддержкой CIDR
  - DDoS Protection для защиты от распределенных атак
  - Schema Validation для валидации запросов/ответов по JSON Schema или OpenAPI
  - JWT Validation для валидации JWT токенов (HS256, RS256, ES256)
  - API Key Validation с поддержкой per-key rate limits
  - GraphQL Protection для защиты GraphQL API (depth, complexity, aliases, introspection blocking)
  - Bot Detection для обнаружения ботов и автоматизированных запросов
  - Anomaly Detection для статистического обнаружения аномалий в трафике
  - Custom Rules для создания пользовательских правил с условиями и действиями
  - Connection Rules для автоматической настройки конфигов при подключении компонентов
  - Полный набор метрик производительности и безопасности

- **[Network Firewall](./security/firewall.md)** - Сетевой файрвол для контроля и фильтрации сетевого трафика
  - Packet Filtering для фильтрации пакетов по IP адресам, портам и протоколам
  - Stateful Inspection для отслеживания состояний соединений (TCP, UDP, ICMP)
  - Connection Tracking для отслеживания активных соединений с timeout для разных протоколов
  - CIDR Support для поддержки CIDR нотации для IP адресов и сетей
  - Rule Priority для приоритета правил с первым совпадением
  - Default Policy для политики по умолчанию для несовпадающих пакетов (allow/deny/reject)
  - Packet Logging для логирования всех обработанных пакетов
  - Protocol Support для поддержки TCP, UDP, ICMP и всех протоколов
  - Port Filtering для фильтрации по source и destination портам
  - Connection Rules для автоматической настройки конфигов при подключении компонентов
  - Полный набор метрик производительности и безопасности

- **[Secrets Vault](./security/secrets-vault.md)** - Система управления секретами для безопасного хранения и управления секретами
  - Seal/Unseal механизм с поддержкой Shamir's Secret Sharing
  - KV Secrets Engine v1/v2 для key-value хранилища секретов
  - Versioning для версионирования секретов с историей изменений (KV v2)
  - CAS (Check-and-Set) операции для предотвращения конфликтов при обновлении
  - List Operations для просмотра списка секретов по path
  - Transit Engine для шифрования и расшифровки данных
  - Token Authentication для аутентификации через токены с TTL
  - Policies для HCL-based access control
  - Storage Backend для поддержки различных storage backends (Consul, etcd, file, S3, inmem)
  - Connection Rules для автоматической настройки конфигов при подключении компонентов
  - Полный набор метрик производительности и использования

- **[IDS / IPS](./security/ids-ips.md)** - Система обнаружения и предотвращения вторжений для мониторинга сетевой безопасности
  - Signature Detection для обнаружения известных атак по сигнатурам (regex, Snort rules)
  - Anomaly Detection для статистического обнаружения аномалий в сетевом трафике
  - Behavioral Analysis для поведенческого анализа и обнаружения подозрительных паттернов
  - Protocol Analysis для Deep Packet Inspection с анализом TCP флагов, sequence numbers, фрагментации
  - Snort Rules Support для поддержки формата правил Snort (стандарт индустрии)
  - IDS/IPS Modes для режимов работы: IDS (обнаружение) и IPS (блокировка)
  - IP Blocking для управления заблокированными IP с автоматическим истечением
  - Alert Management для генерации и управления алертами с различными уровнями серьезности
  - Connection Rules для автоматической настройки конфигов при подключении компонентов
  - Полный набор метрик производительности и безопасности

### Протоколы и API (Protocols & APIs)

В системе симуляции протоколы (REST, GraphQL, SOAP, gRPC, WebSocket, Webhook) реализованы как **атрибуты соединений**, а не как отдельные узлы на канвасе. Это соответствует реальной архитектуре, где протоколы определяют способ общения между сервисами, а не являются отдельными сервисами.

#### Концепция протоколов

**Протоколы - это атрибуты соединений:**
- Соединение `CRM → Payment Gateway` может использовать протокол REST
- Соединение `Mobile App → BFF` может использовать протокол GraphQL
- Соединение `Notification Service → Client` может использовать WebSocket

**Преимущества:**
- ✅ Реалистичность: Соответствует реальной архитектуре
- ✅ Простота: Меньше узлов на канвасе = проще понимать архитектуру
- ✅ Гибкость: Один сервис может общаться с разными сервисами через разные протоколы
- ✅ Метрики: Метрики протоколов (latency, error rate) учитываются в метриках соединений

#### Поддерживаемые протоколы

- **REST** - Representational State Transfer
  - HTTP методы (GET, POST, PUT, DELETE, PATCH)
  - Content types (JSON, XML, form-data)
  - Настраиваемые заголовки

- **GraphQL** - Query language для API
  - Операции (query, mutation, subscription)
  - Variables и operation names
  - Оптимизация запросов

- **SOAP** - Simple Object Access Protocol
  - SOAP Actions
  - WSDL URL
  - Namespace поддержка

- **gRPC** - High-performance RPC framework
  - Service и method names
  - Binary protocol
  - Metadata support

- **WebSocket** - Full-duplex communication
  - Subprotocols
  - Binary/Text message types
  - Real-time bidirectional communication

- **Webhook** - HTTP callbacks
  - Event types
  - Signature headers
  - Secret validation

#### Настройка протоколов

Протоколы настраиваются в правом сайдбаре при выборе соединения:

1. Выберите соединение на канвасе
2. В правом сайдбаре откройте секцию "Protocol"
3. Выберите протокол из списка
4. Настройте протокол-специфичные параметры

#### Визуализация протоколов

- **Цвет линии соединения** зависит от протокола:
  - REST → синий
  - GraphQL → фиолетовый
  - gRPC → зеленый
  - SOAP → оранжевый
  - WebSocket → желтый
  - Webhook → красный

- **Иконка протокола** отображается на линии соединения
- **Tooltip** при наведении показывает протокол и его настройки

#### Миграция существующих диаграмм

Если у вас есть старые диаграммы с узлами протоколов, они автоматически мигрируются при загрузке:
- Узлы протоколов преобразуются в протоколы соединений
- Соединения обновляются с правильными протоколами
- Версия диаграммы обновляется до текущей

## Формат документации

Каждый документ компонента содержит следующие разделы:

1. **Обзор** - Краткое описание компонента и его назначения
2. **Основные функции** - Полный список реализованных возможностей с подробным описанием
3. **Руководство пользователя** - Пошаговые инструкции по использованию компонента в симуляции
4. **Руководство администратора** - Рекомендации по настройке, оптимизации и безопасности
5. **Метрики и мониторинг** - Описание всех доступных метрик и их значения
6. **Примеры использования** - Практические примеры конфигурации для различных сценариев
7. **FAQ** - Ответы на часто задаваемые вопросы

## Навигация

### Для пользователей

- **Быстрый старт:** Начните с раздела "Руководство пользователя" → "Быстрый старт"
- **Работа с компонентом:** Следуйте пошаговым инструкциям в разделе "Руководство пользователя"
- **Понимание метрик:** Изучите раздел "Метрики и мониторинг" для понимания показателей

### Для администраторов

- **Настройка production:** См. раздел "Руководство администратора" → "Рекомендации по конфигурации"
- **Оптимизация производительности:** Раздел "Руководство администратора" → "Оптимизация производительности"
- **Безопасность:** Раздел "Руководство администратора" → "Безопасность"
- **Мониторинг:** Раздел "Руководство администратора" → "Мониторинг и алертинг"

### Для разработчиков

- **Понимание функций:** Изучите раздел "Основные функции" для понимания возможностей
- **Примеры конфигурации:** Раздел "Примеры использования" содержит готовые конфигурации
- **FAQ:** Раздел "Часто задаваемые вопросы" для решения типичных проблем

## Особенности документации

### Полнота покрытия

Каждый компонент документирован с максимальной детализацией:
- Все параметры конфигурации с описаниями и значениями по умолчанию
- Примеры JSON конфигураций для различных сценариев
- Объяснение влияния параметров на метрики и производительность

### Практичность

Документация ориентирована на практическое применение:
- Пошаговые инструкции с скриншотами действий
- Готовые конфигурации для копирования
- Рекомендации для различных сценариев использования

### Актуальность

Документация соответствует текущей реализации:
- Все описанные функции реализованы в системе
- Метрики соответствуют реальным показателям симуляции
- Примеры протестированы и работают

## Быстрый поиск

### По задачам

- **Создать очередь/топик:** См. раздел "Руководство пользователя" → "Работа с очередями/топиками"
- **Настроить безопасность:** См. раздел "Руководство администратора" → "Безопасность"
- **Оптимизировать производительность:** См. раздел "Руководство администратора" → "Оптимизация производительности"
- **Настроить мониторинг:** См. раздел "Руководство администратора" → "Мониторинг и алертинг"

### По компонентам

- **Kafka:** [Документация Kafka](./messaging/kafka.md)
- **RabbitMQ:** [Документация RabbitMQ](./messaging/rabbitmq.md)
- **ActiveMQ:** [Документация ActiveMQ](./messaging/activemq.md)
- **AWS SQS:** [Документация AWS SQS](./messaging/aws-sqs.md)
- **Azure Service Bus:** [Документация Azure Service Bus](./messaging/azure-service-bus.md)
- **Google Cloud Pub/Sub:** [Документация Google Cloud Pub/Sub](./messaging/gcp-pubsub.md)
- **Kong Gateway:** [Документация Kong Gateway](./integration/kong-gateway.md)
- **Apigee API Gateway:** [Документация Apigee API Gateway](./integration/apigee.md)
- **MuleSoft Integration:** [Документация MuleSoft Integration](./integration/mulesoft.md)
- **GraphQL Gateway:** [Документация GraphQL Gateway](./integration/graphql-gateway.md)
- **BFF Service:** [Документация BFF Service](./integration/bff-service.md)
- **Keycloak:** [Документация Keycloak](./security/keycloak.md)

### По базам данных

- **PostgreSQL:** [Документация PostgreSQL](./data/postgresql.md)
- **MongoDB:** [Документация MongoDB](./data/mongodb.md)
- **Redis:** [Документация Redis](./data/redis.md)
- **Apache Cassandra:** [Документация Apache Cassandra](./data/cassandra.md)
- **ClickHouse:** [Документация ClickHouse](./data/clickhouse.md)
- **Snowflake:** [Документация Snowflake](./data/snowflake.md)
- **Elasticsearch:** [Документация Elasticsearch](./data/elasticsearch.md)
- **S3 Data Lake:** [Документация S3 Data Lake](./data/s3-datalake.md)
- **Prometheus:** [Документация Prometheus](./observability/prometheus.md)
- **Grafana:** [Документация Grafana](./observability/grafana.md)
- **Loki:** [Документация Loki](./observability/loki.md)
- **Jaeger:** [Документация Jaeger](./observability/jaeger.md)
- **OpenTelemetry Collector:** [Документация OpenTelemetry Collector](./observability/opentelemetry-collector.md)
- **PagerDuty:** [Документация PagerDuty](./observability/pagerduty.md)
- **Keycloak:** [Документация Keycloak](./security/keycloak.md)
- **WAF / API Shield:** [Документация WAF / API Shield](./security/waf-api-shield.md)
- **Network Firewall:** [Документация Network Firewall](./security/firewall.md)
- **Secrets Vault:** [Документация Secrets Vault](./security/secrets-vault.md)
- **IDS / IPS:** [Документация IDS / IPS](./security/ids-ips.md)

## Обновления

Документация обновляется по мере добавления новых функций и улучшений компонентов.

**Последнее обновление:** Декабрь 2024

**Версия документации:** 1.0

## Обратная связь

Если вы нашли ошибку в документации или у вас есть предложения по улучшению, пожалуйста, создайте issue в репозитории проекта.

## Дополнительные ресурсы

- [Официальная документация Apache Kafka](https://kafka.apache.org/documentation/)
- [Официальная документация RabbitMQ](https://www.rabbitmq.com/documentation.html)
- [Официальная документация ActiveMQ](https://activemq.apache.org/documentation)
- [Официальная документация AWS SQS](https://docs.aws.amazon.com/sqs/)
- [Официальная документация Azure Service Bus](https://docs.microsoft.com/azure/service-bus-messaging/)
- [Официальная документация Google Cloud Pub/Sub](https://cloud.google.com/pubsub/docs)
- [Официальная документация Kong Gateway](https://docs.konghq.com/gateway/)
- [Официальная документация Apigee API Gateway](https://cloud.google.com/apigee/docs)
- [Официальная документация MuleSoft Anypoint Platform](https://docs.mulesoft.com/)
- [GraphQL Specification](https://graphql.org/learn/)
- [Apollo Federation Documentation](https://www.apollographql.com/docs/federation/)
- [BFF Pattern - Sam Newman](https://samnewman.io/patterns/architectural/bff/)
- [Официальная документация PostgreSQL](https://www.postgresql.org/docs/)
- [Официальная документация MongoDB](https://docs.mongodb.com/)
- [Официальная документация Redis](https://redis.io/docs/)
- [Официальная документация Apache Cassandra](https://cassandra.apache.org/doc/latest/)
- [Официальная документация ClickHouse](https://clickhouse.com/docs/)
- [Официальная документация Snowflake](https://docs.snowflake.com/)
- [Официальная документация Elasticsearch](https://www.elastic.co/guide/en/elasticsearch/reference/current/index.html)
- [Официальная документация AWS S3](https://docs.aws.amazon.com/s3/)
- [Официальная документация Prometheus](https://prometheus.io/docs/)
- [Prometheus Query Language (PromQL)](https://prometheus.io/docs/prometheus/latest/querying/basics/)
- [Официальная документация Grafana](https://grafana.com/docs/)
- [Grafana Data Sources](https://grafana.com/docs/grafana/latest/datasources/)
- [Grafana Dashboards](https://grafana.com/docs/grafana/latest/dashboards/)
- [Grafana Alerting](https://grafana.com/docs/grafana/latest/alerting/)
- [Официальная документация Loki](https://grafana.com/docs/loki/latest/)
- [Loki Query Language (LogQL)](https://grafana.com/docs/loki/latest/logql/)
- [Loki Push API](https://grafana.com/docs/loki/latest/api/#push-log-entries-to-loki)
- [Официальная документация Jaeger](https://www.jaegertracing.io/docs/)
- [Jaeger Architecture](https://www.jaegertracing.io/docs/1.50/architecture/)
- [Jaeger Sampling](https://www.jaegertracing.io/docs/1.50/sampling/)
- [Jaeger Storage Backends](https://www.jaegertracing.io/docs/1.50/deployment/#storage-backends)
- [Официальная документация OpenTelemetry Collector](https://opentelemetry.io/docs/collector/)
- [OpenTelemetry Collector Architecture](https://opentelemetry.io/docs/collector/architecture/)
- [OpenTelemetry Collector Configuration](https://opentelemetry.io/docs/collector/configuration/)
- [OpenTelemetry Transformation Language (OTTL)](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/pkg/ottl)
- [Официальная документация PagerDuty](https://developer.pagerduty.com/docs)
- [PagerDuty Events API v2](https://developer.pagerduty.com/docs/events-api-v2/overview/)
- [PagerDuty Escalation Policies](https://support.pagerduty.com/docs/escalation-policies)
- [PagerDuty Schedules](https://support.pagerduty.com/docs/schedules)
- [PagerDuty Webhooks](https://developer.pagerduty.com/docs/webhooks-v2-overview/)
- [Официальная документация Keycloak](https://www.keycloak.org/docs/)
- [Keycloak Server Administration](https://www.keycloak.org/docs/latest/server_admin/)
- [Keycloak Securing Applications](https://www.keycloak.org/docs/latest/securing_apps/)
- [OAuth 2.0 Specification](https://oauth.net/2/)
- [OpenID Connect Specification](https://openid.net/connect/)
- [SAML 2.0 Specification](http://saml.xml.org/saml-specifications)
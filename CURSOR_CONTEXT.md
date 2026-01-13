# Контекст системы симуляции архитектуры

## Что это за система

Визуальный симулятор архитектуры предприятия для моделирования и анализа работы распределенных систем. Позволяет создавать диаграммы компонентов, настраивать их параметры и наблюдать симуляцию работы в реальном времени с метриками производительности.

## Основные компоненты архитектуры

### 1. Canvas (src/components/canvas/)
- **Canvas.tsx** - основной холст для размещения компонентов
- **CanvasNode.tsx** - визуальное представление компонента на холсте
- **ConnectionLine.tsx** - линии соединений между компонентами
- **ComponentGroup.tsx** - группировка компонентов
- Управление позиционированием, масштабированием, выделением

### 2. Система симуляции (src/core/)

#### EmulationEngine.ts
- Главный движок симуляции
- Управляет жизненным циклом всех компонентов
- Рассчитывает метрики: throughput, latency (p50, p99), error rate, utilization
- Обновляется каждые 100ms
- Содержит специализированные эмуляционные движки для каждого типа компонента

#### DataFlowEngine.ts
- Обрабатывает потоки данных между компонентами
- Генерирует сообщения от источников
- Трансформирует данные при передаче
- Обрабатывает входящие сообщения в целевых компонентах
- Поддерживает форматы: JSON, XML, binary, protobuf, text
- Интегрирован с трассировкой (Jaeger)

#### ComponentStateEngine.ts
- Управляет состоянием компонентов (enabled/disabled)
- Отслеживает зависимости между компонентами
- Обрабатывает каскадные изменения состояния

#### Routing Engines (src/core/*RoutingEngine.ts)
- Специализированные движки для маршрутизации данных
- RabbitMQRoutingEngine, KafkaRoutingEngine, NginxRoutingEngine и др.
- Обрабатывают специфичную логику для каждого типа компонента

#### Emulation Engines (src/core/*EmulationEngine.ts)
- Специализированные движки для симуляции компонентов
- DockerEmulationEngine, KubernetesEmulationEngine, PrometheusEmulationEngine и др.
- Реализуют внутреннюю логику работы компонента
- Рассчитывают специфичные метрики

### 3. Система конфигурации (src/components/config/)

#### ComponentConfigRenderer.tsx
- Главный роутер для отображения конфигурационных панелей
- Определяет какой компонент конфигурации показать по типу

#### Структура конфигураций:
- **api/** - REST, GraphQL, gRPC, SOAP, WebSocket, Webhook
- **messaging/** - Kafka, RabbitMQ, ActiveMQ, SQS, PubSub
- **data/** - PostgreSQL, MongoDB, Redis, Cassandra, ClickHouse, Snowflake, Elasticsearch, S3
- **infrastructure/** - Docker, Kubernetes, Nginx, HAProxy, Envoy, Traefik
- **integration/** - Kong, Apigee, MuleSoft, GraphQL Gateway, BFF
- **observability/** - Prometheus, Grafana, Loki, Jaeger, OpenTelemetry, PagerDuty
- **security/** - Keycloak, WAF, Firewall, Vault, IDS/IPS, VPN
- **devops/** - Jenkins, GitLab CI, ArgoCD, Terraform, Ansible, Harbor
- **ml/** - TensorFlow Serving, PyTorch Serve, Feature Store
- **business/** - CRM, ERP, Payment Gateway, RPA
- **edge/** - Edge Gateway, IoT Gateway, CDN

#### ProfileConfigRenderer.tsx
- Универсальный рендерер конфигураций на основе профилей
- Использует систему профилей (profiles.ts) для определения полей
- Автоматически генерирует UI на основе схемы конфигурации

### 4. State Management (src/store/)

#### useCanvasStore.ts
- Хранит nodes и connections
- Управляет позициями, выделением, группами
- Методы: addNode, updateNode, deleteNode, addConnection, etc.

#### useEmulationStore.ts
- Хранит метрики компонентов и соединений
- Синхронизируется с EmulationEngine
- Предоставляет метрики для UI

#### useComponentStateStore.ts
- Управляет состоянием компонентов (enabled/disabled)
- Интегрирован с ComponentStateEngine

#### useDataFlowStore.ts
- Хранит историю сообщений
- Отслеживает потоки данных

#### useTabStore.ts
- Управляет вкладками (diagram, component config)
- Отслеживает активную вкладку

#### useUIStore.ts
- UI состояние (sidebar, properties panel, etc.)

### 5. Типы данных (src/types/index.ts)

#### CanvasNode
- id, type, position, data (label, config)
- config содержит ComponentConfig с параметрами компонента

#### CanvasConnection
- id, source, target, type (sync/async/http/grpc/websocket)
- sourcePort/targetPort - индексы точек подключения (0-15)
- data содержит ConnectionConfig (latency, bandwidth, packetLoss, etc.)

#### ComponentConfig
- Базовые поля: enabled
- Специфичные поля зависят от типа компонента
- Использует [key: string]: unknown для расширяемости

#### ComponentMetrics
- throughput, latency, latencyP50, latencyP99
- errorRate, utilization, timestamp
- customMetrics для специфичных метрик

#### ConnectionMetrics
- traffic, latency, errorRate, utilization
- throughputDependency, backpressure, bottleneck
- effectiveThroughput, congestion

### 6. Система соединений (src/services/connection/)

- **ConnectionRules.ts** - правила валидации соединений между типами компонентов
- **ConnectionValidator.ts** - валидация соединений
- **ConnectionPoints.ts** - управление точками подключения на компонентах

### 7. UI компоненты (src/components/)

#### layout/
- **Toolbar.tsx** - верхняя панель инструментов
- **Sidebar.tsx** - боковая панель с библиотекой компонентов
- **PropertiesPanel.tsx** - панель свойств выделенного элемента
- **TabBar.tsx** - панель вкладок

#### emulation/
- **MetricsDashboard.tsx** - дашборд метрик
- **MetricsOverlay.tsx** - оверлей метрик на холсте
- **AlertsPanel.tsx** - панель алертов
- **SystemStatsPanel.tsx** - статистика системы

#### ui/
- Shadcn/ui компоненты (Button, Input, Select, Dialog, etc.)

## Принципы работы

### Жизненный цикл симуляции

1. **Инициализация**: EmulationEngine.initialize(nodes, connections)
   - Создаются специализированные движки для каждого компонента
   - Инициализируются конфигурации

2. **Запуск**: EmulationEngine.start()
   - Запускается цикл обновления каждые 100ms
   - DataFlowEngine начинает обрабатывать потоки данных
   - Компоненты начинают генерировать/обрабатывать данные

3. **Обновление метрик**:
   - EmulationEngine рассчитывает метрики компонентов
   - DataFlowEngine обрабатывает сообщения
   - Метрики сохраняются в useEmulationStore

4. **Отображение**:
   - UI читает метрики из store
   - Обновляются визуальные индикаторы на холсте
   - Обновляются графики в дашбордах

### Синхронизация конфигурации

1. Пользователь изменяет конфигурацию в UI
2. updateNode обновляет config в useCanvasStore
3. EmulationEngine получает обновленный config через getNodeConfig
4. Специализированный движок обновляет свою конфигурацию
5. Изменения отражаются в метриках на следующем цикле

### Обработка данных

1. **Генерация**: Источники (API, бизнес-приложения) генерируют DataMessage
2. **Маршрутизация**: RoutingEngine определяет куда направить сообщение
3. **Трансформация**: DataFlowEngine трансформирует формат если нужно
4. **Обработка**: Целевой компонент обрабатывает сообщение
5. **Метрики**: Обновляются метрики throughput, latency, error rate

## Важные паттерны

### Расширяемость компонентов
- Каждый новый тип компонента требует:
  - Конфигурационную панель в src/components/config/
  - Эмуляционный движок в src/core/*EmulationEngine.ts
  - Routing движок в src/core/*RoutingEngine.ts (если нужен)
  - Регистрацию в EmulationEngine и DataFlowEngine

### Профили конфигураций
- Используется система профилей (profiles.ts) для универсальных компонентов
- ProfileConfigRenderer автоматически генерирует UI
- Позволяет быстро добавлять новые типы компонентов

### Метрики
- Все метрики рассчитываются в реальном времени
- Поддерживаются процентили (p50, p99) для анализа производительности
- История метрик хранится в rolling window (500-1000 записей)

### Состояние компонентов
- Компоненты могут быть enabled/disabled
- Изменение состояния влияет на зависимости
- ComponentStateEngine управляет каскадными изменениями

## Технологический стек

- **Frontend**: React 19, TypeScript, Vite
- **UI**: Shadcn/ui, Radix UI, Tailwind CSS, Framer Motion
- **State**: Zustand
- **Canvas**: React Three Fiber (для 3D визуализации), кастомный 2D canvas
- **Формы**: React Hook Form, Zod
- **Графики**: Recharts

## Структура файлов

```
src/
├── components/        # React компоненты
│   ├── canvas/       # Canvas и связанные компоненты
│   ├── config/       # Конфигурационные панели
│   ├── emulation/    # Панели метрик и мониторинга
│   ├── layout/       # Layout компоненты
│   └── ui/           # UI компоненты (Shadcn)
├── core/             # Ядро симуляции
│   ├── EmulationEngine.ts
│   ├── DataFlowEngine.ts
│   ├── ComponentStateEngine.ts
│   └── *RoutingEngine.ts, *EmulationEngine.ts
├── store/            # Zustand stores
├── services/         # Сервисы (connection, etc.)
├── hooks/            # React hooks
├── types/            # TypeScript типы
└── utils/            # Утилиты
```

## Ключевые концепции

1. **Компонент** - визуальный элемент на холсте с конфигурацией и метриками
2. **Соединение** - связь между компонентами с параметрами сети
3. **Эмуляция** - симуляция работы компонента с расчетом метрик
4. **Поток данных** - передача сообщений между компонентами
5. **Метрики** - показатели производительности в реальном времени
6. **Конфигурация** - параметры компонента, влияющие на симуляцию

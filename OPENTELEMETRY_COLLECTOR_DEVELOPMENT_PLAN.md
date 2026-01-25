# План разработки OpenTelemetry Collector

## Анализ текущего состояния

### Что уже реализовано ✅
1. **OpenTelemetryCollectorRoutingEngine** - базовый движок для обработки сообщений через pipelines
2. **OpenTelemetryCollectorConfigAdvanced** - UI компонент для конфигурации
3. **Интеграция в DataFlowEngine** - обработчик для OpenTelemetry Collector
4. **Интеграция в EmulationEngine** - инициализация routing engine
5. **Connection Rules** - частичная интеграция через jaegerRules (экспорт в Jaeger)

### Выявленные проблемы ❌

#### 1. Отсутствие EmulationEngine для метрик
- Нет отдельного `OpenTelemetryCollectorEmulationEngine` для расчета метрик компонента
- Метрики не интегрированы в `updateComponentMetrics()` в EmulationEngine
- Нет расчета throughput, latency, errorRate, utilization на основе реальной работы pipelines

#### 2. Проблемы в UI компоненте
- **Хардкод дефолтных значений** (строки 88-117): receivers, processors, exporters, pipelines заданы жестко
- **Несоответствие имен полей метрик**: UI ожидает `metricsReceivedTotal`, но engine возвращает `metricsReceived`
- **Отсутствие валидации конфигурации**: нет проверки корректности pipelines (receivers/processors/exporters должны существовать)
- **Нет синхронизации с реальными метриками из EmulationEngine**: метрики берутся только из routing engine, но не из useEmulationStore

#### 3. Неполная реализация RoutingEngine
- Processors не реализуют реальную логику (batch, memory_limiter, filter, transform, resource, attributes)
- Нет расчета latency на основе конфигурации processors
- Нет расчета memory usage для memory_limiter
- Нет batch processing с реальными timeout и size лимитами
- Нет поддержки всех типов receivers/exporters (только базовая структура)

#### 4. Отсутствие Connection Rules
- Нет специальных connection rules для OpenTelemetry Collector
- Только частичная интеграция через jaegerRules
- Нет правил для подключения к Prometheus, Loki, другим backends
- Нет автоматической настройки exporters при создании соединений

#### 5. Несоответствие реальной архитектуре OpenTelemetry Collector
- В реальности Collector работает как pull-based (scrapers) и push-based (receivers)
- Нет поддержки service discovery для receivers
- Нет поддержки extensions (health check, pprof, zpages)
- Нет поддержки telemetry самого Collector (self-observability)

## План реализации

### Этап 1: Изучение архитектуры и паттернов

#### 1.1 Изучить архитектуру системы
**Файлы для изучения:**
- `src/core/EmulationEngine.ts` - понять как инициализируются движки, паттерны updateComponentMetrics
- `src/core/DataFlowEngine.ts` - понять как обрабатываются потоки данных
- `src/services/connection/ServiceDiscovery.ts` - понять как разрешаются имена/порты
- `src/store/useEmulationStore.ts` - понять как метрики хранятся и синхронизируются

#### 1.2 Изучить похожие компоненты
**Компоненты для изучения:**
- `PrometheusEmulationEngine` - pull-based компонент observability
- `JaegerEmulationEngine` - traces processing, похожая архитектура
- `GrafanaEmulationEngine` - как интегрируется с другими компонентами
- `LokiEmulationEngine` - logs processing

**Что изучить:**
- Как рассчитываются метрики (throughput, latency, errorRate, utilization)
- Как интегрируются в updateComponentMetrics
- Как синхронизируются с useEmulationStore
- Паттерны инициализации и обновления конфигурации

#### 1.3 Изучить Connection Rules
**Файлы для изучения:**
- `src/services/connection/rules/jaegerRules.ts` - пример интеграции с OpenTelemetry Collector
- `src/services/connection/rules/prometheusRules.ts` - пример pull-based компонента
- `src/services/connection/types.ts` - типы для connection rules

**Что понять:**
- Как автоматически настраиваются exporters при создании соединений
- Как обновляются конфигурации source и target
- Как извлекается metadata для соединений

#### 1.4 Изучить реальную архитектуру OpenTelemetry Collector
**Ресурсы:**
- https://opentelemetry.io/docs/collector/architecture/
- https://opentelemetry.io/docs/collector/configuration/
- https://github.com/open-telemetry/opentelemetry-collector

**Что понять:**
- Архитектура pipelines (receivers → processors → exporters)
- Типы receivers (OTLP, Prometheus, Jaeger, Zipkin, Kafka, File Log, etc.)
- Типы processors (batch, memory_limiter, filter, transform, resource, attributes, etc.)
- Типы exporters (OTLP, Prometheus, Jaeger, Zipkin, Logging, File, etc.)
- Как работает batch processing (timeout, size limits)
- Как работает memory_limiter (checkpoint interval, limit)
- Как работает filter processor (conditions, actions)
- Как работает transform processor (OTTL expressions)
- Self-observability (internal metrics, health check, pprof, zpages)

### Этап 2: Создание OpenTelemetryCollectorEmulationEngine

#### 2.1 Создать файл `src/core/OpenTelemetryCollectorEmulationEngine.ts`

**Структура класса:**
```typescript
export class OpenTelemetryCollectorEmulationEngine {
  private config: OpenTelemetryCollectorConfig | null = null;
  private routingEngine: OpenTelemetryCollectorRoutingEngine;
  
  // Метрики компонента (не путать с телеметрическими данными)
  private metrics: {
    throughput: number; // сообщений/сек через все pipelines
    latency: number; // средняя latency обработки
    latencyP50: number;
    latencyP99: number;
    errorRate: number; // процент ошибок обработки
    utilization: number; // загрузка (0-1) на основе memory usage и throughput
    memoryUsage: number; // текущее использование памяти (MiB)
    memoryLimit: number; // лимит памяти из memory_limiter processors
    activePipelines: number; // количество активных pipelines
    activeReceivers: number; // количество активных receivers
    activeProcessors: number; // количество активных processors
    activeExporters: number; // количество активных exporters
  };
  
  // История для расчета процентилей
  private latencyHistory: number[] = [];
  private MAX_HISTORY_SIZE = 1000;
  
  // Batch queues для каждого pipeline
  private batchQueues: Map<string, {
    items: any[];
    lastFlush: number;
    timeout: number;
    size: number;
  }> = new Map();
  
  // Memory tracking
  private memoryCheckpoint: number = 0;
  private memoryCheckpointInterval: number = 100; // ms
  
  constructor(routingEngine: OpenTelemetryCollectorRoutingEngine) {
    this.routingEngine = routingEngine;
    this.initializeMetrics();
  }
  
  public initializeConfig(node: CanvasNode): void {
    // Инициализация конфигурации из node
    // Синхронизация с routingEngine
  }
  
  public calculateComponentMetrics(): ComponentMetrics {
    // Расчет метрик компонента на основе:
    // - Количества обработанных сообщений из routingEngine
    // - Latency обработки
    // - Memory usage
    // - Error rate
    // - Utilization на основе memory и throughput
  }
  
  public performUpdate(deltaTime: number): void {
    // Обновление batch queues (flush по timeout)
    // Обновление memory checkpoints
    // Расчет текущих метрик
  }
  
  private flushBatchQueues(): void {
    // Flush batch queues по timeout
  }
  
  private updateMemoryUsage(): void {
    // Расчет memory usage на основе:
    // - Количества сообщений в batch queues
    // - Конфигурации memory_limiter processors
    // - Размера обрабатываемых данных
  }
  
  private calculateThroughput(): number {
    // Расчет throughput на основе:
    // - Количества сообщений из routingEngine за последний период
    // - Количества активных pipelines
    // - Конфигурации receivers
  }
  
  private calculateLatency(): number {
    // Расчет latency на основе:
    // - Latency обработки из routingEngine
    // - Latency batch processing
    // - Latency exporters
  }
  
  private calculateErrorRate(): number {
    // Расчет error rate на основе:
    // - Ошибок обработки из routingEngine
    // - Ошибок exporters
    // - Memory limit exceeded
  }
  
  private calculateUtilization(): number {
    // Расчет utilization на основе:
    // - Memory usage / memory limit
    // - Throughput / max throughput (на основе конфигурации)
    // - Количества активных pipelines
  }
}
```

#### 2.2 Интегрировать в EmulationEngine

**В `src/core/EmulationEngine.ts`:**

1. **Добавить Map для emulation engines:**
```typescript
private otelCollectorEmulationEngines: Map<string, OpenTelemetryCollectorEmulationEngine> = new Map();
```

2. **Обновить initializeOpenTelemetryCollectorEngine:**
```typescript
private initializeOpenTelemetryCollectorEngine(node: CanvasNode): void {
  // Создать routing engine если нет
  if (!this.otelCollectorEngines.has(node.id)) {
    const routingEngine = new OpenTelemetryCollectorRoutingEngine();
    routingEngine.setGetJaegerEnginesCallback(() => this.getAllJaegerEngines());
    routingEngine.initializeConfig(node);
    this.otelCollectorEngines.set(node.id, routingEngine);
  }
  
  // Создать emulation engine
  if (!this.otelCollectorEmulationEngines.has(node.id)) {
    const routingEngine = this.otelCollectorEngines.get(node.id)!;
    const emulationEngine = new OpenTelemetryCollectorEmulationEngine(routingEngine);
    emulationEngine.initializeConfig(node);
    this.otelCollectorEmulationEngines.set(node.id, emulationEngine);
  } else {
    // Обновить конфигурацию
    const emulationEngine = this.otelCollectorEmulationEngines.get(node.id)!;
    emulationEngine.initializeConfig(node);
  }
}
```

3. **Добавить case в updateComponentMetrics:**
```typescript
case 'otel-collector':
  this.simulateOpenTelemetryCollector(node, config, metrics, hasIncomingConnections);
  break;
```

4. **Реализовать simulateOpenTelemetryCollector:**
```typescript
private simulateOpenTelemetryCollector(
  node: CanvasNode,
  config: ComponentConfig,
  metrics: ComponentMetrics,
  hasIncomingConnections: boolean
): void {
  const emulationEngine = this.otelCollectorEmulationEngines.get(node.id);
  if (!emulationEngine) {
    // Если engine не инициализирован, использовать дефолтные метрики
    return;
  }
  
  // Получить метрики из emulation engine
  const otelMetrics = emulationEngine.calculateComponentMetrics();
  
  // Обновить метрики компонента
  metrics.throughput = otelMetrics.throughput;
  metrics.latency = otelMetrics.latency;
  metrics.latencyP50 = otelMetrics.latencyP50;
  metrics.latencyP99 = otelMetrics.latencyP99;
  metrics.errorRate = otelMetrics.errorRate;
  metrics.utilization = otelMetrics.utilization;
  
  // Добавить custom metrics
  metrics.customMetrics = {
    memoryUsage: otelMetrics.memoryUsage,
    memoryLimit: otelMetrics.memoryLimit,
    activePipelines: otelMetrics.activePipelines,
    activeReceivers: otelMetrics.activeReceivers,
    activeProcessors: otelMetrics.activeProcessors,
    activeExporters: otelMetrics.activeExporters,
  };
}
```

5. **Добавить performUpdate для OpenTelemetry Collector:**
```typescript
// В методе performComponentUpdates, после других компонентов:
for (const [nodeId, otelEmulationEngine] of this.otelCollectorEmulationEngines.entries()) {
  try {
    otelEmulationEngine.performUpdate(deltaTime);
  } catch (error) {
    const node = this.nodes.find(n => n.id === nodeId);
    errorCollector.addError(error as Error, {
      severity: 'warning',
      source: 'component-engine',
      componentId: nodeId,
      componentLabel: node?.data.label,
      componentType: node?.type,
      context: { engine: 'otel-collector', operation: 'performUpdate' },
    });
  }
}
```

### Этап 3: Улучшение OpenTelemetryCollectorRoutingEngine

#### 3.1 Реализовать реальную логику processors

**Batch Processor:**
- Реальная батчизация сообщений
- Flush по timeout и size
- Учет latency батчизации

**Memory Limiter Processor:**
- Реальный расчет memory usage
- Проверка лимита перед обработкой
- Отбрасывание сообщений при превышении лимита

**Filter Processor:**
- Реальная фильтрация на основе условий
- Поддержка OTTL expressions (упрощенная версия)

**Transform Processor:**
- Реальная трансформация данных
- Поддержка OTTL expressions (упрощенная версия)

**Resource Processor:**
- Добавление resource attributes
- Мердж с существующими attributes

**Attributes Processor:**
- Модификация attributes
- Добавление/удаление/обновление attributes

#### 3.2 Улучшить расчет latency

**Учитывать:**
- Latency receivers (network latency)
- Latency processors (batch timeout, processing time)
- Latency exporters (network latency, retry logic)
- Latency batch processing

#### 3.3 Улучшить обработку ошибок

**Типы ошибок:**
- Memory limit exceeded
- Exporter connection errors
- Invalid data format
- Processor errors

**Обработка:**
- Retry logic для exporters
- Error tracking
- Error rate calculation

### Этап 4: Улучшение UI компонента

#### 4.1 Убрать хардкод дефолтных значений

**Использовать профиль из `profiles.ts`:**
```typescript
import { OBSERVABILITY_PROFILES } from './profiles';

const profile = OBSERVABILITY_PROFILES['otel-collector'];
const defaults = profile?.defaults || {};

// Использовать defaults вместо хардкода
const receivers = config.receivers || defaults.receivers || [];
const processors = config.processors || defaults.processors || [];
const exporters = config.exporters || defaults.exporters || [];
const pipelines = config.pipelines || defaults.pipelines || [];
```

#### 4.2 Исправить несоответствие имен полей метрик

**В OpenTelemetryCollectorRoutingEngine.getMetrics():**
```typescript
public getMetrics() {
  return {
    // Добавить Total версии для совместимости
    metricsReceived: this.metricsReceived,
    metricsReceivedTotal: this.metricsReceived, // для UI
    tracesReceived: this.tracesReceived,
    tracesReceivedTotal: this.tracesReceived, // для UI
    logsReceived: this.logsReceived,
    logsReceivedTotal: this.logsReceived, // для UI
    metricsExported: this.metricsExported,
    metricsExportedTotal: this.metricsExported, // для UI
    tracesExported: this.tracesExported,
    tracesExportedTotal: this.tracesExported, // для UI
    logsExported: this.logsExported,
    logsExportedTotal: this.logsExported, // для UI
    // ... остальные поля
  };
}
```

**Или исправить UI для использования правильных имен:**
```typescript
const metrics = otelEngine.getMetrics();
setRealMetrics({
  metricsReceived: metrics.metricsReceived, // исправлено
  tracesReceived: metrics.tracesReceived, // исправлено
  // ...
});
```

#### 4.3 Добавить валидацию конфигурации

**Валидация pipelines:**
- Проверка что receivers существуют
- Проверка что processors существуют
- Проверка что exporters существуют
- Проверка что pipeline type соответствует receivers/exporters

**Валидация receivers/exporters:**
- Проверка корректности endpoints
- Проверка что порты не конфликтуют

#### 4.4 Синхронизировать с useEmulationStore

**Использовать метрики из EmulationEngine:**
```typescript
import { useEmulationStore } from '@/store/useEmulationStore';

const { getComponentMetrics } = useEmulationStore();
const componentMetrics = getComponentMetrics(componentId);

// Использовать componentMetrics для отображения:
// - throughput
// - latency
// - errorRate
// - utilization
// - customMetrics (memoryUsage, activePipelines, etc.)
```

### Этап 5: Создание Connection Rules

#### 5.1 Создать `src/services/connection/rules/otelCollectorRules.ts`

**Правила для подключения к OpenTelemetry Collector:**
- Любой компонент может отправлять данные в OpenTelemetry Collector
- Автоматическая настройка receivers при создании соединения
- Автоматическая настройка pipelines

**Правила для подключения от OpenTelemetry Collector:**
- OpenTelemetry Collector может экспортировать в Prometheus, Jaeger, Loki, etc.
- Автоматическая настройка exporters при создании соединения
- Автоматическая настройка pipelines

**Пример структуры:**
```typescript
export function createOTelCollectorReceiverRule(discovery: ServiceDiscovery): ConnectionRule {
  return {
    sourceType: '*', // Любой компонент
    targetTypes: ['otel-collector'],
    priority: 10,
    
    updateTargetConfig: (source, otelCollector, connection, metadata) => {
      // Автоматически создать receiver для source типа
      // Автоматически добавить в соответствующий pipeline
    },
    
    extractMetadata: (source, otelCollector, connection) => {
      // Извлечь metadata для подключения
    },
    
    validateConnection: (source, target, connection) => {
      // Валидация соединения
    },
  };
}

export function createOTelCollectorExporterRule(discovery: ServiceDiscovery): ConnectionRule {
  return {
    sourceType: 'otel-collector',
    targetTypes: ['prometheus', 'jaeger', 'loki', 'grafana', '*'], // Может экспортировать в разные backends
    priority: 10,
    
    updateSourceConfig: (otelCollector, target, connection, metadata) => {
      // Автоматически создать exporter для target типа
      // Автоматически добавить в соответствующий pipeline
    },
    
    extractMetadata: (otelCollector, target, connection) => {
      // Извлечь metadata для экспорта
    },
    
    validateConnection: (source, target, connection) => {
      // Валидация соединения
    },
  };
}
```

#### 5.2 Зарегистрировать правила в ConnectionRules

**В `src/services/connection/rules/index.ts`:**
```typescript
import { createOTelCollectorReceiverRule, createOTelCollectorExporterRule } from './otelCollectorRules';

export function getAllConnectionRules(discovery: ServiceDiscovery): ConnectionRule[] {
  return [
    // ... существующие правила
    createOTelCollectorReceiverRule(discovery),
    createOTelCollectorExporterRule(discovery),
  ];
}
```

### Этап 6: Улучшение соответствия реальной архитектуре

#### 6.1 Поддержка pull-based receivers

**Prometheus Receiver:**
- Scraping метрик по интервалу
- Service discovery для targets
- Relabeling

**File Log Receiver:**
- Мониторинг файлов
- Parsing логов
- Rotating files

#### 6.2 Поддержка extensions

**Health Check Extension:**
- Health check endpoint
- Status компонента

**Pprof Extension:**
- Профилирование производительности

**Zpages Extension:**
- Debug информация
- Pipeline status

#### 6.3 Self-observability

**Internal Metrics:**
- Метрики самого Collector
- Pipeline metrics
- Receiver/Processor/Exporter metrics

**Health Status:**
- Health check на основе состояния pipelines
- Error status

### Этап 7: Тестирование и валидация

#### 7.1 Тестирование симуляции

**Проверить:**
- Метрики рассчитываются корректно
- Latency соответствует реальной обработке
- Memory usage рассчитывается правильно
- Batch processing работает корректно
- Error rate отражает реальные ошибки

#### 7.2 Тестирование UI

**Проверить:**
- Конфигурация сохраняется корректно
- Метрики отображаются в реальном времени
- Валидация работает
- Connection rules применяются автоматически

#### 7.3 Тестирование интеграции

**Проверить:**
- Интеграция с Prometheus
- Интеграция с Jaeger
- Интеграция с Loki
- Интеграция с другими компонентами

## Приоритеты реализации

### Высокий приоритет (критично для работы)
1. ✅ Этап 2: Создание OpenTelemetryCollectorEmulationEngine
2. ✅ Этап 4.1: Убрать хардкод дефолтных значений
3. ✅ Этап 4.2: Исправить несоответствие имен полей метрик
4. ✅ Этап 4.4: Синхронизировать с useEmulationStore

### Средний приоритет (важно для реалистичности)
5. ✅ Этап 3: Улучшение OpenTelemetryCollectorRoutingEngine
6. ✅ Этап 5: Создание Connection Rules
7. ✅ Этап 4.3: Добавить валидацию конфигурации

### Низкий приоритет (улучшения)
8. ✅ Этап 6: Улучшение соответствия реальной архитектуре
9. ✅ Этап 7: Тестирование и валидация

## Критерии готовности

### Минимальные требования ✅ ВЫПОЛНЕНО
- [x] OpenTelemetryCollectorEmulationEngine создан и интегрирован
- [x] Метрики рассчитываются и отображаются в UI
- [x] Хардкод убран, используются значения из конфигурации
- [x] Connection rules работают для основных сценариев

### Полные требования (частично выполнено)
- [x] Batch processing работает корректно (базовая реализация)
- [x] Memory limiter работает корректно (базовая реализация)
- [x] Connection rules работают для всех типов backends (Prometheus, Jaeger, Loki, Grafana)
- [ ] Все processors реализованы с реальной логикой (базовая структура есть, полная логика - в будущем)
- [ ] Валидация конфигурации работает (базовая валидация через Connection Rules)
- [ ] Self-observability реализована (метрики компонента есть, внутренние метрики Collector - в будущем)
- [ ] Тесты пройдены (требуется ручное тестирование)

## Статус реализации (версия 0.1.8v)

### ✅ Выполнено:
1. **OpenTelemetryCollectorEmulationEngine** - создан и интегрирован в EmulationEngine
   - Расчет метрик компонента (throughput, latency, errorRate, utilization)
   - Поддержка batch queues для pipelines
   - Расчет memory usage на основе конфигурации memory_limiter
   - История метрик для расчета per-second значений
   - Процентили latency (P50, P99)

2. **Интеграция в EmulationEngine**
   - Инициализация emulation engine вместе с routing engine
   - Метод `simulateOpenTelemetryCollector()` для расчета метрик
   - Интеграция в `updateComponentMetrics()`
   - `performUpdate()` для обновления batch queues и memory checkpoints

3. **Убраны хардкоды из UI**
   - Дефолтные значения receivers, processors, exporters, pipelines убраны
   - Используются только значения из конфигурации компонента
   - UI синхронизирован с useEmulationStore для отображения метрик

4. **Исправлено несоответствие имен метрик**
   - Добавлены Total версии в `getMetrics()` (metricsReceivedTotal, tracesReceivedTotal, etc.)
   - UI использует правильные имена полей

5. **Connection Rules**
   - `createOTelCollectorReceiverRule()` - автоматическое создание receivers при подключении к Collector
   - `createOTelCollectorExporterRule()` - автоматическое создание exporters при экспорте из Collector
   - Поддержка Prometheus, Jaeger, Loki, Grafana и других backends
   - Автоматическая настройка pipelines при создании соединений

### ✅ Выполнено в версии 0.1.8v (дополнительно):
1. **Улучшена реализация processors** ✅
   - ✅ Реальная логика memory_limiter с проверкой лимита памяти (отбрасывает сообщения при превышении)
   - ✅ Реальная логика filter processor с условиями (include/exclude)
   - ✅ Реальная логика transform processor (базовая поддержка)
   - ✅ Реальная логика resource processor (добавление resource attributes)
   - ✅ Реальная логика attributes processor (insert/update/delete/upsert)
   - ✅ Batch processor интегрирован с batch queues в EmulationEngine
   - ✅ Все processors используют конфигурацию без хардкода

2. **Валидация конфигурации** ✅
   - ✅ Проверка существования receivers в pipelines
   - ✅ Проверка существования processors в pipelines
   - ✅ Проверка существования exporters в pipelines
   - ✅ Предупреждения при отсутствии receivers/exporters

3. **Интеграция с EmulationEngine** ✅
   - ✅ Memory usage callback для memory_limiter processor
   - ✅ Metrics callback для записи latency и ошибок
   - ✅ Автоматическая запись latency в EmulationEngine
   - ✅ Автоматическая запись ошибок (dropped messages, processing errors)

4. **Улучшен расчет latency** ✅
   - ✅ Учет latency обработки каждого processor
   - ✅ Учет latency exporters
   - ✅ Запись latency в EmulationEngine для расчета процентилей

### ⏳ Осталось реализовать (для будущих версий):
1. **Расширенная реализация processors**
   - Полная поддержка OTTL expressions в transform processor
   - Полная поддержка OTTL expressions в filter processor
   - Более сложные условия фильтрации
   - Поддержка всех типов processors (sampling, tail_sampling, etc.)

2. **Валидация конфигурации**
   - Проверка что receivers/processors/exporters существуют в pipelines
   - Проверка корректности endpoints
   - Проверка что pipeline type соответствует receivers/exporters

3. **Self-observability**
   - Internal metrics самого Collector
   - Health check endpoint
   - Pipeline status metrics

4. **Pull-based receivers**
   - Prometheus receiver с scraping
   - File log receiver с мониторингом файлов

5. **Extensions**
   - Health check extension
   - Pprof extension
   - Zpages extension

## Примечания

1. **Не копировать слепо другие компоненты** - OpenTelemetry Collector уникален по архитектуре (pipelines, receivers, processors, exporters)
2. **Опираться на реальную документацию** - изучать официальную документацию OpenTelemetry Collector
3. **Избегать хардкода** - все значения должны браться из конфигурации или профилей
4. **Соответствовать реальности** - симуляция должна отражать реальное поведение Collector
5. **Интегрироваться с системой** - использовать существующие паттерны EmulationEngine, DataFlowEngine, Connection Rules

## Следующие шаги

1. Начать с Этапа 1 - изучить архитектуру и паттерны
2. Реализовать Этап 2 - создать OpenTelemetryCollectorEmulationEngine
3. Исправить критические проблемы (Этап 4.1, 4.2, 4.4)
4. Продолжить с остальными этапами по приоритетам

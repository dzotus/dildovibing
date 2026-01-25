# OpenTelemetry Collector - Документация компонента

## Обзор

OpenTelemetry Collector - это vendor-agnostic pipeline для приема, обработки и экспорта телеметрических данных (traces, metrics, logs). Компонент OpenTelemetry Collector в системе симуляции полностью эмулирует поведение реального OpenTelemetry Collector, включая receivers для приема данных, processors для обработки и трансформации, exporters для отправки данных, pipelines для маршрутизации данных и полный набор возможностей OpenTelemetry Collector.

### Основные возможности

- ✅ **Receivers** - Прием данных из различных источников (OTLP, Prometheus, Jaeger, Zipkin, Kafka, File Log)
- ✅ **Processors** - Обработка и трансформация данных (batch, memory_limiter, filter, transform, resource, attributes)
- ✅ **Exporters** - Экспорт данных в различные backends (OTLP, Prometheus, Jaeger, Zipkin, Logging, File)
- ✅ **Pipelines** - Маршрутизация данных через receivers → processors → exporters
- ✅ **Data Type Routing** - Автоматическая маршрутизация traces, metrics, logs по типам
- ✅ **Format Conversion** - Конвертация между форматами (Jaeger → OTLP, Prometheus → OTLP)
- ✅ **Batch Processing** - Группировка данных в батчи с настраиваемыми timeout и size
- ✅ **Memory Limiting** - Контроль использования памяти с drop при превышении лимита
- ✅ **Метрики Collector** - Полный набор метрик производительности и использования

---

## Основные функции

### 1. Receivers (Приемники)

**Описание:** Receivers принимают телеметрические данные из различных источников.

**Поддерживаемые типы:**
- **OTLP** - OpenTelemetry Protocol (traces, metrics, logs через gRPC/HTTP)
- **Prometheus** - Scraping и remote write
- **Jaeger** - Jaeger traces (thrift/gRPC)
- **Zipkin** - Zipkin traces
- **Kafka** - Kafka messages
- **File Log** - Логи из файлов

**Параметры Receiver:**
- **id** - Уникальный идентификатор (обязательно)
- **type** - Тип receiver (обязательно)
- **enabled** - Включен ли receiver (по умолчанию: `true`)
- **endpoint** - Endpoint для приема данных (опционально)
- **config** - Дополнительная конфигурация (опционально)

**Пример конфигурации:**
```json
{
  "receivers": [
    {
      "id": "otlp-receiver",
      "type": "otlp",
      "enabled": true,
      "endpoint": "0.0.0.0:4317"
    },
    {
      "id": "prometheus-receiver",
      "type": "prometheus",
      "enabled": true,
      "endpoint": "0.0.0.0:8888"
    }
  ]
}
```

**Как работает:**
1. Receivers принимают данные от компонентов через connections
2. Тип данных определяется автоматически (traces, metrics, logs)
3. Данные маршрутизируются в соответствующие pipelines

### 2. Processors (Процессоры)

**Описание:** Processors обрабатывают и трансформируют данные перед экспортом.

**Поддерживаемые типы:**

#### 2.1. Batch Processor

**Описание:** Группирует данные в батчи для оптимизации экспорта.

**Параметры:**
- **timeout** - Таймаут для flush батча (например: `1s`, `5s`)
- **send_batch_size** - Максимальный размер батча (по умолчанию: `8192`)

**Пример:**
```json
{
  "id": "batch-processor",
  "type": "batch",
  "enabled": true,
  "config": {
    "timeout": "1s",
    "send_batch_size": 8192
  }
}
```

**Как работает:**
- Данные накапливаются в батч до достижения `send_batch_size` или `timeout`
- Батч отправляется в exporters при flush
- Уменьшает количество запросов к exporters

#### 2.2. Memory Limiter Processor

**Описание:** Контролирует использование памяти и отбрасывает данные при превышении лимита.

**Параметры:**
- **limit_mib** - Лимит памяти в MiB (по умолчанию: `512`)
- **limit_percent** - Лимит в процентах от доступной памяти (по умолчанию: `80`)

**Пример:**
```json
{
  "id": "memory-limiter",
  "type": "memory_limiter",
  "enabled": true,
  "config": {
    "limit_mib": 512,
    "limit_percent": 80
  }
}
```

**Как работает:**
- Проверяет использование памяти периодически
- При превышении лимита отбрасывает новые данные
- Защищает от перегрузки памяти

#### 2.3. Filter Processor

**Описание:** Фильтрует данные по условиям.

**Параметры:**
- **include** - Условия для включения данных
- **exclude** - Условия для исключения данных
- **error_mode** - Режим обработки ошибок (`ignore` или `propagate`)

**Пример:**
```json
{
  "id": "filter-processor",
  "type": "filter",
  "enabled": true,
  "config": {
    "include": [
      {
        "match_type": "strict",
        "attributes": [
          { "key": "service.name", "value": "api-service" }
        ]
      }
    ]
  }
}
```

#### 2.4. Transform Processor

**Описание:** Трансформирует данные с помощью OTTL (OpenTelemetry Transformation Language).

**Параметры:**
- **trace_statements** - OTTL выражения для traces
- **metric_statements** - OTTL выражения для metrics
- **log_statements** - OTTL выражения для logs

**Пример:**
```json
{
  "id": "transform-processor",
  "type": "transform",
  "enabled": true,
  "config": {
    "trace_statements": [
      {
        "context": "span",
        "statements": [
          "set(attributes[\"custom.key\"], \"custom.value\")"
        ]
      }
    ]
  }
}
```

#### 2.5. Resource Processor

**Описание:** Добавляет или изменяет resource attributes.

**Параметры:**
- **attributes** - Атрибуты для добавления/изменения

**Пример:**
```json
{
  "id": "resource-processor",
  "type": "resource",
  "enabled": true,
  "config": {
    "attributes": [
      { "key": "environment", "value": "production" },
      { "key": "region", "value": "us-east-1" }
    ]
  }
}
```

#### 2.6. Attributes Processor

**Описание:** Изменяет attributes в spans, metrics, logs.

**Параметры:**
- **actions** - Действия для изменения attributes (insert, update, upsert, delete)

**Пример:**
```json
{
  "id": "attributes-processor",
  "type": "attributes",
  "enabled": true,
  "config": {
    "actions": [
      {
        "key": "http.status_code",
        "action": "insert",
        "value": 200
      }
    ]
  }
}
```

### 3. Exporters (Экспортеры)

**Описание:** Exporters отправляют обработанные данные в различные backends.

**Поддерживаемые типы:**
- **OTLP** - OpenTelemetry Protocol (gRPC/HTTP)
- **Prometheus** - Prometheus metrics
- **Jaeger** - Jaeger traces
- **Zipkin** - Zipkin traces
- **Logging** - Логирование данных
- **File** - Сохранение в файлы

**Параметры Exporter:**
- **id** - Уникальный идентификатор (обязательно)
- **type** - Тип exporter (обязательно)
- **enabled** - Включен ли exporter (по умолчанию: `true`)
- **endpoint** - Endpoint для отправки данных (опционально)
- **config** - Дополнительная конфигурация (опционально)

**Пример конфигурации:**
```json
{
  "exporters": [
    {
      "id": "otlp-exporter",
      "type": "otlp",
      "enabled": true,
      "endpoint": "http://backend:4317"
    },
    {
      "id": "jaeger-exporter",
      "type": "jaeger",
      "enabled": true,
      "endpoint": "http://jaeger:14268"
    }
  ]
}
```

**Как работает:**
1. Exporters получают обработанные данные от processors
2. Данные конвертируются в формат целевого backend
3. Данные отправляются в соответствующий endpoint

### 4. Pipelines (Пайплайны)

**Описание:** Pipelines определяют маршрут данных через receivers → processors → exporters.

**Структура Pipeline:**
- **id** - Уникальный идентификатор (обязательно)
- **name** - Имя pipeline (обязательно)
- **type** - Тип данных: `traces`, `metrics`, `logs` (обязательно)
- **receivers** - Список receiver IDs (обязательно)
- **processors** - Список processor IDs (опционально)
- **exporters** - Список exporter IDs (обязательно)

**Пример конфигурации:**
```json
{
  "pipelines": [
    {
      "id": "traces-pipeline",
      "name": "Traces Pipeline",
      "type": "traces",
      "receivers": ["otlp-receiver", "jaeger-receiver"],
      "processors": ["batch-processor", "memory-limiter"],
      "exporters": ["otlp-exporter", "jaeger-exporter"]
    },
    {
      "id": "metrics-pipeline",
      "name": "Metrics Pipeline",
      "type": "metrics",
      "receivers": ["otlp-receiver", "prometheus-receiver"],
      "processors": ["batch-processor"],
      "exporters": ["otlp-exporter", "prometheus-exporter"]
    }
  ]
}
```

**Как работает:**
1. Данные поступают в receivers
2. Тип данных определяется автоматически
3. Данные маршрутизируются в соответствующий pipeline
4. Данные обрабатываются через processors
5. Данные экспортируются через exporters

### 5. Data Type Routing (Маршрутизация по типам)

**Описание:** OpenTelemetry Collector автоматически определяет тип данных и маршрутизирует их в соответствующие pipelines.

**Типы данных:**
- **traces** - Трассировки (spans)
- **metrics** - Метрики
- **logs** - Логи

**Как определяется тип:**
1. По типу source node (Prometheus → metrics, Jaeger → traces, Loki → logs)
2. По формату сообщения (OTLP может содержать все типы)
3. По содержимому payload

**Пример маршрутизации:**
- Данные от Prometheus → `metrics-pipeline`
- Данные от Jaeger → `traces-pipeline`
- Данные от Loki → `logs-pipeline`
- OTLP данные → соответствующий pipeline по содержимому

### 6. Format Conversion (Конвертация форматов)

**Описание:** OpenTelemetry Collector конвертирует данные между различными форматами.

**Поддерживаемые конвертации:**
- **Jaeger → OTLP** - Jaeger spans в OTLP traces
- **Prometheus → OTLP** - Prometheus metrics в OTLP metrics
- **Zipkin → OTLP** - Zipkin traces в OTLP traces
- **OTLP → Jaeger** - OTLP traces в Jaeger spans
- **OTLP → Prometheus** - OTLP metrics в Prometheus format

**Как работает:**
1. Receiver принимает данные в исходном формате
2. Данные конвертируются в OTLP для внутренней обработки
3. Exporter конвертирует данные в целевой формат
4. Данные отправляются в backend

---

## Руководство пользователя

### Быстрый старт

1. **Добавление компонента OpenTelemetry Collector:**
   - Перетащите компонент "OpenTelemetry Collector" из библиотеки компонентов на canvas
   - Откройте панель конфигурации компонента

2. **Настройка Receivers:**
   - Перейдите на вкладку **"Receivers"**
   - Нажмите кнопку **"Add Receiver"**
   - Выберите тип receiver (OTLP, Prometheus, Jaeger и т.д.)
   - Укажите endpoint (опционально)
   - Нажмите **"Save"**

3. **Настройка Processors:**
   - Перейдите на вкладку **"Processors"**
   - Нажмите кнопку **"Add Processor"**
   - Выберите тип processor (batch, memory_limiter, filter и т.д.)
   - Настройте параметры processor
   - Нажмите **"Save"**

4. **Настройка Exporters:**
   - Перейдите на вкладку **"Exporters"**
   - Нажмите кнопку **"Add Exporter"**
   - Выберите тип exporter (OTLP, Prometheus, Jaeger и т.д.)
   - Укажите endpoint для отправки данных
   - Нажмите **"Save"**

5. **Создание Pipeline:**
   - Перейдите на вкладку **"Pipelines"**
   - Нажмите кнопку **"Add Pipeline"**
   - Укажите имя и тип pipeline (traces, metrics, logs)
   - Выберите receivers, processors, exporters
   - Нажмите **"Save"**

### Работа с Receivers

#### Создание OTLP Receiver

1. Перейдите на вкладку **"Receivers"**
2. Нажмите кнопку **"Add Receiver"**
3. Выберите тип **"OTLP"**
4. Укажите endpoint (например: `0.0.0.0:4317`)
5. Нажмите **"Save"**

**Примечание:** OTLP receiver принимает traces, metrics и logs через gRPC или HTTP.

#### Создание Prometheus Receiver

1. Выберите тип **"Prometheus"**
2. Укажите endpoint (например: `0.0.0.0:8888`)
3. Нажмите **"Save"**

**Примечание:** Prometheus receiver может принимать данные через scraping или remote write.

#### Создание Jaeger Receiver

1. Выберите тип **"Jaeger"**
2. Укажите endpoint (например: `0.0.0.0:14268`)
3. Нажмите **"Save"**

**Примечание:** Jaeger receiver принимает traces в формате Jaeger (thrift/gRPC).

### Работа с Processors

#### Настройка Batch Processor

1. Перейдите на вкладку **"Processors"**
2. Нажмите кнопку **"Add Processor"**
3. Выберите тип **"Batch"**
4. Настройте параметры:
   - **Timeout** - Таймаут для flush (например: `1s`)
   - **Batch Size** - Максимальный размер батча (например: `8192`)
5. Нажмите **"Save"**

**Рекомендации:**
- Используйте `1s` timeout для большинства случаев
- Используйте `8192` batch size для оптимальной производительности

#### Настройка Memory Limiter Processor

1. Выберите тип **"Memory Limiter"**
2. Настройте параметры:
   - **Limit (MiB)** - Лимит памяти в MiB (например: `512`)
   - **Limit Percent** - Лимит в процентах (например: `80`)
3. Нажмите **"Save"**

**Рекомендации:**
- Установите лимит на 80% от доступной памяти
- Мониторьте метрики memory usage

#### Настройка Filter Processor

1. Выберите тип **"Filter"**
2. Настройте условия:
   - **Include** - Условия для включения данных
   - **Exclude** - Условия для исключения данных
3. Нажмите **"Save"**

**Пример:**
- Включить только данные от `api-service`
- Исключить данные с `error=true`

### Работа с Exporters

#### Создание OTLP Exporter

1. Перейдите на вкладку **"Exporters"**
2. Нажмите кнопку **"Add Exporter"**
3. Выберите тип **"OTLP"**
4. Укажите endpoint (например: `http://backend:4317`)
5. Нажмите **"Save"**

#### Создание Jaeger Exporter

1. Выберите тип **"Jaeger"**
2. Укажите endpoint (например: `http://jaeger:14268`)
3. Нажмите **"Save"**

**Примечание:** При создании connection к Jaeger, exporter автоматически настраивается.

#### Создание Prometheus Exporter

1. Выберите тип **"Prometheus"**
2. Укажите endpoint (например: `http://prometheus:9090`)
3. Нажмите **"Save"**

### Работа с Pipelines

#### Создание Traces Pipeline

1. Перейдите на вкладку **"Pipelines"**
2. Нажмите кнопку **"Add Pipeline"**
3. Заполните параметры:
   - **Name** - Имя pipeline (например: `Traces Pipeline`)
   - **Type** - Выберите `traces`
   - **Receivers** - Выберите receivers (например: `otlp-receiver`, `jaeger-receiver`)
   - **Processors** - Выберите processors (например: `batch-processor`, `memory-limiter`)
   - **Exporters** - Выберите exporters (например: `otlp-exporter`, `jaeger-exporter`)
4. Нажмите **"Save"**

#### Создание Metrics Pipeline

1. Выберите тип **"metrics"**
2. Выберите receivers (например: `otlp-receiver`, `prometheus-receiver`)
3. Выберите processors (например: `batch-processor`)
4. Выберите exporters (например: `otlp-exporter`, `prometheus-exporter`)
5. Нажмите **"Save"**

#### Создание Logs Pipeline

1. Выберите тип **"logs"**
2. Выберите receivers (например: `otlp-receiver`, `filelog-receiver`)
3. Выберите processors (например: `batch-processor`, `filter-processor`)
4. Выберите exporters (например: `otlp-exporter`, `logging-exporter`)
5. Нажмите **"Save"**

---

## Руководство администратора

### Рекомендации по конфигурации

#### Production OpenTelemetry Collector

```json
{
  "receivers": [
    {
      "id": "otlp-receiver",
      "type": "otlp",
      "enabled": true,
      "endpoint": "0.0.0.0:4317"
    },
    {
      "id": "prometheus-receiver",
      "type": "prometheus",
      "enabled": true,
      "endpoint": "0.0.0.0:8888"
    }
  ],
  "processors": [
    {
      "id": "batch-processor",
      "type": "batch",
      "enabled": true,
      "config": {
        "timeout": "1s",
        "send_batch_size": 8192
      }
    },
    {
      "id": "memory-limiter",
      "type": "memory_limiter",
      "enabled": true,
      "config": {
        "limit_mib": 512,
        "limit_percent": 80
      }
    }
  ],
  "exporters": [
    {
      "id": "otlp-exporter",
      "type": "otlp",
      "enabled": true,
      "endpoint": "http://backend:4317"
    },
    {
      "id": "jaeger-exporter",
      "type": "jaeger",
      "enabled": true,
      "endpoint": "http://jaeger:14268"
    }
  ],
  "pipelines": [
    {
      "id": "traces-pipeline",
      "name": "Traces Pipeline",
      "type": "traces",
      "receivers": ["otlp-receiver"],
      "processors": ["batch-processor", "memory-limiter"],
      "exporters": ["otlp-exporter", "jaeger-exporter"]
    },
    {
      "id": "metrics-pipeline",
      "name": "Metrics Pipeline",
      "type": "metrics",
      "receivers": ["otlp-receiver", "prometheus-receiver"],
      "processors": ["batch-processor", "memory-limiter"],
      "exporters": ["otlp-exporter"]
    }
  ]
}
```

**Рекомендации:**
- Используйте batch processor для оптимизации экспорта
- Используйте memory_limiter для защиты от перегрузки памяти
- Разделяйте pipelines по типам данных (traces, metrics, logs)
- Используйте множественные exporters для резервирования
- Мониторьте метрики Collector (throughput, latency, memory usage)

### Оптимизация производительности

**Batch Processing:**
- Используйте `1s` timeout для большинства случаев
- Используйте `8192` batch size для оптимальной производительности
- Увеличьте timeout для низкочастотных данных
- Уменьшите batch size для высоколатентных exporters

**Memory Limiting:**
- Установите лимит на 80% от доступной памяти
- Мониторьте memory usage в метриках
- Настройте алерты при приближении к лимиту

**Pipeline Design:**
- Разделяйте pipelines по типам данных
- Используйте filter processor для уменьшения объема данных
- Используйте transform processor для оптимизации данных
- Минимизируйте количество processors для снижения latency

### Безопасность

#### Управление доступом

- Ограничьте доступ к receivers endpoints
- Используйте TLS для connections к exporters
- Настройте аутентификацию для exporters
- Используйте network policies для изоляции

#### Защита данных

- Используйте filter processor для фильтрации чувствительных данных
- Используйте transform processor для маскировки данных
- Регулярно делайте backup конфигурации
- Мониторьте метрики Collector (errors, dropped messages)

### Мониторинг и алертинг

#### Ключевые метрики

1. **Throughput**
   - Нормальное значение: зависит от нагрузки
   - Алерт: throughput значительно снизился (проблемы с receivers)

2. **Latency**
   - Нормальное значение: latency < 100ms
   - Алерт: latency > 500ms (медленная обработка)

3. **Memory Usage**
   - Нормальное значение: < 80% лимита
   - Алерт: memoryUsage > 80% лимита (приближение к лимиту)

4. **Error Rate**
   - Нормальное значение: errorRate = 0
   - Алерт: errorRate > 0 (проблемы с обработкой или экспортом)

5. **Dropped Messages**
   - Нормальное значение: dropped = 0
   - Алерт: dropped > 0 (memory limit exceeded или filter)

6. **Active Pipelines**
   - Нормальное значение: соответствует конфигурации
   - Алерт: activePipelines = 0 (проблемы с конфигурацией)

---

## Метрики и мониторинг

### Метрики Receivers

- **metricsReceived** - Количество полученных метрик
- **tracesReceived** - Количество полученных traces
- **logsReceived** - Количество полученных логов
- **activeReceivers** - Количество активных receivers

### Метрики Processors

- **activeProcessors** - Количество активных processors
- **memoryUsage** - Использование памяти (MiB)
- **memoryLimit** - Лимит памяти (MiB)
- **droppedMessages** - Количество отброшенных сообщений

### Метрики Exporters

- **metricsExported** - Количество экспортированных метрик
- **tracesExported** - Количество экспортированных traces
- **logsExported** - Количество экспортированных логов
- **activeExporters** - Количество активных exporters

### Метрики Pipelines

- **activePipelines** - Количество активных pipelines
- **throughput** - Пропускная способность (сообщений/сек)
- **latency** - Средняя latency обработки (ms)
- **latencyP50** - 50-й процентиль latency (ms)
- **latencyP99** - 99-й процентиль latency (ms)
- **errorRate** - Процент ошибок (0-1)
- **utilization** - Использование ресурсов (0-1)

### Мониторинг в реальном времени

Все метрики обновляются в реальном времени во время симуляции:
- Метрики синхронизируются из `OpenTelemetryCollectorEmulationEngine` каждые 500ms
- Метрики отображаются в UI компоненте
- Batch queues обновляются в реальном времени
- Memory checkpoints выполняются периодически

---

## Примеры использования

### Пример 1: Базовый Pipeline для Traces

**Сценарий:** Прием traces от компонентов и отправка в Jaeger

```json
{
  "receivers": [
    {
      "id": "otlp-receiver",
      "type": "otlp",
      "enabled": true,
      "endpoint": "0.0.0.0:4317"
    }
  ],
  "processors": [
    {
      "id": "batch-processor",
      "type": "batch",
      "enabled": true,
      "config": {
        "timeout": "1s",
        "send_batch_size": 8192
      }
    }
  ],
  "exporters": [
    {
      "id": "jaeger-exporter",
      "type": "jaeger",
      "enabled": true,
      "endpoint": "http://jaeger:14268"
    }
  ],
  "pipelines": [
    {
      "id": "traces-pipeline",
      "name": "Traces Pipeline",
      "type": "traces",
      "receivers": ["otlp-receiver"],
      "processors": ["batch-processor"],
      "exporters": ["jaeger-exporter"]
    }
  ]
}
```

### Пример 2: Multi-Backend Export

**Сценарий:** Отправка данных в несколько backends

```json
{
  "exporters": [
    {
      "id": "otlp-exporter",
      "type": "otlp",
      "enabled": true,
      "endpoint": "http://backend:4317"
    },
    {
      "id": "jaeger-exporter",
      "type": "jaeger",
      "enabled": true,
      "endpoint": "http://jaeger:14268"
    },
    {
      "id": "prometheus-exporter",
      "type": "prometheus",
      "enabled": true,
      "endpoint": "http://prometheus:9090"
    }
  ],
  "pipelines": [
    {
      "id": "traces-pipeline",
      "name": "Traces Pipeline",
      "type": "traces",
      "receivers": ["otlp-receiver"],
      "processors": ["batch-processor"],
      "exporters": ["otlp-exporter", "jaeger-exporter"]
    },
    {
      "id": "metrics-pipeline",
      "name": "Metrics Pipeline",
      "type": "metrics",
      "receivers": ["otlp-receiver"],
      "processors": ["batch-processor"],
      "exporters": ["otlp-exporter", "prometheus-exporter"]
    }
  ]
}
```

### Пример 3: Memory Limiting

**Сценарий:** Защита от перегрузки памяти

```json
{
  "processors": [
    {
      "id": "memory-limiter",
      "type": "memory_limiter",
      "enabled": true,
      "config": {
        "limit_mib": 512,
        "limit_percent": 80
      }
    },
    {
      "id": "batch-processor",
      "type": "batch",
      "enabled": true,
      "config": {
        "timeout": "1s",
        "send_batch_size": 8192
      }
    }
  ],
  "pipelines": [
    {
      "id": "traces-pipeline",
      "name": "Traces Pipeline",
      "type": "traces",
      "receivers": ["otlp-receiver"],
      "processors": ["memory-limiter", "batch-processor"],
      "exporters": ["otlp-exporter"]
    }
  ]
}
```

**Поведение:**
- При превышении 80% лимита памяти новые данные отбрасываются
- Защищает от перегрузки памяти
- Мониторьте метрики memory usage

### Пример 4: Filter Processing

**Сценарий:** Фильтрация данных перед экспортом

```json
{
  "processors": [
    {
      "id": "filter-processor",
      "type": "filter",
      "enabled": true,
      "config": {
        "include": [
          {
            "match_type": "strict",
            "attributes": [
              { "key": "service.name", "value": "api-service" }
            ]
          }
        ]
      }
    }
  ],
  "pipelines": [
    {
      "id": "traces-pipeline",
      "name": "Traces Pipeline",
      "type": "traces",
      "receivers": ["otlp-receiver"],
      "processors": ["filter-processor", "batch-processor"],
      "exporters": ["otlp-exporter"]
    }
  ]
}
```

**Поведение:**
- Только traces от `api-service` проходят через pipeline
- Остальные traces отбрасываются
- Уменьшает объем экспортируемых данных

### Пример 5: Format Conversion

**Сценарий:** Конвертация Jaeger traces в OTLP

```json
{
  "receivers": [
    {
      "id": "jaeger-receiver",
      "type": "jaeger",
      "enabled": true,
      "endpoint": "0.0.0.0:14268"
    }
  ],
  "exporters": [
    {
      "id": "otlp-exporter",
      "type": "otlp",
      "enabled": true,
      "endpoint": "http://backend:4317"
    }
  ],
  "pipelines": [
    {
      "id": "traces-pipeline",
      "name": "Traces Pipeline",
      "type": "traces",
      "receivers": ["jaeger-receiver"],
      "processors": ["batch-processor"],
      "exporters": ["otlp-exporter"]
    }
  ]
}
```

**Поведение:**
- Jaeger traces принимаются через jaeger-receiver
- Traces конвертируются в OTLP формат
- Traces экспортируются в OTLP backend

---

## Часто задаваемые вопросы (FAQ)

### Что такое OpenTelemetry Collector?

OpenTelemetry Collector - это vendor-agnostic pipeline для приема, обработки и экспорта телеметрических данных (traces, metrics, logs). Collector позволяет централизованно обрабатывать данные от различных источников и отправлять их в различные backends.

### Как работает OpenTelemetry Collector?

1. Receivers принимают данные от компонентов
2. Тип данных определяется автоматически (traces, metrics, logs)
3. Данные маршрутизируются в соответствующие pipelines
4. Processors обрабатывают и трансформируют данные
5. Exporters отправляют данные в backends

### Что такое Pipeline?

Pipeline определяет маршрут данных через receivers → processors → exporters. Каждый pipeline обрабатывает один тип данных (traces, metrics или logs).

### Какой processor использовать?

- **Batch** - для группировки данных в батчи (рекомендуется всегда)
- **Memory Limiter** - для защиты от перегрузки памяти (рекомендуется для production)
- **Filter** - для фильтрации данных
- **Transform** - для трансформации данных
- **Resource** - для добавления resource attributes
- **Attributes** - для изменения attributes

### Как работает Batch Processing?

Batch processor группирует данные в батчи до достижения `send_batch_size` или `timeout`, затем отправляет батч в exporters. Это уменьшает количество запросов и улучшает производительность.

### Как работает Memory Limiter?

Memory limiter проверяет использование памяти периодически. При превышении лимита новые данные отбрасываются для защиты от перегрузки памяти.

### Как мониторить OpenTelemetry Collector?

Используйте метрики самого Collector:
- **Throughput** - нагрузка на Collector
- **Latency** - производительность обработки
- **Memory Usage** - использование памяти
- **Error Rate** - проблемы с обработкой
- **Dropped Messages** - проблемы с memory limit или filter

---

## Дополнительные ресурсы

- [Официальная документация OpenTelemetry Collector](https://opentelemetry.io/docs/collector/)
- [OpenTelemetry Collector Architecture](https://opentelemetry.io/docs/collector/architecture/)
- [OpenTelemetry Collector Configuration](https://opentelemetry.io/docs/collector/configuration/)
- [OpenTelemetry Receivers](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/receiver)
- [OpenTelemetry Processors](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/processor)
- [OpenTelemetry Exporters](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/exporter)
- [OpenTelemetry Transformation Language (OTTL)](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/pkg/ottl)

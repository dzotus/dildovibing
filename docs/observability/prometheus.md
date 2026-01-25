# Prometheus - Документация компонента

## Обзор

Prometheus - это система мониторинга и сбора метрик с временными рядами (time-series database). Компонент Prometheus в системе симуляции полностью эмулирует поведение реального Prometheus, включая pull-based scraping метрик, Service Discovery (Kubernetes, Consul, File, DNS, Static), Alerting Rules с PromQL, Recording Rules, Remote Write, метрики самого Prometheus (TSDB, config, targets, alerting) и полный набор возможностей Prometheus.

### Основные возможности

- ✅ **Pull-based Scraping** - Prometheus сам инициирует HTTP GET запросы к targets для сбора метрик
- ✅ **Service Discovery** - Автоматическое обнаружение targets через Kubernetes, Consul, File, DNS, Static configs
- ✅ **Scrape Configs** - Настройка jobs для scraping метрик с различных источников
- ✅ **Alerting Rules** - Правила алертов с PromQL выражениями и поддержкой `for` duration
- ✅ **Recording Rules** - Предварительно вычисляемые метрики для оптимизации запросов
- ✅ **Remote Write** - Отправка метрик в remote storage (Thanos, Cortex, M3DB)
- ✅ **PromQL** - Язык запросов для анализа метрик
- ✅ **Метрики Prometheus** - Полный набор метрик самого Prometheus (TSDB, config, targets, alerting)

---

## Основные функции

### 1. Pull-based Scraping (Сбор метрик)

**Описание:** Prometheus работает по pull-модели - он сам инициирует HTTP GET запросы к targets для сбора метрик.

**Как работает:**
- Prometheus периодически делает HTTP GET запросы к `/metrics` endpoints компонентов
- Компоненты пассивно экспортируют метрики в Prometheus format
- Prometheus собирает метрики согласно `scrape_interval`
- Метрики хранятся в TSDB (Time-Series Database)

**Параметры Scraping:**
- **scrape_interval** - Интервал между scrapes (по умолчанию: `15s`)
- **scrape_timeout** - Таймаут для scrape запроса (по умолчанию: `10s`)
- **metrics_path** - Путь к метрикам (по умолчанию: `/metrics`)
- **scheme** - Схема протокола: `http` или `https` (по умолчанию: `http`)

**Пример конфигурации:**
```json
{
  "scrapeInterval": "15s",
  "evaluationInterval": "15s",
  "scrape_configs": [
    {
      "job_name": "node-exporter",
      "scrape_interval": "15s",
      "scrape_timeout": "10s",
      "metrics_path": "/metrics",
      "scheme": "http",
      "static_configs": [
        {
          "targets": ["localhost:9100"]
        }
      ]
    }
  ]
}
```

### 2. Service Discovery (Обнаружение сервисов)

**Описание:** Service Discovery позволяет автоматически находить targets для scraping без ручной настройки.

#### 2.1. Static Configs

**Описание:** Статический список targets.

**Пример:**
```json
{
  "job_name": "static-targets",
  "static_configs": [
    {
      "targets": ["localhost:9100", "localhost:9101"],
      "labels": {
        "environment": "production",
        "region": "us-east-1"
      }
    }
  ]
}
```

#### 2.2. Kubernetes Service Discovery

**Описание:** Автоматическое обнаружение Pods, Services, Endpoints в Kubernetes.

**Параметры:**
- **role** - Тип ресурса: `pod`, `service`, `endpoints`, `ingress`, `node`
- **namespaces** - Список namespaces для фильтрации (опционально)
- **selectors** - Label selectors для фильтрации (опционально)

**Пример:**
```json
{
  "job_name": "kubernetes-pods",
  "kubernetes_sd_configs": [
    {
      "role": "pod",
      "namespaces": {
        "names": ["default", "production"]
      }
    }
  ],
  "relabel_configs": [
    {
      "source_labels": ["__meta_kubernetes_pod_annotation_prometheus_io_scrape"],
      "action": "keep",
      "regex": "true"
    }
  ]
}
```

**Автоматическое обнаружение:**
- Pods с annotation `prometheus.io/scrape=true` автоматически обнаруживаются
- Используется `KubernetesEmulationEngine` для получения реальных ресурсов
- Targets обновляются каждые 30 секунд

#### 2.3. Consul Service Discovery

**Описание:** Автоматическое обнаружение сервисов через Consul.

**Параметры:**
- **server** - Адрес Consul сервера (опционально, по умолчанию ищется компонент Consul на canvas)
- **services** - Список сервисов для фильтрации (опционально)
- **tags** - Теги для фильтрации (опционально)

**Пример:**
```json
{
  "job_name": "consul-services",
  "consul_sd_configs": [
    {
      "server": "consul:8500",
      "services": ["web", "api"],
      "tags": ["production"]
    }
  ]
}
```

#### 2.4. File Service Discovery

**Описание:** Обнаружение targets из файлов (JSON или YAML).

**Параметры:**
- **files** - Список путей к файлам с targets
- **refresh_interval** - Интервал обновления (по умолчанию: `5m`)

**Формат файла:**
```json
[
  {
    "targets": ["localhost:9100"],
    "labels": {
      "job": "node-exporter",
      "environment": "production"
    }
  }
]
```

**Пример:**
```json
{
  "job_name": "file-sd",
  "file_sd_configs": [
    {
      "files": ["/etc/prometheus/targets.json"],
      "refresh_interval": "5m"
    }
  ]
}
```

#### 2.5. DNS Service Discovery

**Описание:** Обнаружение targets через DNS SRV записи.

**Параметры:**
- **names** - Список DNS имен для запроса
- **type** - Тип DNS записи: `A`, `AAAA`, `SRV` (по умолчанию: `SRV`)
- **refresh_interval** - Интервал обновления (по умолчанию: `30s`)

**Пример:**
```json
{
  "job_name": "dns-sd",
  "dns_sd_configs": [
    {
      "names": ["_metrics._tcp.example.com"],
      "type": "SRV",
      "refresh_interval": "30s"
    }
  ]
}
```

### 3. Scrape Configs (Конфигурация scraping)

**Описание:** Scrape config определяет, как Prometheus собирает метрики с targets.

**Параметры Scrape Config:**
- **job_name** - Имя job (обязательно, уникальное)
- **scrape_interval** - Интервал scraping (опционально, наследуется от global)
- **scrape_timeout** - Таймаут scraping (опционально, по умолчанию: `10s`)
- **metrics_path** - Путь к метрикам (опционально, по умолчанию: `/metrics`)
- **scheme** - Схема протокола (опционально, по умолчанию: `http`)
- **basic_auth** - Basic Authentication (опционально)
- **bearer_token** - Bearer Token authentication (опционально)
- **tls_config** - TLS конфигурация (опционально)
- **relabel_configs** - Правила relabeling (опционально)
- **static_configs** - Статические targets (опционально)
- **kubernetes_sd_configs** - Kubernetes Service Discovery (опционально)
- **consul_sd_configs** - Consul Service Discovery (опционально)
- **file_sd_configs** - File Service Discovery (опционально)
- **dns_sd_configs** - DNS Service Discovery (опционально)

**Пример:**
```json
{
  "scrape_configs": [
    {
      "job_name": "node-exporter",
      "scrape_interval": "15s",
      "scrape_timeout": "10s",
      "metrics_path": "/metrics",
      "scheme": "http",
      "static_configs": [
        {
          "targets": ["localhost:9100"],
          "labels": {
            "instance": "node1",
            "environment": "production"
          }
        }
      ]
    }
  ]
}
```

### 4. Relabeling (Переименование меток)

**Описание:** Relabeling позволяет изменять, добавлять или удалять labels перед сохранением метрик.

**Actions:**
- **replace** - Заменить значение label
- **keep** - Оставить только matching targets
- **drop** - Удалить matching targets
- **hashmod** - Вычислить hash для sharding
- **labelmap** - Переименовать labels по regex
- **labeldrop** - Удалить labels по regex
- **labelkeep** - Оставить только matching labels

**Пример:**
```json
{
  "relabel_configs": [
    {
      "source_labels": ["__meta_kubernetes_pod_name"],
      "target_label": "pod_name",
      "action": "replace"
    },
    {
      "source_labels": ["__meta_kubernetes_namespace"],
      "target_label": "namespace",
      "action": "replace"
    },
    {
      "source_labels": ["__meta_kubernetes_pod_annotation_prometheus_io_scrape"],
      "action": "keep",
      "regex": "true"
    }
  ]
}
```

### 5. Alerting Rules (Правила алертов)

**Описание:** Alerting rules определяют условия, при которых должны генерироваться алерты.

**Параметры Alerting Rule:**
- **name** - Имя правила (обязательно, уникальное)
- **expr** - PromQL выражение (обязательно)
- **for** - Длительность, в течение которой условие должно быть true (опционально, например: `5m`)
- **labels** - Дополнительные labels для алерта (опционально)
- **annotations** - Аннотации для алерта (опционально)
- **severity** - Уровень серьезности: `critical`, `warning`, `info` (опционально)

**Состояния алерта:**
- **inactive** - Условие не выполнено
- **pending** - Условие выполнено, но `for` duration еще не истек
- **firing** - Условие выполнено и `for` duration истек (алерт активен)

**Пример:**
```json
{
  "alertingRules": [
    {
      "name": "HighCPUUsage",
      "expr": "cpu_usage > 0.8",
      "for": "5m",
      "labels": {
        "severity": "warning",
        "team": "sre"
      },
      "annotations": {
        "summary": "High CPU usage detected",
        "description": "CPU usage is above 80% for more than 5 minutes"
      },
      "severity": "warning"
    },
    {
      "name": "ServiceDown",
      "expr": "up == 0",
      "for": "1m",
      "labels": {
        "severity": "critical"
      },
      "annotations": {
        "summary": "Service is down",
        "description": "Service {{ $labels.instance }} is down"
      },
      "severity": "critical"
    }
  ]
}
```

**Evaluation:**
- Alerting rules оцениваются каждые `evaluation_interval` (по умолчанию: `15s`)
- PromQL выражение выполняется над scraped метриками
- Если условие true и `for` duration истек, алерт переходит в `firing` state
- Алерты отправляются в Alertmanager (если настроен)

### 6. Recording Rules (Правила записи)

**Описание:** Recording rules предварительно вычисляют метрики для оптимизации запросов.

**Параметры Recording Rule:**
- **name** - Имя новой метрики (обязательно)
- **expr** - PromQL выражение (обязательно)
- **labels** - Дополнительные labels (опционально)

**Пример:**
```json
{
  "recordingRules": [
    {
      "name": "cpu_usage:rate5m",
      "expr": "rate(cpu_usage[5m])",
      "labels": {
        "aggregation": "rate"
      }
    },
    {
      "name": "http_requests_total:sum",
      "expr": "sum(http_requests_total) by (method, status)",
      "labels": {
        "aggregation": "sum"
      }
    }
  ]
}
```

**Преимущества:**
- Оптимизация сложных запросов
- Предварительное вычисление агрегаций
- Уменьшение нагрузки на Prometheus

### 7. PromQL (Prometheus Query Language)

**Описание:** PromQL - язык запросов для анализа метрик.

**Основные типы запросов:**
- **Instant Query** - Мгновенное значение метрики
- **Range Query** - Значения метрики за период времени

**Примеры PromQL:**
```promql
# Простая метрика
cpu_usage

# Метрика с фильтром по labels
cpu_usage{instance="node1", environment="production"}

# Rate (скорость изменения)
rate(http_requests_total[5m])

# Агрегация
sum(http_requests_total) by (method, status)

# Сравнение
cpu_usage > 0.8

# Функции
avg(cpu_usage)
max(cpu_usage)
min(cpu_usage)
count(cpu_usage)

# Арифметические операции
cpu_usage * 100
memory_usage / 1024 / 1024
```

**Поддерживаемые операторы:**
- Арифметические: `+`, `-`, `*`, `/`, `%`
- Сравнения: `==`, `!=`, `>`, `<`, `>=`, `<=`
- Логические: `and`, `or`, `unless`

**Поддерживаемые функции:**
- `rate()` - Скорость изменения
- `increase()` - Увеличение за период
- `avg()`, `sum()`, `min()`, `max()`, `count()` - Агрегации
- `histogram_quantile()` - Квантили для гистограмм

### 8. Remote Write (Удаленная запись)

**Описание:** Remote Write позволяет отправлять метрики в remote storage для долгосрочного хранения.

**Параметры Remote Write:**
- **url** - URL remote write endpoint (обязательно)
- **auth** - Authentication (опционально)

**Пример:**
```json
{
  "enableRemoteWrite": true,
  "remoteWrite": [
    {
      "url": "http://thanos-receive:10908/api/v1/receive",
      "auth": "bearer-token"
    }
  ]
}
```

**Поддерживаемые backends:**
- Thanos Receive
- Cortex
- M3DB
- Другие Prometheus Remote Write совместимые системы

### 9. Alertmanager Integration (Интеграция с Alertmanager)

**Описание:** Prometheus отправляет активные алерты в Alertmanager для обработки и уведомлений.

**Параметры:**
- **enableAlertmanager** - Включить интеграцию (по умолчанию: `true`)
- **alertmanagerUrl** - URL Alertmanager (по умолчанию: `http://alertmanager:9093`)

**Пример:**
```json
{
  "enableAlertmanager": true,
  "alertmanagerUrl": "http://alertmanager:9093"
}
```

**Как работает:**
- Prometheus отправляет алерты в `firing` state в Alertmanager
- Alertmanager обрабатывает алерты (группировка, дедупликация, маршрутизация)
- Alertmanager отправляет уведомления через различные receivers (webhook, email, slack, etc.)

---

## Руководство пользователя

### Быстрый старт

1. **Добавление компонента Prometheus:**
   - Перетащите компонент "Prometheus" из библиотеки компонентов на canvas
   - Откройте панель конфигурации компонента

2. **Настройка базовых параметров:**
   - Перейдите на вкладку **"General"**
   - Укажите `scrapeInterval` (по умолчанию: `15s`)
   - Укажите `evaluationInterval` (по умолчанию: `15s`)
   - Укажите `retentionTime` (по умолчанию: `15d`)

3. **Добавление Scrape Config:**
   - Перейдите на вкладку **"Scraping"**
   - Нажмите кнопку **"Add Scrape Config"**
   - Укажите `job_name`
   - Добавьте targets в `static_configs`
   - Нажмите **"Save"**

4. **Настройка Service Discovery:**
   - Перейдите на вкладку **"Service Discovery"**
   - Нажмите кнопку **"Add Service Discovery"**
   - Выберите тип (Kubernetes, Consul, File, DNS)
   - Заполните параметры
   - Нажмите **"Save"**

5. **Создание Alerting Rule:**
   - Перейдите на вкладку **"Alerting"**
   - Нажмите кнопку **"Add Alerting Rule"**
   - Укажите имя, PromQL выражение, `for` duration
   - Нажмите **"Save"**

### Работа со Scrape Configs

#### Создание Scrape Config

1. Перейдите на вкладку **"Scraping"**
2. Нажмите кнопку **"Add Scrape Config"**
3. Заполните параметры:
   - **Job Name** - Имя job (уникальное)
   - **Scrape Interval** - Интервал scraping (опционально)
   - **Scrape Timeout** - Таймаут scraping (опционально)
   - **Metrics Path** - Путь к метрикам (опционально)
   - **Scheme** - Схема протокола (опционально)
4. Добавьте targets:
   - **Static Configs** - Статический список targets
   - **Service Discovery** - Автоматическое обнаружение
5. Нажмите **"Save"**

#### Редактирование Scrape Config

1. Выберите scrape config из списка
2. Нажмите кнопку **"Edit"**
3. Измените параметры
4. Нажмите **"Save"**

#### Удаление Scrape Config

1. Выберите scrape config из списка
2. Нажмите кнопку **"Delete"**
3. Подтвердите удаление

### Работа с Service Discovery

#### Kubernetes Service Discovery

1. Перейдите на вкладку **"Service Discovery"**
2. Нажмите кнопку **"Add Service Discovery"**
3. Выберите тип **"Kubernetes"**
4. Заполните параметры:
   - **Role** - Тип ресурса (pod, service, endpoints, ingress, node)
   - **Namespaces** - Список namespaces (опционально)
   - **Selectors** - Label selectors (опционально)
5. Нажмите **"Save"**

**Автоматическое обнаружение:**
- Pods с annotation `prometheus.io/scrape=true` автоматически обнаруживаются
- Targets обновляются каждые 30 секунд

#### Consul Service Discovery

1. Выберите тип **"Consul"**
2. Заполните параметры:
   - **Server** - Адрес Consul сервера (опционально)
   - **Services** - Список сервисов (опционально)
   - **Tags** - Теги для фильтрации (опционально)
3. Нажмите **"Save"**

#### File Service Discovery

1. Выберите тип **"File"**
2. Заполните параметры:
   - **Files** - Список путей к файлам
   - **Refresh Interval** - Интервал обновления (опционально)
3. Нажмите **"Save"**

### Работа с Alerting Rules

#### Создание Alerting Rule

1. Перейдите на вкладку **"Alerting"**
2. Нажмите кнопку **"Add Alerting Rule"**
3. Заполните параметры:
   - **Name** - Имя правила (уникальное)
   - **Expression** - PromQL выражение
   - **For** - Длительность (опционально, например: `5m`)
   - **Labels** - Дополнительные labels (опционально)
   - **Annotations** - Аннотации (опционально)
   - **Severity** - Уровень серьезности (опционально)
4. Нажмите **"Save"**

**Пример PromQL выражений:**
```promql
# High CPU usage
cpu_usage > 0.8

# Service down
up == 0

# High error rate
rate(http_errors_total[5m]) > 0.1

# Low memory
memory_available < 1024 * 1024 * 1024
```

#### Просмотр активных алертов

1. Перейдите на вкладку **"Alerting"**
2. Просмотрите список активных алертов:
   - **Pending** - Условие выполнено, но `for` duration еще не истек
   - **Firing** - Алерт активен

### Работа с Recording Rules

#### Создание Recording Rule

1. Перейдите на вкладку **"Recording Rules"**
2. Нажмите кнопку **"Add Recording Rule"**
3. Заполните параметры:
   - **Name** - Имя новой метрики
   - **Expression** - PromQL выражение
   - **Labels** - Дополнительные labels (опционально)
4. Нажмите **"Save"**

---

## Руководство администратора

### Рекомендации по конфигурации

#### Production Prometheus

```json
{
  "version": "2.48.0",
  "scrapeInterval": "15s",
  "evaluationInterval": "15s",
  "retentionTime": "30d",
  "storagePath": "/prometheus",
  "enableAlertmanager": true,
  "alertmanagerUrl": "http://alertmanager:9093",
  "enableRemoteWrite": true,
  "remoteWrite": [
    {
      "url": "http://thanos-receive:10908/api/v1/receive"
    }
  ],
  "scrape_configs": [
    {
      "job_name": "kubernetes-pods",
      "kubernetes_sd_configs": [
        {
          "role": "pod"
        }
      ],
      "relabel_configs": [
        {
          "source_labels": ["__meta_kubernetes_pod_annotation_prometheus_io_scrape"],
          "action": "keep",
          "regex": "true"
        }
      ]
    }
  ],
  "alertingRules": [
    {
      "name": "HighCPUUsage",
      "expr": "cpu_usage > 0.8",
      "for": "5m",
      "severity": "warning"
    }
  ]
}
```

**Рекомендации:**
- Используйте Service Discovery для автоматического обнаружения targets
- Настройте Alerting Rules для критичных метрик
- Используйте Recording Rules для оптимизации сложных запросов
- Настройте Remote Write для долгосрочного хранения
- Мониторьте метрики самого Prometheus (scrape errors, TSDB usage)

### Оптимизация производительности

**Scrape Interval:**
- Используйте `15s` для большинства метрик
- Используйте `30s` или `60s` для редко изменяющихся метрик
- Избегайте слишком частого scraping (< 5s) - увеличивает нагрузку

**Retention:**
- Используйте `15d-30d` для локального хранения
- Используйте Remote Write для долгосрочного хранения
- Мониторьте использование диска

**Recording Rules:**
- Используйте для предварительного вычисления сложных агрегаций
- Уменьшает нагрузку на Prometheus при запросах
- Оптимизирует использование памяти

**Service Discovery:**
- Используйте Kubernetes SD для автоматического обнаружения в K8s
- Используйте Consul SD для service mesh
- Используйте File SD для статических конфигураций

### Безопасность

#### Управление доступом

- Используйте TLS для HTTPS scraping
- Используйте Basic Auth или Bearer Token для аутентификации
- Ограничьте доступ к Prometheus UI
- Используйте network policies для изоляции

#### Защита данных

- Регулярно делайте backup конфигурации
- Мониторьте метрики Prometheus (scrape errors, TSDB usage)
- Настройте алерты для критичных проблем

### Мониторинг и алертинг

#### Ключевые метрики

1. **Targets Up/Down**
   - Нормальное значение: все targets up
   - Алерт: targets_down > 0 (проблемы с доступностью targets)

2. **Scrape Errors**
   - Нормальное значение: scrape_errors_total = 0
   - Алерт: scrape_errors_total > 0 (проблемы с scraping)

3. **TSDB Usage**
   - Нормальное значение: зависит от объема данных
   - Алерт: tsdb_storage_blocks_bytes > 80% диска (приближение к лимиту)

4. **Alerting Rules Evaluation**
   - Нормальное значение: evaluation_duration < 1s
   - Алерт: evaluation_duration > 5s (медленная evaluation)

5. **Scrape Duration**
   - Нормальное значение: scrape_duration_seconds < 1s
   - Алерт: scrape_duration_seconds > 5s (медленный scraping)

---

## Метрики и мониторинг

### Метрики Scraping

- **scrape_requests_total** - Общее количество scrape запросов
- **scrape_errors_total** - Общее количество ошибок scraping
- **scrape_duration_seconds** - Длительность scraping (для каждого target)
- **scrape_samples_scraped** - Количество собранных samples (для каждого target)
- **up** - Статус target (1 = up, 0 = down, для каждого target)

### Метрики TSDB

- **tsdb_head_samples** - Количество samples в head block
- **tsdb_head_series** - Количество series в head block
- **tsdb_compactions_total** - Количество compactions
- **tsdb_wal_corruptions_total** - Количество ошибок WAL
- **tsdb_storage_blocks_bytes** - Размер storage blocks (bytes)

### Метрики Config

- **config_last_reload_success_timestamp** - Время последней успешной перезагрузки конфига
- **config_last_reload_successful** - Статус последней перезагрузки (1 = success, 0 = failed)

### Метрики Targets

- **targets_up** - Количество targets в состоянии up
- **targets_down** - Количество targets в состоянии down
- **target_scrape_pool_sync_total** - Количество синхронизаций scrape pool
- **target_scrapes_exceeded_sample_limit_total** - Количество scrapes, превысивших лимит samples

### Метрики Alerting

- **alerting_rules_last_evaluation_timestamp** - Время последней evaluation alerting rules
- **alerting_rules_last_evaluation_duration_seconds** - Длительность последней evaluation
- **notifications_total** - Общее количество отправленных уведомлений
- **notifications_failed_total** - Общее количество неудачных уведомлений

### Мониторинг в реальном времени

Все метрики обновляются в реальном времени во время симуляции:
- Метрики синхронизируются из `PrometheusEmulationEngine` каждые 500ms
- Метрики отображаются в UI компоненте
- Targets обновляются каждые 30 секунд (Service Discovery)
- Alerting rules оцениваются каждые `evaluation_interval`

---

## Примеры использования

### Пример 1: Простой scraping

**Сценарий:** Scraping метрик с нескольких статических targets

```json
{
  "scrapeInterval": "15s",
  "scrape_configs": [
    {
      "job_name": "node-exporter",
      "static_configs": [
        {
          "targets": ["localhost:9100", "localhost:9101"],
          "labels": {
            "environment": "production"
          }
        }
      ]
    }
  ]
}
```

### Пример 2: Kubernetes Service Discovery

**Сценарий:** Автоматическое обнаружение Pods в Kubernetes

```json
{
  "scrape_configs": [
    {
      "job_name": "kubernetes-pods",
      "kubernetes_sd_configs": [
        {
          "role": "pod",
          "namespaces": {
            "names": ["default", "production"]
          }
        }
      ],
      "relabel_configs": [
        {
          "source_labels": ["__meta_kubernetes_pod_annotation_prometheus_io_scrape"],
          "action": "keep",
          "regex": "true"
        },
        {
          "source_labels": ["__meta_kubernetes_pod_name"],
          "target_label": "pod_name"
        }
      ]
    }
  ]
}
```

### Пример 3: Alerting Rules

**Сценарий:** Алерты для критичных метрик

```json
{
  "alertingRules": [
    {
      "name": "HighCPUUsage",
      "expr": "cpu_usage > 0.8",
      "for": "5m",
      "labels": {
        "severity": "warning"
      },
      "annotations": {
        "summary": "High CPU usage",
        "description": "CPU usage is above 80% for more than 5 minutes"
      }
    },
    {
      "name": "ServiceDown",
      "expr": "up == 0",
      "for": "1m",
      "labels": {
        "severity": "critical"
      },
      "annotations": {
        "summary": "Service is down",
        "description": "Service {{ $labels.instance }} is down"
      }
    }
  ]
}
```

### Пример 4: Recording Rules

**Сценарий:** Предварительное вычисление агрегаций

```json
{
  "recordingRules": [
    {
      "name": "http_requests:rate5m",
      "expr": "rate(http_requests_total[5m])"
    },
    {
      "name": "http_requests:sum",
      "expr": "sum(http_requests_total) by (method, status)"
    },
    {
      "name": "cpu_usage:avg",
      "expr": "avg(cpu_usage) by (instance)"
    }
  ]
}
```

### Пример 5: Remote Write

**Сценарий:** Отправка метрик в Thanos для долгосрочного хранения

```json
{
  "enableRemoteWrite": true,
  "remoteWrite": [
    {
      "url": "http://thanos-receive:10908/api/v1/receive"
    }
  ]
}
```

---

## Часто задаваемые вопросы (FAQ)

### Что такое Prometheus?

Prometheus - это система мониторинга и сбора метрик с временными рядами. Prometheus работает по pull-модели - он сам инициирует HTTP GET запросы к targets для сбора метрик.

### Как работает Prometheus?

1. Prometheus периодически делает HTTP GET запросы к `/metrics` endpoints компонентов
2. Компоненты экспортируют метрики в Prometheus format
3. Prometheus собирает метрики согласно `scrape_interval`
4. Метрики хранятся в TSDB (Time-Series Database)
5. Prometheus оценивает alerting rules и отправляет алерты в Alertmanager

### В чем разница между Prometheus и push-based системой?

- **Prometheus (Pull-based)**: Prometheus сам инициирует запросы к targets
- **Push-based**: Компоненты сами отправляют метрики в систему мониторинга

**Преимущества Pull-based:**
- Централизованное управление scraping
- Автоматическое обнаружение через Service Discovery
- Нет необходимости настраивать каждый компонент

### Что такое Service Discovery?

Service Discovery позволяет автоматически находить targets для scraping без ручной настройки. Prometheus поддерживает:
- Kubernetes SD - обнаружение Pods, Services в Kubernetes
- Consul SD - обнаружение сервисов через Consul
- File SD - обнаружение из файлов
- DNS SD - обнаружение через DNS SRV записи
- Static Configs - статический список targets

### Как работает Alerting?

1. Prometheus оценивает alerting rules каждые `evaluation_interval`
2. Если PromQL выражение возвращает true и `for` duration истек, алерт переходит в `firing` state
3. Prometheus отправляет алерты в Alertmanager
4. Alertmanager обрабатывает алерты (группировка, дедупликация, маршрутизация)
5. Alertmanager отправляет уведомления через различные receivers

### Что такое Recording Rules?

Recording Rules предварительно вычисляют метрики для оптимизации запросов. Они полезны для:
- Оптимизации сложных запросов
- Предварительного вычисления агрегаций
- Уменьшения нагрузки на Prometheus

### Как мониторить Prometheus?

Используйте метрики самого Prometheus:
- **Targets Up/Down** - доступность targets
- **Scrape Errors** - ошибки scraping
- **TSDB Usage** - использование хранилища
- **Alerting Rules Evaluation** - производительность evaluation
- **Scrape Duration** - длительность scraping

---

## Дополнительные ресурсы

- [Официальная документация Prometheus](https://prometheus.io/docs/)
- [Prometheus Query Language (PromQL)](https://prometheus.io/docs/prometheus/latest/querying/basics/)
- [Prometheus Service Discovery](https://prometheus.io/docs/prometheus/latest/configuration/configuration/#scrape_config)
- [Prometheus Alerting Rules](https://prometheus.io/docs/prometheus/latest/configuration/alerting_rules/)
- [Prometheus Best Practices](https://prometheus.io/docs/practices/)

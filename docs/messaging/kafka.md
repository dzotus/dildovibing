# Apache Kafka - Документация компонента

## Обзор

Apache Kafka - это распределенная платформа потоковой обработки данных, предназначенная для высокопроизводительной передачи сообщений между компонентами системы. Компонент Kafka в системе симуляции полностью эмулирует поведение реального Kafka кластера, включая партиционирование, репликацию, consumer groups, retention policies и ACL.

### Основные возможности

- ✅ **Кластер брокеров** - Поддержка множественных брокеров с репликацией
- ✅ **Топики и партиции** - Создание топиков с настраиваемым количеством партиций
- ✅ **Consumer Groups** - Группы потребителей с автоматическим распределением партиций
- ✅ **Retention и Compaction** - Политики хранения и уплотнения логов
- ✅ **ACL (Access Control List)** - Контроль доступа на уровне топиков и групп
- ✅ **Schema Registry** - Интеграция с реестром схем (Avro, JSON, Protobuf)
- ✅ **Метрики в реальном времени** - Отслеживание throughput, lag, offsets

---

## Основные функции

### 1. Управление брокерами

**Описание:** Настройка кластера Kafka с несколькими брокерами для обеспечения отказоустойчивости и масштабируемости.

**Возможности:**
- Добавление/удаление брокеров
- Настройка адресов брокеров (host:port)
- Мониторинг состояния брокеров (health checks)
- Автоматическая выборка лидера при отказе брокера

**Пример конфигурации:**
```json
{
  "brokers": [
    "kafka-1:9092",
    "kafka-2:9092",
    "kafka-3:9092"
  ]
}
```

### 2. Управление топиками

**Описание:** Создание и настройка топиков с различными параметрами партиционирования и репликации.

**Параметры топика:**
- **name** - Имя топика (обязательно)
- **partitions** - Количество партиций (по умолчанию: 3)
- **replication** - Фактор репликации (по умолчанию: 1)
- **config** - Дополнительные настройки топика:
  - `retentionMs` - Время хранения сообщений в миллисекундах
  - `retentionBytes` - Максимальный размер топика в байтах
  - `cleanupPolicy` - Политика очистки: `delete`, `compact`, `delete,compact`
  - `compressionType` - Тип сжатия: `uncompressed`, `gzip`, `snappy`, `lz4`, `zstd`
  - `maxMessageBytes` - Максимальный размер сообщения
  - `minInsyncReplicas` - Минимальное количество синхронизированных реплик
  - `segmentMs` - Время жизни сегмента
  - `segmentBytes` - Размер сегмента в байтах

**Пример конфигурации:**
```json
{
  "topics": [
    {
      "name": "user-events",
      "partitions": 12,
      "replication": 3,
      "config": {
        "retentionMs": 604800000,
        "cleanupPolicy": "delete",
        "compressionType": "lz4"
      }
    },
    {
      "name": "user-profiles",
      "partitions": 6,
      "replication": 3,
      "config": {
        "cleanupPolicy": "compact",
        "minInsyncReplicas": 2
      }
    }
  ]
}
```

### 3. Consumer Groups

**Описание:** Группы потребителей для распределенной обработки сообщений из топиков.

**Параметры consumer group:**
- **id** - Уникальный идентификатор группы (обязательно)
- **topic** - Имя топика для подписки (обязательно)
- **members** - Количество потребителей в группе (по умолчанию: 1)
- **offsetStrategy** - Стратегия начального offset: `earliest`, `latest`, `none` (по умолчанию: `latest`)
- **autoCommit** - Автоматический коммит offset (по умолчанию: `true`)
- **lag** - Текущий lag группы (вычисляется автоматически)

**Особенности:**
- Автоматическое распределение партиций между потребителями (Range Assignment Strategy)
- Поддержка rebalancing при изменении количества потребителей
- Отслеживание lag на основе разницы между latest offset и consumer offset

**Пример конфигурации:**
```json
{
  "consumerGroups": [
    {
      "id": "order-processor-group",
      "topic": "orders",
      "members": 5,
      "offsetStrategy": "latest",
      "autoCommit": true
    },
    {
      "id": "analytics-group",
      "topic": "user-events",
      "members": 3,
      "offsetStrategy": "earliest",
      "autoCommit": false
    }
  ]
}
```

### 4. Retention и Compaction

**Описание:** Политики управления жизненным циклом сообщений в топиках.

**Retention by Time:**
- Удаление сообщений старше указанного времени (`retentionMs`)
- Применяется к топикам с политикой `delete` или `delete,compact`

**Retention by Size:**
- Удаление старых сегментов при превышении размера (`retentionBytes`)
- Обеспечивает контроль использования дискового пространства

**Log Compaction:**
- Уплотнение логов для топиков с политикой `compact` или `delete,compact`
- Сохраняет только последнее сообщение для каждого ключа
- Полезно для топиков с обновлениями состояния (например, user-profiles)

**Примеры:**
```json
// Топик с retention по времени (7 дней)
{
  "name": "logs",
  "config": {
    "retentionMs": 604800000,
    "cleanupPolicy": "delete"
  }
}

// Топик с compaction (хранит последнее состояние)
{
  "name": "user-profiles",
  "config": {
    "cleanupPolicy": "compact"
  }
}
```

### 5. ACL (Access Control List)

**Описание:** Контроль доступа на уровне топиков, consumer groups и кластера.

**Параметры ACL:**
- **principal** - Идентификатор пользователя/приложения (обязательно)
- **resourceType** - Тип ресурса: `Topic`, `Group`, `Cluster`, `TransactionalId`, `DelegationToken`
- **resourceName** - Имя ресурса (например, имя топика)
- **resourcePatternType** - Тип паттерна: `Literal`, `Prefixed`, `Match` (по умолчанию: `Literal`)
- **operation** - Операция: `Read`, `Write`, `Create`, `Delete`, `Alter`, `Describe`, `AlterConfigs`, `DescribeConfigs`, `ClusterAction`, `IdempotentWrite`, `All`
- **permission** - Разрешение: `Allow`, `Deny` (по умолчанию: `Allow`)
- **host** - Ограничение по хосту (опционально)

**Правила:**
- `Deny` имеет приоритет над `Allow`
- Поддержка префиксных паттернов для групповых правил
- Проверка прав при публикации (Write) и потреблении (Read)

**Пример конфигурации:**
```json
{
  "acls": [
    {
      "principal": "producer-app",
      "resourceType": "Topic",
      "resourceName": "orders",
      "operation": "Write",
      "permission": "Allow"
    },
    {
      "principal": "consumer-app",
      "resourceType": "Topic",
      "resourceName": "orders",
      "operation": "Read",
      "permission": "Allow"
    },
    {
      "principal": "unauthorized-app",
      "resourceType": "Topic",
      "resourceName": "orders",
      "operation": "All",
      "permission": "Deny"
    }
  ]
}
```

### 6. Schema Registry

**Описание:** Интеграция с реестром схем для валидации и эволюции схем данных.

**Параметры Schema Registry:**
- **url** - URL реестра схем (по умолчанию: `http://localhost:8081`)
- **subjects** - Список зарегистрированных схем:
  - **name** - Имя субъекта (обычно соответствует имени топика)
  - **version** - Версия схемы
  - **schemaType** - Тип схемы: `AVRO`, `JSON`, `PROTOBUF`
  - **schema** - Определение схемы (JSON строка)

**Пример конфигурации:**
```json
{
  "schemaRegistry": {
    "url": "http://localhost:8081",
    "subjects": [
      {
        "name": "user-events-value",
        "version": 1,
        "schemaType": "AVRO",
        "schema": "{\"type\":\"record\",\"name\":\"UserEvent\",\"fields\":[{\"name\":\"userId\",\"type\":\"string\"},{\"name\":\"eventType\",\"type\":\"string\"}]}"
      }
    ]
  }
}
```

---

## Руководство пользователя

### Быстрый старт

1. **Добавление компонента Kafka:**
   - Перетащите компонент "Kafka" из библиотеки компонентов на canvas
   - Откройте панель конфигурации компонента

2. **Базовая настройка:**
   - Укажите адреса брокеров (например, `localhost:9092`)
   - Создайте первый топик через вкладку "Topics"
   - Настройте количество партиций и репликацию

3. **Подключение к другим компонентам:**
   - Создайте соединение от компонента-производителя к Kafka
   - Создайте соединение от Kafka к компоненту-потребителю
   - Настройте consumer group для потребителя

### Работа с топиками

#### Создание топика

1. Перейдите на вкладку **"Topics"**
2. Нажмите кнопку **"Add Topic"**
3. Заполните параметры:
   - **Name** - Уникальное имя топика
   - **Partitions** - Количество партиций (рекомендуется: 3-12)
   - **Replication** - Фактор репликации (рекомендуется: 3 для production)
4. Нажмите **"Save"**

#### Настройка топика

1. Выберите топик из списка
2. Нажмите кнопку **"Edit"** (иконка карандаша)
3. Настройте параметры в разделе **"Topic Configuration"**:
   - **Retention (ms)** - Время хранения сообщений
   - **Retention (bytes)** - Максимальный размер топика
   - **Cleanup Policy** - Политика очистки
   - **Compression** - Тип сжатия
4. Сохраните изменения

#### Просмотр метрик топика

Во время симуляции на вкладке **"Topics"** отображаются:
- **Messages** - Количество сообщений в топике
- **Size** - Размер топика в байтах
- **Partitions** - Детальная информация по каждой партиции:
  - ID партиции
  - Количество сообщений
  - Размер
  - Offset и High Watermark
  - Leader и реплики (ISR)

### Работа с Consumer Groups

#### Создание Consumer Group

1. Перейдите на вкладку **"Consumer Groups"**
2. Нажмите кнопку **"Add Consumer Group"**
3. Заполните параметры:
   - **ID** - Уникальный идентификатор группы
   - **Topic** - Выберите топик для подписки
   - **Members** - Количество потребителей
   - **Offset Strategy** - Стратегия начального offset
   - **Auto Commit** - Включить автоматический коммит
4. Нажмите **"Save"**

#### Мониторинг Consumer Groups

Во время симуляции отображаются:
- **Lag** - Задержка обработки (разница между latest offset и consumer offset)
- **Members** - Количество активных потребителей
- **Partition Assignment** - Распределение партиций между потребителями
- **Rebalancing Status** - Статус перебалансировки

### Настройка ACL

1. Перейдите на вкладку **"Security"**
2. Нажмите кнопку **"Add ACL"**
3. Заполните параметры:
   - **Principal** - Идентификатор пользователя/приложения
   - **Resource Type** - Тип ресурса (Topic, Group, Cluster)
   - **Resource Name** - Имя ресурса
   - **Operation** - Операция (Read, Write, All и т.д.)
   - **Permission** - Allow или Deny
4. Нажмите **"Save"**

**Важно:** Правила `Deny` имеют приоритет над `Allow`. Используйте `Deny` для явного запрета доступа.

### Регистрация схем в Schema Registry

1. Перейдите на вкладку **"Schema Registry"**
2. Нажмите кнопку **"Register Schema"**
3. Заполните параметры:
   - **Subject Name** - Имя субъекта (обычно `{topic-name}-value`)
   - **Version** - Версия схемы
   - **Schema Type** - AVRO, JSON или PROTOBUF
   - **Schema** - Определение схемы (JSON)
4. Нажмите **"Register"**

---

## Руководство администратора

### Рекомендации по конфигурации

#### Production кластер

```json
{
  "brokers": [
    "kafka-1:9092",
    "kafka-2:9092",
    "kafka-3:9092"
  ],
  "topics": [
    {
      "name": "production-topic",
      "partitions": 12,
      "replication": 3,
      "config": {
        "retentionMs": 604800000,
        "minInsyncReplicas": 2,
        "compressionType": "lz4"
      }
    }
  ]
}
```

**Рекомендации:**
- Используйте минимум 3 брокера для отказоустойчивости
- Фактор репликации должен быть не менее 3 для production
- `minInsyncReplicas` должен быть меньше фактора репликации
- Используйте сжатие для экономии пропускной способности

#### High-throughput топики

Для топиков с высокой нагрузкой:
- Увеличьте количество партиций (12-24)
- Используйте `lz4` или `zstd` сжатие
- Настройте retention по размеру (`retentionBytes`)
- Увеличьте `segmentBytes` для больших сообщений

#### Stateful топики (Compaction)

Для топиков, хранящих состояние:
```json
{
  "name": "user-profiles",
  "partitions": 6,
  "replication": 3,
  "config": {
    "cleanupPolicy": "compact",
    "minInsyncReplicas": 2
  }
}
```

**Особенности:**
- Используйте `compact` политику
- Меньше партиций, чем для event streams
- Сообщения должны иметь ключ (key)

### Оптимизация производительности

#### Партиционирование

- **Количество партиций:**
  - Минимум: 1
  - Рекомендуется: 3-12 для большинства случаев
  - Максимум: зависит от количества брокеров (обычно 100-200 на кластер)
  
- **Выбор партиции:**
  - Используйте ключи сообщений для детерминированного партиционирования
  - Сообщения без ключа распределяются round-robin

#### Consumer Groups

- **Количество потребителей:**
  - Не должно превышать количество партиций
  - Рекомендуется: количество партиций / количество потребителей = 1-2

- **Offset Management:**
  - Используйте `autoCommit: true` для простых случаев
  - Используйте `autoCommit: false` для критичных приложений с ручным коммитом

#### Retention

- **По времени:**
  - Event streams: 7-30 дней
  - Logs: 1-7 дней
  - Metrics: 1-3 дня

- **По размеру:**
  - Устанавливайте лимит для предотвращения переполнения диска
  - Учитывайте скорость поступления данных

### Безопасность

#### Настройка ACL

**Рекомендуемый подход:**
1. Создайте правила `Deny` для неавторизованных пользователей
2. Создайте правила `Allow` для конкретных приложений
3. Используйте префиксные паттерны для групповых правил

**Пример production ACL:**
```json
{
  "acls": [
    {
      "principal": "producer-*",
      "resourceType": "Topic",
      "resourceName": "events-*",
      "resourcePatternType": "Prefixed",
      "operation": "Write",
      "permission": "Allow"
    },
    {
      "principal": "consumer-*",
      "resourceType": "Topic",
      "resourceName": "events-*",
      "resourcePatternType": "Prefixed",
      "operation": "Read",
      "permission": "Allow"
    }
  ]
}
```

### Мониторинг и алертинг

#### Ключевые метрики

1. **Throughput (msg/sec)**
   - Нормальное значение: зависит от нагрузки
   - Алерт: резкое падение или рост

2. **Lag (сообщений)**
   - Нормальное значение: < 1000 для большинства случаев
   - Алерт: lag > 10000 или постоянно растущий lag

3. **Error Rate**
   - Нормальное значение: < 0.1%
   - Алерт: error rate > 1%

4. **Utilization**
   - Нормальное значение: < 80%
   - Алерт: utilization > 90%

5. **Broker Health**
   - Все брокеры должны быть healthy
   - Алерт: любой брокер unhealthy

#### Partition Metrics

Мониторинг на уровне партиций:
- **Messages per partition** - Равномерное распределение
- **Size per partition** - Контроль размера
- **Leader distribution** - Равномерное распределение лидеров по брокерам

---

## Метрики и мониторинг

### Основные метрики

#### Throughput
- **Описание:** Количество сообщений в секунду
- **Единица измерения:** msg/sec
- **Источник:** Рассчитывается на основе входящих соединений и конфигурации

#### Latency
- **Описание:** Задержка обработки сообщений
- **Единица измерения:** миллисекунды (ms)
- **Факторы влияния:**
  - Количество партиций
  - Фактор репликации
  - Нагрузка на брокеры
  - Размер сообщений

#### Error Rate
- **Описание:** Процент ошибок при обработке
- **Единица измерения:** процент (0-1)
- **Причины ошибок:**
  - ACL блокировки
  - Переполнение топиков
  - Проблемы с брокерами

#### Utilization
- **Описание:** Загрузка кластера
- **Единица измерения:** процент (0-1)
- **Расчет:** На основе throughput и capacity

### Кастомные метрики

#### Topics
- Количество топиков в кластере

#### Partitions
- Общее количество партиций

#### Replication
- Средний фактор репликации

#### Brokers
- Количество брокеров в кластере

#### Consumer Groups
- Количество consumer groups

#### Total Lag
- Суммарный lag всех consumer groups

### Метрики топиков

Для каждого топика доступны:
- **Messages** - Количество сообщений
- **Size** - Размер в байтах
- **Partitions** - Количество партиций

### Метрики партиций

Для каждой партиции доступны:
- **Partition ID** - Идентификатор партиции
- **Messages** - Количество сообщений в партиции
- **Size** - Размер партиции в байтах
- **Offset** - Текущий offset
- **High Watermark** - Последний committed offset
- **Leader** - ID брокера-лидера
- **Replicas** - Список ID брокеров-реплик
- **ISR (In-Sync Replicas)** - Список синхронизированных реплик

### Метрики Consumer Groups

Для каждой consumer group доступны:
- **Lag** - Задержка обработки (latest offset - consumer offset)
- **Members** - Количество активных потребителей
- **Partition Assignment** - Распределение партиций
- **Rebalancing Status** - Статус перебалансировки

---

## Примеры использования

### Пример 1: Event Streaming Pipeline

**Сценарий:** Поток событий от веб-приложения к системе аналитики

```json
{
  "brokers": ["kafka-1:9092", "kafka-2:9092", "kafka-3:9092"],
  "topics": [
    {
      "name": "user-events",
      "partitions": 12,
      "replication": 3,
      "config": {
        "retentionMs": 604800000,
        "compressionType": "lz4"
      }
    }
  ],
  "consumerGroups": [
    {
      "id": "analytics-processor",
      "topic": "user-events",
      "members": 6,
      "offsetStrategy": "latest",
      "autoCommit": true
    }
  ]
}
```

### Пример 2: State Store с Compaction

**Сценарий:** Хранение профилей пользователей с обновлениями

```json
{
  "topics": [
    {
      "name": "user-profiles",
      "partitions": 6,
      "replication": 3,
      "config": {
        "cleanupPolicy": "compact",
        "minInsyncReplicas": 2
      }
    }
  ]
}
```

### Пример 3: Multi-Tenant с ACL

**Сценарий:** Разделение доступа между разными приложениями

```json
{
  "topics": [
    {
      "name": "tenant-a-events",
      "partitions": 6,
      "replication": 3
    },
    {
      "name": "tenant-b-events",
      "partitions": 6,
      "replication": 3
    }
  ],
  "acls": [
    {
      "principal": "tenant-a-producer",
      "resourceType": "Topic",
      "resourceName": "tenant-a-events",
      "operation": "Write",
      "permission": "Allow"
    },
    {
      "principal": "tenant-a-producer",
      "resourceType": "Topic",
      "resourceName": "tenant-b-events",
      "operation": "All",
      "permission": "Deny"
    }
  ]
}
```

### Пример 4: High-Throughput Logging

**Сценарий:** Централизованное логирование с высокой нагрузкой

```json
{
  "topics": [
    {
      "name": "application-logs",
      "partitions": 24,
      "replication": 3,
      "config": {
        "retentionMs": 259200000,
        "retentionBytes": 107374182400,
        "compressionType": "gzip",
        "segmentBytes": 1073741824
      }
    }
  ],
  "consumerGroups": [
    {
      "id": "log-aggregator",
      "topic": "application-logs",
      "members": 12,
      "offsetStrategy": "earliest",
      "autoCommit": true
    }
  ]
}
```

---

## Часто задаваемые вопросы (FAQ)

### Как выбрать количество партиций?

Количество партиций определяет максимальный параллелизм потребителей. Рекомендации:
- Для низкой нагрузки: 3-6 партиций
- Для средней нагрузки: 6-12 партиций
- Для высокой нагрузки: 12-24 партиций
- Учитывайте: количество партиций должно быть кратно количеству брокеров

### Что такое lag и как его уменьшить?

Lag - это разница между latest offset (последнее сообщение в топике) и consumer offset (последнее обработанное сообщение). Для уменьшения lag:
- Увеличьте количество потребителей в группе
- Оптимизируйте обработку сообщений
- Увеличьте throughput обработки

### Когда использовать compaction?

Используйте compaction для топиков, которые хранят состояние (state stores):
- Профили пользователей
- Конфигурации
- Справочники
- Любые данные, где важна последняя версия по ключу

### Как работает rebalancing?

Rebalancing происходит автоматически при:
- Изменении количества потребителей в группе
- Добавлении/удалении партиций в топике
- Отказе потребителя

Во время rebalancing обработка сообщений может быть приостановлена.

### Что такое minInsyncReplicas?

`minInsyncReplicas` - минимальное количество реплик, которые должны подтвердить запись перед успешным ответом producer. Рекомендуется:
- Для replication factor 3: minInsyncReplicas = 2
- Обеспечивает отказоустойчивость при потере одного брокера

---

## Дополнительные ресурсы

- [Официальная документация Apache Kafka](https://kafka.apache.org/documentation/)
- [Kafka Best Practices](https://kafka.apache.org/documentation/#bestpractices)
- [Kafka Performance Tuning](https://kafka.apache.org/documentation/#performance)

# S3 Data Lake - Документация компонента

## Обзор

S3 Data Lake - это объектное хранилище для построения data lakes с версионированием и lifecycle политиками. Компонент S3 Data Lake в системе симуляции полностью эмулирует поведение AWS S3, включая управление buckets (бакетами), objects (объектами), versioning (версионированием), lifecycle policies (политиками жизненного цикла), storage classes (классами хранения), multipart uploads (многокомпонентными загрузками), restore operations (операциями восстановления), encryption (шифрованием), метрики производительности и полный набор возможностей AWS S3.

### Основные возможности

- ✅ **Buckets** - Управление бакетами для хранения объектов
- ✅ **Objects** - Загрузка, получение, удаление и листинг объектов
- ✅ **Versioning** - Версионирование объектов для защиты от случайного удаления
- ✅ **Storage Classes** - Классы хранения (STANDARD, STANDARD_IA, GLACIER, DEEP_ARCHIVE, INTELLIGENT_TIERING)
- ✅ **Lifecycle Policies** - Автоматические переходы между классами хранения и удаление объектов
- ✅ **Multipart Upload** - Загрузка больших файлов по частям
- ✅ **Restore Operations** - Восстановление объектов из Glacier/Deep Archive
- ✅ **Encryption** - Шифрование объектов (AES256, aws:kms)
- ✅ **Метрики в реальном времени** - Полный набор метрик S3 (operations, latency, storage utilization, lifecycle transitions)

---

## Основные функции

### 1. Управление Buckets (Бакеты)

**Описание:** Bucket - это контейнер для объектов в S3. Каждый bucket имеет уникальное имя и регион.

**Параметры Bucket:**
- **name** - Имя бакета (обязательно, уникальное, например: `my-datalake`)
- **region** - AWS регион (по умолчанию: `us-east-1`)
- **versioning** - Включить версионирование (по умолчанию: `false`)
- **encryption** - Тип шифрования: `AES256` или `aws:kms` (по умолчанию: `AES256`)
- **lifecycleEnabled** - Включить lifecycle политики (по умолчанию: `false`)
- **lifecycleDays** - Количество дней до перехода в другой storage class (опционально)
- **glacierEnabled** - Включить переход в Glacier (по умолчанию: `false`)
- **glacierDays** - Количество дней до перехода в Glacier (опционально)
- **publicAccess** - Публичный доступ к бакету (по умолчанию: `false`)

**Пример конфигурации:**
```json
{
  "buckets": [
    {
      "name": "my-datalake",
      "region": "us-east-1",
      "versioning": true,
      "encryption": "AES256",
      "lifecycleEnabled": true,
      "lifecycleDays": 90,
      "glacierEnabled": true,
      "glacierDays": 365,
      "publicAccess": false
    }
  ]
}
```

### 2. Operations (Операции)

**Описание:** S3 поддерживает различные операции для работы с объектами.

#### 2.1. PUT (Загрузка объекта)

**Описание:** Загрузка объекта в бакет.

**Параметры:**
- **operation** - `PUT` или `UPLOAD`
- **bucket** - Имя бакета (обязательно)
- **key** - Ключ объекта (обязательно, путь к объекту, например: `data/file.txt`)
- **data** - Данные объекта (обязательно)
- **contentType** - MIME тип (опционально, по умолчанию: `application/octet-stream`)
- **metadata** - Метаданные объекта (опционально, объект)

**Пример:**
```json
{
  "operation": "PUT",
  "bucket": "my-datalake",
  "key": "data/file.txt",
  "data": "Hello, World!",
  "contentType": "text/plain",
  "metadata": {
    "author": "John Doe",
    "department": "Engineering"
  }
}
```

**Результат:**
- **success** - Успешность операции
- **versionId** - ID версии (если versioning включен)
- **etag** - ETag объекта
- **latency** - Задержка операции (ms)

#### 2.2. GET (Получение объекта)

**Описание:** Получение объекта из бакета.

**Параметры:**
- **operation** - `GET` или `DOWNLOAD`
- **bucket** - Имя бакета (обязательно)
- **key** - Ключ объекта (обязательно)
- **versionId** - ID версии (опционально, для версионированных объектов)

**Пример:**
```json
{
  "operation": "GET",
  "bucket": "my-datalake",
  "key": "data/file.txt",
  "versionId": "1234567890-abcdef"
}
```

**Результат:**
- **success** - Успешность операции
- **object** - Объект с данными
- **latency** - Задержка операции (ms)

**Примечание:** Если объект находится в Glacier или Deep Archive, требуется операция restore.

#### 2.3. DELETE (Удаление объекта)

**Описание:** Удаление объекта из бакета.

**Параметры:**
- **operation** - `DELETE`
- **bucket** - Имя бакета (обязательно)
- **key** - Ключ объекта (обязательно)
- **versionId** - ID версии (опционально, для версионированных объектов)

**Пример:**
```json
{
  "operation": "DELETE",
  "bucket": "my-datalake",
  "key": "data/file.txt"
}
```

**Результат:**
- **success** - Успешность операции
- **deleteMarker** - Создан ли delete marker (для версионированных бакетов)
- **latency** - Задержка операции (ms)

**Примечание:** Для версионированных бакетов создается delete marker вместо удаления объекта.

#### 2.4. LIST (Листинг объектов)

**Описание:** Получение списка объектов в бакете.

**Параметры:**
- **operation** - `LIST`
- **bucket** - Имя бакета (обязательно)
- **prefix** - Префикс для фильтрации (опционально, например: `data/`)
- **maxKeys** - Максимальное количество объектов (опционально, по умолчанию: `1000`)

**Пример:**
```json
{
  "operation": "LIST",
  "bucket": "my-datalake",
  "prefix": "data/",
  "maxKeys": 100
}
```

**Результат:**
- **success** - Успешность операции
- **objects** - Массив объектов
- **latency** - Задержка операции (ms)

#### 2.5. HEAD (Получение метаданных)

**Описание:** Получение только метаданных объекта без тела.

**Параметры:**
- **operation** - `HEAD`
- **bucket** - Имя бакета (обязательно)
- **key** - Ключ объекта (обязательно)

**Пример:**
```json
{
  "operation": "HEAD",
  "bucket": "my-datalake",
  "key": "data/file.txt"
}
```

**Результат:**
- **success** - Успешность операции
- **object** - Объект с метаданными (без тела)
- **latency** - Задержка операции (ms)

### 3. Versioning (Версионирование)

**Описание:** Versioning позволяет хранить несколько версий одного объекта.

**Как работает:**
- При включении versioning каждый PUT создает новую версию
- DELETE создает delete marker вместо удаления объекта
- Можно получить любую версию объекта по versionId
- Можно восстановить объект, удалив delete marker

**Преимущества:**
- Защита от случайного удаления
- Возможность восстановления предыдущих версий
- Аудит изменений объектов

**Пример:**
```json
{
  "name": "my-datalake",
  "versioning": true
}
```

**Операции с версиями:**
- **GET с versionId** - Получение конкретной версии
- **DELETE с versionId** - Удаление конкретной версии
- **DELETE без versionId** - Создание delete marker (для версионированных бакетов)

### 4. Storage Classes (Классы хранения)

**Описание:** Storage classes определяют стоимость и доступность хранения.

**Классы хранения:**
- **STANDARD** - Стандартное хранение (высокая доступность, высокая стоимость)
- **STANDARD_IA** - Infrequent Access (редкий доступ, средняя стоимость)
- **GLACIER** - Архивное хранение (низкая стоимость, требуется restore)
- **DEEP_ARCHIVE** - Глубокое архивирование (самая низкая стоимость, долгий restore)
- **INTELLIGENT_TIERING** - Автоматический выбор класса хранения

**Характеристики:**
- **STANDARD**: Немедленный доступ, высокая стоимость
- **STANDARD_IA**: Немедленный доступ, средняя стоимость, плата за извлечение
- **GLACIER**: Требуется restore (минуты-часы), низкая стоимость
- **DEEP_ARCHIVE**: Требуется restore (часы-дни), самая низкая стоимость

**Переходы между классами:**
- Автоматически через lifecycle policies
- На основе времени с момента создания объекта
- На основе префикса объекта

### 5. Lifecycle Policies (Политики жизненного цикла)

**Описание:** Lifecycle policies автоматически управляют переходами между storage classes и удалением объектов.

**Параметры Lifecycle Rule:**
- **id** - Уникальный ID правила (обязательно)
- **name** - Имя правила (обязательно)
- **prefix** - Префикс для фильтрации объектов (опционально)
- **status** - Статус правила: `Enabled` или `Disabled` (обязательно)
- **transitions** - Массив переходов между storage classes (опционально)
- **expiration** - Удаление объектов через указанное количество дней (опционально)

**Параметры Transition:**
- **days** - Количество дней до перехода (обязательно)
- **storageClass** - Целевой storage class (обязательно, например: `STANDARD_IA`, `GLACIER`, `DEEP_ARCHIVE`)

**Параметры Expiration:**
- **days** - Количество дней до удаления (обязательно)

**Пример конфигурации:**
```json
{
  "lifecycleRules": [
    {
      "id": "rule-1",
      "name": "Archive old data",
      "prefix": "archive/",
      "status": "Enabled",
      "transitions": [
        {
          "days": 30,
          "storageClass": "STANDARD_IA"
        },
        {
          "days": 90,
          "storageClass": "GLACIER"
        },
        {
          "days": 365,
          "storageClass": "DEEP_ARCHIVE"
        }
      ],
      "expiration": {
        "days": 2555
      }
    }
  ]
}
```

**Как работает:**
- Правила применяются автоматически при создании/обновлении объектов
- Переходы выполняются по расписанию (периодически проверяются)
- Expiration удаляет объекты через указанное количество дней
- Префикс определяет, к каким объектам применяется правило (самый длинный префикс имеет приоритет)

### 6. Multipart Upload (Многокомпонентная загрузка)

**Описание:** Multipart upload позволяет загружать большие файлы по частям.

**Этапы:**
1. **INITIATE_MULTIPART_UPLOAD** - Инициализация загрузки
2. **UPLOAD_PART** - Загрузка каждой части (можно параллельно)
3. **COMPLETE_MULTIPART_UPLOAD** - Завершение загрузки
4. **ABORT_MULTIPART_UPLOAD** - Отмена загрузки (опционально)

**Преимущества:**
- Загрузка больших файлов (>5GB)
- Возможность параллельной загрузки частей
- Возможность возобновления при сбое
- Оптимизация использования пропускной способности

**Пример:**
```json
// 1. Инициализация
{
  "operation": "INITIATE_MULTIPART_UPLOAD",
  "bucket": "my-datalake",
  "key": "large-file.zip"
}

// 2. Загрузка частей (можно параллельно)
{
  "operation": "UPLOAD_PART",
  "bucket": "my-datalake",
  "key": "large-file.zip",
  "uploadId": "upload-id-123",
  "partNumber": 1,
  "data": "part1-data",
  "size": 5242880
}

// 3. Завершение
{
  "operation": "COMPLETE_MULTIPART_UPLOAD",
  "bucket": "my-datalake",
  "key": "large-file.zip",
  "uploadId": "upload-id-123",
  "parts": [
    { "partNumber": 1, "etag": "etag1" },
    { "partNumber": 2, "etag": "etag2" }
  ]
}
```

### 7. Restore Operations (Операции восстановления)

**Описание:** Restore operations позволяют временно восстановить объекты из Glacier/Deep Archive.

**Этапы:**
1. **RESTORE_OBJECT** - Инициализация восстановления
2. **GET_RESTORE_STATUS** - Проверка статуса восстановления
3. **GET_AFTER_RESTORE** - Получение объекта после восстановления

**Tiers (уровни восстановления):**
- **Expedited** - Быстрое восстановление (1-5 минут, высокая стоимость)
- **Standard** - Стандартное восстановление (3-5 часов, средняя стоимость)
- **Bulk** - Массовое восстановление (5-12 часов, низкая стоимость)

**Пример:**
```json
// 1. Инициализация восстановления
{
  "operation": "RESTORE_OBJECT",
  "bucket": "my-datalake",
  "key": "archive/data.zip",
  "storageClass": "GLACIER",
  "tier": "Standard"
}

// 2. Проверка статуса
{
  "operation": "GET_RESTORE_STATUS",
  "bucket": "my-datalake",
  "key": "archive/data.zip"
}

// 3. Получение после восстановления
{
  "operation": "GET_AFTER_RESTORE",
  "bucket": "my-datalake",
  "key": "archive/data.zip"
}
```

**Примечание:** Объекты из Glacier/Deep Archive недоступны для GET до завершения restore.

### 8. Encryption (Шифрование)

**Описание:** S3 поддерживает шифрование объектов на стороне сервера.

**Типы шифрования:**
- **AES256** - Server-Side Encryption с AES-256 (по умолчанию)
- **aws:kms** - Server-Side Encryption с AWS KMS

**Пример конфигурации:**
```json
{
  "name": "my-datalake",
  "encryption": "AES256"
}
```

**Примечание:** Шифрование применяется автоматически при загрузке объектов.

---

## Руководство пользователя

### Быстрый старт

1. **Добавление компонента S3 Data Lake:**
   - Перетащите компонент "S3 Data Lake" из библиотеки компонентов на canvas
   - Откройте панель конфигурации компонента

2. **Настройка credentials:**
   - Перейдите на вкладку **"Credentials"**
   - Укажите Access Key ID и Secret Access Key (опционально)
   - Укажите Default Region (по умолчанию: `us-east-1`)

3. **Создание бакета:**
   - Перейдите на вкладку **"Buckets"**
   - Нажмите кнопку **"Add Bucket"**
   - Укажите имя, регион, настройки versioning, encryption
   - Нажмите **"Save"**

4. **Загрузка объекта:**
   - Выберите бакет
   - Нажмите кнопку **"Upload Object"**
   - Укажите key (путь) и данные
   - Нажмите **"Save"**

5. **Настройка Lifecycle Rules:**
   - Перейдите на вкладку **"Lifecycle"**
   - Нажмите кнопку **"Add Rule"**
   - Укажите имя, префикс, transitions, expiration
   - Нажмите **"Save"**

### Работа с Buckets

#### Создание бакета

1. Перейдите на вкладку **"Buckets"**
2. Нажмите кнопку **"Add Bucket"**
3. Заполните параметры:
   - **Name** - Имя бакета (уникальное)
   - **Region** - AWS регион
   - **Versioning** - Включить версионирование
   - **Encryption** - Тип шифрования
   - **Lifecycle Enabled** - Включить lifecycle политики
   - **Public Access** - Публичный доступ
4. Нажмите **"Save"**

#### Редактирование бакета

1. Выберите бакет из списка
2. Нажмите кнопку **"Edit"** (иконка карандаша)
3. Измените параметры
4. Нажмите **"Save"**

#### Удаление бакета

1. Выберите бакет из списка
2. Нажмите кнопку **"Delete"** (иконка корзины)
3. Подтвердите удаление

**Примечание:** Бакет должен быть пустым для удаления.

### Работа с Objects

#### Загрузка объекта

1. Выберите бакет
2. Нажмите кнопку **"Upload Object"**
3. Заполните параметры:
   - **Key** - Путь к объекту (например: `data/file.txt`)
   - **Data** - Данные объекта
   - **Content Type** - MIME тип (опционально)
   - **Metadata** - Метаданные (опционально)
4. Нажмите **"Save"**

**Пример key:**
- `data/file.txt` - Файл в папке data
- `logs/2024/01/01.log` - Вложенные папки
- `backup.tar.gz` - Файл в корне бакета

#### Получение объекта

1. Выберите бакет
2. Найдите объект в списке
3. Нажмите кнопку **"Download"** или **"View"**
4. Объект отобразится или будет загружен

#### Удаление объекта

1. Выберите бакет
2. Найдите объект в списке
3. Нажмите кнопку **"Delete"**
4. Подтвердите удаление

**Примечание:** Для версионированных бакетов создается delete marker.

### Работа с Lifecycle Rules

#### Создание правила

1. Перейдите на вкладку **"Lifecycle"**
2. Нажмите кнопку **"Add Rule"**
3. Заполните параметры:
   - **Name** - Имя правила
   - **Prefix** - Префикс для фильтрации (опционально)
   - **Status** - Enabled или Disabled
   - **Transitions** - Переходы между storage classes
   - **Expiration** - Удаление объектов (опционально)
4. Нажмите **"Save"**

#### Редактирование правила

1. Выберите правило из списка
2. Нажмите кнопку **"Edit"**
3. Измените параметры
4. Нажмите **"Save"**

#### Удаление правила

1. Выберите правило из списка
2. Нажмите кнопку **"Delete"**
3. Подтвердите удаление

---

## Руководство администратора

### Рекомендации по конфигурации

#### Production S3 Data Lake

```json
{
  "buckets": [
    {
      "name": "production-datalake",
      "region": "us-east-1",
      "versioning": true,
      "encryption": "aws:kms",
      "lifecycleEnabled": true,
      "publicAccess": false
    }
  ],
  "lifecycleRules": [
    {
      "id": "rule-production",
      "name": "Production Lifecycle",
      "status": "Enabled",
      "transitions": [
        {
          "days": 30,
          "storageClass": "STANDARD_IA"
        },
        {
          "days": 90,
          "storageClass": "GLACIER"
        },
        {
          "days": 365,
          "storageClass": "DEEP_ARCHIVE"
        }
      ],
      "expiration": {
        "days": 2555
      }
    }
  ]
}
```

**Рекомендации:**
- Используйте versioning для критичных данных
- Используйте encryption (aws:kms для production)
- Настройте lifecycle policies для оптимизации стоимости
- Используйте префиксы для организации данных
- Мониторьте storage utilization и operations utilization
- Настройте lifecycle transitions для автоматической оптимизации стоимости

### Оптимизация стоимости

**Storage Classes:**
- Используйте STANDARD для часто используемых данных
- Используйте STANDARD_IA для редко используемых данных (экономия ~50%)
- Используйте GLACIER для архивных данных (экономия ~80%)
- Используйте DEEP_ARCHIVE для долгосрочного архивирования (экономия ~95%)

**Lifecycle Policies:**
- Настройте автоматические переходы на основе времени
- Используйте префиксы для разных типов данных
- Настройте expiration для автоматического удаления старых данных
- Мониторьте lifecycle transitions

**Best Practices:**
- Организуйте данные по префиксам (например: `logs/`, `backups/`, `archive/`)
- Используйте разные lifecycle rules для разных типов данных
- Регулярно проверяйте неиспользуемые объекты
- Используйте multipart upload для больших файлов (>5GB)

### Безопасность

#### Управление доступом

- Используйте IAM policies для контроля доступа
- Не храните credentials в открытом виде
- Используйте переменные окружения для credentials
- Ограничьте public access (publicAccess: false)
- Используйте bucket policies для fine-grained контроля

#### Защита данных

- Используйте encryption (AES256 или aws:kms)
- Используйте versioning для защиты от случайного удаления
- Регулярно делайте backup критичных данных
- Мониторьте доступ к данным через CloudTrail (в реальном AWS)

### Мониторинг и алертинг

#### Ключевые метрики

1. **Storage Utilization**
   - Нормальное значение: < 80%
   - Алерт: storage utilization > 90% (приближение к лимитам)

2. **Operations Utilization**
   - Нормальное значение: < 80%
   - Алерт: operations utilization > 90% (приближение к лимитам AWS S3: 3500 PUT/POST/DELETE per second per bucket)

3. **Error Rate**
   - Нормальное значение: < 0.1%
   - Алерт: error rate > 1% (проблемы с доступом или конфигурацией)

4. **Average Latency**
   - Нормальное значение: < 100ms для PUT, < 50ms для GET
   - Алерт: average latency > 500ms (проблемы с производительностью)

5. **Lifecycle Transitions**
   - Нормальное значение: зависит от политик
   - Мониторинг: количество переходов в день/неделю

6. **Glacier Objects**
   - Мониторинг: количество объектов в Glacier/Deep Archive
   - Алерт: резкое увеличение (проверка lifecycle policies)

---

## Метрики и мониторинг

### Основные метрики

#### Throughput
- **Описание:** Количество операций в секунду
- **Единица измерения:** operations/sec
- **Типы:** PUT, GET, DELETE, LIST, HEAD операции
- **Источник:** Рассчитывается из истории операций за последнюю секунду

#### Latency
- **Описание:** Задержка выполнения операций
- **Единица измерения:** миллисекунды (ms)
- **Типы:** Average Latency, P50 Latency, P99 Latency
- **Факторы влияния:**
  - Размер объекта (больше размер = выше latency)
  - Storage class (Glacier/Deep Archive требуют restore)
  - Количество объектов в бакете (для LIST)
  - Загрузка системы

#### Storage Utilization
- **Описание:** Использование хранилища
- **Единица измерения:** 0-1 (0-100%)
- **Расчет:** totalSize / (maxStoragePerBucket * totalBuckets)
- **Лимит:** AWS S3 не имеет жесткого лимита, но рекомендуется < 80%

#### Operations Utilization
- **Описание:** Использование операций
- **Единица измерения:** 0-1 (0-100%)
- **Расчет:** throughput / (maxOpsPerBucket * totalBuckets)
- **Лимит:** AWS S3: 3500 PUT/POST/DELETE per second per bucket

### Метрики Buckets

- **totalBuckets** - Общее количество бакетов
- **bucketMetrics** - Метрики по каждому бакету:
  - **objectCount** - Количество объектов
  - **totalSize** - Общий размер (bytes)
  - **versionsCount** - Количество версий (если versioning включен)
  - **putCount** - Количество PUT операций
  - **getCount** - Количество GET операций
  - **deleteCount** - Количество DELETE операций
  - **listCount** - Количество LIST операций
  - **errorCount** - Количество ошибок
  - **averageLatency** - Средняя задержка (ms)
  - **storageClassDistribution** - Распределение по storage classes

### Метрики Operations

- **totalOperations** - Общее количество операций
- **putOperations** - Количество PUT операций
- **getOperations** - Количество GET операций
- **deleteOperations** - Количество DELETE операций
- **listOperations** - Количество LIST операций
- **headOperations** - Количество HEAD операций

### Метрики Storage Classes

- **standardObjects** - Количество объектов в STANDARD
- **standardIASize** - Размер объектов в STANDARD_IA (bytes)
- **glacierObjects** - Количество объектов в GLACIER
- **glacierSize** - Размер объектов в GLACIER (bytes)
- **deepArchiveObjects** - Количество объектов в DEEP_ARCHIVE
- **deepArchiveSize** - Размер объектов в DEEP_ARCHIVE (bytes)

### Метрики Lifecycle

- **lifecycleTransitions** - Количество переходов между storage classes
- **lifecycleExpirations** - Количество удаленных объектов по expiration

### Метрики Errors

- **errorRate** - Процент ошибок (0-1)
- **totalErrors** - Общее количество ошибок

### Мониторинг в реальном времени

Все метрики обновляются в реальном времени во время симуляции:
- Метрики синхронизируются из `S3EmulationEngine` каждые 500ms
- Метрики отображаются в UI компоненте
- История операций хранится для расчета метрик
- Lifecycle transitions обрабатываются периодически

---

## Примеры использования

### Пример 1: Простой data lake

**Сценарий:** Базовый data lake для хранения данных

```json
{
  "buckets": [
    {
      "name": "my-datalake",
      "region": "us-east-1",
      "versioning": false,
      "encryption": "AES256",
      "lifecycleEnabled": false,
      "publicAccess": false
    }
  ]
}
```

**Загрузка объекта:**
```json
{
  "operation": "PUT",
  "bucket": "my-datalake",
  "key": "data/file.txt",
  "data": "Hello, World!",
  "contentType": "text/plain"
}
```

**Получение объекта:**
```json
{
  "operation": "GET",
  "bucket": "my-datalake",
  "key": "data/file.txt"
}
```

### Пример 2: Data lake с lifecycle policies

**Сценарий:** Data lake с автоматической оптимизацией стоимости

```json
{
  "buckets": [
    {
      "name": "production-datalake",
      "region": "us-east-1",
      "versioning": true,
      "encryption": "aws:kms",
      "lifecycleEnabled": true,
      "publicAccess": false
    }
  ],
  "lifecycleRules": [
    {
      "id": "rule-logs",
      "name": "Logs Lifecycle",
      "prefix": "logs/",
      "status": "Enabled",
      "transitions": [
        {
          "days": 30,
          "storageClass": "STANDARD_IA"
        },
        {
          "days": 90,
          "storageClass": "GLACIER"
        }
      ],
      "expiration": {
        "days": 365
      }
    },
    {
      "id": "rule-backups",
      "name": "Backups Lifecycle",
      "prefix": "backups/",
      "status": "Enabled",
      "transitions": [
        {
          "days": 90,
          "storageClass": "GLACIER"
        },
        {
          "days": 365,
          "storageClass": "DEEP_ARCHIVE"
        }
      ]
    }
  ]
}
```

### Пример 3: Multipart upload

**Сценарий:** Загрузка большого файла по частям

```json
// 1. Инициализация
{
  "operation": "INITIATE_MULTIPART_UPLOAD",
  "bucket": "my-datalake",
  "key": "large-backup.tar.gz"
}

// 2. Загрузка частей (параллельно)
{
  "operation": "UPLOAD_PART",
  "bucket": "my-datalake",
  "key": "large-backup.tar.gz",
  "uploadId": "upload-id-123",
  "partNumber": 1,
  "data": "part1-data...",
  "size": 5242880
}

{
  "operation": "UPLOAD_PART",
  "bucket": "my-datalake",
  "key": "large-backup.tar.gz",
  "uploadId": "upload-id-123",
  "partNumber": 2,
  "data": "part2-data...",
  "size": 5242880
}

// 3. Завершение
{
  "operation": "COMPLETE_MULTIPART_UPLOAD",
  "bucket": "my-datalake",
  "key": "large-backup.tar.gz",
  "uploadId": "upload-id-123",
  "parts": [
    { "partNumber": 1, "etag": "etag1" },
    { "partNumber": 2, "etag": "etag2" }
  ]
}
```

### Пример 4: Restore из Glacier

**Сценарий:** Восстановление архивных данных

```json
// 1. Инициализация восстановления
{
  "operation": "RESTORE_OBJECT",
  "bucket": "my-datalake",
  "key": "archive/data.zip",
  "storageClass": "GLACIER",
  "tier": "Standard"
}

// 2. Проверка статуса (периодически)
{
  "operation": "GET_RESTORE_STATUS",
  "bucket": "my-datalake",
  "key": "archive/data.zip"
}

// 3. Получение после восстановления
{
  "operation": "GET_AFTER_RESTORE",
  "bucket": "my-datalake",
  "key": "archive/data.zip"
}
```

### Пример 5: Версионирование объектов

**Сценарий:** Защита от случайного удаления

```json
{
  "buckets": [
    {
      "name": "versioned-bucket",
      "versioning": true
    }
  ]
}
```

**Загрузка версий:**
```json
// Версия 1
{
  "operation": "PUT",
  "bucket": "versioned-bucket",
  "key": "document.txt",
  "data": "Version 1"
}

// Версия 2
{
  "operation": "PUT",
  "bucket": "versioned-bucket",
  "key": "document.txt",
  "data": "Version 2"
}
```

**Получение конкретной версии:**
```json
{
  "operation": "GET",
  "bucket": "versioned-bucket",
  "key": "document.txt",
  "versionId": "version-id-1"
}
```

**Удаление (создает delete marker):**
```json
{
  "operation": "DELETE",
  "bucket": "versioned-bucket",
  "key": "document.txt"
}
```

---

## Часто задаваемые вопросы (FAQ)

### Что такое S3 Data Lake?

S3 Data Lake - это объектное хранилище для построения data lakes. S3 позволяет хранить неограниченное количество данных с различными классами хранения, lifecycle policies, versioning и encryption.

### В чем разница между S3 и традиционными файловыми системами?

- **Модель данных:** S3 использует объектную модель (key-value), традиционные ФС - иерархическую
- **Масштабирование:** S3 масштабируется автоматически, традиционные ФС - ограничены размером диска
- **Доступность:** S3 обеспечивает высокую доступность (99.99%), традиционные ФС - зависят от сервера
- **Стоимость:** S3 оплачивается по использованию, традиционные ФС - фиксированная стоимость диска

### Что такое bucket в S3?

Bucket - это контейнер для объектов в S3. Каждый bucket имеет уникальное имя и регион. Bucket аналогичен папке в файловой системе, но с глобально уникальным именем.

### Что такое storage class?

Storage class определяет стоимость и доступность хранения:
- **STANDARD** - Высокая доступность, высокая стоимость
- **STANDARD_IA** - Средняя доступность, средняя стоимость
- **GLACIER** - Низкая доступность (требуется restore), низкая стоимость
- **DEEP_ARCHIVE** - Очень низкая доступность (долгий restore), самая низкая стоимость

### Как работает lifecycle policy?

Lifecycle policy автоматически управляет переходами между storage classes и удалением объектов:
- Переходы выполняются на основе времени с момента создания объекта
- Expiration удаляет объекты через указанное количество дней
- Префикс определяет, к каким объектам применяется правило

### Что такое versioning?

Versioning позволяет хранить несколько версий одного объекта:
- Каждый PUT создает новую версию
- DELETE создает delete marker вместо удаления объекта
- Можно получить любую версию по versionId
- Можно восстановить объект, удалив delete marker

### Когда использовать multipart upload?

Multipart upload используется для:
- Загрузки больших файлов (>5GB)
- Оптимизации использования пропускной способности
- Возможности возобновления при сбое
- Параллельной загрузки частей

### Как восстановить объект из Glacier?

1. Инициализируйте restore операцию (RESTORE_OBJECT)
2. Дождитесь завершения restore (проверяйте статус через GET_RESTORE_STATUS)
3. Получите объект после восстановления (GET_AFTER_RESTORE)

**Время восстановления:**
- Expedited: 1-5 минут
- Standard: 3-5 часов
- Bulk: 5-12 часов

### Как оптимизировать стоимость S3?

1. Используйте lifecycle policies для автоматических переходов
2. Используйте STANDARD_IA для редко используемых данных
3. Используйте GLACIER для архивных данных
4. Используйте DEEP_ARCHIVE для долгосрочного архивирования
5. Настройте expiration для автоматического удаления старых данных
6. Организуйте данные по префиксам для применения разных правил

### Как мониторить S3 Data Lake?

Используйте метрики в реальном времени:
- Storage Utilization, Operations Utilization
- Error Rate, Average Latency
- Lifecycle Transitions, Glacier Objects
- Bucket Metrics (objectCount, totalSize, operations)

---

## Дополнительные ресурсы

- [Официальная документация AWS S3](https://docs.aws.amazon.com/s3/)
- [AWS S3 Storage Classes](https://docs.aws.amazon.com/AmazonS3/latest/userguide/storage-class-intro.html)
- [AWS S3 Lifecycle Policies](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lifecycle-mgmt.html)
- [AWS S3 Best Practices](https://docs.aws.amazon.com/AmazonS3/latest/userguide/security-best-practices.html)

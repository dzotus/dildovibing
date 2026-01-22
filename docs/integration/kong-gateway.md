# Kong Gateway - Документация компонента

## Обзор

Kong Gateway - это облачный API Gateway с открытым исходным кодом, предназначенный для управления, маршрутизации и защиты API и микросервисов. Компонент Kong Gateway в системе симуляции полностью эмулирует поведение реального Kong Gateway, включая сервисы, маршруты, upstreams, consumers, плагины, load balancing, health checks, circuit breakers и retry logic.

### Основные возможности

- ✅ **Services** - Определение backend сервисов
- ✅ **Routes** - Маршрутизация запросов к сервисам
- ✅ **Upstreams** - Группировка backend targets с load balancing
- ✅ **Consumers** - Управление клиентами API
- ✅ **Plugins** - Расширяемая система плагинов для функциональности
- ✅ **Load Balancing** - Распределение нагрузки (round-robin, consistent-hashing, least-connections)
- ✅ **Health Checks** - Активные и пассивные проверки здоровья upstream targets
- ✅ **Circuit Breakers** - Защита от каскадных сбоев
- ✅ **Retry Logic** - Автоматические повторные попытки при ошибках
- ✅ **Timeout Handling** - Управление таймаутами соединений
- ✅ **Метрики в реальном времени** - Отслеживание запросов, latency, error rate, plugin statistics

---

## Основные функции

### 1. Управление Services

**Описание:** Services представляют backend сервисы, к которым Kong Gateway проксирует запросы.

**Параметры Service:**
- **id** - Уникальный идентификатор (генерируется автоматически)
- **name** - Имя сервиса (обязательно, уникальное)
- **url** - URL сервиса (альтернатива protocol/host/port/path)
- **protocol** - Протокол: `http`, `https`, `grpc`, `grpcs` (по умолчанию: `http`)
- **host** - Хост сервиса (обязательно, если не указан url)
- **port** - Порт сервиса (обязательно, если не указан url)
- **path** - Путь сервиса (опционально)
- **connect_timeout** - Таймаут подключения в миллисекундах (60000, по умолчанию: 60000)
- **write_timeout** - Таймаут записи в миллисекундах (60000, по умолчанию: 60000)
- **read_timeout** - Таймаут чтения в миллисекундах (60000, по умолчанию: 60000)
- **retries** - Количество повторных попыток при ошибках (0-10, по умолчанию: 5)
- **enabled** - Включен ли сервис (по умолчанию: `true`)
- **upstream** - Имя upstream для load balancing (опционально)
- **tags** - Метки для организации (опционально)
- **ca_certificates** - CA сертификаты для TLS (опционально)
- **client_certificate** - Клиентский сертификат для mTLS (опционально)
- **tls_verify** - Проверять ли TLS сертификат (по умолчанию: `false`)
- **tls_verify_depth** - Глубина проверки TLS сертификата (по умолчанию: 1)

**Пример конфигурации:**
```json
{
  "services": [
    {
      "name": "user-service",
      "protocol": "http",
      "host": "user-service.internal",
      "port": 8080,
      "path": "/api",
      "connect_timeout": 60000,
      "write_timeout": 60000,
      "read_timeout": 60000,
      "retries": 5,
      "enabled": true,
      "upstream": "user-service-upstream"
    }
  ]
}
```

### 2. Управление Routes

**Описание:** Routes определяют правила маршрутизации запросов к сервисам.

**Параметры Route:**
- **id** - Уникальный идентификатор (генерируется автоматически)
- **name** - Имя маршрута (опционально)
- **paths** - Пути для маршрутизации (обязательно, если не указаны hosts)
- **methods** - HTTP методы (GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD, TRACE, CONNECT)
- **hosts** - Хосты для маршрутизации (опционально)
- **protocols** - Протоколы (`http`, `https`, `grpc`, `grpcs`, по умолчанию: `["http", "https"]`)
- **regex_priority** - Приоритет для regex путей (0-1000, по умолчанию: 0)
- **preserve_host** - Сохранять ли Host заголовок (по умолчанию: `false`)
- **strip_path** - Удалять ли путь из запроса перед проксированием (по умолчанию: `true`)
- **request_buffering** - Буферизация запроса (по умолчанию: `true`)
- **response_buffering** - Буферизация ответа (по умолчанию: `true`)
- **https_redirect_status_code** - Код редиректа для HTTPS (301, 302, 307, 308, опционально)
- **path_handling** - Обработка путей: `v0` или `v1` (по умолчанию: `v0`)
- **service** - Имя сервиса для маршрутизации (обязательно)
- **tags** - Метки для организации (опционально)

**Особенности маршрутизации:**
- Routes сопоставляются по paths, hosts, methods, protocols
- При совпадении нескольких routes выбирается с наивысшим `regex_priority`
- `strip_path` удаляет matched path перед проксированием к upstream

**Пример конфигурации:**
```json
{
  "routes": [
    {
      "name": "user-api-route",
      "paths": ["/api/users"],
      "methods": ["GET", "POST", "PUT", "DELETE"],
      "protocols": ["http", "https"],
      "strip_path": true,
      "preserve_host": false,
      "service": "user-service"
    }
  ]
}
```

### 3. Управление Upstreams

**Описание:** Upstreams группируют backend targets для load balancing и health checks.

**Параметры Upstream:**
- **id** - Уникальный идентификатор (генерируется автоматически)
- **name** - Имя upstream (обязательно, уникальное)
- **algorithm** - Алгоритм load balancing: `round-robin`, `consistent-hashing`, `least-connections` (по умолчанию: `round-robin`)
- **slots** - Количество слотов для consistent-hashing (10-65536, по умолчанию: 10000)
- **hash_on** - Критерий хеширования: `none`, `header`, `cookie`, `consumer`, `ip` (по умолчанию: `none`)
- **hash_fallback** - Fallback критерий хеширования (по умолчанию: `none`)
- **hash_on_header** - Имя заголовка для хеширования (если hash_on = header)
- **hash_fallback_header** - Имя заголовка для fallback хеширования
- **hash_on_cookie** - Имя cookie для хеширования (если hash_on = cookie)
- **hash_on_cookie_path** - Путь для cookie (по умолчанию: `/`)
- **healthchecks** - Конфигурация health checks (опционально)
- **targets** - Список backend targets (обязательно)
- **tags** - Метки для организации (опционально)

**Health Checks:**
- **active** - Активные health checks (периодические проверки):
  - `type` - Тип проверки: `http`, `https`, `tcp`
  - `http_path` - Путь для HTTP проверки
  - `timeout` - Таймаут проверки в секундах
  - `concurrency` - Количество параллельных проверок
  - `healthy.interval` - Интервал проверок для healthy targets
  - `healthy.successes` - Количество успешных проверок для healthy
  - `healthy.http_statuses` - HTTP статусы для healthy
  - `unhealthy.interval` - Интервал проверок для unhealthy targets
  - `unhealthy.timeouts` - Количество таймаутов для unhealthy
  - `unhealthy.http_statuses` - HTTP статусы для unhealthy
  - `unhealthy.tcp_failures` - Количество TCP ошибок для unhealthy
  - `unhealthy.http_failures` - Количество HTTP ошибок для unhealthy
- **passive** - Пассивные health checks (на основе реальных запросов):
  - Аналогичные параметры для healthy/unhealthy

**Targets:**
- **target** - Адрес target в формате `host:port` (обязательно)
- **weight** - Вес target для load balancing (0-1000, по умолчанию: 100)
- **health** - Статус здоровья: `healthy`, `unhealthy`, `draining` (обновляется автоматически)
- **tags** - Метки для организации (опционально)

**Пример конфигурации:**
```json
{
  "upstreams": [
    {
      "name": "user-service-upstream",
      "algorithm": "round-robin",
      "healthchecks": {
        "active": {
          "type": "http",
          "http_path": "/health",
          "timeout": 1,
          "concurrency": 10,
          "healthy": {
            "interval": 10,
            "successes": 2,
            "http_statuses": [200, 201, 204]
          },
          "unhealthy": {
            "interval": 10,
            "timeouts": 3,
            "http_statuses": [429, 500, 503],
            "tcp_failures": 3,
            "http_failures": 3
          }
        },
        "passive": {
          "healthy": {
            "successes": 2,
            "http_statuses": [200, 201, 204]
          },
          "unhealthy": {
            "timeouts": 3,
            "http_statuses": [429, 500, 503],
            "tcp_failures": 3,
            "http_failures": 3
          }
        }
      },
      "targets": [
        {
          "target": "user-service-1:8080",
          "weight": 100
        },
        {
          "target": "user-service-2:8080",
          "weight": 100
        }
      ]
    }
  ]
}
```

### 4. Управление Consumers

**Описание:** Consumers представляют клиентов API, использующих сервисы через Kong Gateway.

**Параметры Consumer:**
- **id** - Уникальный идентификатор (генерируется автоматически)
- **username** - Имя пользователя (обязательно, уникальное)
- **custom_id** - Кастомный идентификатор (опционально, уникальный)
- **tags** - Метки для организации (опционально)
- **credentials** - Список credentials для аутентификации (опционально)

**Credentials:**
- **type** - Тип credential: `key-auth`, `jwt`, `oauth2`, `basic-auth`, `hmac-auth`, `ldap-auth`, `mtls-auth`
- **key** - API ключ (для key-auth)
- **secret** - Секрет (для jwt, oauth2, hmac-auth)
- **algorithm** - Алгоритм (для jwt: HS256, HS384, HS512, RS256, RS384, RS512, ES256, ES384, ES512)
- **rsa_public_key** - RSA публичный ключ (для jwt)
- **client_id** - Client ID (для oauth2)
- **username** - Имя пользователя (для basic-auth, hmac-auth)
- **password** - Пароль (для basic-auth)
- **ldap_host** - LDAP хост (для ldap-auth)
- **ldap_port** - LDAP порт (для ldap-auth)
- **certificate** - Сертификат (для mtls-auth)

**Пример конфигурации:**
```json
{
  "consumers": [
    {
      "username": "api-client",
      "custom_id": "client-123",
      "credentials": [
        {
          "type": "key-auth",
          "key": "api-key-12345"
        },
        {
          "type": "jwt",
          "secret": "jwt-secret",
          "algorithm": "HS256"
        }
      ]
    }
  ]
}
```

### 5. Управление Plugins

**Описание:** Plugins расширяют функциональность Kong Gateway.

**Параметры Plugin:**
- **id** - Уникальный идентификатор (генерируется автоматически)
- **name** - Имя плагина (обязательно)
- **instance_name** - Имя экземпляра плагина (опционально)
- **enabled** - Включен ли плагин (по умолчанию: `true`)
- **config** - Конфигурация плагина (JSON объект, зависит от типа плагина)
- **protocols** - Протоколы, на которых работает плагин (`http`, `https`, `grpc`, `grpcs`, `tcp`, `tls`)
- **service** - Имя сервиса (для service-scoped плагина, опционально)
- **route** - ID маршрута (для route-scoped плагина, опционально)
- **consumer** - Имя consumer (для consumer-scoped плагина, опционально)
- **tags** - Метки для организации (опционально)
- **ordering** - Порядок выполнения плагина (опционально):
  - `before` - Выполнять перед указанными плагинами
  - `after` - Выполнять после указанных плагинов
- **run_on** - На каких нодах выполнять: `first`, `second`, `all` (по умолчанию: `first`)

**Поддерживаемые плагины:**
- **rate-limiting** - Ограничение количества запросов
- **key-auth** - Аутентификация по API ключу
- **jwt** - JWT аутентификация
- **cors** - CORS заголовки
- **ip-restriction** - Ограничение по IP адресам
- **file-log** - Логирование в файл
- **http-log** - Логирование через HTTP
- И многие другие (см. раздел "Плагины")

**Пример конфигурации:**
```json
{
  "plugins": [
    {
      "name": "rate-limiting",
      "enabled": true,
      "service": "user-service",
      "config": {
        "minute": 100,
        "hour": 1000,
        "policy": "local"
      }
    },
    {
      "name": "key-auth",
      "enabled": true,
      "service": "user-service",
      "config": {
        "key_names": ["apikey"],
        "hide_credentials": false
      }
    }
  ]
}
```

### 6. Load Balancing

**Описание:** Распределение нагрузки между upstream targets.

**Алгоритмы:**
- **round-robin** - Циклическое распределение (по умолчанию)
- **consistent-hashing** - Консистентное хеширование для sticky sessions
- **least-connections** - Выбор target с наименьшим количеством соединений

**Hash Criteria (для consistent-hashing):**
- **none** - Не использовать хеширование
- **header** - Хешировать по значению заголовка
- **cookie** - Хешировать по значению cookie
- **consumer** - Хешировать по consumer ID
- **ip** - Хешировать по IP адресу клиента

**Пример конфигурации:**
```json
{
  "upstreams": [
    {
      "name": "session-aware-upstream",
      "algorithm": "consistent-hashing",
      "hash_on": "header",
      "hash_on_header": "X-Session-ID",
      "slots": 10000,
      "targets": [
        {
          "target": "backend-1:8080",
          "weight": 100
        },
        {
          "target": "backend-2:8080",
          "weight": 100
        }
      ]
    }
  ]
}
```

### 7. Health Checks

**Описание:** Проверка здоровья upstream targets.

**Типы Health Checks:**
- **Active** - Периодические проверки (Kong инициирует запросы)
- **Passive** - На основе реальных запросов (Kong анализирует ответы)

**Как работает:**
1. Active health checks периодически проверяют targets
2. При успешных проверках target становится healthy
3. При неуспешных проверках target становится unhealthy
4. Unhealthy targets исключаются из load balancing
5. Passive health checks обновляют статус на основе реальных запросов

**Пример конфигурации:**
```json
{
  "healthchecks": {
    "active": {
      "type": "http",
      "http_path": "/health",
      "timeout": 1,
      "concurrency": 10,
      "healthy": {
        "interval": 10,
        "successes": 2,
        "http_statuses": [200]
      },
      "unhealthy": {
        "interval": 10,
        "timeouts": 3,
        "http_statuses": [500, 503],
        "tcp_failures": 3,
        "http_failures": 3
      }
    }
  }
}
```

### 8. Circuit Breakers

**Описание:** Защита от каскадных сбоев при проблемах с upstream targets.

**Как работает:**
1. Отслеживание ошибок для каждого target
2. При превышении порога ошибок (5 по умолчанию) - circuit открывается
3. Запросы к target блокируются на время timeout (30 секунд по умолчанию)
4. После timeout - circuit переходит в half-open состояние
5. При успешных запросах (2 по умолчанию) - circuit закрывается

**Состояния:**
- **closed** - Нормальная работа, запросы проходят
- **open** - Circuit открыт, запросы блокируются
- **half-open** - Тестовое состояние, ограниченные запросы

**Параметры:**
- **failure_threshold** - Порог ошибок для открытия circuit (по умолчанию: 5)
- **success_threshold** - Порог успешных запросов для закрытия circuit (по умолчанию: 2)
- **timeout** - Время до попытки half-open (по умолчанию: 30000ms)

### 9. Retry Logic

**Описание:** Автоматические повторные попытки при ошибках.

**Параметры:**
- **retries** - Количество повторных попыток (0-10, по умолчанию: 5)

**Как работает:**
1. При ошибке upstream (5xx, timeout, connection error)
2. Kong автоматически повторяет запрос к другому target
3. Количество попыток ограничено параметром `retries`
4. Используется только для идемпотентных методов (GET, HEAD, OPTIONS, PUT, DELETE)

**Пример конфигурации:**
```json
{
  "services": [
    {
      "name": "user-service",
      "retries": 5
    }
  ]
}
```

### 10. Timeout Handling

**Описание:** Управление таймаутами соединений.

**Параметры:**
- **connect_timeout** - Таймаут подключения в миллисекундах (по умолчанию: 60000)
- **write_timeout** - Таймаут записи в миллисекундах (по умолчанию: 60000)
- **read_timeout** - Таймаут чтения в миллисекундах (по умолчанию: 60000)

**Как работает:**
- При превышении `connect_timeout` - ошибка подключения
- При превышении `write_timeout` - ошибка записи
- При превышении `read_timeout` - ошибка чтения
- Таймауты применяются к каждому запросу

**Пример конфигурации:**
```json
{
  "services": [
    {
      "name": "user-service",
      "connect_timeout": 10000,
      "write_timeout": 10000,
      "read_timeout": 30000
    }
  ]
}
```

### 11. Плагины

**Описание:** Расширяемая система плагинов для функциональности.

#### Rate Limiting

**Описание:** Ограничение количества запросов.

**Конфигурация:**
- **minute** - Лимит в минуту
- **hour** - Лимит в час
- **day** - Лимит в день
- **limit_by** - Критерий лимита: `consumer`, `ip`, `credential`, `service`, `header`
- **policy** - Политика хранения: `local`, `redis`, `cluster`
- **redis.host** - Redis хост (если policy = redis)
- **redis.port** - Redis порт (если policy = redis)
- **redis.password** - Redis пароль (если policy = redis)
- **redis.database** - Redis база данных (если policy = redis)

**Пример:**
```json
{
  "name": "rate-limiting",
  "config": {
    "minute": 100,
    "hour": 1000,
    "limit_by": "consumer",
    "policy": "local"
  }
}
```

#### Key Authentication

**Описание:** Аутентификация по API ключу.

**Конфигурация:**
- **key_names** - Имена заголовков/query параметров для ключа (по умолчанию: `["apikey"]`)
- **hide_credentials** - Скрывать ли credentials в заголовках (по умолчанию: `false`)

**Пример:**
```json
{
  "name": "key-auth",
  "config": {
    "key_names": ["apikey", "x-api-key"],
    "hide_credentials": true
  }
}
```

#### JWT Authentication

**Описание:** JWT аутентификация.

**Конфигурация:**
- **secret_is_base64** - Секрет в base64 (по умолчанию: `false`)
- **run_on** - На каких нодах выполнять: `first`, `second`, `all`

**Пример:**
```json
{
  "name": "jwt",
  "config": {
    "secret_is_base64": false
  }
}
```

#### CORS

**Описание:** CORS заголовки для cross-origin запросов.

**Конфигурация:**
- **origins** - Разрешенные origins (массив или `*`)
- **methods** - Разрешенные методы (массив или `*`)
- **headers** - Разрешенные заголовки (массив или `*`)
- **exposed_headers** - Заголовки для экспозиции (массив)
- **credentials** - Разрешать ли credentials (по умолчанию: `false`)
- **max_age** - Время кэширования preflight запросов в секундах

**Пример:**
```json
{
  "name": "cors",
  "config": {
    "origins": ["https://example.com", "https://app.example.com"],
    "methods": ["GET", "POST", "PUT", "DELETE"],
    "headers": ["Content-Type", "Authorization"],
    "credentials": true,
    "max_age": 3600
  }
}
```

#### IP Restriction

**Описание:** Ограничение доступа по IP адресам.

**Конфигурация:**
- **whitelist** - Список разрешенных IP адресов/CIDR (опционально)
- **blacklist** - Список запрещенных IP адресов/CIDR (опционально)

**Пример:**
```json
{
  "name": "ip-restriction",
  "config": {
    "whitelist": ["192.168.1.0/24", "10.0.0.0/8"]
  }
}
```

#### File Log

**Описание:** Логирование запросов в файл.

**Конфигурация:**
- **path** - Путь к файлу лога (обязательно)
- **reopen** - Переоткрывать ли файл (по умолчанию: `false`)

**Пример:**
```json
{
  "name": "file-log",
  "config": {
    "path": "/var/log/kong/access.log",
    "reopen": true
  }
}
```

#### HTTP Log

**Описание:** Логирование запросов через HTTP.

**Конфигурация:**
- **http_endpoint** - URL endpoint для логирования (обязательно)
- **method** - HTTP метод (по умолчанию: `POST`)
- **timeout** - Таймаут запроса в миллисекундах (по умолчанию: 10000)
- **keepalive** - Использовать ли keepalive (по умолчанию: `60000`)

**Пример:**
```json
{
  "name": "http-log",
  "config": {
    "http_endpoint": "https://logs.example.com/api/logs",
    "method": "POST",
    "timeout": 5000
  }
}
```

---

## Руководство пользователя

### Быстрый старт

1. **Добавление компонента Kong Gateway:**
   - Перетащите компонент "Kong Gateway" из библиотеки компонентов на canvas
   - Откройте панель конфигурации компонента

2. **Базовая настройка:**
   - Укажите Admin API URL (например, `http://kong:8001`)
   - Создайте первый Service через вкладку "Services"
   - Создайте первый Route через вкладку "Routes"

3. **Подключение к другим компонентам:**
   - Создайте соединение от компонента-клиента к Kong Gateway
   - Создайте соединение от Kong Gateway к backend сервису
   - Service и Route создаются автоматически при соединении

### Работа с Services

#### Создание Service

1. Перейдите на вкладку **"Services"**
2. Нажмите кнопку **"Add Service"**
3. Заполните параметры:
   - **Name** - Имя сервиса (обязательно, уникальное)
   - **Protocol** - Протокол (http, https, grpc, grpcs)
   - **Host** - Хост сервиса
   - **Port** - Порт сервиса
   - **Path** - Путь сервиса (опционально)
4. Настройте таймауты (опционально):
   - Connect Timeout
   - Write Timeout
   - Read Timeout
5. Настройте retries (опционально)
6. Выберите Upstream для load balancing (опционально)
7. Нажмите **"Save"**

#### Редактирование Service

1. Выберите сервис из списка
2. Нажмите кнопку **"Edit"** (иконка карандаша)
3. Измените параметры
4. Нажмите **"Save"**

#### Просмотр метрик Service

Во время симуляции отображаются:
- Количество связанных Routes
- Статус (enabled/disabled)
- Метрики (requests/sec, latency, error rate) - при наличии

### Работа с Routes

#### Создание Route

1. Перейдите на вкладку **"Routes"**
2. Нажмите кнопку **"Add Route"**
3. Заполните параметры:
   - **Name** - Имя маршрута (опционально)
   - **Paths** - Пути для маршрутизации (обязательно)
   - **Methods** - HTTP методы (опционально)
   - **Service** - Выберите сервис для маршрутизации
4. Настройте дополнительные параметры (опционально):
   - Strip Path
   - Preserve Host
   - Request/Response Buffering
5. Нажмите **"Save"**

#### Редактирование Route

1. Выберите маршрут из списка
2. Нажмите кнопку **"Edit"** (иконка карандаша)
3. Измените параметры
4. Нажмите **"Save"**

### Работа с Upstreams

#### Создание Upstream

1. Перейдите на вкладку **"Upstreams"**
2. Нажмите кнопку **"Add Upstream"**
3. Заполните параметры:
   - **Name** - Имя upstream (обязательно, уникальное)
   - **Algorithm** - Алгоритм load balancing
4. Настройте health checks (опционально):
   - Active health checks
   - Passive health checks
5. Добавьте targets:
   - Нажмите **"Add Target"**
   - Укажите target в формате `host:port`
   - Укажите weight (опционально)
6. Нажмите **"Save"**

#### Настройка Health Checks

1. Выберите upstream из списка
2. Нажмите кнопку **"Edit"**
3. В разделе **"Health Checks"**:
   - Настройте Active health checks:
     - Type (http, https, tcp)
     - HTTP Path
     - Timeout
     - Healthy/Unhealthy интервалы и критерии
   - Настройте Passive health checks:
     - Healthy/Unhealthy критерии
4. Нажмите **"Save"**

#### Просмотр статуса Targets

Во время симуляции отображаются:
- Health status каждого target (healthy/unhealthy/draining)
- Количество healthy/unhealthy targets
- Circuit breaker состояние (если применимо)

### Работа с Consumers

#### Создание Consumer

1. Перейдите на вкладку **"Consumers"**
2. Нажмите кнопку **"Add Consumer"**
3. Заполните параметры:
   - **Username** - Имя пользователя (обязательно, уникальное)
   - **Custom ID** - Кастомный идентификатор (опционально)
4. Добавьте credentials (опционально):
   - Нажмите **"Add Credential"**
   - Выберите тип credential
   - Заполните параметры в зависимости от типа
5. Нажмите **"Save"**

#### Добавление Credentials

1. Выберите consumer из списка
2. Нажмите кнопку **"Add Credential"**
3. Выберите тип credential:
   - **Key Auth** - API ключ
   - **JWT** - JWT токен
   - **OAuth2** - OAuth2 credentials
   - **Basic Auth** - Basic authentication
   - **HMAC Auth** - HMAC authentication
   - **LDAP Auth** - LDAP authentication
   - **mTLS Auth** - Mutual TLS certificate
4. Заполните параметры в зависимости от типа
5. Нажмите **"Save"**

### Работа с Plugins

#### Создание Plugin

1. Перейдите на вкладку **"Plugins"**
2. Нажмите кнопку **"Add Plugin"**
3. Выберите тип плагина:
   - Rate Limiting
   - Key Authentication
   - JWT
   - CORS
   - IP Restriction
   - File Log
   - HTTP Log
   - И другие
4. Настройте scope (опционально):
   - Global (для всех запросов)
   - Service (для конкретного сервиса)
   - Route (для конкретного маршрута)
   - Consumer (для конкретного consumer)
5. Заполните конфигурацию плагина
6. Нажмите **"Save"**

#### Настройка Rate Limiting

1. Создайте plugin типа **"rate-limiting"**
2. Заполните параметры:
   - **Minute** - Лимит в минуту
   - **Hour** - Лимит в час
   - **Day** - Лимит в день
   - **Limit By** - Критерий лимита (consumer, ip, credential, service)
   - **Policy** - Политика хранения (local, redis, cluster)
3. Если policy = redis, укажите параметры Redis
4. Нажмите **"Save"**

### Настройка Settings

1. Перейдите на вкладку **"Settings"**
2. Укажите:
   - **Admin API URL** - URL Admin API Kong Gateway
   - **Requests Per Second** - Ожидаемая нагрузка (для симуляции)
3. Изменения сохраняются автоматически

---

## Руководство администратора

### Рекомендации по конфигурации

#### Production Service

```json
{
  "services": [
    {
      "name": "production-api",
      "protocol": "https",
      "host": "api.production.com",
      "port": 443,
      "connect_timeout": 10000,
      "write_timeout": 10000,
      "read_timeout": 30000,
      "retries": 3,
      "enabled": true,
      "upstream": "production-api-upstream"
    }
  ]
}
```

**Рекомендации:**
- Используйте HTTPS для production
- Настройте адекватные таймауты
- Используйте upstream для load balancing
- Настройте retries для отказоустойчивости

#### Production Upstream с Health Checks

```json
{
  "upstreams": [
    {
      "name": "production-api-upstream",
      "algorithm": "least-connections",
      "healthchecks": {
        "active": {
          "type": "http",
          "http_path": "/health",
          "timeout": 1,
          "concurrency": 10,
          "healthy": {
            "interval": 10,
            "successes": 2,
            "http_statuses": [200]
          },
          "unhealthy": {
            "interval": 10,
            "timeouts": 3,
            "http_statuses": [500, 503],
            "tcp_failures": 3,
            "http_failures": 3
          }
        }
      },
      "targets": [
        {
          "target": "api-1:8080",
          "weight": 100
        },
        {
          "target": "api-2:8080",
          "weight": 100
        },
        {
          "target": "api-3:8080",
          "weight": 100
        }
      ]
    }
  ]
}
```

**Рекомендации:**
- Используйте health checks для всех production upstreams
- Настройте как active, так и passive health checks
- Используйте несколько targets для отказоустойчивости
- Мониторьте health status targets

### Оптимизация производительности

#### Load Balancing Algorithm

- **round-robin:** Для равномерного распределения нагрузки
- **consistent-hashing:** Для sticky sessions
- **least-connections:** Для оптимального использования ресурсов

#### Health Checks

- Настройте активные health checks для быстрого обнаружения проблем
- Используйте пассивные health checks для дополнения активных
- Настройте адекватные интервалы (не слишком часто, не слишком редко)

#### Timeouts

- **connect_timeout:** 5-10 секунд для большинства случаев
- **write_timeout:** 5-10 секунд для большинства случаев
- **read_timeout:** 30-60 секунд для большинства случаев

#### Retries

- Используйте 3-5 retries для большинства случаев
- Учитывайте идемпотентность методов
- Не используйте retries для неидемпотентных операций

### Безопасность

#### Аутентификация

- Используйте key-auth для простых случаев
- Используйте JWT для сложных сценариев
- Используйте OAuth2 для enterprise интеграций
- Настройте IP restriction для дополнительной защиты

#### Rate Limiting

- Настройте rate limiting для всех публичных API
- Используйте разные лимиты для разных consumers
- Мониторьте rate limit hits

#### CORS

- Настройте CORS для веб-приложений
- Используйте конкретные origins вместо `*`
- Настройте credentials только при необходимости

### Мониторинг и алертинг

#### Ключевые метрики

1. **Throughput (requests/sec)**
   - Нормальное значение: зависит от нагрузки
   - Алерт: резкое падение или превышение порога

2. **Latency**
   - Нормальное значение: < 100ms для большинства случаев
   - Алерт: latency > 500ms или постоянно растущая

3. **Error Rate**
   - Нормальное значение: < 1%
   - Алерт: error rate > 5%

4. **Upstream Health**
   - Все targets должны быть healthy
   - Алерт: любой target unhealthy

5. **Circuit Breaker State**
   - Все circuits должны быть closed
   - Алерт: любой circuit open

6. **Rate Limit Hits**
   - Мониторьте количество rate limit hits
   - Алерт: постоянные rate limit hits (возможно, лимиты слишком низкие)

---

## Метрики и мониторинг

### Основные метрики

#### Throughput
- **Описание:** Количество запросов в секунду
- **Единица измерения:** requests/sec
- **Источник:** Рассчитывается на основе входящих соединений и конфигурации

#### Latency
- **Описание:** Задержка обработки запросов
- **Единица измерения:** миллисекунды (ms)
- **Факторы влияния:**
  - Базовая задержка gateway (1-5ms)
  - Overhead плагинов (~0.5ms на плагин)
  - Задержка upstream сервисов
  - Health checks
  - Circuit breaker состояние

**Формула:**
```
Latency = baseLatency + pluginOverhead + upstreamLatency + healthCheckOverhead
```

#### Error Rate
- **Описание:** Процент ошибок при обработке
- **Единица измерения:** процент (0-1)
- **Причины ошибок:**
  - Ошибки аутентификации (key-auth, jwt)
  - Rate limit превышен
  - IP restriction блокировки
  - Upstream ошибки (5xx)
  - Timeout ошибки
  - Circuit breaker открыт

#### Utilization
- **Описание:** Загрузка gateway
- **Единица измерения:** процент (0-1)
- **Расчет:** На основе throughput и capacity

### Кастомные метрики

#### Services
- Количество сервисов

#### Routes
- Количество маршрутов

#### Upstreams
- Количество upstreams

#### Consumers
- Количество consumers

#### Plugins
- Количество активных плагинов

#### Active Connections
- Количество активных соединений к upstream targets

### Метрики Upstreams

Для каждого upstream доступны:
- **Healthy Targets** - Количество healthy targets
- **Unhealthy Targets** - Количество unhealthy targets
- **Circuit Breaker State** - Состояние circuit breaker для каждого target
- **Load Distribution** - Распределение нагрузки между targets

### Метрики Plugins

Для каждого плагина доступны:
- **Hits** - Количество применений плагина
- **Blocks** - Количество блокировок (rate limit, ip restriction)
- **Errors** - Количество ошибок плагина

### Мониторинг в реальном времени

Все метрики обновляются в реальном времени во время симуляции:
- Метрики services/routes обновляются при обработке запросов
- Health status targets обновляется на основе health checks
- Circuit breaker состояние обновляется на основе ошибок
- Throughput рассчитывается на основе входящих соединений

---

## Примеры использования

### Пример 1: Базовый API Gateway

**Сценарий:** Простой API Gateway с одним сервисом

```json
{
  "services": [
    {
      "name": "api-service",
      "protocol": "http",
      "host": "api.internal",
      "port": 8080,
      "retries": 3
    }
  ],
  "routes": [
    {
      "name": "api-route",
      "paths": ["/api"],
      "methods": ["GET", "POST", "PUT", "DELETE"],
      "service": "api-service",
      "strip_path": true
    }
  ]
}
```

### Пример 2: Load Balancing с Health Checks

**Сценарий:** Отказоустойчивый API с несколькими backend targets

```json
{
  "services": [
    {
      "name": "user-service",
      "protocol": "http",
      "host": "user-service.internal",
      "port": 8080,
      "upstream": "user-service-upstream",
      "retries": 5
    }
  ],
  "upstreams": [
    {
      "name": "user-service-upstream",
      "algorithm": "least-connections",
      "healthchecks": {
        "active": {
          "type": "http",
          "http_path": "/health",
          "timeout": 1,
          "healthy": {
            "interval": 10,
            "successes": 2,
            "http_statuses": [200]
          },
          "unhealthy": {
            "interval": 10,
            "timeouts": 3,
            "http_statuses": [500, 503]
          }
        }
      },
      "targets": [
        {
          "target": "user-1:8080",
          "weight": 100
        },
        {
          "target": "user-2:8080",
          "weight": 100
        },
        {
          "target": "user-3:8080",
          "weight": 100
        }
      ]
    }
  ]
}
```

### Пример 3: Аутентификация и Rate Limiting

**Сценарий:** Защищенный API с аутентификацией и ограничением скорости

```json
{
  "services": [
    {
      "name": "protected-api",
      "protocol": "https",
      "host": "api.example.com",
      "port": 443
    }
  ],
  "routes": [
    {
      "name": "protected-route",
      "paths": ["/api/v1"],
      "service": "protected-api"
    }
  ],
  "consumers": [
    {
      "username": "api-client",
      "credentials": [
        {
          "type": "key-auth",
          "key": "secret-api-key-12345"
        }
      ]
    }
  ],
  "plugins": [
    {
      "name": "key-auth",
      "service": "protected-api",
      "config": {
        "key_names": ["apikey"],
        "hide_credentials": true
      }
    },
    {
      "name": "rate-limiting",
      "service": "protected-api",
      "config": {
        "minute": 100,
        "hour": 1000,
        "limit_by": "consumer",
        "policy": "local"
      }
    }
  ]
}
```

### Пример 4: CORS для веб-приложения

**Сценарий:** API с поддержкой CORS для веб-приложения

```json
{
  "plugins": [
    {
      "name": "cors",
      "service": "api-service",
      "config": {
        "origins": ["https://app.example.com", "https://admin.example.com"],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "headers": ["Content-Type", "Authorization", "X-Requested-With"],
        "exposed_headers": ["X-Total-Count"],
        "credentials": true,
        "max_age": 3600
      }
    }
  ]
}
```

### Пример 5: Consistent Hashing для Sticky Sessions

**Сценарий:** Распределение нагрузки с сохранением сессий

```json
{
  "upstreams": [
    {
      "name": "session-aware-upstream",
      "algorithm": "consistent-hashing",
      "hash_on": "header",
      "hash_on_header": "X-Session-ID",
      "slots": 10000,
      "targets": [
        {
          "target": "backend-1:8080",
          "weight": 100
        },
        {
          "target": "backend-2:8080",
          "weight": 100
        }
      ]
    }
  ]
}
```

### Пример 6: IP Restriction

**Сценарий:** Ограничение доступа по IP адресам

```json
{
  "plugins": [
    {
      "name": "ip-restriction",
      "service": "internal-api",
      "config": {
        "whitelist": ["192.168.1.0/24", "10.0.0.0/8"]
      }
    }
  ]
}
```

---

## Часто задаваемые вопросы (FAQ)

### Что такое Service в Kong Gateway?

Service представляет backend сервис, к которому Kong Gateway проксирует запросы. Service определяет протокол, хост, порт и другие параметры подключения.

### Что такое Route?

Route определяет правила маршрутизации запросов к сервисам. Routes сопоставляются по paths, hosts, methods и protocols.

### Как работает Load Balancing?

Kong Gateway распределяет запросы между targets upstream используя выбранный алгоритм (round-robin, consistent-hashing, least-connections).

### Что такое Health Checks?

Health Checks проверяют здоровье upstream targets. Active checks периодически проверяют targets, passive checks анализируют реальные запросы.

### Как работает Circuit Breaker?

Circuit Breaker защищает от каскадных сбоев. При превышении порога ошибок circuit открывается и блокирует запросы к проблемному target.

### Когда использовать Retry Logic?

Используйте retry logic для идемпотентных операций (GET, HEAD, OPTIONS, PUT, DELETE). Не используйте для POST и других неидемпотентных операций.

### Как выбрать Load Balancing Algorithm?

- **round-robin:** Для равномерного распределения
- **consistent-hashing:** Для sticky sessions
- **least-connections:** Для оптимального использования ресурсов

### Как настроить Rate Limiting?

Создайте plugin типа `rate-limiting` и настройте лимиты (minute, hour, day). Выберите критерий лимита (consumer, ip, credential, service).

### Как работает Key Authentication?

Key Authentication проверяет наличие API ключа в заголовках или query параметрах. Ключ должен быть связан с consumer через credentials.

### Что такое Plugin Scope?

Plugin scope определяет область применения плагина:
- **Global** - для всех запросов
- **Service** - для конкретного сервиса
- **Route** - для конкретного маршрута
- **Consumer** - для конкретного consumer

---

## Дополнительные ресурсы

- [Официальная документация Kong Gateway](https://docs.konghq.com/gateway/)
- [Kong Gateway Admin API](https://docs.konghq.com/gateway/latest/admin-api/)
- [Kong Gateway Plugins](https://docs.konghq.com/hub/)
- [Kong Gateway Best Practices](https://docs.konghq.com/gateway/latest/production/)

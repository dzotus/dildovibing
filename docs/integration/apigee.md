# Apigee API Gateway - Документация компонента

## Обзор

Apigee API Gateway - это полнофункциональная платформа управления API от Google Cloud, предназначенная для проектирования, публикации, защиты и анализа API. Компонент Apigee в системе симуляции полностью эмулирует поведение реального Apigee API Gateway, включая API прокси, политики, API продукты, Developer Apps, API ключи, OAuth токены, JWT валидацию, quota, spike arrest и execution flows.

### Основные возможности

- ✅ **API Proxies** - Определение API прокси с базовыми путями и target endpoints
- ✅ **Policies** - Система политик для функциональности (quota, spike-arrest, oauth, jwt, verify-api-key, cors, xml-to-json)
- ✅ **Execution Flows** - Упорядоченное выполнение политик (PreFlow, RequestFlow, ResponseFlow, PostFlow, ErrorFlow)
- ✅ **API Products** - Группировка прокси для управления доступом
- ✅ **Developer Apps** - Управление приложениями разработчиков
- ✅ **API Keys** - Управление API ключами для аутентификации
- ✅ **OAuth Tokens** - Поддержка OAuth аутентификации
- ✅ **JWT Validation** - Валидация JWT токенов
- ✅ **Quota** - Ограничение количества запросов
- ✅ **Spike Arrest** - Защита от всплесков трафика (token bucket)
- ✅ **Метрики в реальном времени** - Отслеживание запросов, ошибок, latency по прокси

---

## Основные функции

### 1. Управление Organization и Environment

**Описание:** Настройка организации и окружения Apigee.

**Параметры:**
- **organization** - Имя организации (по умолчанию: `archiphoenix-org`)
- **environment** - Окружение: `dev`, `stage`, `prod` (по умолчанию: `prod`)

**Пример конфигурации:**
```json
{
  "organization": "my-organization",
  "environment": "prod"
}
```

### 2. Управление API Proxies

**Описание:** Создание и настройка API прокси для маршрутизации запросов.

**Параметры Proxy:**
- **name** - Имя прокси (обязательно, уникальное, `[a-zA-Z0-9_-]+`)
- **environment** - Окружение: `dev`, `stage`, `prod` (обязательно)
- **basePath** - Базовый путь для маршрутизации (обязательно, должен начинаться с `/`)
- **targetEndpoint** - URL целевого сервиса (обязательно, должен быть валидным URL)
- **revision** - Ревизия прокси (опционально, по умолчанию: 1)
- **status** - Статус: `deployed` или `undeployed` (по умолчанию: `deployed`)
- **quota** - Квота запросов (опционально)
- **quotaInterval** - Интервал квоты в секундах (опционально)
- **spikeArrest** - Лимит spike arrest в запросах в секунду (опционально)
- **enableOAuth** - Включить OAuth аутентификацию (по умолчанию: `false`)
- **jwtIssuer** - JWT issuer для валидации (опционально)

**Метрики прокси (обновляются в реальном времени):**
- **requestCount** - Количество запросов
- **errorCount** - Количество ошибок
- **avgResponseTime** - Среднее время ответа в миллисекундах

**Пример конфигурации:**
```json
{
  "proxies": [
    {
      "name": "user-api-proxy",
      "environment": "prod",
      "basePath": "/api/users",
      "targetEndpoint": "https://user-service.internal/api",
      "revision": 1,
      "status": "deployed",
      "quota": 10000,
      "quotaInterval": 3600,
      "spikeArrest": 100,
      "enableOAuth": true
    }
  ]
}
```

### 3. Управление Policies

**Описание:** Создание и настройка политик для функциональности API Gateway.

**Параметры Policy:**
- **id** - Уникальный идентификатор (генерируется автоматически)
- **name** - Имя политики (обязательно)
- **type** - Тип политики (обязательно): `quota`, `spike-arrest`, `oauth`, `jwt`, `verify-api-key`, `cors`, `xml-to-json`
- **enabled** - Включена ли политика (по умолчанию: `true`)
- **executionFlow** - Поток выполнения: `PreFlow`, `RequestFlow`, `ResponseFlow`, `PostFlow`, `ErrorFlow` (опционально)
- **condition** - Условие выполнения (опционально, JavaScript выражение)
- **config** - Конфигурация политики (JSON объект, зависит от типа)

**Execution Flows:**
- **PreFlow** - Выполняется до маршрутизации (аутентификация: verify-api-key, oauth, jwt)
- **RequestFlow** - Выполняется после маршрутизации, до отправки к upstream (quota, spike-arrest)
- **ResponseFlow** - Выполняется после получения ответа от upstream (xml-to-json, response transformation)
- **PostFlow** - Выполняется перед отправкой ответа клиенту (cors, final transformation)
- **ErrorFlow** - Выполняется при ошибках (error handling)

**Пример конфигурации:**
```json
{
  "policies": [
    {
      "name": "verify-api-key-policy",
      "type": "verify-api-key",
      "enabled": true,
      "executionFlow": "PreFlow"
    },
    {
      "name": "quota-policy",
      "type": "quota",
      "enabled": true,
      "executionFlow": "RequestFlow",
      "config": {
        "quota": 1000,
        "interval": 3600,
        "timeUnit": "hour"
      }
    },
    {
      "name": "cors-policy",
      "type": "cors",
      "enabled": true,
      "executionFlow": "PostFlow",
      "config": {
        "origins": ["https://app.example.com"],
        "methods": ["GET", "POST"],
        "headers": ["Content-Type", "Authorization"]
      }
    }
  ]
}
```

### 4. Типы Policies

#### Quota Policy

**Описание:** Ограничение количества запросов за период времени.

**Конфигурация:**
- **quota** - Количество запросов (обязательно)
- **interval** - Интервал в секундах (опционально, используется quotaInterval из прокси если не указан)
- **timeUnit** - Единица времени: `second`, `minute`, `hour`, `day` (по умолчанию: `second`)

**Как работает:**
- Отслеживается количество запросов для каждого идентификатора (consumer, IP, и т.д.)
- При превышении квоты возвращается 429 (Too Many Requests)
- Счетчик сбрасывается по истечении интервала

**Пример:**
```json
{
  "type": "quota",
  "config": {
    "quota": 1000,
    "interval": 3600,
    "timeUnit": "hour"
  }
}
```

#### Spike Arrest Policy

**Описание:** Защита от всплесков трафика с использованием token bucket алгоритма.

**Конфигурация:**
- **rate** - Лимит в запросах в секунду (обязательно)
- **timeUnit** - Единица времени: `second` или `minute` (по умолчанию: `second`)

**Как работает:**
- Используется token bucket алгоритм
- Токены пополняются со скоростью `rate`
- Каждый запрос потребляет один токен
- При отсутствии токенов запрос блокируется (429)

**Пример:**
```json
{
  "type": "spike-arrest",
  "config": {
    "rate": 100,
    "timeUnit": "second"
  }
}
```

#### Verify API Key Policy

**Описание:** Проверка API ключа для аутентификации.

**Конфигурация:**
- Политика проверяет наличие валидного API ключа
- Ключ может быть в заголовке (`X-API-Key`, `apikey`) или query параметре (`apikey`)
- Валидация выполняется против списка сконфигурированных ключей

**Пример:**
```json
{
  "type": "verify-api-key",
  "executionFlow": "PreFlow"
}
```

#### OAuth Policy

**Описание:** Проверка OAuth токена для аутентификации.

**Конфигурация:**
- Политика проверяет наличие валидного OAuth токена
- Токен может быть в заголовке `Authorization` (Bearer или OAuth)
- Валидация выполняется против списка сконфигурированных токенов
- Проверяется expiration если настроено

**Пример:**
```json
{
  "type": "oauth",
  "executionFlow": "PreFlow"
}
```

#### JWT Policy

**Описание:** Валидация JWT токена.

**Конфигурация:**
- Политика проверяет наличие валидного JWT токена
- Токен может быть в заголовке `Authorization` (Bearer) или `X-JWT-Token`
- Валидация выполняется по issuer из конфигурации прокси или JWT configs
- Проверяется структура токена (header.payload.signature)

**Пример:**
```json
{
  "type": "jwt",
  "executionFlow": "PreFlow"
}
```

#### CORS Policy

**Описание:** Добавление CORS заголовков для cross-origin запросов.

**Конфигурация:**
- **origins** - Разрешенные origins (массив или строка, по умолчанию: `["*"]`)
- **methods** - Разрешенные методы (массив или строка, по умолчанию: `["GET", "POST", "PUT", "DELETE"]`)
- **headers** - Разрешенные заголовки (массив или строка, по умолчанию: `["Content-Type", "Authorization"]`)
- **maxAge** - Время кэширования preflight запросов в секундах (по умолчанию: 3600)
- **allowCredentials** - Разрешать ли credentials (по умолчанию: `false`)

**Пример:**
```json
{
  "type": "cors",
  "executionFlow": "PostFlow",
  "config": {
    "origins": ["https://app.example.com"],
    "methods": ["GET", "POST", "PUT", "DELETE"],
    "headers": ["Content-Type", "Authorization"],
    "maxAge": 3600,
    "allowCredentials": true
  }
}
```

#### XML to JSON Policy

**Описание:** Преобразование XML ответа в JSON.

**Конфигурация:**
- **options** - Опции преобразования (опционально)
- **attributes** - Обработка атрибутов: `prefix` (по умолчанию)
- **namespaces** - Обработка namespaces: `prefix` (по умолчанию)

**Пример:**
```json
{
  "type": "xml-to-json",
  "executionFlow": "ResponseFlow",
  "config": {
    "attributes": "prefix",
    "namespaces": "prefix"
  }
}
```

### 5. Управление API Products

**Описание:** Группировка прокси для управления доступом и квотами.

**Параметры Product:**
- **id** - Уникальный идентификатор (генерируется автоматически)
- **name** - Имя продукта (обязательно, уникальное)
- **displayName** - Отображаемое имя (опционально)
- **description** - Описание продукта (опционально)
- **proxies** - Список имен прокси, включенных в продукт (обязательно, массив)
- **environments** - Список окружений: `dev`, `stage`, `prod` (опционально)
- **quota** - Квота на уровне продукта (опционально)
- **quotaInterval** - Интервал квоты в секундах (опционально)
- **attributes** - Атрибуты продукта (key-value пары, опционально)

**Пример конфигурации:**
```json
{
  "products": [
    {
      "name": "user-api-product",
      "displayName": "User API Product",
      "description": "Product for user management APIs",
      "proxies": ["user-api-proxy", "user-profile-proxy"],
      "environments": ["prod"],
      "quota": 50000,
      "quotaInterval": 86400
    }
  ]
}
```

### 6. Управление Developer Apps

**Описание:** Управление приложениями разработчиков и их API ключами.

**Параметры Developer App:**
- **id** - Уникальный идентификатор (генерируется автоматически)
- **name** - Имя приложения (обязательно, уникальное)
- **displayName** - Отображаемое имя (опционально)
- **description** - Описание приложения (опционально)
- **developerId** - ID разработчика (опционально)
- **developerEmail** - Email разработчика (опционально)
- **status** - Статус: `approved`, `pending`, `revoked` (по умолчанию: `approved`)
- **apiProducts** - Список ID продуктов, доступных приложению (обязательно, массив)
- **keys** - Список API ключей приложения (обязательно, массив)
- **attributes** - Атрибуты приложения (key-value пары, опционально)

**API Key:**
- **id** - Уникальный идентификатор (генерируется автоматически)
- **key** - API ключ (обязательно, генерируется автоматически)
- **consumerKey** - Consumer key (опционально, для OAuth)
- **consumerSecret** - Consumer secret (опционально, для OAuth)
- **status** - Статус: `approved`, `revoked` (по умолчанию: `approved`)
- **expiresAt** - Время истечения в миллисекундах (опционально)
- **apiProducts** - Список ID продуктов для ключа (опционально, по умолчанию из app)

**Пример конфигурации:**
```json
{
  "developerApps": [
    {
      "name": "mobile-app",
      "displayName": "Mobile Application",
      "developerEmail": "developer@example.com",
      "status": "approved",
      "apiProducts": ["user-api-product"],
      "keys": [
        {
          "key": "AbCdEfGhIjKlMnOpQrStUvWxYz123456",
          "status": "approved",
          "apiProducts": ["user-api-product"]
        }
      ]
    }
  ]
}
```

### 7. API Keys Management

**Описание:** Управление API ключами для аутентификации.

**Формат ключа:**
- 32 символа, alphanumeric (стандартный формат Apigee)
- Генерируется автоматически при создании ключа в Developer App

**Валидация:**
- Ключ проверяется против списка сконфигурированных ключей
- Проверяется expiration если настроено
- Проверяется status (approved/revoked)
- Ключ должен быть связан с продуктом, который включает прокси

**Использование:**
- Ключ передается в заголовке: `X-API-Key` или `apikey`
- Или в query параметре: `?apikey=...`
- Verify API Key policy проверяет ключ в PreFlow

### 8. OAuth Tokens

**Описание:** Управление OAuth токенами для аутентификации.

**Конфигурация:**
- **token** - OAuth токен (обязательно)
- **tokenType** - Тип токена: `Bearer` или `OAuth` (по умолчанию: `Bearer`)
- **expiresAt** - Время истечения в миллисекундах (опционально)
- **scopes** - Список scopes (опционально)
- **clientId** - Client ID (опционально)

**Валидация:**
- Токен проверяется против списка сконфигурированных токенов
- Проверяется expiration если настроено
- Токен передается в заголовке `Authorization: Bearer <token>` или `Authorization: OAuth <token>`

**Пример конфигурации:**
```json
{
  "oauthTokens": [
    {
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "tokenType": "Bearer",
      "expiresAt": 1735689600000,
      "scopes": ["read", "write"]
    }
  ]
}
```

### 9. JWT Configuration

**Описание:** Конфигурация для валидации JWT токенов.

**Параметры:**
- **issuer** - JWT issuer (обязательно)
- **audience** - JWT audience (опционально)
- **publicKey** - Публичный ключ для проверки подписи (опционально)
- **algorithm** - Алгоритм подписи (опционально)
- **allowedIssuers** - Список разрешенных issuers (опционально)

**Валидация:**
- JWT токен проверяется по issuer из конфигурации прокси или JWT configs
- Проверяется структура токена (header.payload.signature)
- Токен передается в заголовке `Authorization: Bearer <token>` или `X-JWT-Token: <token>`

**Пример конфигурации:**
```json
{
  "jwtConfigs": [
    {
      "issuer": "https://auth.example.com",
      "audience": "api.example.com",
      "algorithm": "RS256"
    }
  ]
}
```

### 10. Execution Flows

**Описание:** Упорядоченное выполнение политик в различных фазах обработки запроса.

**Фазы выполнения:**

1. **PreFlow** - До маршрутизации:
   - Аутентификация (verify-api-key, oauth, jwt)
   - Проверка доступа

2. **RequestFlow** - После маршрутизации, до upstream:
   - Quota проверка
   - Spike Arrest
   - Request transformation

3. **Upstream Request** - Отправка к target endpoint

4. **ResponseFlow** - После получения ответа от upstream:
   - Response transformation (xml-to-json)
   - Модификация ответа

5. **PostFlow** - Перед отправкой ответа клиенту:
   - CORS заголовки
   - Final transformation

6. **ErrorFlow** - При ошибках:
   - Error handling
   - Error transformation

**Порядок выполнения:**
- Политики выполняются в порядке их добавления
- Если политика блокирует запрос - выполнение останавливается
- ResponseFlow и PostFlow выполняются для всех политик (не блокируют)

---

## Руководство пользователя

### Быстрый старт

1. **Добавление компонента Apigee:**
   - Перетащите компонент "Apigee API Proxy" из библиотеки компонентов на canvas
   - Откройте панель конфигурации компонента

2. **Базовая настройка:**
   - Укажите Organization и Environment
   - Создайте первый API Proxy через вкладку "Proxies"
   - Создайте первую Policy через вкладку "Policies"

3. **Подключение к другим компонентам:**
   - Создайте соединение от компонента-клиента к Apigee
   - Создайте соединение от Apigee к backend сервису
   - Настройте basePath и targetEndpoint в прокси

### Работа с API Proxies

#### Создание Proxy

1. Перейдите на вкладку **"Proxies"**
2. Нажмите кнопку **"Add Proxy"**
3. Заполните параметры:
   - **Name** - Имя прокси (уникальное, `[a-zA-Z0-9_-]+`)
   - **Environment** - Окружение (dev, stage, prod)
   - **Base Path** - Базовый путь (должен начинаться с `/`)
   - **Target Endpoint** - URL целевого сервиса (валидный URL)
4. Настройте дополнительные параметры (опционально):
   - Quota и Quota Interval
   - Spike Arrest
   - Enable OAuth
   - JWT Issuer
5. Нажмите **"Save"**

#### Редактирование Proxy

1. Выберите прокси из списка
2. Нажмите кнопку **"Edit"** (иконка карандаша)
3. Измените параметры
4. Нажмите **"Save"**

#### Deployment Proxy

1. Выберите прокси из списка
2. Переключите статус:
   - **Deployed** - Прокси активен и обрабатывает запросы
   - **Undeployed** - Прокси неактивен (возвращает 503)

#### Просмотр метрик Proxy

Во время симуляции на вкладке **"Proxies"** отображаются:
- **Requests** - Количество запросов
- **Errors** - Количество ошибок
- **Avg Response Time** - Среднее время ответа в миллисекундах
- **Status** - Статус прокси (deployed/undeployed)

### Работа с Policies

#### Создание Policy

1. Перейдите на вкладку **"Policies"**
2. Нажмите кнопку **"Add Policy"**
3. Выберите тип политики:
   - **Quota** - Ограничение количества запросов
   - **Spike Arrest** - Защита от всплесков трафика
   - **OAuth** - OAuth аутентификация
   - **JWT** - JWT валидация
   - **Verify API Key** - Проверка API ключа
   - **CORS** - CORS заголовки
   - **XML to JSON** - Преобразование XML в JSON
4. Заполните параметры:
   - **Name** - Имя политики
   - **Execution Flow** - Поток выполнения
   - **Condition** - Условие выполнения (опционально)
   - **Config** - Конфигурация политики
5. Нажмите **"Save"**

#### Настройка Quota Policy

1. Создайте политику типа **"quota"**
2. Заполните конфигурацию:
   - **Quota** - Количество запросов
   - **Interval** - Интервал в секундах
   - **Time Unit** - Единица времени (second, minute, hour, day)
3. Нажмите **"Save"**

#### Настройка Spike Arrest Policy

1. Создайте политику типа **"spike-arrest"**
2. Заполните конфигурацию:
   - **Rate** - Лимит в запросах в секунду
   - **Time Unit** - Единица времени (second, minute)
3. Нажмите **"Save"**

### Работа с API Products

#### Создание Product

1. Перейдите на вкладку **"Products"**
2. Нажмите кнопку **"Add Product"**
3. Заполните параметры:
   - **Name** - Имя продукта (уникальное)
   - **Display Name** - Отображаемое имя (опционально)
   - **Description** - Описание (опционально)
   - **Proxies** - Выберите прокси для включения в продукт
   - **Environments** - Выберите окружения (опционально)
4. Настройте quota на уровне продукта (опционально)
5. Нажмите **"Save"**

### Работа с Developer Apps

#### Создание Developer App

1. Перейдите на вкладку **"Developer Apps"**
2. Нажмите кнопку **"Add App"**
3. Заполните параметры:
   - **Name** - Имя приложения (уникальное)
   - **Display Name** - Отображаемое имя (опционально)
   - **Description** - Описание (опционально)
   - **Developer Email** - Email разработчика (опционально)
   - **API Products** - Выберите продукты для приложения
4. Нажмите **"Save"**

#### Добавление API Key

1. Выберите приложение из списка
2. Нажмите кнопку **"Add Key"**
3. API ключ генерируется автоматически
4. Настройте параметры ключа:
   - **Status** - Approved или Revoked
   - **Expires At** - Время истечения (опционально)
   - **API Products** - Продукты для ключа (опционально, по умолчанию из app)
5. Нажмите **"Save"**

### Настройка Settings

1. Перейдите на вкладку **"Settings"**
2. Укажите:
   - **Organization** - Имя организации
   - **Default Environment** - Окружение по умолчанию
   - **API Key** - API ключ для доступа (опционально)
3. Изменения сохраняются автоматически

### Поиск и фильтрация

1. Используйте поле **"Search"** для поиска:
   - Прокси по имени, base path, target endpoint
   - Политики по имени, типу, condition
   - Продукты по имени
   - Приложения по имени
2. Используйте фильтры:
   - **Environment** - Фильтрация прокси по окружению
   - **Status** - Фильтрация прокси по статусу (deployed/undeployed)
   - **Type** - Фильтрация политик по типу
   - **Flow** - Фильтрация политик по execution flow

---

## Руководство администратора

### Рекомендации по конфигурации

#### Production Proxy

```json
{
  "proxies": [
    {
      "name": "production-api-proxy",
      "environment": "prod",
      "basePath": "/api/v1",
      "targetEndpoint": "https://api.production.com",
      "status": "deployed",
      "quota": 100000,
      "quotaInterval": 86400,
      "spikeArrest": 1000,
      "enableOAuth": true
    }
  ]
}
```

**Рекомендации:**
- Используйте HTTPS для production target endpoints
- Настройте quota для защиты от злоупотреблений
- Используйте spike arrest для защиты от всплесков
- Включите аутентификацию (OAuth или JWT)
- Мониторьте метрики прокси

#### Production Policy Configuration

```json
{
  "policies": [
    {
      "name": "verify-api-key",
      "type": "verify-api-key",
      "executionFlow": "PreFlow"
    },
    {
      "name": "quota-policy",
      "type": "quota",
      "executionFlow": "RequestFlow",
      "config": {
        "quota": 10000,
        "interval": 3600,
        "timeUnit": "hour"
      }
    },
    {
      "name": "spike-arrest-policy",
      "type": "spike-arrest",
      "executionFlow": "RequestFlow",
      "config": {
        "rate": 100,
        "timeUnit": "second"
      }
    },
    {
      "name": "cors-policy",
      "type": "cors",
      "executionFlow": "PostFlow",
      "config": {
        "origins": ["https://app.example.com"],
        "methods": ["GET", "POST", "PUT", "DELETE"],
        "headers": ["Content-Type", "Authorization"],
        "maxAge": 3600
      }
    }
  ]
}
```

### Оптимизация производительности

#### Quota Configuration

- **Интервал:** Выберите интервал в соответствии с бизнес-логикой
  - Короткий интервал (секунды/минуты): для защиты от злоупотреблений
  - Длинный интервал (часы/дни): для бизнес-лимитов
- **Квота:** Установите реалистичные лимиты
  - Слишком низкая: блокирует легитимных пользователей
  - Слишком высокая: не защищает от злоупотреблений

#### Spike Arrest Configuration

- **Rate:** Установите rate в соответствии с возможностями upstream
  - Обычно: 50-200 requests/sec для большинства API
  - Высоконагруженные: 500-1000 requests/sec
- **Time Unit:** Используйте `second` для точного контроля

#### Policy Ordering

- Порядок политик важен для правильной работы
- PreFlow политики должны выполняться первыми (аутентификация)
- RequestFlow политики выполняются после аутентификации (quota, spike-arrest)
- PostFlow политики выполняются последними (CORS)

### Безопасность

#### Аутентификация

- Используйте Verify API Key для простых случаев
- Используйте OAuth для enterprise интеграций
- Используйте JWT для микросервисных архитектур
- Настройте expiration для всех токенов и ключей

#### API Keys Management

- Генерируйте уникальные ключи для каждого приложения
- Регулярно ротируйте ключи
- Отзывайте скомпрометированные ключи
- Мониторьте использование ключей

#### CORS Configuration

- Используйте конкретные origins вместо `*`
- Настройте credentials только при необходимости
- Ограничьте методы и заголовки минимально необходимыми

### Мониторинг и алертинг

#### Ключевые метрики

1. **Request Count**
   - Нормальное значение: зависит от нагрузки
   - Алерт: резкое падение или превышение порога

2. **Error Count**
   - Нормальное значение: < 1% от requests
   - Алерт: error rate > 5%

3. **Avg Response Time**
   - Нормальное значение: < 200ms для большинства случаев
   - Алерт: latency > 1000ms или постоянно растущая

4. **Quota Exceeded**
   - Мониторьте количество 429 ответов
   - Алерт: постоянные quota exceeded (возможно, лимиты слишком низкие)

5. **Spike Arrest Hits**
   - Мониторьте количество блокировок spike arrest
   - Алерт: постоянные блокировки (возможно, rate слишком низкий)

6. **Authentication Failures**
   - Мониторьте количество 401 ответов
   - Алерт: резкое увеличение (возможны проблемы с ключами/токенами)

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
  - Базовая задержка gateway
  - Overhead политик
  - Задержка upstream сервисов
  - Quota и spike arrest проверки

#### Error Rate
- **Описание:** Процент ошибок при обработке
- **Единица измерения:** процент (0-1)
- **Причины ошибок:**
  - Ошибки аутентификации (401)
  - Quota exceeded (429)
  - Spike arrest exceeded (429)
  - Upstream ошибки (5xx)
  - Прокси undeployed (503)

#### Utilization
- **Описание:** Загрузка gateway
- **Единица измерения:** процент (0-1)
- **Расчет:** На основе throughput и capacity

### Метрики прокси

Для каждого прокси доступны:
- **Request Count** - Количество запросов
- **Error Count** - Количество ошибок
- **Avg Response Time** - Среднее время ответа в миллисекундах
- **Status** - Статус прокси (deployed/undeployed)

### Кастомные метрики

#### Proxies
- Количество прокси

#### Policies
- Количество активных политик

#### Products
- Количество продуктов

#### Developer Apps
- Количество приложений разработчиков

### Мониторинг в реальном времени

Все метрики обновляются в реальном времени во время симуляции:
- Метрики прокси обновляются каждые 2 секунды
- Метрики синхронизируются из ApigeeRoutingEngine
- Throughput рассчитывается на основе входящих соединений

---

## Примеры использования

### Пример 1: Базовый API Proxy с аутентификацией

**Сценарий:** Простой API с проверкой API ключа

```json
{
  "proxies": [
    {
      "name": "user-api",
      "environment": "prod",
      "basePath": "/api/users",
      "targetEndpoint": "https://user-service.internal/api",
      "status": "deployed"
    }
  ],
  "policies": [
    {
      "name": "verify-api-key",
      "type": "verify-api-key",
      "executionFlow": "PreFlow"
    }
  ],
  "developerApps": [
    {
      "name": "web-app",
      "apiProducts": [],
      "keys": [
        {
          "key": "AbCdEfGhIjKlMnOpQrStUvWxYz123456",
          "status": "approved"
        }
      ]
    }
  ]
}
```

### Пример 2: API Proxy с Quota и Spike Arrest

**Сценарий:** Защищенный API с ограничениями трафика

```json
{
  "proxies": [
    {
      "name": "protected-api",
      "environment": "prod",
      "basePath": "/api/v1",
      "targetEndpoint": "https://api.example.com",
      "quota": 10000,
      "quotaInterval": 3600,
      "spikeArrest": 100
    }
  ],
  "policies": [
    {
      "name": "quota-policy",
      "type": "quota",
      "executionFlow": "RequestFlow",
      "config": {
        "quota": 10000,
        "interval": 3600,
        "timeUnit": "hour"
      }
    },
    {
      "name": "spike-arrest-policy",
      "type": "spike-arrest",
      "executionFlow": "RequestFlow",
      "config": {
        "rate": 100,
        "timeUnit": "second"
      }
    }
  ]
}
```

### Пример 3: API Proxy с OAuth

**Сценарий:** API с OAuth аутентификацией

```json
{
  "proxies": [
    {
      "name": "oauth-api",
      "environment": "prod",
      "basePath": "/api/oauth",
      "targetEndpoint": "https://api.example.com",
      "enableOAuth": true
    }
  ],
  "policies": [
    {
      "name": "oauth-policy",
      "type": "oauth",
      "executionFlow": "PreFlow"
    }
  ],
  "oauthTokens": [
    {
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "tokenType": "Bearer",
      "expiresAt": 1735689600000,
      "scopes": ["read", "write"]
    }
  ]
}
```

### Пример 4: API Proxy с JWT

**Сценарий:** API с JWT валидацией

```json
{
  "proxies": [
    {
      "name": "jwt-api",
      "environment": "prod",
      "basePath": "/api/jwt",
      "targetEndpoint": "https://api.example.com",
      "jwtIssuer": "https://auth.example.com"
    }
  ],
  "policies": [
    {
      "name": "jwt-policy",
      "type": "jwt",
      "executionFlow": "PreFlow"
    }
  ],
  "jwtConfigs": [
    {
      "issuer": "https://auth.example.com",
      "audience": "api.example.com",
      "algorithm": "RS256"
    }
  ]
}
```

### Пример 5: API Product с несколькими прокси

**Сценарий:** Группировка нескольких прокси в продукт

```json
{
  "proxies": [
    {
      "name": "user-api-proxy",
      "environment": "prod",
      "basePath": "/api/users",
      "targetEndpoint": "https://user-service.internal"
    },
    {
      "name": "order-api-proxy",
      "environment": "prod",
      "basePath": "/api/orders",
      "targetEndpoint": "https://order-service.internal"
    }
  ],
  "products": [
    {
      "name": "ecommerce-api-product",
      "displayName": "E-Commerce API Product",
      "proxies": ["user-api-proxy", "order-api-proxy"],
      "environments": ["prod"],
      "quota": 100000,
      "quotaInterval": 86400
    }
  ],
  "developerApps": [
    {
      "name": "mobile-app",
      "apiProducts": ["ecommerce-api-product"],
      "keys": [
        {
          "key": "AbCdEfGhIjKlMnOpQrStUvWxYz123456",
          "status": "approved",
          "apiProducts": ["ecommerce-api-product"]
        }
      ]
    }
  ]
}
```

### Пример 6: CORS для веб-приложения

**Сценарий:** API с поддержкой CORS для веб-приложения

```json
{
  "policies": [
    {
      "name": "cors-policy",
      "type": "cors",
      "executionFlow": "PostFlow",
      "config": {
        "origins": ["https://app.example.com", "https://admin.example.com"],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "headers": ["Content-Type", "Authorization", "X-Requested-With"],
        "exposed_headers": ["X-Total-Count"],
        "maxAge": 3600,
        "allowCredentials": true
      }
    }
  ]
}
```

---

## Часто задаваемые вопросы (FAQ)

### Что такое API Proxy в Apigee?

API Proxy - это абстракция над backend сервисом, которая определяет базовый путь для маршрутизации и target endpoint для проксирования запросов.

### Как работает маршрутизация в Apigee?

Запросы сопоставляются с прокси по `basePath`. Если путь запроса начинается с `basePath` прокси, запрос маршрутизируется к этому прокси. Оставшаяся часть пути передается к target endpoint.

### Что такое Execution Flow?

Execution Flow определяет фазу обработки запроса, в которой выполняется политика:
- **PreFlow:** До маршрутизации (аутентификация)
- **RequestFlow:** После маршрутизации, до upstream (quota, spike-arrest)
- **ResponseFlow:** После получения ответа от upstream (transformation)
- **PostFlow:** Перед отправкой ответа клиенту (CORS)
- **ErrorFlow:** При ошибках (error handling)

### Как работает Quota Policy?

Quota Policy отслеживает количество запросов для каждого идентификатора (consumer, IP, и т.д.) в течение интервала. При превышении квоты запрос блокируется с кодом 429.

### Как работает Spike Arrest Policy?

Spike Arrest использует token bucket алгоритм для ограничения скорости запросов. Токены пополняются со скоростью `rate`, каждый запрос потребляет один токен. При отсутствии токенов запрос блокируется.

### Что такое API Product?

API Product - это группировка нескольких прокси для управления доступом. Приложения разработчиков получают доступ к продуктам, а не к отдельным прокси.

### Как работает Verify API Key Policy?

Verify API Key Policy проверяет наличие валидного API ключа в запросе. Ключ может быть в заголовке (`X-API-Key`, `apikey`) или query параметре (`apikey`). Ключ должен быть в списке сконфигурированных ключей и связан с продуктом, который включает прокси.

### Как работает OAuth Policy?

OAuth Policy проверяет наличие валидного OAuth токена в заголовке `Authorization`. Токен должен быть в списке сконфигурированных токенов и не истекшим (если настроено expiration).

### Как работает JWT Policy?

JWT Policy проверяет наличие валидного JWT токена в заголовке `Authorization` или `X-JWT-Token`. Токен проверяется по issuer из конфигурации прокси или JWT configs. Проверяется структура токена (header.payload.signature).

### Что такое Condition в Policy?

Condition - это JavaScript выражение, которое определяет, должна ли политика выполняться. Если условие не выполнено, политика пропускается. Полезно для условного выполнения политик в зависимости от пути, метода, заголовков и т.д.

---

## Дополнительные ресурсы

- [Официальная документация Apigee](https://cloud.google.com/apigee/docs)
- [Apigee API Platform Overview](https://cloud.google.com/apigee/docs/api-platform/get-started/overview)
- [Apigee Policies Reference](https://cloud.google.com/apigee/docs/api-platform/reference/policies)

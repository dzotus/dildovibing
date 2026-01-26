# WAF / API Shield - Документация компонента

## Обзор

WAF (Web Application Firewall) / API Shield - это комплексное решение для защиты веб-приложений и API от различных типов атак и угроз. Компонент WAF/API Shield в системе симуляции полностью эмулирует поведение реальных WAF решений (Cloudflare WAF, AWS WAF, ModSecurity), включая OWASP правила, rate limiting, geo-blocking, DDoS protection, а также API Shield функции (Schema Validation, JWT Validation, API Key Validation, GraphQL Protection) и дополнительные функции (Bot Detection, Anomaly Detection).

### Основные возможности

- ✅ **OWASP Rules** - Защита от OWASP Top 10 атак (SQL Injection, XSS, CSRF, SSRF, XXE, Path Traversal, RCE, Command Injection, LDAP Injection, NoSQL Injection, Template Injection)
- ✅ **Rate Limiting** - Ограничение частоты запросов с поддержкой стратегий (fixed-window, sliding-window, token-bucket)
- ✅ **Geo-blocking** - Блокировка запросов по странам
- ✅ **IP Whitelist/Blacklist** - Разрешение/блокировка IP адресов с поддержкой CIDR
- ✅ **DDoS Protection** - Защита от распределенных атак типа "отказ в обслуживании"
- ✅ **Schema Validation** - Валидация запросов и ответов по JSON Schema или OpenAPI схеме
- ✅ **JWT Validation** - Валидация JWT токенов (HS256, RS256, ES256)
- ✅ **API Key Validation** - Валидация API ключей с поддержкой per-key rate limits
- ✅ **GraphQL Protection** - Защита GraphQL API (depth, complexity, aliases, introspection blocking)
- ✅ **Bot Detection** - Обнаружение ботов и автоматизированных запросов
- ✅ **Anomaly Detection** - Статистическое обнаружение аномалий в трафике
- ✅ **Custom Rules** - Создание пользовательских правил с условиями и действиями
- ✅ **Connection Rules** - Автоматическая настройка конфигов при подключении компонентов
- ✅ **Метрики WAF** - Полный набор метрик производительности и безопасности

---

## Основные функции

### 1. Operation Modes (Режимы работы)

**Описание:** WAF может работать в трех режимах для обработки обнаруженных угроз.

**Режимы:**

#### 1.1. Detection Mode (Режим обнаружения)

**Описание:** WAF обнаруживает угрозы, но не блокирует запросы. Все угрозы логируются.

**Параметры:**
- **mode**: `detection`

**Поведение:**
- Угрозы обнаруживаются и логируются
- Запросы не блокируются
- Метрики `threatsDetected` увеличиваются
- Угрозы отображаются в UI

**Использование:** Для тестирования правил и анализа трафика без блокировки легитимных запросов.

#### 1.2. Prevention Mode (Режим предотвращения)

**Описание:** WAF блокирует запросы при обнаружении угроз.

**Параметры:**
- **mode**: `prevention`

**Поведение:**
- Угрозы обнаруживаются и блокируются
- Запросы с угрозами отклоняются с HTTP 403
- Метрики `blockedRequests` и `threatsDetected` увеличиваются
- Угрозы отображаются в UI с флагом `blocked: true`

**Использование:** Для production окружений с активной защитой.

#### 1.3. Logging Only Mode (Режим только логирования)

**Описание:** WAF только логирует запросы без обнаружения угроз.

**Параметры:**
- **mode**: `logging`

**Поведение:**
- Все запросы логируются
- Угрозы не обнаруживаются
- Метрики `totalRequests` увеличиваются
- Используется для аудита и анализа

**Использование:** Для аудита и анализа трафика без применения правил безопасности.

### 2. OWASP Rules (OWASP правила)

**Описание:** WAF использует OWASP ModSecurity Core Rule Set для защиты от распространенных веб-атак.

**Параметры:**
- **enableOWASP** - Включить OWASP правила (по умолчанию: `true`)
- **owaspRuleset** - Версия OWASP Rule Set: `3.3`, `3.2`, `3.1` (по умолчанию: `3.3`)

**Поддерживаемые типы атак:**

#### 2.1. SQL Injection

**Паттерны:**
- UNION-based SQL injection (`UNION SELECT`, `UNION ALL`)
- Boolean-based blind SQL injection (`OR 1=1`, `AND 1=1`)
- Time-based blind SQL injection (`SLEEP(5)`, `WAITFOR DELAY`)
- Error-based SQL injection (`' OR 1=1--`, `' OR '1'='1`)
- Second-order SQL injection

**Примеры блокируемых запросов:**
```
GET /api/users?id=1' OR '1'='1
POST /api/login {"username": "admin'--", "password": "pass"}
GET /api/search?q=1 UNION SELECT * FROM users
```

#### 2.2. XSS (Cross-Site Scripting)

**Паттерны:**
- Stored XSS (`<script>alert('XSS')</script>`)
- Reflected XSS (`<img src=x onerror=alert(1)>`)
- DOM-based XSS (`javascript:alert(1)`)
- Event handler injection (`onclick=alert(1)`)
- CSS injection (`<style>body{background:url('javascript:alert(1)')}</style>`)

**Примеры блокируемых запросов:**
```
GET /api/search?q=<script>alert('XSS')</script>
POST /api/comment {"text": "<img src=x onerror=alert(1)>"}
```

#### 2.3. CSRF (Cross-Site Request Forgery)

**Паттерны:**
- Отсутствие CSRF токена в запросах
- Неправильный Referer header
- Cross-origin запросы без CORS headers

#### 2.4. SSRF (Server-Side Request Forgery)

**Паттерны:**
- Запросы к внутренним IP адресам (`http://127.0.0.1`, `http://192.168.1.1`)
- Запросы к метаданным сервисов (`http://169.254.169.254`)
- Запросы к localhost (`http://localhost`)

#### 2.5. XXE (XML External Entity)

**Паттерны:**
- XML с внешними сущностями (`<!ENTITY xxe SYSTEM "file:///etc/passwd">`)
- XML с внутренними сущностями
- XML с параметрическими сущностями

#### 2.6. Path Traversal

**Паттерны:**
- Попытки доступа к файлам вне директории (`../../../etc/passwd`)
- URL encoding обходы (`%2e%2e%2f`)
- Unicode обходы

#### 2.7. RCE (Remote Code Execution)

**Паттерны:**
- Command injection (`; ls -la`, `| cat /etc/passwd`)
- Code injection (`eval()`, `exec()`, `system()`)
- Template injection

#### 2.8. Другие атаки

- **LDAP Injection** - Инъекции в LDAP запросы
- **NoSQL Injection** - Инъекции в NoSQL запросы
- **Command Injection** - Выполнение команд через параметры
- **Template Injection** - Инъекции в шаблоны

**Пример конфигурации:**
```json
{
  "enableOWASP": true,
  "owaspRuleset": "3.3"
}
```

### 3. Rate Limiting (Ограничение частоты запросов)

**Описание:** WAF ограничивает частоту запросов от одного IP адреса для защиты от злоупотреблений.

**Параметры:**
- **enableRateLimiting** - Включить rate limiting (по умолчанию: `true`)
- **rateLimitPerMinute** - Максимальное количество запросов в минуту (по умолчанию: `100`)
- **rateLimitStrategy** - Стратегия rate limiting: `fixed-window`, `sliding-window`, `token-bucket` (по умолчанию: `fixed-window`)
- **rateLimitBurst** - Размер burst для token-bucket (по умолчанию: равен `rateLimitPerMinute`)

**Стратегии:**

#### 3.1. Fixed Window (Фиксированное окно)

**Описание:** Запросы считаются в фиксированном временном окне (1 минута).

**Как работает:**
1. Запросы группируются по IP адресу
2. Считается количество запросов в текущей минуте
3. Если превышен лимит, запрос блокируется

**Преимущества:**
- Простая реализация
- Низкая нагрузка на память

**Недостатки:**
- Возможны всплески в начале окна
- Менее точное ограничение

**Пример:**
```json
{
  "enableRateLimiting": true,
  "rateLimitPerMinute": 100,
  "rateLimitStrategy": "fixed-window"
}
```

#### 3.2. Sliding Window (Скользящее окно)

**Описание:** Запросы считаются в скользящем окне для более точного ограничения.

**Как работает:**
1. Запросы группируются по IP адресу
2. Считается количество запросов в последней минуте (скользящее окно)
3. Если превышен лимит, запрос блокируется

**Преимущества:**
- Более точное ограничение
- Нет всплесков в начале окна

**Недостатки:**
- Более высокая нагрузка на память
- Более сложная реализация

**Пример:**
```json
{
  "enableRateLimiting": true,
  "rateLimitPerMinute": 100,
  "rateLimitStrategy": "sliding-window"
}
```

#### 3.3. Token Bucket (Ведро токенов)

**Описание:** Использует токены для более гибкого ограничения с поддержкой burst.

**Как работает:**
1. Каждый IP имеет bucket с токенами
2. Токены пополняются с фиксированной скоростью
3. Каждый запрос потребляет один токен
4. Если токенов нет, запрос блокируется
5. Поддерживается burst до `rateLimitBurst` токенов

**Преимущества:**
- Поддержка burst трафика
- Более гибкое ограничение
- Лучше для пиковых нагрузок

**Недостатки:**
- Более сложная реализация
- Требует настройки burst размера

**Пример:**
```json
{
  "enableRateLimiting": true,
  "rateLimitPerMinute": 100,
  "rateLimitStrategy": "token-bucket",
  "rateLimitBurst": 150
}
```

**Поведение при превышении лимита:**
- Запрос блокируется с HTTP 429 (Too Many Requests)
- Создается угроза типа `rate-limit`
- Метрика `rateLimitHits` увеличивается

### 4. Geo-blocking (Географическая блокировка)

**Описание:** WAF может блокировать запросы из определенных стран.

**Параметры:**
- **enableGeoBlocking** - Включить geo-blocking (по умолчанию: `false`)
- **blockedCountries** - Список заблокированных стран (коды ISO 3166-1 alpha-2): `['CN', 'RU', 'KP']`

**Как работает:**
1. WAF определяет страну источника запроса из метаданных сообщения
2. Если страна в списке `blockedCountries`, запрос блокируется
3. Создается угроза типа `geo-block`

**Пример конфигурации:**
```json
{
  "enableGeoBlocking": true,
  "blockedCountries": ["CN", "RU", "KP"]
}
```

**Примечание:** Страна определяется из метаданных сообщения (`DataMessage.metadata.country`). Если страна не указана, geo-blocking не применяется.

### 5. IP Whitelist/Blacklist (Белый/черный список IP)

**Описание:** WAF может разрешать или блокировать запросы от определенных IP адресов с поддержкой CIDR.

**Параметры:**
- **enableIPWhitelist** - Включить IP whitelist (по умолчанию: `false`)
- **whitelistedIPs** - Список разрешенных IP адресов или CIDR: `['192.168.1.1', '10.0.0.0/24']`
- **ipBlacklist** - Список заблокированных IP адресов или CIDR: `['192.168.1.100', '10.0.0.0/16']`

**Поддержка CIDR:**
- Отдельные IP: `192.168.1.1`
- CIDR сети: `192.168.1.0/24`, `10.0.0.0/16`

**Приоритет:**
1. IP Whitelist проверяется первым (если включен)
2. IP Blacklist проверяется вторым
3. Если IP в whitelist, запрос разрешается (даже если в blacklist)
4. Если IP в blacklist, запрос блокируется

**Пример конфигурации:**
```json
{
  "enableIPWhitelist": true,
  "whitelistedIPs": ["192.168.1.0/24", "10.0.0.1"],
  "ipBlacklist": ["192.168.1.100", "10.0.0.0/16"]
}
```

**Поведение:**
- IP в whitelist: запрос разрешается
- IP в blacklist: запрос блокируется с угрозой типа `ip-block`
- IP не в списках: применяются другие правила

### 6. DDoS Protection (Защита от DDoS)

**Описание:** WAF защищает от распределенных атак типа "отказ в обслуживании" (DDoS).

**Параметры:**
- **enableDDoSProtection** - Включить DDoS protection (по умолчанию: `true`)
- **ddosThreshold** - Порог запросов в секунду для обнаружения DDoS (по умолчанию: `1000`)

**Как работает:**
1. WAF отслеживает количество запросов от каждого IP в секунду
2. Если превышен `ddosThreshold`, IP блокируется
3. Создается угроза типа `ddos`
4. Блокировка действует до конца текущей секунды

**Пример конфигурации:**
```json
{
  "enableDDoSProtection": true,
  "ddosThreshold": 1000
}
```

**Поведение:**
- Нормальный трафик: запросы обрабатываются
- DDoS атака: запросы блокируются с HTTP 429
- Метрика `blockedRequests` увеличивается

### 7. Schema Validation (Валидация схемы)

**Описание:** WAF может валидировать запросы и ответы по JSON Schema или OpenAPI схеме (API Shield функция).

**Параметры:**
- **schemaValidation.enabled** - Включить schema validation (по умолчанию: `false`)
- **schemaValidation.schemaType** - Тип схемы: `json-schema` или `openapi` (по умолчанию: `json-schema`)
- **schemaValidation.schema** - JSON Schema или OpenAPI spec (строка JSON)
- **schemaValidation.validateRequest** - Валидировать запросы (по умолчанию: `true`)
- **schemaValidation.validateResponse** - Валидировать ответы (по умолчанию: `false`)

**Как работает:**
1. WAF парсит JSON Schema или OpenAPI spec
2. Валидирует тело запроса по схеме
3. Если валидация не проходит, запрос блокируется
4. Опционально валидирует ответы

**Пример JSON Schema:**
```json
{
  "schemaValidation": {
    "enabled": true,
    "schemaType": "json-schema",
    "schema": "{\"type\":\"object\",\"properties\":{\"username\":{\"type\":\"string\",\"minLength\":3},\"password\":{\"type\":\"string\",\"minLength\":8}},\"required\":[\"username\",\"password\"]}",
    "validateRequest": true,
    "validateResponse": false
  }
}
```

**Пример OpenAPI:**
```json
{
  "schemaValidation": {
    "enabled": true,
    "schemaType": "openapi",
    "schema": "{\"openapi\":\"3.0.0\",\"paths\":{\"/api/users\":{\"post\":{\"requestBody\":{\"content\":{\"application/json\":{\"schema\":{\"type\":\"object\",\"properties\":{\"name\":{\"type\":\"string\"}}}}}}}}}}",
    "validateRequest": true,
    "validateResponse": false
  }
}
```

**Поведение при ошибке валидации:**
- Запрос блокируется с HTTP 400 (Bad Request)
- Создается угроза типа `custom` с деталями ошибки валидации

### 8. JWT Validation (Валидация JWT)

**Описание:** WAF может валидировать JWT токены в запросах (API Shield функция).

**Параметры:**
- **jwtValidation.enabled** - Включить JWT validation (по умолчанию: `false`)
- **jwtValidation.algorithm** - Алгоритм подписи: `HS256`, `RS256`, `ES256` (по умолчанию: `HS256`)
- **jwtValidation.secret** - Секрет для HMAC (HS256)
- **jwtValidation.publicKey** - Публичный ключ для RSA/ECDSA (RS256, ES256)
- **jwtValidation.issuer** - Ожидаемый issuer (опционально)
- **jwtValidation.audience** - Ожидаемые audience (массив строк, опционально)
- **jwtValidation.requireExpiration** - Требовать expiration claim (по умолчанию: `true`)

**Как работает:**
1. WAF извлекает JWT токен из заголовка `Authorization: Bearer <token>`
2. Проверяет структуру токена (header.payload.signature)
3. Валидирует подпись по алгоритму и ключу
4. Проверяет expiration (если `requireExpiration: true`)
5. Проверяет issuer и audience (если указаны)
6. Если валидация не проходит, запрос блокируется

**Пример конфигурации:**
```json
{
  "jwtValidation": {
    "enabled": true,
    "algorithm": "HS256",
    "secret": "my-secret-key",
    "issuer": "https://auth.example.com",
    "audience": ["api.example.com"],
    "requireExpiration": true
  }
}
```

**Поведение при ошибке валидации:**
- Запрос блокируется с HTTP 401 (Unauthorized)
- Создается угроза типа `custom` с деталями ошибки JWT

### 9. API Key Validation (Валидация API ключей)

**Описание:** WAF может валидировать API ключи в запросах с поддержкой per-key rate limits (API Shield функция).

**Параметры:**
- **apiKeyValidation.enabled** - Включить API key validation (по умолчанию: `false`)
- **apiKeyValidation.headerName** - Имя заголовка с API ключом (по умолчанию: `X-API-Key`)
- **apiKeyValidation.keys** - Массив API ключей:
  ```json
  [
    {
      "id": "key-1",
      "key": "api-key-secret-123",
      "enabled": true,
      "allowedPaths": ["/api/v1/*"], // Опционально: только для определенных путей
      "rateLimit": 1000 // Опционально: per-key rate limit (запросов в минуту)
    }
  ]
  ```

**Как работает:**
1. WAF извлекает API ключ из заголовка (по умолчанию `X-API-Key`)
2. Проверяет ключ в списке `keys`
3. Проверяет, что ключ включен (`enabled: true`)
4. Проверяет `allowedPaths` (если указаны)
5. Применяет per-key rate limit (если указан)
6. Если валидация не проходит, запрос блокируется

**Пример конфигурации:**
```json
{
  "apiKeyValidation": {
    "enabled": true,
    "headerName": "X-API-Key",
    "keys": [
      {
        "id": "production-key",
        "key": "prod-api-key-12345",
        "enabled": true,
        "allowedPaths": ["/api/v1/*"],
        "rateLimit": 1000
      },
      {
        "id": "development-key",
        "key": "dev-api-key-67890",
        "enabled": true,
        "rateLimit": 100
      }
    ]
  }
}
```

**Поведение при ошибке валидации:**
- Запрос блокируется с HTTP 401 (Unauthorized)
- Создается угроза типа `custom` с деталями ошибки API key

### 10. GraphQL Protection (Защита GraphQL)

**Описание:** WAF может защищать GraphQL API от сложных и опасных запросов (API Shield функция).

**Параметры:**
- **graphQLProtection.enabled** - Включить GraphQL protection (по умолчанию: `false`)
- **graphQLProtection.maxDepth** - Максимальная глубина запроса (по умолчанию: `10`)
- **graphQLProtection.maxComplexity** - Максимальная сложность запроса (по умолчанию: `100`)
- **graphQLProtection.maxAliases** - Максимальное количество алиасов (по умолчанию: `10`)
- **graphQLProtection.blockIntrospection** - Блокировать introspection запросы (по умолчанию: `false`)

**Как работает:**
1. WAF парсит GraphQL запрос
2. Вычисляет глубину запроса (максимальная вложенность полей)
3. Вычисляет сложность запроса (количество полей и аргументов)
4. Подсчитывает количество алиасов
5. Проверяет на introspection запросы (`__schema`, `__type`)
6. Если превышены лимиты, запрос блокируется

**Пример конфигурации:**
```json
{
  "graphQLProtection": {
    "enabled": true,
    "maxDepth": 10,
    "maxComplexity": 100,
    "maxAliases": 10,
    "blockIntrospection": true
  }
}
```

**Примеры блокируемых запросов:**
```graphql
# Слишком глубокая вложенность
query {
  user {
    posts {
      comments {
        author {
          posts {
            comments { ... } # Глубина > 10
          }
        }
      }
    }
  }
}

# Introspection запрос (если blockIntrospection: true)
query {
  __schema {
    types {
      name
    }
  }
}
```

**Поведение при превышении лимитов:**
- Запрос блокируется с HTTP 400 (Bad Request)
- Создается угроза типа `custom` с деталями превышения лимитов

### 11. Bot Detection (Обнаружение ботов)

**Описание:** WAF может обнаруживать ботов и автоматизированные запросы.

**Параметры:**
- **botDetection.enabled** - Включить bot detection (по умолчанию: `false`)
- **botDetection.methods** - Методы обнаружения: `['user-agent', 'behavioral', 'fingerprint']`
- **botDetection.blockKnownBots** - Блокировать известных ботов (Googlebot, Bingbot, etc.) (по умолчанию: `false`)
- **botDetection.challengeSuspicious** - Выдавать challenge подозрительным запросам (по умолчанию: `false`)

**Методы обнаружения:**

#### 11.1. User-Agent Detection

**Описание:** Анализ User-Agent заголовка на известных ботов.

**Обнаруживаемые боты:**
- Googlebot, Bingbot, Slurp (поисковые боты)
- curl, wget, python-requests (скрипты)
- Отсутствие User-Agent заголовка

#### 11.2. Behavioral Detection

**Описание:** Анализ поведения запросов (слишком быстрые запросы, отсутствие cookies, одинаковые заголовки).

**Паттерны:**
- Слишком быстрые запросы от одного IP
- Отсутствие cookies в запросах
- Одинаковые заголовки для всех запросов
- Отсутствие Referer заголовка

#### 11.3. Fingerprint Detection

**Описание:** Анализ fingerprint браузера (заголовки, TLS fingerprint).

**Паттерны:**
- Необычные комбинации заголовков
- Отсутствие стандартных браузерных заголовков
- Нестандартные значения заголовков

**Пример конфигурации:**
```json
{
  "botDetection": {
    "enabled": true,
    "methods": ["user-agent", "behavioral"],
    "blockKnownBots": false,
    "challengeSuspicious": true
  }
}
```

**Поведение при обнаружении бота:**
- Если `blockKnownBots: true` и бот известный: запрос блокируется
- Если `challengeSuspicious: true` и бот подозрительный: возвращается challenge (HTTP 403 с action: 'challenge')
- Создается угроза типа `custom` с деталями обнаружения бота

### 12. Anomaly Detection (Обнаружение аномалий)

**Описание:** WAF может обнаруживать аномалии в трафике с помощью статистических методов.

**Параметры:**
- **anomalyDetection.enabled** - Включить anomaly detection (по умолчанию: `false`)
- **anomalyDetection.threshold** - Порог для обнаружения аномалий (множитель от среднего) (по умолчанию: `3.0`)
- **anomalyDetection.windowSize** - Размер окна для анализа в секундах (по умолчанию: `60`)

**Как работает:**
1. WAF отслеживает количество запросов от каждого IP в окне времени
2. Вычисляет среднее количество запросов за окно
3. Если текущее количество превышает `threshold * среднее`, обнаруживается аномалия
4. Используется moving average для сглаживания

**Пример конфигурации:**
```json
{
  "anomalyDetection": {
    "enabled": true,
    "threshold": 3.0,
    "windowSize": 60
  }
}
```

**Поведение при обнаружении аномалии:**
- Создается угроза типа `custom` с деталями аномалии
- Запрос может быть заблокирован (в зависимости от режима)
- Метрика `threatsDetected` увеличивается

### 13. Custom Rules (Пользовательские правила)

**Описание:** WAF поддерживает создание пользовательских правил с условиями и действиями.

**Структура правила:**
```json
{
  "id": "rule-1",
  "name": "Block Admin Path",
  "description": "Block access to /admin path",
  "enabled": true,
  "action": "block",
  "priority": 100,
  "conditions": [
    {
      "type": "uri",
      "operator": "startsWith",
      "value": "/admin"
    }
  ]
}
```

**Типы условий:**
- **ip** - IP адрес источника
- **uri** - URI пути запроса
- **header** - HTTP заголовок
- **body** - Тело запроса
- **method** - HTTP метод (GET, POST, etc.)
- **country** - Страна источника
- **user-agent** - User-Agent заголовок

**Операторы:**
- **equals** - Точное совпадение
- **contains** - Содержит подстроку
- **startsWith** - Начинается с
- **endsWith** - Заканчивается на
- **regex** - Регулярное выражение
- **in** - В списке значений
- **not-in** - Не в списке значений

**Действия:**
- **allow** - Разрешить запрос
- **block** - Заблокировать запрос
- **log** - Только залогировать
- **challenge** - Выдать challenge (CAPTCHA)

**Приоритет:**
- Правила обрабатываются по приоритету (от большего к меньшему)
- Первое совпавшее правило определяет действие

**Пример конфигурации:**
```json
{
  "rules": [
    {
      "id": "block-admin",
      "name": "Block Admin Path",
      "description": "Block access to /admin path",
      "enabled": true,
      "action": "block",
      "priority": 100,
      "conditions": [
        {
          "type": "uri",
          "operator": "startsWith",
          "value": "/admin"
        }
      ]
    },
    {
      "id": "allow-internal",
      "name": "Allow Internal IPs",
      "description": "Allow requests from internal IPs",
      "enabled": true,
      "action": "allow",
      "priority": 200,
      "conditions": [
        {
          "type": "ip",
          "operator": "in",
          "value": "192.168.1.0/24,10.0.0.0/8"
        }
      ]
    }
  ]
}
```

---

## Руководство пользователя

### Быстрый старт

1. **Добавление компонента WAF:**
   - Перетащите компонент "WAF" из библиотеки компонентов на canvas
   - Откройте панель конфигурации компонента

2. **Настройка режима работы:**
   - Перейдите на вкладку **"Settings"**
   - Выберите режим: `detection`, `prevention`, или `logging`
   - Для production используйте `prevention`

3. **Включение OWASP правил:**
   - Перейдите на вкладку **"OWASP Rules"**
   - Включите `Enable OWASP Rules`
   - Выберите версию OWASP Rule Set (рекомендуется `3.3`)

4. **Настройка Rate Limiting:**
   - Перейдите на вкладку **"Rate Limiting"**
   - Включите `Enable Rate Limiting`
   - Укажите `Rate Limit Per Minute` (рекомендуется: `100`)
   - Выберите стратегию: `fixed-window`, `sliding-window`, или `token-bucket`

5. **Подключение к другим компонентам:**
   - Создайте соединение от API Gateway или Load Balancer к WAF
   - WAF автоматически настроится для защиты целевого компонента (Connection Rules)

### Работа с OWASP правилами

#### Включение OWASP правил

1. Перейдите на вкладку **"OWASP Rules"**
2. Включите переключатель **"Enable OWASP Rules"**
3. Выберите версию OWASP Rule Set:
   - **3.3** - Последняя версия (рекомендуется)
   - **3.2** - Предыдущая версия
   - **3.1** - Старая версия

**Примечание:** OWASP правила защищают от SQL Injection, XSS, CSRF, SSRF, XXE, Path Traversal, RCE и других атак.

#### Мониторинг OWASP угроз

1. Перейдите на вкладку **"Threats"**
2. Фильтруйте угрозы по типу: `sql-injection`, `xss`, `csrf`, etc.
3. Просматривайте детали каждой угрозы
4. Экспортируйте угрозы в JSON или CSV для анализа

### Работа с Rate Limiting

#### Настройка Fixed Window

1. Перейдите на вкладку **"Rate Limiting"**
2. Включите `Enable Rate Limiting`
3. Укажите `Rate Limit Per Minute` (например: `100`)
4. Выберите стратегию `fixed-window`
5. Нажмите **"Save"**

**Поведение:** Запросы ограничиваются в фиксированном окне 1 минута.

#### Настройка Sliding Window

1. Выберите стратегию `sliding-window`
2. Укажите `Rate Limit Per Minute`
3. Нажмите **"Save"**

**Поведение:** Запросы ограничиваются в скользящем окне для более точного ограничения.

#### Настройка Token Bucket

1. Выберите стратегию `token-bucket`
2. Укажите `Rate Limit Per Minute` (скорость пополнения токенов)
3. Укажите `Rate Limit Burst` (максимальное количество токенов)
4. Нажмите **"Save"**

**Поведение:** Запросы ограничиваются токенами с поддержкой burst трафика.

### Работа с Geo-blocking

#### Настройка блокировки стран

1. Перейдите на вкладку **"Settings"**
2. Включите `Enable Geo-blocking`
3. Добавьте коды стран в `Blocked Countries`:
   - `CN` - Китай
   - `RU` - Россия
   - `KP` - Северная Корея
   - И т.д. (коды ISO 3166-1 alpha-2)
4. Нажмите **"Save"**

**Примечание:** Страна определяется из метаданных сообщения. Если страна не указана, geo-blocking не применяется.

### Работа с IP Whitelist/Blacklist

#### Настройка IP Whitelist

1. Перейдите на вкладку **"Settings"**
2. Включите `Enable IP Whitelist`
3. Добавьте IP адреса или CIDR в `Whitelisted IPs`:
   - Отдельные IP: `192.168.1.1`
   - CIDR сети: `192.168.1.0/24`, `10.0.0.0/16`
4. Нажмите **"Save"**

**Примечание:** IP в whitelist разрешаются даже если в blacklist.

#### Настройка IP Blacklist

1. В секции **"IP Blacklist"** добавьте IP адреса или CIDR:
   - Отдельные IP: `192.168.1.100`
   - CIDR сети: `10.0.0.0/16`
2. Нажмите **"Save"**

**Примечание:** IP в blacklist блокируются (кроме тех, что в whitelist).

### Работа с Schema Validation

#### Настройка JSON Schema Validation

1. Перейдите на вкладку **"Schema Validation"**
2. Включите `Enable Schema Validation`
3. Выберите тип схемы: `json-schema`
4. Вставьте JSON Schema в поле `Schema`:
   ```json
   {
     "type": "object",
     "properties": {
       "username": {
         "type": "string",
         "minLength": 3
       },
       "password": {
         "type": "string",
         "minLength": 8
       }
     },
     "required": ["username", "password"]
   }
   ```
5. Включите `Validate Request` (валидировать запросы)
6. Опционально включите `Validate Response` (валидировать ответы)
7. Нажмите **"Save"**

**Поведение:** Запросы валидируются по JSON Schema. Если валидация не проходит, запрос блокируется.

#### Настройка OpenAPI Validation

1. Выберите тип схемы: `openapi`
2. Вставьте OpenAPI spec в поле `Schema`
3. Нажмите **"Save"**

**Поведение:** Запросы валидируются по OpenAPI спецификации.

### Работа с JWT Validation

#### Настройка JWT Validation

1. Перейдите на вкладку **"JWT Validation"**
2. Включите `Enable JWT Validation`
3. Выберите алгоритм:
   - **HS256** - HMAC с секретом
   - **RS256** - RSA с публичным ключом
   - **ES256** - ECDSA с публичным ключом
4. Укажите секрет или публичный ключ:
   - Для HS256: `Secret` (например: `my-secret-key`)
   - Для RS256/ES256: `Public Key` (PEM формат)
5. Опционально укажите `Issuer` (например: `https://auth.example.com`)
6. Опционально укажите `Audience` (массив строк, например: `["api.example.com"]`)
7. Включите `Require Expiration` для проверки expiration claim
8. Нажмите **"Save"**

**Поведение:** JWT токены извлекаются из заголовка `Authorization: Bearer <token>` и валидируются. Если валидация не проходит, запрос блокируется.

### Работа с API Key Validation

#### Создание API ключей

1. Перейдите на вкладку **"API Keys"**
2. Включите `Enable API Key Validation`
3. Нажмите кнопку **"Add API Key"**
4. Заполните параметры:
   - **ID** - Уникальный идентификатор ключа
   - **Key** - Значение API ключа
   - **Enabled** - Включить ключ
   - **Allowed Paths** - Опционально: пути, для которых ключ действителен (например: `["/api/v1/*"]`)
   - **Rate Limit** - Опционально: per-key rate limit (запросов в минуту)
5. Нажмите **"Save"**

**Поведение:** API ключи извлекаются из заголовка (по умолчанию `X-API-Key`) и валидируются. Если ключ недействителен, запрос блокируется.

#### Настройка заголовка API ключа

1. В секции **"API Key Header"** укажите имя заголовка (по умолчанию: `X-API-Key`)
2. Нажмите **"Save"**

### Работа с GraphQL Protection

#### Настройка защиты GraphQL

1. Перейдите на вкладку **"GraphQL Protection"**
2. Включите `Enable GraphQL Protection`
3. Укажите лимиты:
   - **Max Depth** - Максимальная глубина запроса (рекомендуется: `10`)
   - **Max Complexity** - Максимальная сложность запроса (рекомендуется: `100`)
   - **Max Aliases** - Максимальное количество алиасов (рекомендуется: `10`)
4. Включите `Block Introspection` для блокировки introspection запросов
5. Нажмите **"Save"**

**Поведение:** GraphQL запросы анализируются на глубину, сложность и количество алиасов. Если превышены лимиты, запрос блокируется.

### Работа с Bot Detection

#### Настройка обнаружения ботов

1. Перейдите на вкладку **"Bot Detection"**
2. Включите `Enable Bot Detection`
3. Выберите методы обнаружения:
   - **User-Agent** - Анализ User-Agent заголовка
   - **Behavioral** - Анализ поведения запросов
   - **Fingerprint** - Анализ fingerprint браузера
4. Включите `Block Known Bots` для блокировки известных ботов (Googlebot, etc.)
5. Включите `Challenge Suspicious` для выдачи challenge подозрительным запросам
6. Нажмите **"Save"**

**Поведение:** WAF анализирует запросы на признаки ботов. Если бот обнаружен, запрос может быть заблокирован или ему выдается challenge.

### Работа с Anomaly Detection

#### Настройка обнаружения аномалий

1. Перейдите на вкладку **"Anomaly Detection"**
2. Включите `Enable Anomaly Detection`
3. Укажите `Threshold` - порог для обнаружения аномалий (множитель от среднего, рекомендуется: `3.0`)
4. Укажите `Window Size` - размер окна для анализа в секундах (рекомендуется: `60`)
5. Нажмите **"Save"**

**Поведение:** WAF отслеживает статистику запросов от каждого IP и обнаруживает аномалии (резкие скачки трафика).

### Работа с Custom Rules

#### Создание пользовательского правила

1. Перейдите на вкладку **"Custom Rules"**
2. Нажмите кнопку **"Add Rule"**
3. Заполните параметры:
   - **Name** - Имя правила
   - **Description** - Описание правила
   - **Enabled** - Включить правило
   - **Action** - Действие: `allow`, `block`, `log`, `challenge`
   - **Priority** - Приоритет правила (больше = выше приоритет)
4. Добавьте условия:
   - Нажмите **"Add Condition"**
   - Выберите тип: `ip`, `uri`, `header`, `body`, `method`, `country`, `user-agent`
   - Выберите оператор: `equals`, `contains`, `startsWith`, `endsWith`, `regex`, `in`, `not-in`
   - Укажите значение
5. Нажмите **"Save"**

**Пример правила:**
- **Name:** Block Admin Path
- **Action:** block
- **Priority:** 100
- **Conditions:**
  - Type: `uri`, Operator: `startsWith`, Value: `/admin`

**Поведение:** Правила обрабатываются по приоритету. Первое совпавшее правило определяет действие.

### Мониторинг угроз

#### Просмотр угроз

1. Перейдите на вкладку **"Threats"**
2. Просматривайте список обнаруженных угроз
3. Фильтруйте угрозы по:
   - **Type** - Тип угрозы (sql-injection, xss, etc.)
   - **Severity** - Серьезность (critical, high, medium, low)
   - **Blocked** - Заблокированные/разрешенные
   - **Source IP** - IP адрес источника
4. Используйте поиск для фильтрации по тексту

#### Экспорт угроз

1. На вкладке **"Threats"** нажмите кнопку **"Export to JSON"** или **"Export to CSV"**
2. Файл будет загружен с именем `waf-threats-YYYY-MM-DD.json` или `waf-threats-YYYY-MM-DD.csv`

**Формат JSON:**
```json
[
  {
    "id": "threat-1",
    "type": "sql-injection",
    "severity": "high",
    "sourceIP": "192.168.1.100",
    "target": "/api/users",
    "timestamp": "2026-01-26T10:00:00Z",
    "blocked": true,
    "ruleId": "owasp-sql-1",
    "ruleName": "SQL Injection Detection",
    "details": { ... }
  }
]
```

**Формат CSV:**
- Заголовки: ID, Type, Severity, Source IP, Target, Timestamp, Blocked, Rule ID, Rule Name, Details
- Данные в формате CSV с экранированием кавычек

---

## Руководство администратора

### Рекомендации по конфигурации

#### Production WAF

```json
{
  "mode": "prevention",
  "enableOWASP": true,
  "owaspRuleset": "3.3",
  "enableRateLimiting": true,
  "rateLimitPerMinute": 100,
  "rateLimitStrategy": "sliding-window",
  "enableGeoBlocking": true,
  "blockedCountries": ["CN", "RU", "KP"],
  "enableIPWhitelist": false,
  "ipBlacklist": [],
  "enableDDoSProtection": true,
  "ddosThreshold": 1000,
  "schemaValidation": {
    "enabled": true,
    "schemaType": "json-schema",
    "validateRequest": true,
    "validateResponse": false
  },
  "jwtValidation": {
    "enabled": true,
    "algorithm": "HS256",
    "requireExpiration": true
  },
  "apiKeyValidation": {
    "enabled": true,
    "headerName": "X-API-Key"
  },
  "graphQLProtection": {
    "enabled": true,
    "maxDepth": 10,
    "maxComplexity": 100,
    "blockIntrospection": true
  },
  "botDetection": {
    "enabled": true,
    "methods": ["user-agent", "behavioral"],
    "challengeSuspicious": true
  },
  "anomalyDetection": {
    "enabled": true,
    "threshold": 3.0,
    "windowSize": 60
  }
}
```

**Рекомендации:**
- Используйте режим `prevention` для production
- Включите OWASP правила с последней версией (3.3)
- Используйте `sliding-window` для более точного rate limiting
- Настройте geo-blocking для блокировки нежелательных стран
- Включите DDoS protection с разумным порогом
- Используйте Schema Validation для валидации API запросов
- Используйте JWT Validation для защиты API с аутентификацией
- Используйте API Key Validation для управления доступом к API
- Включите GraphQL Protection для защиты GraphQL API
- Используйте Bot Detection для защиты от автоматизированных запросов
- Включите Anomaly Detection для обнаружения необычных паттернов трафика

### Оптимизация производительности

#### Rate Limiting

**Рекомендации:**
- Используйте `sliding-window` для более точного ограничения
- Используйте `token-bucket` для поддержки burst трафика
- Настройте `rateLimitPerMinute` в зависимости от нагрузки:
  - Низкая нагрузка: 50-100 запросов/минуту
  - Средняя нагрузка: 100-500 запросов/минуту
  - Высокая нагрузка: 500-1000 запросов/минуту

#### OWASP Rules

**Рекомендации:**
- Используйте последнюю версию OWASP Rule Set (3.3)
- OWASP правила увеличивают latency обработки запросов
- Мониторьте метрики `owaspHits` для понимания эффективности правил

#### Schema Validation

**Рекомендации:**
- Используйте JSON Schema для простых API
- Используйте OpenAPI для сложных API с множеством endpoints
- Валидируйте только запросы (`validateRequest: true`), ответы валидируйте только при необходимости
- Schema Validation увеличивает latency обработки запросов

#### JWT Validation

**Рекомендации:**
- Используйте HS256 для простых случаев (быстрее)
- Используйте RS256 для распределенных систем (безопаснее)
- Всегда включайте `requireExpiration: true` для безопасности
- Указывайте `issuer` и `audience` для дополнительной безопасности

### Безопасность

#### Управление доступом

- Используйте режим `prevention` для production
- Настройте IP whitelist для внутренних сервисов
- Используйте IP blacklist для блокировки известных злоумышленников
- Настройте geo-blocking для блокировки нежелательных стран
- Используйте API Key Validation для управления доступом к API
- Регулярно ротируйте API ключи

#### Защита от атак

- Включите OWASP правила для защиты от распространенных атак
- Настройте rate limiting для защиты от злоупотреблений
- Включите DDoS protection для защиты от распределенных атак
- Используйте Bot Detection для защиты от автоматизированных запросов
- Включите Anomaly Detection для обнаружения необычных паттернов

#### Валидация данных

- Используйте Schema Validation для валидации структуры запросов
- Используйте JWT Validation для аутентификации и авторизации
- Используйте GraphQL Protection для защиты GraphQL API от сложных запросов

### Мониторинг и алертинг

#### Ключевые метрики

1. **Total Requests**
   - Нормальное значение: зависит от нагрузки
   - Алерт: резкое увеличение может указывать на атаку

2. **Blocked Requests**
   - Нормальное значение: зависит от режима и правил
   - Алерт: резкое увеличение может указывать на атаку

3. **Threats Detected**
   - Нормальное значение: зависит от трафика
   - Алерт: резкое увеличение может указывать на атаку

4. **Rate Limit Hits**
   - Нормальное значение: зависит от rate limit настроек
   - Алерт: резкое увеличение может указывать на злоупотребления

5. **OWASP Hits**
   - Нормальное значение: зависит от трафика
   - Алерт: резкое увеличение может указывать на попытки атак

6. **Average Latency**
   - Нормальное значение: < 50ms (без валидации), < 100ms (с валидацией)
   - Алерт: averageLatency > 200ms (медленная обработка)

7. **Error Rate**
   - Нормальное значение: errorRate = 0
   - Алерт: errorRate > 0 (проблемы с обработкой запросов)

#### Рекомендации по алертингу

- Настройте алерты на резкое увеличение `blockedRequests`
- Настройте алерты на резкое увеличение `threatsDetected`
- Настройте алерты на резкое увеличение `rateLimitHits`
- Настройте алерты на высокую `averageLatency`
- Настройте алерты на `errorRate > 0`

---

## Метрики и мониторинг

### Метрики Requests

- **totalRequests** - Общее количество обработанных запросов
- **allowedRequests** - Количество разрешенных запросов
- **blockedRequests** - Количество заблокированных запросов

### Метрики Threats

- **threatsDetected** - Общее количество обнаруженных угроз
- **owaspHits** - Количество срабатываний OWASP правил
- **rateLimitHits** - Количество срабатываний rate limiting
- **geoBlockHits** - Количество срабатываний geo-blocking
- **ipBlockHits** - Количество срабатываний IP блокировки

### Метрики Rules

- **activeRules** - Количество активных правил (OWASP + Custom)

### Per-Second Метрики

- **requestsPerSecond** - Скорость запросов
- **averageLatency** - Средняя latency обработки (ms)
- **errorRate** - Процент ошибок (0-1)

### Мониторинг в реальном времени

Все метрики обновляются в реальном времени во время симуляции:
- Метрики синхронизируются из `WAFEmulationEngine` каждые 500ms
- Метрики отображаются в UI компонента
- Угрозы обновляются в реальном времени
- Правила применяются к каждому запросу

---

## Примеры использования

### Пример 1: Базовый WAF для API

**Сценарий:** Защита REST API от основных атак

```json
{
  "mode": "prevention",
  "enableOWASP": true,
  "owaspRuleset": "3.3",
  "enableRateLimiting": true,
  "rateLimitPerMinute": 100,
  "rateLimitStrategy": "sliding-window",
  "enableDDoSProtection": true,
  "ddosThreshold": 1000
}
```

### Пример 2: WAF с API Shield функциями

**Сценарий:** Защита API с валидацией схемы и JWT

```json
{
  "mode": "prevention",
  "enableOWASP": true,
  "enableRateLimiting": true,
  "rateLimitPerMinute": 200,
  "schemaValidation": {
    "enabled": true,
    "schemaType": "json-schema",
    "schema": "{\"type\":\"object\",\"properties\":{\"username\":{\"type\":\"string\"}},\"required\":[\"username\"]}",
    "validateRequest": true
  },
  "jwtValidation": {
    "enabled": true,
    "algorithm": "HS256",
    "secret": "my-secret-key",
    "requireExpiration": true
  },
  "apiKeyValidation": {
    "enabled": true,
    "keys": [
      {
        "id": "key-1",
        "key": "api-key-123",
        "enabled": true,
        "rateLimit": 1000
      }
    ]
  }
}
```

### Пример 3: WAF для GraphQL API

**Сценарий:** Защита GraphQL API от сложных запросов

```json
{
  "mode": "prevention",
  "enableOWASP": true,
  "enableRateLimiting": true,
  "graphQLProtection": {
    "enabled": true,
    "maxDepth": 10,
    "maxComplexity": 100,
    "maxAliases": 10,
    "blockIntrospection": true
  },
  "botDetection": {
    "enabled": true,
    "methods": ["user-agent", "behavioral"],
    "challengeSuspicious": true
  }
}
```

### Пример 4: WAF с Custom Rules

**Сценарий:** Защита с пользовательскими правилами

```json
{
  "mode": "prevention",
  "enableOWASP": true,
  "rules": [
    {
      "id": "block-admin",
      "name": "Block Admin Path",
      "description": "Block access to /admin path",
      "enabled": true,
      "action": "block",
      "priority": 100,
      "conditions": [
        {
          "type": "uri",
          "operator": "startsWith",
          "value": "/admin"
        }
      ]
    },
    {
      "id": "allow-internal",
      "name": "Allow Internal IPs",
      "description": "Allow requests from internal IPs",
      "enabled": true,
      "action": "allow",
      "priority": 200,
      "conditions": [
        {
          "type": "ip",
          "operator": "in",
          "value": "192.168.1.0/24,10.0.0.0/8"
        }
      ]
    }
  ]
}
```

### Пример 5: WAF с Geo-blocking и IP Blacklist

**Сценарий:** Защита с географической блокировкой и блокировкой IP

```json
{
  "mode": "prevention",
  "enableOWASP": true,
  "enableGeoBlocking": true,
  "blockedCountries": ["CN", "RU", "KP"],
  "ipBlacklist": ["192.168.1.100", "10.0.0.0/16"],
  "enableDDoSProtection": true,
  "ddosThreshold": 1000
}
```

---

## Часто задаваемые вопросы (FAQ)

### Что такое WAF?

WAF (Web Application Firewall) - это решение для защиты веб-приложений и API от различных типов атак и угроз. WAF анализирует HTTP/HTTPS запросы и блокирует подозрительные запросы на основе правил безопасности.

### Что такое API Shield?

API Shield - это набор функций для защиты API, включая Schema Validation, JWT Validation, API Key Validation и GraphQL Protection. API Shield функции дополняют базовые WAF функции для комплексной защиты API.

### Как работает WAF?

1. WAF получает запросы от клиентов или upstream компонентов (API Gateway, Load Balancer)
2. WAF анализирует запросы на основе правил (OWASP, Custom Rules)
3. WAF применяет защитные функции (Rate Limiting, Geo-blocking, DDoS Protection)
4. WAF применяет API Shield функции (Schema Validation, JWT Validation, etc.)
5. Если обнаружена угроза, запрос блокируется (в режиме prevention)
6. Все угрозы логируются и отображаются в UI

### Какой режим работы использовать?

- **Detection** - Для тестирования правил и анализа трафика без блокировки
- **Prevention** - Для production с активной защитой (рекомендуется)
- **Logging** - Для аудита и анализа трафика без применения правил

### Как настроить Rate Limiting?

1. Включите `Enable Rate Limiting`
2. Укажите `Rate Limit Per Minute` (рекомендуется: 100)
3. Выберите стратегию:
   - **fixed-window** - Простая, но менее точная
   - **sliding-window** - Более точная (рекомендуется)
   - **token-bucket** - С поддержкой burst трафика

### Как работает Geo-blocking?

Geo-blocking блокирует запросы из определенных стран. Страна определяется из метаданных сообщения (`DataMessage.metadata.country`). Если страна не указана, geo-blocking не применяется.

### Как работает IP Whitelist/Blacklist?

- IP Whitelist разрешает запросы от указанных IP адресов или CIDR сетей
- IP Blacklist блокирует запросы от указанных IP адресов или CIDR сетей
- IP в whitelist разрешаются даже если в blacklist
- Поддерживается CIDR нотация: `192.168.1.0/24`, `10.0.0.0/16`

### Как настроить Schema Validation?

1. Включите `Enable Schema Validation`
2. Выберите тип схемы: `json-schema` или `openapi`
3. Вставьте схему в поле `Schema`
4. Включите `Validate Request` для валидации запросов
5. Опционально включите `Validate Response` для валидации ответов

### Как настроить JWT Validation?

1. Включите `Enable JWT Validation`
2. Выберите алгоритм: `HS256`, `RS256`, или `ES256`
3. Укажите секрет (для HS256) или публичный ключ (для RS256/ES256)
4. Опционально укажите `Issuer` и `Audience`
5. Включите `Require Expiration` для проверки expiration claim

### Как настроить API Key Validation?

1. Включите `Enable API Key Validation`
2. Добавьте API ключи в список `Keys`
3. Для каждого ключа укажите:
   - ID и Key
   - Enabled
   - Allowed Paths (опционально)
   - Rate Limit (опционально)

### Как настроить GraphQL Protection?

1. Включите `Enable GraphQL Protection`
2. Укажите лимиты:
   - Max Depth (рекомендуется: 10)
   - Max Complexity (рекомендуется: 100)
   - Max Aliases (рекомендуется: 10)
3. Включите `Block Introspection` для блокировки introspection запросов

### Как создать Custom Rule?

1. Перейдите на вкладку **"Custom Rules"**
2. Нажмите **"Add Rule"**
3. Заполните параметры (Name, Action, Priority)
4. Добавьте условия (Type, Operator, Value)
5. Нажмите **"Save"**

### Как мониторить WAF?

Используйте метрики WAF:
- **Total Requests** - Общее количество запросов
- **Blocked Requests** - Количество заблокированных запросов
- **Threats Detected** - Количество обнаруженных угроз
- **Rate Limit Hits** - Количество срабатываний rate limiting
- **Average Latency** - Средняя latency обработки
- **Error Rate** - Процент ошибок

### Как экспортировать угрозы?

На вкладке **"Threats"** нажмите кнопку **"Export to JSON"** или **"Export to CSV"**. Файл будет загружен с текущей датой в имени.

### Как работает Connection Rules?

Connection Rules автоматически настраивают WAF при подключении компонентов:
- **API Gateway → WAF → Backend**: WAF автоматически настраивается для защиты API
- **Load Balancer → WAF → Backend**: WAF настраивается для защиты backend
- **CDN → WAF → Origin**: WAF настраивается для защиты origin сервера

---

## Дополнительные ресурсы

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP ModSecurity Core Rule Set](https://github.com/coreruleset/coreruleset)
- [Cloudflare WAF Documentation](https://developers.cloudflare.com/waf/)
- [Cloudflare API Shield Documentation](https://developers.cloudflare.com/api-shield/)
- [AWS WAF Documentation](https://docs.aws.amazon.com/waf/)
- [ModSecurity Documentation](https://github.com/owasp-modsecurity/ModSecurity)
- [JSON Schema Specification](https://json-schema.org/)
- [OpenAPI Specification](https://www.openapis.org/)
- [JWT Specification](https://jwt.io/)
- [GraphQL Specification](https://graphql.org/)

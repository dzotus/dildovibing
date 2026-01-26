# Keycloak - Документация компонента

## Обзор

Keycloak - это open-source решение для управления идентификацией и доступом (IAM) с поддержкой SSO, OAuth2 и SAML. Компонент Keycloak в системе симуляции полностью эмулирует поведение реального Keycloak, включая OAuth2/OIDC flows (authorization_code, implicit, client_credentials, password, refresh_token), управление пользователями и клиентами, Client Scopes и Protocol Mappers для генерации токенов с claims, поддержку Groups и Roles, Identity Providers (LDAP, SAML, Social), Authentication Flows и полный набор возможностей Keycloak.

### Основные возможности

- ✅ **OAuth2/OIDC Flows** - Полная поддержка всех OAuth2 flows (authorization_code, implicit, client_credentials, password, refresh_token)
- ✅ **Realm Management** - Управление realms с настройками SSL, session management, password policies
- ✅ **Client Management** - Управление клиентами (public, confidential, bearer-only) с grant types и redirect URIs
- ✅ **User Management** - Управление пользователями с roles, groups, attributes
- ✅ **Client Scopes** - Scopes для управления claims в токенах
- ✅ **Protocol Mappers** - Mappers для добавления custom claims в токены
- ✅ **Identity Providers** - Поддержка LDAP, SAML, Social providers (Google, GitHub, Facebook)
- ✅ **Authentication Flows** - Настраиваемые flows для аутентификации
- ✅ **Session Management** - Управление SSO сессиями с idle и max timeout
- ✅ **Token Management** - Генерация access, refresh и ID токенов с настраиваемым временем жизни
- ✅ **Connection Rules** - Автоматическая настройка конфигов при подключении к Keycloak
- ✅ **Метрики Keycloak** - Полный набор метрик производительности и использования

---

## Основные функции

### 1. OAuth2/OIDC Flows (OAuth2/OIDC потоки)

**Описание:** Keycloak поддерживает все стандартные OAuth2 и OpenID Connect flows для аутентификации и авторизации.

**Поддерживаемые flows:**

#### 1.1. Authorization Code Flow

**Описание:** Стандартный flow для веб-приложений с backend.

**Как работает:**
1. Приложение перенаправляет пользователя на Keycloak authorization endpoint
2. Пользователь аутентифицируется
3. Keycloak возвращает authorization code
4. Приложение обменивает code на access token через token endpoint

**Параметры:**
- **grant_type**: `authorization_code`
- **code**: Authorization code
- **redirect_uri**: Redirect URI (должен быть в whitelist клиента)
- **client_id**: Client ID
- **client_secret**: Client secret (для confidential clients)

**Пример запроса:**
```json
{
  "grant_type": "authorization_code",
  "client_id": "my-app",
  "client_secret": "secret",
  "code": "abc123",
  "redirect_uri": "http://localhost:3000/callback"
}
```

#### 1.2. Implicit Flow

**Описание:** Упрощенный flow для SPA (Single Page Applications).

**Как работает:**
1. Приложение перенаправляет пользователя на Keycloak
2. Пользователь аутентифицируется
3. Keycloak возвращает access token напрямую в redirect URI

**Параметры:**
- **grant_type**: `implicit`
- **client_id**: Client ID
- **redirect_uri**: Redirect URI

**Примечание:** Implicit flow считается менее безопасным и рекомендуется использовать Authorization Code Flow с PKCE.

#### 1.3. Client Credentials Flow

**Описание:** Flow для service-to-service аутентификации без пользователя.

**Как работает:**
1. Клиент отправляет client_id и client_secret
2. Keycloak возвращает access token для клиента

**Параметры:**
- **grant_type**: `client_credentials`
- **client_id**: Client ID
- **client_secret**: Client secret (обязательно для confidential clients)

**Пример запроса:**
```json
{
  "grant_type": "client_credentials",
  "client_id": "service-client",
  "client_secret": "secret"
}
```

#### 1.4. Password Flow (Resource Owner Password Credentials)

**Описание:** Прямая аутентификация с username и password.

**Как работает:**
1. Клиент отправляет username и password
2. Keycloak проверяет credentials
3. Keycloak возвращает access token и refresh token

**Параметры:**
- **grant_type**: `password`
- **client_id**: Client ID
- **username**: Username
- **password**: Password

**Примечание:** Password flow не рекомендуется для production, используйте Authorization Code Flow.

#### 1.5. Refresh Token Flow

**Описание:** Обновление access token с помощью refresh token.

**Как работает:**
1. Клиент отправляет refresh token
2. Keycloak валидирует refresh token
3. Keycloak возвращает новый access token и refresh token

**Параметры:**
- **grant_type**: `refresh_token`
- **client_id**: Client ID
- **refresh_token**: Refresh token

**Пример запроса:**
```json
{
  "grant_type": "refresh_token",
  "client_id": "my-app",
  "refresh_token": "refresh_token_abc123"
}
```

### 2. Realm Management (Управление realms)

**Описание:** Realm - это изолированное пространство для пользователей, клиентов и настроек.

**Параметры Realm:**
- **realm** - Имя realm (обязательно, по умолчанию: `archiphoenix`)
- **adminUrl** - URL Keycloak admin console (по умолчанию: `http://keycloak:8080`)
- **enableSSL** - Включить SSL (по умолчанию: `false`)
- **sslRequired** - Когда требуется SSL: `external`, `all`, `none` (по умолчанию: `external`)

**Пример конфигурации:**
```json
{
  "realm": "archiphoenix",
  "adminUrl": "http://keycloak:8080",
  "enableSSL": false,
  "sslRequired": "external"
}
```

### 3. Session Management (Управление сессиями)

**Описание:** Keycloak управляет SSO сессиями для пользователей.

**Параметры Session:**
- **ssoSessionIdle** - Idle timeout для SSO сессий в секундах (по умолчанию: `1800` = 30 минут)
- **ssoSessionMax** - Максимальная длительность SSO сессии в секундах (по умолчанию: `36000` = 10 часов)

**Как работает:**
1. При первой аутентификации создается SSO сессия
2. Сессия остается активной пока пользователь активен (в пределах `ssoSessionIdle`)
3. Сессия истекает через `ssoSessionMax` даже при активности
4. При истечении сессии пользователь должен аутентифицироваться заново

**Пример конфигурации:**
```json
{
  "ssoSessionIdle": 1800,
  "ssoSessionMax": 36000
}
```

### 4. Token Management (Управление токенами)

**Описание:** Keycloak генерирует и управляет access, refresh и ID токенами.

**Типы токенов:**
- **Access Token** - Токен для доступа к ресурсам
- **Refresh Token** - Токен для обновления access token
- **ID Token** - Токен с информацией о пользователе (OIDC)

**Параметры Token:**
- **accessTokenLifespan** - Время жизни access token в секундах (по умолчанию: `300` = 5 минут)
- **refreshTokenLifespan** - Время жизни refresh token в секундах (по умолчанию: `1800` = 30 минут)

**Структура токена (JWT claims):**
```json
{
  "iss": "http://keycloak:8080/realms/archiphoenix",
  "aud": "my-app",
  "exp": 1609459200,
  "iat": 1609458900,
  "sub": "user-1",
  "preferred_username": "john",
  "email": "john@example.com",
  "realm_access": {
    "roles": ["admin", "user"]
  },
  "resource_access": {
    "my-app": {
      "roles": ["app-user"]
    }
  },
  "groups": ["developers"]
}
```

**Пример конфигурации:**
```json
{
  "accessTokenLifespan": 300,
  "refreshTokenLifespan": 1800
}
```

### 5. Client Management (Управление клиентами)

**Описание:** Clients представляют приложения, которые используют Keycloak для аутентификации.

**Типы клиентов:**
- **public** - Публичный клиент (SPA, mobile apps) - без client secret
- **confidential** - Конфиденциальный клиент (backend apps) - с client secret
- **bearer-only** - Только валидация токенов, без аутентификации

**Параметры Client:**
- **id** - Уникальный идентификатор (обязательно)
- **name** - Имя клиента (обязательно)
- **clientId** - Client ID для OAuth2 (обязательно)
- **type** - Тип клиента (обязательно)
- **enabled** - Включен ли клиент (по умолчанию: `true`)
- **protocol** - Протокол: `openid-connect` или `saml` (по умолчанию: `openid-connect`)
- **clientSecret** - Client secret (для confidential clients)
- **redirectUris** - Whitelist redirect URIs
- **webOrigins** - Allowed CORS origins
- **grantTypes** - Разрешенные grant types
- **standardFlowEnabled** - Включить Authorization Code Flow (по умолчанию: `true`)
- **implicitFlowEnabled** - Включить Implicit Flow (по умолчанию: `false`)
- **directAccessGrantsEnabled** - Включить Password Flow (по умолчанию: `false`)
- **serviceAccountsEnabled** - Включить Client Credentials Flow (по умолчанию: `false`)
- **defaultClientScopes** - Default scopes для клиента
- **optionalClientScopes** - Optional scopes для клиента

**Пример конфигурации:**
```json
{
  "clients": [
    {
      "id": "my-app",
      "name": "My Application",
      "clientId": "my-app",
      "type": "confidential",
      "enabled": true,
      "protocol": "openid-connect",
      "clientSecret": "secret",
      "redirectUris": ["http://localhost:3000/*"],
      "webOrigins": ["http://localhost:3000"],
      "grantTypes": ["authorization_code", "refresh_token"],
      "standardFlowEnabled": true,
      "directAccessGrantsEnabled": false
    }
  ]
}
```

### 6. User Management (Управление пользователями)

**Описание:** Users представляют пользователей, которые могут аутентифицироваться в Keycloak.

**Параметры User:**
- **id** - Уникальный идентификатор (обязательно)
- **username** - Имя пользователя (обязательно)
- **email** - Email пользователя (опционально)
- **enabled** - Включен ли пользователь (по умолчанию: `true`)
- **roles** - Realm roles пользователя
- **groups** - Groups пользователя
- **realmRoles** - Realm roles (альтернатива roles)
- **clientRoles** - Client roles (clientId → roles mapping)

**Пример конфигурации:**
```json
{
  "users": [
    {
      "id": "user-1",
      "username": "john",
      "email": "john@example.com",
      "enabled": true,
      "roles": ["admin", "user"],
      "groups": ["developers"],
      "realmRoles": ["admin", "user"],
      "clientRoles": {
        "my-app": ["app-user"]
      }
    }
  ]
}
```

### 7. Client Scopes (Scopes клиентов)

**Описание:** Client Scopes определяют, какие claims включаются в токены.

**Структура Client Scope:**
- **id** - Уникальный идентификатор
- **name** - Имя scope (например: `profile`, `email`, `roles`)
- **protocol** - Протокол: `openid-connect` или `saml`
- **protocolMappers** - Protocol mappers для генерации claims
- **attributes** - Дополнительные атрибуты

**Встроенные scopes:**
- **profile** - Базовая информация о пользователе
- **email** - Email пользователя
- **roles** - Roles пользователя

**Пример конфигурации:**
```json
{
  "clientScopes": [
    {
      "id": "profile",
      "name": "profile",
      "protocol": "openid-connect",
      "protocolMappers": [
        {
          "id": "mapper-1",
          "name": "username",
          "protocolMapper": "oidc-usermodel-property-mapper",
          "config": {
            "user.attribute": "username",
            "claim.name": "preferred_username"
          }
        }
      ]
    }
  ]
}
```

### 8. Protocol Mappers (Мапперы протоколов)

**Описание:** Protocol Mappers определяют, как user attributes маппятся в токены.

**Типы mappers:**
- **oidc-usermodel-property-mapper** - Маппинг user attributes в claims
- **oidc-usermodel-realm-role-mapper** - Маппинг realm roles в claims
- **oidc-usermodel-client-role-mapper** - Маппинг client roles в claims
- **oidc-group-membership-mapper** - Маппинг groups в claims

**Пример конфигурации:**
```json
{
  "protocolMappers": [
    {
      "id": "mapper-1",
      "name": "username-mapper",
      "protocolMapper": "oidc-usermodel-property-mapper",
      "config": {
        "user.attribute": "username",
        "claim.name": "preferred_username",
        "access.token.claim": "true"
      }
    }
  ]
}
```

### 9. Identity Providers (Провайдеры идентификации)

**Описание:** Identity Providers позволяют использовать внешние системы для аутентификации.

**Поддерживаемые providers:**
- **LDAP** - LDAP/Active Directory federation
- **SAML** - SAML 2.0 IdP
- **OIDC** - OpenID Connect IdP
- **Google** - Google OAuth
- **GitHub** - GitHub OAuth
- **Facebook** - Facebook OAuth

**Параметры Identity Provider:**
- **id** - Уникальный идентификатор
- **alias** - Alias provider
- **providerId** - Тип provider
- **enabled** - Включен ли provider
- **config** - Конфигурация provider

**Пример конфигурации:**
```json
{
  "identityProviders": [
    {
      "id": "ldap-1",
      "alias": "ldap",
      "providerId": "ldap",
      "enabled": true,
      "config": {
        "connectionUrl": "ldap://ldap.example.com:389",
        "usersDn": "ou=users,dc=example,dc=com"
      }
    }
  ]
}
```

**Как работает:**
- При включенном LDAP увеличивается latency аутентификации
- SAML flows обрабатываются отдельно
- Social providers используют redirect flows

### 10. Authentication Flows (Потоки аутентификации)

**Описание:** Authentication Flows определяют шаги процесса аутентификации.

**Встроенные flows:**
- **browser** - Browser-based authentication (forms, cookies)
- **direct-grant** - Direct grant authentication (username/password)

**Структура Flow:**
- **id** - Уникальный идентификатор
- **alias** - Имя flow
- **providerId** - Тип flow (например: `basic-flow`)
- **topLevel** - Top-level flow
- **builtIn** - Встроенный flow
- **executions** - Шаги выполнения

**Пример конфигурации:**
```json
{
  "authenticationFlows": [
    {
      "id": "browser",
      "alias": "browser",
      "providerId": "basic-flow",
      "topLevel": true,
      "builtIn": true,
      "executions": [
        {
          "id": "cookie",
          "requirement": "ALTERNATIVE",
          "displayName": "Cookie",
          "providerId": "auth-cookie"
        },
        {
          "id": "forms",
          "requirement": "ALTERNATIVE",
          "displayName": "Forms",
          "providerId": "auth-username-password-form"
        }
      ]
    }
  ]
}
```

### 11. Password Policy (Политика паролей)

**Описание:** Password Policy определяет требования к паролям пользователей.

**Формат policy:**
- `length(8)` - Минимальная длина 8 символов
- `digits(1)` - Минимум 1 цифра
- `uppercase(1)` - Минимум 1 заглавная буква
- `lowercase(1)` - Минимум 1 строчная буква
- `specialChars(1)` - Минимум 1 специальный символ

**Пример конфигурации:**
```json
{
  "passwordPolicy": "length(8) and digits(1) and uppercase(1)"
}
```

---

## Руководство пользователя

### Быстрый старт

1. **Добавление компонента Keycloak:**
   - Перетащите компонент "Keycloak" из библиотеки компонентов на canvas
   - Откройте панель конфигурации компонента

2. **Настройка Realm:**
   - Перейдите на вкладку **"Realm Configuration"**
   - Укажите `realm` (по умолчанию: `archiphoenix`)
   - Укажите `adminUrl` (по умолчанию: `http://keycloak:8080`)

3. **Создание Client:**
   - Перейдите на вкладку **"Clients"**
   - Нажмите кнопку **"Add Client"**
   - Укажите имя и clientId
   - Выберите тип (public, confidential, bearer-only)
   - Настройте grant types и redirect URIs
   - Нажмите **"Save"**

4. **Добавление User:**
   - Перейдите на вкладку **"Users"**
   - Нажмите кнопку **"Add User"**
   - Укажите username, email
   - Назначьте roles
   - Нажмите **"Save"**

5. **Настройка Session Management:**
   - Перейдите на вкладку **"Settings"** → **"Session Management"**
   - Укажите `ssoSessionIdle` (по умолчанию: `1800` = 30 минут)
   - Укажите `ssoSessionMax` (по умолчанию: `36000` = 10 часов)
   - Нажмите **"Save"**

### Работа с Clients

#### Создание Public Client

1. Перейдите на вкладку **"Clients"**
2. Нажмите кнопку **"Add Client"**
3. Заполните параметры:
   - **Name** - Имя клиента
   - **Client ID** - Client ID для OAuth2
   - **Type** - Выберите `public`
   - **Protocol** - Выберите `openid-connect`
   - **Standard Flow Enabled** - Включите для Authorization Code Flow
   - **Redirect URIs** - Добавьте redirect URIs
4. Нажмите **"Save"**

**Примечание:** Public clients не требуют client secret.

#### Создание Confidential Client

1. Выберите тип **"confidential"**
2. Укажите **Client Secret**
3. Включите нужные grant types:
   - **Standard Flow Enabled** - Authorization Code Flow
   - **Direct Access Grants Enabled** - Password Flow
   - **Service Accounts Enabled** - Client Credentials Flow
4. Нажмите **"Save"**

**Примечание:** Confidential clients требуют client secret для аутентификации.

#### Настройка Redirect URIs

1. Выберите client из списка
2. Нажмите кнопку **"Edit"**
3. В секции **"Redirect URIs"** добавьте URIs:
   - `http://localhost:3000/*` - Для разработки
   - `https://app.example.com/*` - Для production
4. Нажмите **"Save"**

**Примечание:** Redirect URIs должны точно совпадать или использовать wildcard (`*`).

### Работа с Users

#### Создание User

1. Перейдите на вкладку **"Users"**
2. Нажмите кнопку **"Add User"**
3. Заполните параметры:
   - **Username** - Имя пользователя
   - **Email** - Email пользователя
   - **Enabled** - Включить пользователя
   - **Email Verified** - Email подтвержден
4. Нажмите **"Save"**

#### Назначение Roles

1. Выберите user из списка
2. Нажмите кнопку **"Edit"**
3. В секции **"Roles"** выберите roles:
   - **Realm Roles** - Roles на уровне realm
   - **Client Roles** - Roles для конкретных клиентов
4. Нажмите **"Save"**

#### Назначение Groups

1. В секции **"Groups"** выберите groups
2. Groups наследуют roles от parent groups
3. Нажмите **"Save"**

### Работа с Client Scopes

#### Создание Client Scope

1. Перейдите на вкладку **"Client Scopes"**
2. Нажмите кнопку **"Add Scope"**
3. Заполните параметры:
   - **Name** - Имя scope
   - **Protocol** - Выберите `openid-connect`
   - **Protocol Mappers** - Добавьте mappers для генерации claims
4. Нажмите **"Save"**

#### Назначение Scopes клиенту

1. Выберите client из списка
2. Нажмите кнопку **"Edit"**
3. В секции **"Client Scopes"**:
   - **Default Scopes** - Scopes, которые всегда включаются
   - **Optional Scopes** - Scopes, которые могут быть запрошены
4. Нажмите **"Save"**

### Работа с Protocol Mappers

#### Создание Protocol Mapper

1. Выберите client scope из списка
2. Нажмите кнопку **"Add Mapper"**
3. Выберите тип mapper:
   - **User Property** - Маппинг user attributes
   - **Realm Role** - Маппинг realm roles
   - **Client Role** - Маппинг client roles
   - **Group Membership** - Маппинг groups
4. Настройте параметры:
   - **Claim Name** - Имя claim в токене
   - **User Attribute** - User attribute для маппинга
5. Нажмите **"Save"**

### Работа с Identity Providers

#### Настройка LDAP

1. Перейдите на вкладку **"Identity Providers"**
2. Нажмите кнопку **"Add Provider"**
3. Выберите тип **"LDAP"**
4. Заполните параметры:
   - **Connection URL** - URL LDAP сервера
   - **Users DN** - DN для поиска пользователей
   - **Bind DN** - DN для bind
   - **Bind Credential** - Пароль для bind
5. Нажмите **"Save"**

**Примечание:** При включенном LDAP увеличивается latency аутентификации.

#### Настройка SAML

1. Выберите тип **"SAML"**
2. Заполните параметры:
   - **Single Sign-On Service URL** - SSO URL IdP
   - **Single Logout Service URL** - SLO URL IdP
   - **Certificate** - Certificate IdP
3. Нажмите **"Save"**

---

## Руководство администратора

### Рекомендации по конфигурации

#### Production Keycloak

```json
{
  "realm": "production",
  "adminUrl": "https://keycloak.example.com",
  "enableSSL": true,
  "sslRequired": "all",
  "accessTokenLifespan": 300,
  "refreshTokenLifespan": 1800,
  "ssoSessionIdle": 1800,
  "ssoSessionMax": 36000,
  "enableOAuth2": true,
  "enableSAML": true,
  "enableLDAP": true,
  "passwordPolicy": "length(12) and digits(2) and uppercase(2) and lowercase(2) and specialChars(1)",
  "clients": [
    {
      "id": "api-service",
      "name": "API Service",
      "clientId": "api-service",
      "type": "confidential",
      "enabled": true,
      "protocol": "openid-connect",
      "clientSecret": "secure-secret",
      "grantTypes": ["authorization_code", "refresh_token"],
      "standardFlowEnabled": true,
      "redirectUris": ["https://api.example.com/*"]
    }
  ]
}
```

**Рекомендации:**
- Используйте HTTPS для production (`enableSSL: true`, `sslRequired: "all"`)
- Используйте сильные password policies
- Используйте confidential clients для backend приложений
- Настройте разумные token lifespans (5 минут для access, 30 минут для refresh)
- Используйте LDAP для централизованного управления пользователями
- Мониторьте метрики Keycloak (login requests, token refresh, sessions)

### Оптимизация производительности

**Token Lifespans:**
- Используйте `300` секунд (5 минут) для access tokens
- Используйте `1800` секунд (30 минут) для refresh tokens
- Короткие lifespans улучшают безопасность, но увеличивают количество refresh requests

**Session Management:**
- Используйте `1800` секунд (30 минут) для idle timeout
- Используйте `36000` секунд (10 часов) для max session
- Балансируйте между удобством пользователя и безопасностью

**LDAP Federation:**
- Используйте connection pooling для LDAP
- Кэшируйте LDAP queries для уменьшения latency
- Мониторьте LDAP latency в метриках

### Безопасность

#### Управление доступом

- Используйте HTTPS для всех connections (`sslRequired: "all"`)
- Используйте сильные client secrets для confidential clients
- Ограничьте redirect URIs для клиентов
- Используйте password policies для сложных паролей
- Регулярно ротируйте client secrets

#### Защита токенов

- Используйте короткие access token lifespans
- Используйте refresh tokens для обновления access tokens
- Валидируйте токены на стороне ресурсов
- Используйте HTTPS для передачи токенов
- Мониторьте метрики Keycloak (login errors, token refresh errors)

### Мониторинг и алертинг

#### Ключевые метрики

1. **Login Requests Per Second**
   - Нормальное значение: зависит от нагрузки
   - Алерт: loginRequestsPerSecond > 100 (высокая нагрузка)

2. **Login Success Rate**
   - Нормальное значение: authSuccessRate > 95%
   - Алерт: authSuccessRate < 90% (проблемы с аутентификацией)

3. **Token Refresh Rate**
   - Нормальное значение: зависит от access token lifespan
   - Алерт: tokenRefreshTotal значительно превышает loginRequestsTotal (слишком короткий access token lifespan)

4. **Active Sessions**
   - Нормальное значение: зависит от количества пользователей
   - Алерт: activeSessions > 10000 (высокая нагрузка на память)

5. **Average Latency**
   - Нормальное значение: averageLatency < 100ms
   - Алерт: averageLatency > 500ms (медленная обработка)

6. **Error Rate**
   - Нормальное значение: errorRate = 0
   - Алерт: errorRate > 0 (проблемы с обработкой запросов)

---

## Метрики и мониторинг

### Метрики Authentication

- **loginRequestsTotal** - Общее количество login запросов
- **loginErrorsTotal** - Общее количество ошибок login
- **authSuccessRate** - Процент успешных аутентификаций (0-1)

### Метрики Tokens

- **tokenRefreshTotal** - Общее количество refresh token запросов
- **introspectionRequestsTotal** - Общее количество introspection запросов
- **userInfoRequestsTotal** - Общее количество userinfo запросов

### Метрики Sessions

- **sessionsCreatedTotal** - Общее количество созданных сессий
- **sessionsExpiredTotal** - Общее количество истекших сессий
- **activeSessions** - Количество активных сессий

### Метрики Email

- **emailsSentTotal** - Общее количество отправленных email
- **emailErrorsTotal** - Общее количество ошибок отправки email

### Метрики Events

- **eventsTotal** - Общее количество событий
- **adminEventsTotal** - Общее количество admin событий

### Per-Second Метрики

- **requestsPerSecond** - Скорость запросов
- **averageLatency** - Средняя latency обработки (ms)
- **errorRate** - Процент ошибок (0-1)

### Мониторинг в реальном времени

Все метрики обновляются в реальном времени во время симуляции:
- Метрики синхронизируются из `KeycloakEmulationEngine` каждые 500ms
- Метрики отображаются в UI компоненте
- Сессии обновляются в реальном времени
- Токены генерируются с учетом конфигурации

---

## Примеры использования

### Пример 1: Базовый OAuth2 Client

**Сценарий:** Создание клиента для веб-приложения

```json
{
  "realm": "archiphoenix",
  "clients": [
    {
      "id": "web-app",
      "name": "Web Application",
      "clientId": "web-app",
      "type": "confidential",
      "enabled": true,
      "protocol": "openid-connect",
      "clientSecret": "secret",
      "redirectUris": ["http://localhost:3000/*"],
      "webOrigins": ["http://localhost:3000"],
      "grantTypes": ["authorization_code", "refresh_token"],
      "standardFlowEnabled": true,
      "directAccessGrantsEnabled": false
    }
  ]
}
```

### Пример 2: Service-to-Service Authentication

**Сценарий:** Client Credentials Flow для сервисов

```json
{
  "clients": [
    {
      "id": "api-service",
      "name": "API Service",
      "clientId": "api-service",
      "type": "confidential",
      "enabled": true,
      "protocol": "openid-connect",
      "clientSecret": "secret",
      "grantTypes": ["client_credentials"],
      "serviceAccountsEnabled": true
    }
  ]
}
```

**Использование:**
```json
{
  "grant_type": "client_credentials",
  "client_id": "api-service",
  "client_secret": "secret"
}
```

### Пример 3: Client Scopes с Protocol Mappers

**Сценарий:** Настройка custom claims в токенах

```json
{
  "clientScopes": [
    {
      "id": "custom-scope",
      "name": "custom",
      "protocol": "openid-connect",
      "protocolMappers": [
        {
          "id": "mapper-1",
          "name": "department-mapper",
          "protocolMapper": "oidc-usermodel-property-mapper",
          "config": {
            "user.attribute": "department",
            "claim.name": "department",
            "access.token.claim": "true"
          }
        }
      ]
    }
  ],
  "clients": [
    {
      "id": "my-app",
      "name": "My App",
      "defaultClientScopes": ["profile", "email", "custom"]
    }
  ]
}
```

**Результат:** Токены будут содержать claim `department` из user attributes.

### Пример 4: LDAP Federation

**Сценарий:** Интеграция с LDAP для централизованного управления пользователями

```json
{
  "enableLDAP": true,
  "identityProviders": [
    {
      "id": "ldap-1",
      "alias": "ldap",
      "providerId": "ldap",
      "enabled": true,
      "config": {
        "connectionUrl": "ldap://ldap.example.com:389",
        "usersDn": "ou=users,dc=example,dc=com",
        "bindDn": "cn=admin,dc=example,dc=com",
        "bindCredential": "password"
      }
    }
  ]
}
```

**Поведение:**
- Пользователи аутентифицируются через LDAP
- Увеличивается latency аутентификации (LDAP queries)
- Пользователи синхронизируются из LDAP

### Пример 5: Token Refresh

**Сценарий:** Обновление access token с помощью refresh token

```json
{
  "accessTokenLifespan": 300,
  "refreshTokenLifespan": 1800
}
```

**Использование:**
```json
{
  "grant_type": "refresh_token",
  "client_id": "my-app",
  "refresh_token": "refresh_token_abc123"
}
```

**Результат:**
- Новый access token (lifespan: 300 секунд)
- Новый refresh token (lifespan: 1800 секунд)

---

## Часто задаваемые вопросы (FAQ)

### Что такое Keycloak?

Keycloak - это open-source решение для управления идентификацией и доступом (IAM). Keycloak предоставляет SSO, OAuth2, OpenID Connect и SAML для аутентификации и авторизации приложений.

### Как работает Keycloak?

1. Приложения регистрируются как clients в Keycloak
2. Пользователи аутентифицируются через Keycloak
3. Keycloak выдает токены (access, refresh, ID) для доступа к ресурсам
4. Приложения валидируют токены для авторизации

### Какой OAuth2 flow использовать?

- **Authorization Code Flow** - для веб-приложений с backend (рекомендуется)
- **Implicit Flow** - для SPA (не рекомендуется, используйте Authorization Code Flow с PKCE)
- **Client Credentials Flow** - для service-to-service аутентификации
- **Password Flow** - для legacy приложений (не рекомендуется)
- **Refresh Token Flow** - для обновления access tokens

### Что такое Realm?

Realm - это изолированное пространство для пользователей, клиентов и настроек. Каждый realm имеет свои пользователи, клиенты и конфигурацию.

### Что такое Client Scope?

Client Scope определяет, какие claims включаются в токены. Scopes могут быть default (всегда включаются) или optional (запрашиваются клиентом).

### Что такое Protocol Mapper?

Protocol Mapper определяет, как user attributes маппятся в токены. Mappers могут добавлять custom claims в токены на основе user attributes, roles, groups.

### Как работает LDAP Federation?

При включенном LDAP пользователи аутентифицируются через LDAP сервер. Keycloak делает LDAP queries для проверки credentials, что увеличивает latency аутентификации.

### Как мониторить Keycloak?

Используйте метрики самого Keycloak:
- **Login Requests Per Second** - нагрузка на Keycloak
- **Auth Success Rate** - эффективность аутентификации
- **Token Refresh Rate** - частота обновления токенов
- **Active Sessions** - количество активных сессий
- **Average Latency** - производительность обработки
- **Error Rate** - проблемы с обработкой запросов

---

## Дополнительные ресурсы

- [Официальная документация Keycloak](https://www.keycloak.org/docs/)
- [Keycloak Server Administration](https://www.keycloak.org/docs/latest/server_admin/)
- [Keycloak Securing Applications](https://www.keycloak.org/docs/latest/securing_apps/)
- [OAuth 2.0 Specification](https://oauth.net/2/)
- [OpenID Connect Specification](https://openid.net/connect/)
- [SAML 2.0 Specification](http://saml.xml.org/saml-specifications)

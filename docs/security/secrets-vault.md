# Secrets Vault - Документация компонента

## Обзор

Secrets Vault - это система управления секретами для безопасного хранения и управления секретами, API ключами и учетными данными. Компонент Vault в системе симуляции полностью эмулирует поведение HashiCorp Vault, включая Seal/Unseal механизм, KV v1/v2 secrets engines, версионирование секретов, CAS (check-and-set) операции, Transit encryption, аутентификацию через токены, policies, storage backend и полный набор метрик производительности.

### Основные возможности

- ✅ **Seal/Unseal механизм** - Vault стартует в sealed состоянии, требует unsealing (Shamir's Secret Sharing)
- ✅ **KV Secrets Engine v1/v2** - Key-Value хранилище секретов с поддержкой версионирования (v2)
- ✅ **Versioning** - Версионирование секретов для KV v2 с историей изменений
- ✅ **CAS (Check-and-Set)** - Операции с проверкой версии для предотвращения конфликтов
- ✅ **List Operations** - Просмотр списка секретов по path
- ✅ **Transit Engine** - Шифрование и расшифровка данных
- ✅ **Token Authentication** - Аутентификация через токены с TTL
- ✅ **Policies** - HCL-based access control policies
- ✅ **Storage Backend** - Поддержка различных storage backends (Consul, etcd, file, S3, inmem)
- ✅ **Connection Rules** - Автоматическая настройка конфигов при подключении компонентов
- ✅ **Метрики Vault** - Полный набор метрик производительности и использования

---

## Основные функции

### 1. Seal/Unseal механизм

**Описание:** Vault использует механизм seal/unseal для защиты данных. Vault стартует в sealed состоянии и требует unsealing перед выполнением операций.

**Параметры:**
- **sealed** - Состояние Vault: `true` (sealed) или `false` (unsealed) (по умолчанию: `true`)
- **unsealThreshold** - Количество shards, необходимое для unsealing (по умолчанию: `3`)
- **unsealShares** - Общее количество shards (по умолчанию: `5`)
- **autoUnseal** - Автоматический unseal через KMS/HSM (по умолчанию: `false`)

**Как работает:**
1. Vault стартует в sealed состоянии
2. Для unsealing требуется предоставить определенное количество shards (unseal threshold)
3. Shards генерируются при инициализации Vault (Shamir's Secret Sharing)
4. После unsealing Vault может выполнять операции
5. Vault можно запечатать обратно (seal) для безопасности

**Shamir's Secret Sharing:**
- Vault использует алгоритм Shamir's Secret Sharing для разделения master key
- Master key разделяется на несколько shards (по умолчанию: 5)
- Для unsealing требуется определенное количество shards (по умолчанию: 3)
- Это обеспечивает безопасность и возможность распределения ключей между несколькими администраторами

**Поведение при sealed:**
- Все операции (read, write, delete, auth, encrypt, decrypt, list) возвращают ошибку "Vault is sealed"
- Метрика `vaultSealed` = `true`
- Требуется unsealing перед использованием

**Пример конфигурации:**
```json
{
  "sealed": true,
  "unsealThreshold": 3,
  "unsealShares": 5,
  "autoUnseal": false
}
```

### 2. KV Secrets Engine v1/v2

**Описание:** KV (Key-Value) Secrets Engine - это основное хранилище секретов в Vault.

**Различия между v1 и v2:**

#### 2.1. KV v1 (Simple Key-Value)

**Описание:** Простое key-value хранилище без версионирования.

**API Paths:**
- Чтение: `GET /v1/secret/path`
- Запись: `POST /v1/secret/path`
- Удаление: `DELETE /v1/secret/path`
- Список: `GET /v1/secret/metadata/?list=true`

**Особенности:**
- Нет версионирования
- Нет metadata
- Нет CAS операций
- Hard delete (удаление безвозвратное)

**Пример секрета:**
```json
{
  "path": "secret/database",
  "key": "password",
  "value": "secret123"
}
```

#### 2.2. KV v2 (Versioned Key-Value)

**Описание:** Версионированное key-value хранилище с поддержкой metadata и CAS.

**API Paths:**
- Чтение: `GET /v1/secret/data/path`
- Запись: `POST /v1/secret/data/path`
- Удаление: `DELETE /v1/secret/data/path` (soft delete)
- Список: `GET /v1/secret/metadata/?list=true`
- Чтение версии: `GET /v1/secret/data/path?version=1`
- Восстановление: `POST /v1/secret/undelete/path`
- Уничтожение: `POST /v1/secret/destroy/path`

**Особенности:**
- Версионирование (каждая запись создает новую версию)
- Metadata для каждой версии (created, deleted, destroyed)
- CAS (check-and-set) операции для предотвращения конфликтов
- Soft delete (секрет помечается как deleted, но не удаляется)
- Восстановление удаленных версий
- Уничтожение версий (безвозвратное удаление)

**Структура секрета KV v2:**
```json
{
  "path": "secret/database",
  "versions": {
    "1": {
      "data": { "password": "secret123" },
      "metadata": {
        "version": 1,
        "created": "2026-01-26T10:00:00Z"
      }
    },
    "2": {
      "data": { "password": "newsecret456" },
      "metadata": {
        "version": 2,
        "created": "2026-01-26T11:00:00Z"
      }
    }
  },
  "currentVersion": 2,
  "casRequired": false
}
```

**Параметры:**
- **kvVersion** - Версия KV engine: `1` или `2` (по умолчанию: `2`)
- **enableKV** - Включить KV engine (по умолчанию: `true`)

**Пример конфигурации:**
```json
{
  "enableKV": true,
  "kvVersion": "2"
}
```

### 3. Versioning (Версионирование)

**Описание:** KV v2 поддерживает версионирование секретов с историей изменений.

**Как работает:**
1. Каждая запись создает новую версию секрета
2. Версии нумеруются последовательно (1, 2, 3, ...)
3. Можно читать конкретную версию секрета
4. Текущая версия используется по умолчанию
5. Старые версии сохраняются для истории

**Метаданные версии:**
- **version** - Номер версии
- **created** - Время создания версии
- **deleted** - Помечена ли версия как удаленная
- **destroyed** - Уничтожена ли версия

**Операции с версиями:**
- **Чтение версии**: `GET /v1/secret/data/path?version=1`
- **Восстановление**: `POST /v1/secret/undelete/path` (с указанием версий)
- **Уничтожение**: `POST /v1/secret/destroy/path` (с указанием версий)

**Пример использования:**
```json
{
  "operation": "read",
  "path": "secret/database",
  "version": 1  // Чтение конкретной версии
}
```

### 4. CAS (Check-and-Set)

**Описание:** CAS (Check-and-Set) операции предотвращают конфликты при одновременном обновлении секретов.

**Как работает:**
1. При записи указывается `cas` параметр с номером версии
2. Запись выполняется только если текущая версия совпадает с указанной
3. Если версия не совпадает, операция отклоняется с ошибкой

**Параметры:**
- **cas** - Номер версии для проверки (опционально)
- **casRequired** - Требовать CAS для всех операций записи (опционально)

**Пример использования:**
```json
{
  "operation": "write",
  "path": "secret/database",
  "data": { "password": "newsecret" },
  "cas": 2  // Запись только если текущая версия = 2
}
```

**Поведение:**
- Если `cas` совпадает с текущей версией: запись выполняется
- Если `cas` не совпадает: операция отклоняется с ошибкой "check-and-set parameter did not match"

### 5. List Operations (Операции списка)

**Описание:** List операции позволяют просматривать список секретов по path.

**API Paths:**
- KV v1: `GET /v1/secret/metadata/?list=true`
- KV v2: `GET /v1/secret/metadata/?list=true`

**Как работает:**
1. Указывается path для просмотра
2. Возвращается список секретов (ключей) на этом уровне
3. Можно навигировать по иерархии paths

**Пример использования:**
```json
{
  "operation": "list",
  "path": "secret/"
}
```

**Результат:**
```json
{
  "keys": ["database", "api-keys", "certificates"]
}
```

### 6. Transit Engine (Шифрование)

**Описание:** Transit Engine предоставляет шифрование и расшифровку данных.

**Параметры:**
- **enableTransit** - Включить Transit engine (по умолчанию: `true`)

**Операции:**
- **encrypt** - Шифрование данных
- **decrypt** - Расшифровка данных
- **rekey** - Смена ключа шифрования
- **rotate** - Ротация ключа

**Пример использования:**
```json
{
  "operation": "encrypt",
  "key": "my-key",
  "plaintext": "sensitive data"
}
```

**Результат:**
```json
{
  "ciphertext": "vault:v1:encrypted_data"
}
```

### 7. Token Authentication (Аутентификация через токены)

**Описание:** Vault использует токены для аутентификации и авторизации.

**Параметры:**
- **enableAuth** - Включить аутентификацию (по умолчанию: `true`)
- **authMethod** - Метод аутентификации: `token`, `approle`, `ldap`, `aws` (по умолчанию: `token`)
- **tokenTTL** - Время жизни токена (например: `24h`, `1h`, `30m`) (по умолчанию: `24h`)

**Как работает:**
1. Клиент запрашивает токен через auth endpoint
2. Vault выдает токен с указанным TTL
3. Токен используется для всех последующих операций
4. Токен может быть обновлен (renew) до истечения
5. Токен может быть отозван (revoke)

**Структура токена:**
```json
{
  "token": "hvs.abc123...",
  "policies": ["default", "admin"],
  "ttl": 86400,
  "renewable": true,
  "createdAt": 1609459200000,
  "expiresAt": 1609545600000
}
```

**Операции:**
- **auth** - Получение токена
- **renew** - Обновление токена
- **revoke** - Отзыв токена

**Пример использования:**
```json
{
  "operation": "auth",
  "method": "token",
  "policies": ["default"]
}
```

### 8. Policies (Политики доступа)

**Описание:** Policies определяют права доступа к секретам в формате HCL (HashiCorp Configuration Language).

**Структура policy:**
```hcl
path "secret/*" {
  capabilities = ["read", "list"]
}

path "secret/admin/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}
```

**Capabilities:**
- **create** - Создание секретов
- **read** - Чтение секретов
- **update** - Обновление секретов
- **delete** - Удаление секретов
- **list** - Просмотр списка секретов

**Пример policy:**
```json
{
  "id": "policy-1",
  "name": "database-access",
  "rules": "path \"secret/database/*\" { capabilities = [\"read\"] }",
  "enabled": true
}
```

### 9. Storage Backend (Хранилище данных)

**Описание:** Storage Backend определяет, где Vault хранит свои данные.

**Поддерживаемые типы:**
- **consul** - Consul (рекомендуется для production)
- **etcd** - etcd
- **file** - Файловая система
- **s3** - AWS S3
- **inmem** - In-memory (только для разработки, данные не сохраняются)

**Параметры:**
- **storageBackend.type** - Тип storage backend (по умолчанию: `consul`)
- **storageBackend.address** - Адрес storage backend (опционально)
- **storageBackend.path** - Путь в storage (опционально)
- **storageBackend.haEnabled** - High Availability режим (по умолчанию: `false`)

**Влияние на производительность:**
- **consul**: Низкая латентность, высокая доступность
- **etcd**: Средняя латентность
- **file**: Высокая латентность, низкая доступность
- **s3**: Высокая латентность, высокая доступность
- **inmem**: Очень низкая латентность, нет персистентности

**Пример конфигурации:**
```json
{
  "storageBackend": {
    "type": "consul",
    "address": "consul:8500",
    "haEnabled": true
  }
}
```

---

## Руководство пользователя

### Быстрый старт

1. **Добавление компонента Vault:**
   - Перетащите компонент "Secrets Vault" из библиотеки компонентов на canvas
   - Откройте панель конфигурации компонента

2. **Unsealing Vault:**
   - Перейдите на вкладку **"Status"**
   - Vault стартует в sealed состоянии
   - Нажмите кнопку **"Unseal Vault"**
   - Введите unseal keys (shards) - требуется указанное количество (по умолчанию: 3 из 5)
   - Нажмите **"Unseal"**

3. **Создание Secret Engine:**
   - Перейдите на вкладку **"Engines"**
   - Нажмите кнопку **"Add Engine"**
   - Укажите имя (например: `secret/`)
   - Выберите тип: `kv`
   - Выберите версию: `1` или `2` (рекомендуется `2`)
   - Нажмите **"Save"**

4. **Создание секрета:**
   - Перейдите на вкладку **"Secrets"**
   - Нажмите кнопку **"Add Secret"**
   - Укажите path (должен начинаться с engine name, например: `secret/database`)
   - Укажите key и value
   - Нажмите **"Save"**

5. **Подключение к другим компонентам:**
   - Создайте соединение от компонента к Vault
   - Vault автоматически настроится для работы с компонентом (Connection Rules)

### Работа с Seal/Unseal

#### Unsealing Vault

1. Перейдите на вкладку **"Status"**
2. Проверьте состояние Vault (должно быть "Sealed")
3. Нажмите кнопку **"Unseal Vault"**
4. Введите unseal keys (shards):
   - Требуется указанное количество keys (по умолчанию: 3)
   - Keys разделяются пробелами или переносами строк
5. Нажмите **"Unseal"**

**Примечание:** Vault должен быть unsealed перед выполнением любых операций.

#### Sealing Vault

1. Перейдите на вкладку **"Status"**
2. Нажмите кнопку **"Seal Vault"**
3. Подтвердите действие

**Примечание:** После sealing все операции будут заблокированы до следующего unsealing.

#### Настройка Unseal параметров

1. Перейдите на вкладку **"Settings"**
2. В секции **"Seal Configuration"** укажите:
   - **Unseal Threshold** - Количество shards, необходимое для unsealing (рекомендуется: 3)
   - **Unseal Shares** - Общее количество shards (рекомендуется: 5)
3. Нажмите **"Save"**

### Работа с Secret Engines

#### Создание KV v1 Engine

1. Перейдите на вкладку **"Engines"**
2. Нажмите кнопку **"Add Engine"**
3. Заполните параметры:
   - **Name** - Имя engine (должно заканчиваться на `/`, например: `secret/`)
   - **Type** - Выберите `kv`
   - **Version** - Выберите `1`
4. Нажмите **"Save"**

**Примечание:** KV v1 не поддерживает версионирование и CAS операции.

#### Создание KV v2 Engine

1. Выберите **Version** `2`
2. KV v2 поддерживает:
   - Версионирование
   - CAS операции
   - Soft delete
   - Metadata

**Примечание:** KV v2 рекомендуется для production использования.

### Работа с секретами

#### Создание секрета

1. Перейдите на вкладку **"Secrets"**
2. Нажмите кнопку **"Add Secret"**
3. Заполните параметры:
   - **Path** - Путь к секрету (должен начинаться с engine name, например: `secret/database`)
   - **Key** - Ключ секрета
   - **Value** - Значение секрета
4. Нажмите **"Save"**

**Валидация:**
- Path должен начинаться с engine name
- Path не должен содержать недопустимые символы
- Path и key не должны дублироваться

#### Чтение секрета

1. Найдите секрет в списке
2. Нажмите кнопку **"View"** для просмотра значения
3. Для KV v2 можно выбрать конкретную версию

#### Обновление секрета

1. Найдите секрет в списке
2. Нажмите кнопку **"Edit"**
3. Измените значение
4. Нажмите **"Save"**

**Примечание:** Для KV v2 обновление создает новую версию.

#### Удаление секрета

1. Найдите секрет в списке
2. Нажмите кнопку **"Delete"**
3. Подтвердите удаление

**Примечание:**
- KV v1: Hard delete (безвозвратное удаление)
- KV v2: Soft delete (секрет помечается как deleted, но сохраняется)

### Работа с версиями (KV v2)

#### Просмотр истории версий

1. Найдите секрет KV v2 в списке
2. Нажмите кнопку **"View Versions"**
3. Просматривайте историю версий с метаданными

#### Чтение конкретной версии

1. В истории версий выберите версию
2. Нажмите кнопку **"Read Version"**
3. Просматривайте данные конкретной версии

#### Восстановление версии

1. В истории версий выберите удаленную версию
2. Нажмите кнопку **"Undelete"**
3. Версия будет восстановлена

### Работа с CAS операциями

#### Запись с CAS

1. При создании или обновлении секрета укажите **CAS Version**
2. Запись выполнится только если текущая версия совпадает с указанной
3. Если версия не совпадает, операция будет отклонена

**Использование:** CAS операции предотвращают конфликты при одновременном обновлении секретов.

### Работа с List операциями

#### Просмотр списка секретов

1. Перейдите на вкладку **"Secrets"**
2. Используйте поле поиска для фильтрации по path
3. Или используйте операцию **"List"** для просмотра всех секретов по path

**Примечание:** List операции возвращают список секретов на указанном уровне иерархии.

### Работа с Transit Engine

#### Шифрование данных

1. Перейдите на вкладку **"Transit"** (если включен)
2. Укажите ключ шифрования
3. Введите данные для шифрования
4. Нажмите **"Encrypt"**

#### Расшифровка данных

1. Введите зашифрованные данные (ciphertext)
2. Нажмите **"Decrypt"**

**Примечание:** Transit Engine должен быть включен (`enableTransit: true`).

### Работа с токенами

#### Получение токена

1. Перейдите на вкладку **"Auth"**
2. Выберите метод аутентификации: `token`
3. Укажите policies
4. Нажмите **"Get Token"**

#### Обновление токена

1. Найдите токен в списке
2. Нажмите кнопку **"Renew"**
3. Токен будет обновлен с новым TTL

#### Отзыв токена

1. Найдите токен в списке
2. Нажмите кнопку **"Revoke"**
3. Токен будет отозван и станет недействительным

### Работа с Policies

#### Создание policy

1. Перейдите на вкладку **"Policies"**
2. Нажмите кнопку **"Add Policy"**
3. Заполните параметры:
   - **Name** - Имя policy
   - **Rules** - HCL правила доступа
4. Нажмите **"Save"**

**Пример HCL правил:**
```hcl
path "secret/*" {
  capabilities = ["read", "list"]
}

path "secret/admin/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}
```

---

## Руководство администратора

### Рекомендации по конфигурации

#### Production Vault

```json
{
  "vaultType": "hashicorp",
  "address": "https://vault.example.com:8200",
  "enableTLS": true,
  "enableKV": true,
  "kvVersion": "2",
  "enableTransit": true,
  "enableAuth": true,
  "authMethod": "token",
  "tokenTTL": "24h",
  "sealed": true,
  "unsealThreshold": 3,
  "unsealShares": 5,
  "storageBackend": {
    "type": "consul",
    "address": "consul:8500",
    "haEnabled": true
  }
}
```

**Рекомендации:**
- Используйте HTTPS для production (`enableTLS: true`)
- Используйте KV v2 для версионирования и CAS
- Настройте unseal threshold и shares для безопасности
- Используйте Consul для storage backend (высокая доступность)
- Включите HA режим для storage backend
- Используйте разумные TTL для токенов (24 часа)

### Оптимизация производительности

#### Storage Backend

**Рекомендации:**
- Используйте **Consul** для production (низкая латентность, высокая доступность)
- Используйте **etcd** для альтернативы Consul
- Избегайте **file** storage для production (высокая латентность)
- Используйте **inmem** только для разработки (данные не сохраняются)

#### KV Version

**Рекомендации:**
- Используйте **KV v2** для production (версионирование, CAS, soft delete)
- Используйте **KV v1** только если версионирование не требуется

#### Token TTL

**Рекомендации:**
- Используйте `24h` для production токенов
- Используйте более короткие TTL для временных токенов
- Настройте автоматическое обновление токенов

### Безопасность

#### Seal/Unseal

- Всегда храните unseal keys в безопасном месте
- Распределите unseal keys между несколькими администраторами
- Используйте разумные unseal threshold и shares (3 из 5 рекомендуется)
- Регулярно ротируйте unseal keys

#### Policies

- Используйте принцип наименьших привилегий
- Создавайте отдельные policies для разных ролей
- Ограничивайте доступ к секретам по path
- Регулярно проверяйте и обновляйте policies

#### Токены

- Используйте короткие TTL для токенов
- Регулярно ротируйте токены
- Отзывайте неиспользуемые токены
- Мониторьте активные токены

#### Storage Backend

- Используйте зашифрованное хранилище для storage backend
- Настройте backup для storage backend
- Используйте HA режим для высокой доступности

### Мониторинг и алертинг

#### Ключевые метрики

1. **Vault Sealed**
   - Нормальное значение: `false` (unsealed)
   - Алерт: `vaultSealed = true` (Vault запечатан, операции заблокированы)

2. **Read Requests**
   - Нормальное значение: зависит от нагрузки
   - Алерт: резкое увеличение может указывать на проблемы

3. **Write Requests**
   - Нормальное значение: зависит от нагрузки
   - Алерт: резкое увеличение может указывать на проблемы

4. **Auth Errors**
   - Нормальное значение: `authErrorsTotal = 0`
   - Алерт: `authErrorsTotal > 0` (проблемы с аутентификацией)

5. **Active Tokens**
   - Нормальное значение: зависит от количества клиентов
   - Алерт: `activeTokens > 1000` (много активных токенов)

6. **Average Latency**
   - Нормальное значение: < 50ms
   - Алерт: `averageLatency > 100ms` (медленная обработка)

#### Рекомендации по алертингу

- Настройте алерты на `vaultSealed = true`
- Настройте алерты на резкое увеличение `authErrorsTotal`
- Настройте алерты на высокую `averageLatency`
- Настройте алерты на большое количество `activeTokens`

---

## Метрики и мониторинг

### Метрики Requests

- **readRequestsTotal** - Общее количество read запросов
- **writeRequestsTotal** - Общее количество write запросов
- **deleteRequestsTotal** - Общее количество delete запросов
- **listRequestsTotal** - Общее количество list запросов

### Метрики Authentication

- **authRequestsTotal** - Общее количество auth запросов
- **authErrorsTotal** - Общее количество ошибок аутентификации
- **tokenIssuedTotal** - Общее количество выданных токенов
- **tokenRenewedTotal** - Общее количество обновленных токенов
- **tokenRevokedTotal** - Общее количество отозванных токенов
- **activeTokens** - Количество активных токенов

### Метрики Encryption

- **encryptionOperationsTotal** - Общее количество операций шифрования
- **decryptionOperationsTotal** - Общее количество операций расшифровки

### Метрики Secrets

- **secretsTotal** - Общее количество секретов

### Метрики Seal

- **vaultSealed** - Состояние Vault (sealed/unsealed)
- **unsealAttemptsTotal** - Общее количество попыток unseal
- **unsealSuccessTotal** - Общее количество успешных unseal

### Per-Second Метрики

- **requestsPerSecond** - Скорость запросов
- **averageLatency** - Средняя latency обработки (ms)
- **errorRate** - Процент ошибок (0-1)

### Мониторинг в реальном времени

Все метрики обновляются в реальном времени во время симуляции:
- Метрики синхронизируются из `VaultEmulationEngine` каждые 500ms
- Метрики отображаются в UI компонента
- Секреты обновляются в реальном времени
- Токены обновляются в реальном времени

---

## Примеры использования

### Пример 1: Базовый Vault для хранения секретов

**Сценарий:** Хранение API ключей и паролей

```json
{
  "vaultType": "hashicorp",
  "address": "http://vault:8200",
  "enableKV": true,
  "kvVersion": "2",
  "enableAuth": true,
  "authMethod": "token",
  "tokenTTL": "24h",
  "sealed": false,
  "engines": [
    {
      "id": "1",
      "name": "secret/",
      "type": "kv",
      "enabled": true,
      "version": 2
    }
  ],
  "secrets": [
    {
      "id": "1",
      "path": "secret/api-keys",
      "key": "github-token",
      "value": "ghp_abc123..."
    },
    {
      "id": "2",
      "path": "secret/database",
      "key": "password",
      "value": "db_password_123"
    }
  ]
}
```

### Пример 2: Vault с Transit Engine

**Сценарий:** Шифрование данных через Transit Engine

```json
{
  "vaultType": "hashicorp",
  "enableKV": true,
  "enableTransit": true,
  "engines": [
    {
      "id": "1",
      "name": "secret/",
      "type": "kv",
      "enabled": true,
      "version": 2
    },
    {
      "id": "2",
      "name": "transit/",
      "type": "transit",
      "enabled": true
    }
  ]
}
```

### Пример 3: Vault с Policies

**Сценарий:** Управление доступом через policies

```json
{
  "enableAuth": true,
  "policies": [
    {
      "id": "1",
      "name": "read-only",
      "rules": "path \"secret/*\" { capabilities = [\"read\", \"list\"] }",
      "enabled": true
    },
    {
      "id": "2",
      "name": "admin",
      "rules": "path \"secret/*\" { capabilities = [\"create\", \"read\", \"update\", \"delete\", \"list\"] }",
      "enabled": true
    }
  ]
}
```

### Пример 4: Vault с Storage Backend

**Сценарий:** Production Vault с Consul storage

```json
{
  "storageBackend": {
    "type": "consul",
    "address": "consul:8500",
    "haEnabled": true
  },
  "sealed": true,
  "unsealThreshold": 3,
  "unsealShares": 5
}
```

### Пример 5: Vault с KV v2 и версионированием

**Сценарий:** Использование версионирования для отслеживания изменений

```json
{
  "enableKV": true,
  "kvVersion": "2",
  "engines": [
    {
      "id": "1",
      "name": "secret/",
      "type": "kv",
      "enabled": true,
      "version": 2
    }
  ]
}
```

**Использование:**
- Каждая запись создает новую версию
- Можно читать конкретную версию
- Можно восстанавливать удаленные версии
- Можно использовать CAS для предотвращения конфликтов

---

## Часто задаваемые вопросы (FAQ)

### Что такое HashiCorp Vault?

HashiCorp Vault - это система управления секретами для безопасного хранения и управления секретами, API ключами и учетными данными. Vault предоставляет централизованное хранилище секретов с шифрованием, версионированием и контролем доступа.

### Как работает Vault?

1. Vault стартует в sealed состоянии
2. Требуется unsealing для выполнения операций
3. Клиенты аутентифицируются через токены
4. Секреты хранятся в KV engines (v1 или v2)
5. Policies определяют права доступа
6. Все операции логируются и отслеживаются

### Что такое Seal/Unseal?

Seal/Unseal - это механизм защиты данных в Vault. Vault стартует в sealed состоянии и требует unsealing перед выполнением операций. Unsealing требует определенное количество shards (ключей) для безопасности.

### В чем разница между KV v1 и v2?

- **KV v1**: Простое key-value хранилище без версионирования
- **KV v2**: Версионированное хранилище с поддержкой CAS, soft delete и metadata

### Что такое CAS операции?

CAS (Check-and-Set) операции предотвращают конфликты при одновременном обновлении секретов. Запись выполняется только если текущая версия совпадает с указанной.

### Как настроить Storage Backend?

1. Перейдите на вкладку **"Settings"**
2. В секции **"Storage Backend"** выберите тип: `consul`, `etcd`, `file`, `s3`, или `inmem`
3. Укажите адрес и путь (если требуется)
4. Включите HA режим (если требуется)
5. Нажмите **"Save"**

### Как работает аутентификация?

Vault использует токены для аутентификации. Клиенты запрашивают токен через auth endpoint, получают токен с TTL, и используют его для всех операций. Токены могут быть обновлены или отозваны.

### Как создать policy?

1. Перейдите на вкладку **"Policies"**
2. Нажмите **"Add Policy"**
3. Укажите имя и HCL правила
4. Нажмите **"Save"**

### Как работает версионирование (KV v2)?

Каждая запись создает новую версию секрета. Можно читать конкретную версию, восстанавливать удаленные версии и использовать CAS для предотвращения конфликтов.

### Как мониторить Vault?

Используйте метрики Vault:
- **Vault Sealed** - Состояние Vault
- **Read/Write Requests** - Количество операций
- **Active Tokens** - Количество активных токенов
- **Average Latency** - Средняя latency обработки
- **Error Rate** - Процент ошибок

### Как работает Connection Rules?

Connection Rules автоматически настраивают Vault при подключении компонентов:
- Компоненты могут подключаться к Vault для получения секретов
- Vault автоматически настраивается для работы с компонентами
- Адреса и токены могут автоматически настраиваться

---

## Дополнительные ресурсы

- [HashiCorp Vault Documentation](https://developer.hashicorp.com/vault/docs)
- [Vault Architecture](https://developer.hashicorp.com/vault/docs/internals/architecture)
- [Vault API Documentation](https://developer.hashicorp.com/vault/api-docs)
- [KV Secrets Engine](https://developer.hashicorp.com/vault/docs/secrets/kv)
- [KV v1 vs v2](https://developer.hashicorp.com/vault/docs/secrets/kv/kv-v2)
- [Transit Secrets Engine](https://developer.hashicorp.com/vault/docs/secrets/transit)
- [Vault Policies](https://developer.hashicorp.com/vault/docs/concepts/policies)
- [Vault Authentication](https://developer.hashicorp.com/vault/docs/auth)

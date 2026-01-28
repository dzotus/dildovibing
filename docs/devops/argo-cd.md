# Argo CD - Документация компонента

## Обзор

Argo CD - это декларативная система непрерывного развертывания (CD) для Kubernetes, основанная на принципах GitOps. Компонент Argo CD в системе симуляции полностью эмулирует поведение реального Argo CD, включая управление applications, repositories, projects, sync operations, health checks, RBAC, notifications, sync windows, ApplicationSets, поддержку Helm charts и OCI registries, интеграции с Git репозиториями и Kubernetes кластерами, webhook обработку и полный набор метрик производительности.

### Основные возможности

- ✅ **Application Management** - Управление Argo CD Applications с автоматической синхронизацией
- ✅ **Repository Management** - Управление Git, Helm и OCI репозиториями
- ✅ **Project Management** - Управление проектами с ограничениями доступа
- ✅ **Sync Operations** - Симуляция синхронизации с прогрессом, hooks и rollback
- ✅ **Health Checks** - Автоматические проверки здоровья applications
- ✅ **Sync Policy** - Поддержка automated, manual и sync-window политик
- ✅ **Sync Windows** - Ограничение времени синхронизации
- ✅ **Sync Hooks** - Поддержка PreSync, Sync, PostSync hooks
- ✅ **RBAC** - Role-Based Access Control для управления доступом
- ✅ **Notifications** - Уведомления через Slack, Email, PagerDuty, Webhook
- ✅ **ApplicationSets** - Генерация applications из шаблонов
- ✅ **Helm Support** - Поддержка Helm charts и repositories
- ✅ **OCI Support** - Поддержка OCI registries для Helm charts
- ✅ **Multi-Cluster** - Поддержка развертывания в несколько Kubernetes кластеров
- ✅ **Webhook Integration** - Обработка webhooks от GitLab, GitHub, Bitbucket
- ✅ **Интеграции** - Интеграция с Prometheus, Loki, Jaeger, Kubernetes, Git репозиториями
- ✅ **Метрики Argo CD** - Полный набор метрик производительности и использования

---

## Основные функции

### 1. Application Management (Управление applications)

**Описание:** Argo CD управляет applications - декларативными описаниями желаемого состояния Kubernetes ресурсов в Git репозитории.

**Структура Application:**
```json
{
  "name": "my-app",
  "namespace": "argocd",
  "project": "default",
  "repository": "https://github.com/example/my-app.git",
  "path": "k8s/",
  "targetRevision": "main",
  "destination": {
    "server": "https://kubernetes.default.svc",
    "namespace": "production"
  },
  "helm": {
    "chart": "nginx",
    "version": "1.2.3",
    "releaseName": "my-nginx",
    "values": {
      "replicaCount": 3
    },
    "valueFiles": ["values-production.yaml"]
  },
  "syncPolicy": {
    "type": "automated",
    "options": {
      "prune": true,
      "selfHeal": true
    }
  },
  "status": "synced",
  "health": "healthy",
  "lastSync": 1609459200000,
  "lastSyncDuration": 30000,
  "revision": "abc123def456789...",
  "sourceRevision": "abc123def456789...",
  "resources": [
    {
      "kind": "Deployment",
      "name": "my-app-deployment",
      "namespace": "production",
      "status": "synced",
      "health": "healthy"
    }
  ],
  "hooks": [
    {
      "name": "pre-migration",
      "kind": "Job",
      "phase": "PreSync",
      "status": "success",
      "deletePolicy": "HookSucceeded"
    }
  ]
}
```

**Параметры Application:**
- **name** - Имя application (обязательно, уникальное)
- **namespace** - Namespace Argo CD (опционально, по умолчанию: `argocd`)
- **project** - Имя проекта (опционально, по умолчанию: `default`)
- **repository** - URL или имя репозитория (обязательно)
- **path** - Путь в репозитории (для Git) или имя chart (для Helm) (опционально, по умолчанию: `.`)
- **targetRevision** - Ветка/тег/commit (для Git) или версия chart (для Helm) (опционально, по умолчанию: `main` для Git, `latest` для Helm)
- **destination** - Целевой Kubernetes кластер и namespace (обязательно)
  - **server** - URL Kubernetes API server (опционально, по умолчанию: `https://kubernetes.default.svc`)
  - **namespace** - Целевой namespace (опционально, по умолчанию: namespace application)
- **helm** - Конфигурация Helm chart (опционально, только для Helm repositories)
- **oci** - Конфигурация OCI chart (опционально, только для OCI repositories)
- **syncPolicy** - Политика синхронизации (опционально, по умолчанию: `manual`)
- **status** - Статус синхронизации: `synced`, `outofsync`, `progressing`, `degraded`, `suspended`, `unknown`
- **health** - Статус здоровья: `healthy`, `degraded`, `progressing`, `suspended`, `missing`, `unknown`
- **lastSync** - Время последней синхронизации (timestamp, опционально)
- **lastSyncDuration** - Длительность последней синхронизации в миллисекундах (опционально)
- **revision** - Текущая развернутая ревизия (опционально)
- **sourceRevision** - Ревизия в source репозитории (опционально)
- **resources** - Список Kubernetes ресурсов (опционально)
- **hooks** - Список sync hooks (опционально)
- **history** - История развертываний (опционально)

**Статусы Application:**
- **synced** - Application синхронизирован с Git репозиторием
- **outofsync** - Application отличается от Git репозитория
- **progressing** - Синхронизация выполняется
- **degraded** - Application в деградированном состоянии
- **suspended** - Application приостановлен
- **unknown** - Статус неизвестен

**Health Status:**
- **healthy** - Все ресурсы здоровы
- **degraded** - Некоторые ресурсы деградированы
- **progressing** - Ресурсы в процессе обновления
- **suspended** - Application приостановлен
- **missing** - Ресурсы отсутствуют
- **unknown** - Статус здоровья неизвестен

### 2. Repository Management (Управление репозиториями)

**Описание:** Argo CD управляет репозиториями - источниками конфигураций для applications.

**Структура Repository:**
```json
{
  "name": "my-git-repo",
  "url": "https://github.com/example/my-app.git",
  "type": "git",
  "username": "git-user",
  "password": "secret-password",
  "sshPrivateKey": "-----BEGIN RSA PRIVATE KEY-----...",
  "insecure": false,
  "enableLfs": true,
  "enableOci": false,
  "proxy": "http://proxy.example.com:8080",
  "project": "default",
  "lastVerifiedAt": 1609459200000,
  "connectionStatus": "successful",
  "lastConnectionError": null,
  "helmCharts": [
    {
      "name": "nginx",
      "versions": ["1.2.3", "1.2.2", "1.2.1"],
      "description": "NGINX Helm chart",
      "appVersion": "1.21.0",
      "home": "https://github.com/nginx/nginx",
      "maintainers": [
        {
          "name": "NGINX Team",
          "email": "nginx@example.com"
        }
      ]
    }
  ],
  "chartsLastUpdated": 1609459200000,
  "ociCharts": [
    {
      "name": "bitnamicharts/nginx",
      "registry": "registry-1.docker.io",
      "versions": ["15.9.0", "15.8.0"],
      "description": "NGINX OCI chart",
      "appVersion": "1.21.0"
    }
  ],
  "ociChartsLastUpdated": 1609459200000
}
```

**Параметры Repository:**
- **name** - Имя репозитория (обязательно, уникальное)
- **url** - URL репозитория (обязательно)
- **type** - Тип репозитория: `git`, `helm`, `oci` (по умолчанию: `git`)
- **username** - Имя пользователя для аутентификации (опционально)
- **password** - Пароль для аутентификации (опционально)
- **sshPrivateKey** - SSH приватный ключ (опционально, для SSH Git репозиториев)
- **insecure** - Разрешить insecure соединения (по умолчанию: `false`)
- **enableLfs** - Включить Git LFS (по умолчанию: `false`)
- **enableOci** - Включить OCI поддержку (по умолчанию: `false`)
- **proxy** - URL прокси сервера (опционально)
- **project** - Имя проекта (опционально)
- **lastVerifiedAt** - Время последней проверки соединения (timestamp, опционально)
- **connectionStatus** - Статус соединения: `successful`, `failed`, `unknown`
- **lastConnectionError** - Последняя ошибка соединения (опционально)
- **helmCharts** - Список Helm charts (только для Helm repositories, опционально)
- **chartsLastUpdated** - Время последнего обновления списка charts (timestamp, опционально)
- **ociCharts** - Список OCI charts (только для OCI repositories, опционально)
- **ociChartsLastUpdated** - Время последнего обновления списка OCI charts (timestamp, опционально)

**Типы репозиториев:**
- **git** - Git репозиторий (GitHub, GitLab, Bitbucket, etc.)
- **helm** - Helm chart repository
- **oci** - OCI registry (Docker Hub, Harbor, etc.)

**Connection Status:**
- **successful** - Соединение успешно установлено
- **failed** - Соединение не удалось установить
- **unknown** - Статус соединения неизвестен

### 3. Project Management (Управление проектами)

**Описание:** Argo CD управляет projects - логическими группами applications с ограничениями доступа.

**Структура Project:**
```json
{
  "name": "production",
  "description": "Production environment project",
  "sourceRepos": [
    "https://github.com/example/*",
    "https://gitlab.com/example/*"
  ],
  "destinations": [
    {
      "server": "https://kubernetes.default.svc",
      "namespace": "production"
    },
    {
      "server": "https://k8s-prod.example.com",
      "namespace": "*"
    }
  ],
  "clusterResourceWhitelist": [
    {
      "group": "",
      "kind": "Namespace"
    },
    {
      "group": "rbac.authorization.k8s.io",
      "kind": "ClusterRole"
    }
  ],
  "namespaceResourceWhitelist": [
    {
      "group": "",
      "kind": "*"
    }
  ],
  "roles": [
    {
      "name": "admin",
      "description": "Project admin role",
      "policies": [
        "p, proj:production:admin, applications, *, production/*, allow",
        "p, proj:production:admin, repositories, get, production/*, allow"
      ],
      "groups": ["production-admins"]
    }
  ]
}
```

**Параметры Project:**
- **name** - Имя проекта (обязательно, уникальное)
- **description** - Описание проекта (опционально)
- **sourceRepos** - Разрешенные source репозитории (массив URL/паттернов, опционально)
- **destinations** - Разрешенные destination кластеры и namespaces (массив, опционально)
- **clusterResourceWhitelist** - Whitelist для cluster-scoped ресурсов (массив, опционально)
- **namespaceResourceWhitelist** - Whitelist для namespace-scoped ресурсов (массив, опционально)
- **roles** - RBAC роли проекта (массив, опционально)

**Source Repos:**
- Поддержка wildcards: `https://github.com/example/*`
- Поддержка конкретных репозиториев: `https://github.com/example/my-app.git`

**Destinations:**
- Поддержка wildcards для namespace: `namespace: "*"`
- Поддержка конкретных namespaces: `namespace: "production"`

**Resource Whitelist:**
- **clusterResourceWhitelist** - Разрешенные cluster-scoped ресурсы (Namespace, ClusterRole, etc.)
- **namespaceResourceWhitelist** - Разрешенные namespace-scoped ресурсы (Deployment, Service, etc.)
- Поддержка wildcards: `kind: "*"`

### 4. Sync Operations (Операции синхронизации)

**Описание:** Argo CD выполняет sync operations для синхронизации applications с Git репозиторием.

**Структура Sync Operation:**
```json
{
  "id": "sync-op-123",
  "application": "my-app",
  "startedAt": 1609459200000,
  "finishedAt": 1609459260000,
  "status": "success",
  "phase": "sync",
  "currentHookPhase": null,
  "hooks": [
    {
      "name": "pre-migration",
      "phase": "PreSync",
      "status": "success",
      "startedAt": 1609459200000,
      "finishedAt": 1609459205000,
      "error": null
    },
    {
      "name": "post-deployment",
      "phase": "PostSync",
      "status": "success",
      "startedAt": 1609459255000,
      "finishedAt": 1609459260000,
      "error": null
    }
  ],
  "resources": [
    {
      "kind": "Deployment",
      "name": "my-app-deployment",
      "namespace": "production",
      "status": "synced",
      "message": "Successfully synced"
    },
    {
      "kind": "Service",
      "name": "my-app-service",
      "namespace": "production",
      "status": "synced",
      "message": "Successfully synced"
    }
  ],
  "syncOptions": {
    "prune": true,
    "force": false,
    "dryRun": false
  },
  "prunedResources": 2,
  "error": null
}
```

**Параметры Sync Operation:**
- **id** - Уникальный идентификатор операции (генерируется автоматически)
- **application** - Имя application (обязательно)
- **startedAt** - Время начала синхронизации (timestamp, обязательно)
- **finishedAt** - Время завершения синхронизации (timestamp, опционально)
- **status** - Статус операции: `running`, `success`, `failed`, `error`
- **phase** - Фаза синхронизации: `presync`, `sync`, `postsync`, `syncfail`, `hook`, `rollback`, `prune`
- **currentHookPhase** - Текущая фаза hook (опционально)
- **hooks** - Список sync hooks (массив, опционально)
- **resources** - Список синхронизированных ресурсов (массив, опционально)
- **syncOptions** - Опции синхронизации (опционально)
- **prunedResources** - Количество удаленных ресурсов (опционально)
- **error** - Ошибка синхронизации (опционально)

**Статусы Sync Operation:**
- **running** - Синхронизация выполняется
- **success** - Синхронизация успешно завершена
- **failed** - Синхронизация провалилась
- **error** - Ошибка синхронизации

**Phases:**
- **presync** - PreSync hooks выполняются
- **sync** - Основная синхронизация ресурсов
- **postsync** - PostSync hooks выполняются
- **syncfail** - Ошибка синхронизации
- **hook** - Выполнение hooks
- **rollback** - Откат изменений
- **prune** - Удаление ресурсов

**Sync Options:**
- **prune** - Удалять ресурсы, которых больше нет в Git (по умолчанию: `false`)
- **force** - Принудительная синхронизация (по умолчанию: `false`)
- **dryRun** - Пробный запуск без изменений (по умолчанию: `false`)

### 5. Sync Policy (Политика синхронизации)

**Описание:** Argo CD поддерживает различные политики синхронизации для автоматизации развертываний.

**Типы Sync Policy:**
- **automated** - Автоматическая синхронизация при изменениях в Git
- **manual** - Ручная синхронизация (по умолчанию)
- **sync-window** - Синхронизация только в разрешенные временные окна

**Структура Sync Policy:**
```json
{
  "type": "automated",
  "options": {
    "prune": true,
    "selfHeal": true
  }
}
```

**Опции Sync Policy:**
- **prune** - Автоматически удалять ресурсы, которых больше нет в Git (по умолчанию: `false`)
- **selfHeal** - Автоматически восстанавливать drift (когда ресурсы изменены вручную в кластере) (по умолчанию: `false`)

**Automated Sync Policy:**
- Автоматически синхронизирует application при изменениях в Git репозитории
- Поддерживает опции `prune` и `selfHeal`
- Может быть ограничена sync windows

**Manual Sync Policy:**
- Требует ручного запуска синхронизации
- Опции `prune` и `selfHeal` не применяются

**Sync-Window Policy:**
- Синхронизация разрешена только в определенные временные окна
- Может быть ограничена по времени (например, только в рабочие часы)
- Manual sync может обойти sync windows (если настроено)

### 6. Sync Windows (Временные окна синхронизации)

**Описание:** Argo CD поддерживает sync windows для ограничения времени синхронизации.

**Структура Sync Window:**
```json
{
  "name": "business-hours",
  "description": "Allow syncs during business hours",
  "schedule": "09:00-17:00",
  "duration": null,
  "kind": "allow",
  "applications": ["my-app", "another-app"],
  "projects": ["production"],
  "manualSync": true,
  "enabled": true
}
```

**Параметры Sync Window:**
- **name** - Имя sync window (обязательно, уникальное)
- **description** - Описание sync window (опционально)
- **schedule** - Расписание в формате "HH:MM-HH:MM" или cron выражение (обязательно)
- **duration** - Длительность окна в миллисекундах (опционально, для cron)
- **kind** - Тип окна: `allow` (разрешить) или `deny` (запретить) (по умолчанию: `allow`)
- **applications** - Список applications (массив имен, опционально)
- **projects** - Список projects (массив имен, опционально)
- **manualSync** - Разрешить manual sync во время окна (по умолчанию: `true`)
- **enabled** - Включено ли окно (по умолчанию: `true`)

**Форматы Schedule:**
- **Time Range:** `"09:00-17:00"` - С 9:00 до 17:00 каждый день
- **Cron Expression:** `"0 9 * * 1-5"` - В 9:00 с понедельника по пятницу

**Типы Sync Windows:**
- **allow** - Разрешить синхронизацию только в это окно
- **deny** - Запретить синхронизацию в это окно

**Применение:**
- Если указаны `applications` - применяется только к указанным applications
- Если указаны `projects` - применяется ко всем applications в проектах
- Если не указаны ни `applications`, ни `projects` - применяется ко всем applications

### 7. Sync Hooks (Хуки синхронизации)

**Описание:** Argo CD поддерживает sync hooks для выполнения действий до, во время и после синхронизации.

**Структура Sync Hook:**
```json
{
  "name": "pre-migration",
  "kind": "Job",
  "phase": "PreSync",
  "status": "success",
  "startedAt": 1609459200000,
  "finishedAt": 1609459205000,
  "duration": 5000,
  "error": null,
  "deletePolicy": "HookSucceeded"
}
```

**Параметры Sync Hook:**
- **name** - Имя hook ресурса (обязательно)
- **kind** - Тип Kubernetes ресурса: `Pod`, `Job`, `Argo Workflow`, etc. (обязательно)
- **phase** - Фаза выполнения: `PreSync`, `Sync`, `PostSync`, `SyncFail`, `PreDelete`, `PostDelete`, `Skip` (обязательно)
- **status** - Статус выполнения: `pending`, `running`, `success`, `failed`, `skipped`
- **startedAt** - Время начала выполнения (timestamp, опционально)
- **finishedAt** - Время завершения выполнения (timestamp, опционально)
- **duration** - Длительность выполнения в миллисекундах (опционально)
- **error** - Ошибка выполнения (опционально)
- **deletePolicy** - Политика удаления: `HookSucceeded`, `HookFailed`, `BeforeHookCreation` (опционально)

**Hook Phases:**
- **PreSync** - Выполняется до синхронизации ресурсов
- **Sync** - Выполняется во время синхронизации (редко используется)
- **PostSync** - Выполняется после успешной синхронизации
- **SyncFail** - Выполняется при ошибке синхронизации
- **PreDelete** - Выполняется перед удалением ресурсов
- **PostDelete** - Выполняется после удаления ресурсов
- **Skip** - Пропустить hook

**Delete Policies:**
- **HookSucceeded** - Удалить hook после успешного выполнения
- **HookFailed** - Удалить hook после неудачного выполнения
- **BeforeHookCreation** - Удалить hook перед созданием нового

### 8. RBAC (Role-Based Access Control)

**Описание:** Argo CD поддерживает RBAC для управления доступом к resources.

**Структура Role:**
```json
{
  "name": "admin",
  "description": "Administrator role",
  "policies": [
    "p, role:admin, applications, *, */*, allow",
    "p, role:admin, repositories, *, */*, allow",
    "p, role:admin, clusters, *, */*, allow"
  ],
  "groups": ["admins"],
  "jwtGroups": ["admin-group"]
}
```

**Параметры Role:**
- **name** - Имя роли (обязательно, уникальное)
- **description** - Описание роли (опционально)
- **policies** - Список RBAC политик (массив строк, обязательно)
- **groups** - LDAP/OIDC группы, имеющие эту роль (массив строк, опционально)
- **jwtGroups** - JWT группы (массив строк, опционально)

**Структура Policy:**
```json
{
  "action": "get",
  "resource": "applications",
  "effect": "allow",
  "object": "my-app"
}
```

**Параметры Policy:**
- **action** - Действие: `get`, `create`, `update`, `delete`, `sync`, `override`, etc. (обязательно)
- **resource** - Ресурс: `applications`, `repositories`, `clusters`, `projects`, `*` (обязательно)
- **effect** - Эффект: `allow` или `deny` (обязательно)
- **object** - Конкретный объект или паттерн (опционально)

**RBAC Policy Format:**
- Формат: `p, <role>, <resource>, <action>, <object>, <effect>`
- Примеры:
  - `p, role:admin, applications, *, */*, allow` - Разрешить все действия для всех applications
  - `p, role:developer, applications, get, my-app/*, allow` - Разрешить get для applications в my-app проекте
  - `p, role:readonly, applications, get, */*, allow` - Разрешить только чтение для всех applications

### 9. Notifications (Уведомления)

**Описание:** Argo CD поддерживает уведомления о событиях через различные каналы.

**Структура Notification Channel:**
```json
{
  "name": "slack-production",
  "type": "slack",
  "enabled": true,
  "config": {
    "webhook": "https://hooks.slack.com/services/...",
    "channel": "#production-alerts"
  },
  "triggers": [
    {
      "event": "sync-success",
      "condition": "app.project == 'production'"
    },
    {
      "event": "sync-failed",
      "condition": null
    },
    {
      "event": "health-degraded",
      "condition": null
    }
  ]
}
```

**Параметры Notification Channel:**
- **name** - Имя канала (обязательно, уникальное)
- **type** - Тип канала: `slack`, `email`, `pagerduty`, `webhook`, `opsgenie`, `msteams` (обязательно)
- **enabled** - Включен ли канал (по умолчанию: `true`)
- **config** - Конфигурация канала (объект, опционально)
- **triggers** - Список триггеров (массив, обязательно)

**Типы Notification Channels:**
- **slack** - Slack webhook
- **email** - Email уведомления
- **pagerduty** - PagerDuty integration
- **webhook** - Generic webhook
- **opsgenie** - Opsgenie integration
- **msteams** - Microsoft Teams webhook

**Event Types:**
- **sync-success** - Успешная синхронизация
- **sync-failed** - Неудачная синхронизация
- **health-degraded** - Деградация здоровья
- **health-progressing** - Прогресс восстановления здоровья
- **sync-running** - Синхронизация выполняется
- **app-created** - Application создан
- **app-deleted** - Application удален

**Triggers:**
- **event** - Тип события (обязательно)
- **condition** - Условие для фильтрации (опционально, выражение)

### 10. ApplicationSets

**Описание:** Argo CD ApplicationSets позволяют генерировать applications из шаблонов.

**Структура ApplicationSet:**
```json
{
  "name": "multi-env-apps",
  "namespace": "argocd",
  "generators": [
    {
      "type": "list",
      "elements": [
        { "env": "dev", "cluster": "dev-cluster" },
        { "env": "staging", "cluster": "staging-cluster" },
        { "env": "production", "cluster": "prod-cluster" }
      ]
    }
  ],
  "template": {
    "name": "my-app-{{env}}",
    "namespace": "argocd",
    "project": "default",
    "repository": "https://github.com/example/my-app.git",
    "path": "k8s/{{env}}",
    "targetRevision": "main",
    "destination": {
      "server": "{{cluster}}",
      "namespace": "{{env}}"
    },
    "syncPolicy": {
      "type": "automated",
      "options": {
        "prune": true
      }
    }
  },
  "syncPolicy": {
    "type": "automated"
  },
  "preserveResourcesOnDeletion": false,
  "goTemplate": false,
  "enabled": true
}
```

**Параметры ApplicationSet:**
- **name** - Имя ApplicationSet (обязательно, уникальное)
- **namespace** - Namespace Argo CD (опционально, по умолчанию: `argocd`)
- **generators** - Генераторы applications (массив, обязательно)
- **template** - Шаблон application (обязательно)
- **syncPolicy** - Политика синхронизации для ApplicationSet (опционально)
- **preserveResourcesOnDeletion** - Сохранять ресурсы при удалении (по умолчанию: `false`)
- **goTemplate** - Использовать Go templates вместо стандартных (по умолчанию: `false`)
- **enabled** - Включен ли ApplicationSet (по умолчанию: `true`)

**Generator Types:**
- **list** - Список элементов
- **git** - Генерация из Git репозитория (directories, files)
- **cluster** - Генерация из Kubernetes кластеров

**List Generator:**
```json
{
  "type": "list",
  "elements": [
    { "env": "dev", "cluster": "dev-cluster" },
    { "env": "staging", "cluster": "staging-cluster" }
  ]
}
```

**Git Generator:**
```json
{
  "type": "git",
  "repoURL": "https://github.com/example/my-app.git",
  "revision": "main",
  "directories": [
    { "path": "apps/*" },
    { "path": "services/*", "exclude": true }
  ],
  "files": [
    { "path": "environments/*.yaml" }
  ]
}
```

**Cluster Generator:**
```json
{
  "type": "cluster",
  "selector": {
    "matchLabels": {
      "environment": "production"
    }
  },
  "values": {
    "cluster": "{{name}}"
  }
}
```

### 11. Helm Support (Поддержка Helm)

**Описание:** Argo CD поддерживает Helm charts для развертывания applications.

**Структура Helm Config:**
```json
{
  "chart": "nginx",
  "version": "1.2.3",
  "releaseName": "my-nginx",
  "values": {
    "replicaCount": 3,
    "image": {
      "repository": "nginx",
      "tag": "1.21.0"
    }
  },
  "valueFiles": ["values-production.yaml"],
  "parameters": [
    {
      "name": "image.tag",
      "value": "1.21.0",
      "forceString": false
    }
  ],
  "skipCrds": false
}
```

**Параметры Helm Config:**
- **chart** - Имя Helm chart (обязательно)
- **version** - Версия chart (опционально, по умолчанию: `latest`)
- **releaseName** - Имя Helm release (опционально, по умолчанию: имя application)
- **values** - Переопределение values (объект или YAML строка, опционально)
- **valueFiles** - Пути к файлам values в репозитории (массив строк, опционально)
- **parameters** - Параметры Helm (массив, опционально)
- **skipCrds** - Пропустить CRDs при установке (по умолчанию: `false`)

**Helm Repository:**
- Helm repositories должны быть добавлены как repositories с типом `helm`
- Argo CD автоматически обнаруживает доступные charts в Helm repository
- Charts отображаются в UI при выборе Helm repository

### 12. OCI Support (Поддержка OCI)

**Описание:** Argo CD поддерживает OCI registries для Helm charts.

**Структура OCI Config:**
```json
{
  "registry": "registry-1.docker.io",
  "chart": "bitnamicharts/nginx",
  "version": "15.9.0",
  "releaseName": "my-nginx",
  "values": {
    "replicaCount": 3
  },
  "valueFiles": ["values-production.yaml"],
  "parameters": [
    {
      "name": "image.tag",
      "value": "1.21.0",
      "forceString": false
    }
  ],
  "skipCrds": false
}
```

**Параметры OCI Config:**
- **registry** - URL OCI registry (обязательно)
- **chart** - Имя OCI chart/image (обязательно)
- **version** - Версия/tag chart (опционально, по умолчанию: `latest`)
- **releaseName** - Имя Helm release (опционально, по умолчанию: имя application)
- **values** - Переопределение values (объект или YAML строка, опционально)
- **valueFiles** - Пути к файлам values в репозитории (массив строк, опционально)
- **parameters** - Параметры Helm (массив, опционально)
- **skipCrds** - Пропустить CRDs при установке (по умолчанию: `false`)

**OCI Repository:**
- OCI repositories должны быть добавлены как repositories с типом `oci`
- Argo CD автоматически обнаруживает доступные charts в OCI registry
- Charts отображаются в UI при выборе OCI repository

---

## Руководство пользователя

### Быстрый старт

1. **Добавьте компонент Argo CD на канвас:**
   - Перетащите компонент "Argo CD" из библиотеки компонентов на канвас
   - Компонент будет создан с дефолтной конфигурацией

2. **Настройте базовые параметры:**
   - Откройте конфигурацию компонента
   - Настройте `serverUrl` (по умолчанию: `https://argocd.example.com`)
   - Включите `enableHealthChecks` (по умолчанию: `true`)
   - Включите `enableRBAC` (по умолчанию: `true`)

3. **Добавьте Repository:**
   - Перейдите на вкладку "Repositories"
   - Нажмите "Add Repository"
   - Заполните URL, тип (git/helm/oci), credentials
   - Сохраните repository

4. **Создайте Application:**
   - Перейдите на вкладку "Applications"
   - Нажмите "Add Application"
   - Заполните конфигурацию application (name, repository, path, destination)
   - Настройте sync policy
   - Сохраните application

5. **Запустите симуляцию:**
   - Нажмите кнопку "Start" в toolbar
   - Applications начнут синхронизироваться автоматически (если sync policy = automated)
   - Наблюдайте за синхронизацией в реальном времени

### Работа с Applications

#### Создание Application

1. **Через UI:**
   - Откройте вкладку "Applications"
   - Нажмите "Add Application"
   - Заполните конфигурацию:
     - Name (уникальное имя)
     - Repository (выберите из списка или введите URL)
     - Path (путь в репозитории или имя Helm chart)
     - Target Revision (ветка/тег/версия)
     - Destination (Kubernetes server и namespace)
     - Sync Policy (automated/manual/sync-window)
   - Сохраните application

2. **Через конфигурацию:**
   - Добавьте application в конфигурацию компонента:
   ```json
   {
     "applications": [
       {
         "name": "my-app",
         "repository": "https://github.com/example/my-app.git",
         "path": "k8s/",
         "targetRevision": "main",
         "destination": {
           "server": "https://kubernetes.default.svc",
           "namespace": "production"
         },
         "syncPolicy": {
           "type": "automated",
           "options": {
             "prune": true,
             "selfHeal": true
           }
         }
       }
     ]
   }
   ```

#### Синхронизация Application

1. **Автоматическая синхронизация:**
   - Applications с sync policy `automated` синхронизируются автоматически при изменениях в Git
   - Webhooks от Git репозиториев автоматически запускают синхронизацию
   - Sync windows могут ограничивать время синхронизации

2. **Ручная синхронизация:**
   - Выберите application в списке
   - Нажмите кнопку "Sync" (▶)
   - Выберите опции синхронизации (prune, force, dry-run)
   - Нажмите "Sync" для запуска

3. **Rollback:**
   - Выберите application в списке
   - Откройте детали application
   - Перейдите на вкладку "History"
   - Выберите предыдущую ревизию
   - Нажмите "Rollback"

#### Просмотр Application

1. **Список Applications:**
   - Откройте вкладку "Applications"
   - Список показывает все applications
   - Фильтры по статусу, health, project
   - Поиск по имени, repository, project

2. **Детали Application:**
   - Кликните на application в списке
   - Откроется детальная информация:
     - Статус и health
     - Repository и path
     - Destination и sync policy
     - Resource tree
     - Sync history
     - Events timeline

3. **Resource Tree:**
   - В деталях application откройте раздел "Resource Tree"
   - Показываются все Kubernetes ресурсы
   - Статус и health каждого ресурса
   - Клик по ресурсу показывает детали

### Работа с Repositories

#### Добавление Repository

1. **Git Repository:**
   - Откройте вкладку "Repositories"
   - Нажмите "Add Repository"
   - Заполните конфигурацию:
     - Name (имя repository)
     - URL (URL Git репозитория)
     - Type: `git`
     - Username/Password или SSH Private Key (для приватных репозиториев)
   - Сохраните repository

2. **Helm Repository:**
   - Откройте вкладку "Repositories"
   - Нажмите "Add Repository"
   - Заполните конфигурацию:
     - Name (имя repository)
     - URL (URL Helm repository)
     - Type: `helm`
     - Username/Password (если требуется)
   - Сохраните repository
   - Argo CD автоматически обнаружит доступные charts

3. **OCI Repository:**
   - Откройте вкладку "Repositories"
   - Нажмите "Add Repository"
   - Заполните конфигурацию:
     - Name (имя repository)
     - URL (URL OCI registry)
     - Type: `oci`
     - Username/Password (если требуется)
   - Сохраните repository
   - Argo CD автоматически обнаружит доступные charts

#### Управление Repositories

1. **Просмотр Repositories:**
   - Откройте вкладку "Repositories"
   - Список показывает все repositories
   - Статус соединения, тип, последняя проверка
   - Для Helm/OCI repositories показываются доступные charts

2. **Проверка соединения:**
   - Выберите repository в списке
   - Нажмите кнопку "Refresh" (↻)
   - Argo CD проверит соединение с repository
   - Статус соединения обновится

3. **Редактирование Repository:**
   - Выберите repository в списке
   - Нажмите кнопку "Edit" (✎)
   - Измените конфигурацию
   - Сохраните изменения

4. **Удаление Repository:**
   - Выберите repository в списке
   - Нажмите кнопку "Delete" (🗑)
   - Подтвердите удаление
   - Примечание: Repository не может быть удален, если используется в applications

### Работа с Projects

#### Создание Project

1. **Через UI:**
   - Откройте вкладку "Projects"
   - Нажмите "Add Project"
   - Заполните конфигурацию:
     - Name (уникальное имя)
     - Description (описание проекта)
     - Source Repos (разрешенные репозитории)
     - Destinations (разрешенные кластеры и namespaces)
     - Resource Whitelists (разрешенные ресурсы)
   - Сохраните project

2. **Через конфигурацию:**
   - Добавьте project в конфигурацию компонента:
   ```json
   {
     "projects": [
       {
         "name": "production",
         "description": "Production environment project",
         "sourceRepos": ["https://github.com/example/*"],
         "destinations": [
           {
             "server": "https://kubernetes.default.svc",
             "namespace": "production"
           }
         ]
       }
     ]
   }
   ```

#### Управление Projects

1. **Просмотр Projects:**
   - Откройте вкладку "Projects"
   - Список показывает все projects
   - Количество applications в проекте
   - Ограничения доступа

2. **Редактирование Project:**
   - Выберите project в списке
   - Нажмите кнопку "Edit" (✎)
   - Измените конфигурацию
   - Сохраните изменения

3. **Удаление Project:**
   - Выберите project в списке
   - Нажмите кнопку "Delete" (🗑)
   - Подтвердите удаление
   - Примечание: Project не может быть удален, если используется в applications

### Работа с Sync Windows

#### Создание Sync Window

1. **Через UI:**
   - Откройте вкладку "Settings"
   - Перейдите в раздел "Sync Windows"
   - Нажмите "Add Sync Window"
   - Заполните конфигурацию:
     - Name (уникальное имя)
     - Description (описание)
     - Schedule (время в формате "HH:MM-HH:MM" или cron)
     - Kind (allow/deny)
     - Applications/Projects (применение)
     - Manual Sync (разрешить manual sync)
   - Сохраните sync window

2. **Через конфигурацию:**
   - Добавьте sync window в конфигурацию компонента:
   ```json
   {
     "syncWindows": [
       {
         "name": "business-hours",
         "description": "Allow syncs during business hours",
         "schedule": "09:00-17:00",
         "kind": "allow",
         "applications": ["my-app"],
         "manualSync": true,
         "enabled": true
       }
     ]
   }
   ```

#### Управление Sync Windows

1. **Просмотр Sync Windows:**
   - Откройте вкладку "Settings"
   - Перейдите в раздел "Sync Windows"
   - Список показывает все sync windows
   - Расписание, тип, применение, статус

2. **Редактирование Sync Window:**
   - Выберите sync window в списке
   - Нажмите кнопку "Edit" (✎)
   - Измените конфигурацию
   - Сохраните изменения

3. **Удаление Sync Window:**
   - Выберите sync window в списке
   - Нажмите кнопку "Delete" (🗑)
   - Подтвердите удаление

4. **Активация/Деактивация Sync Window:**
   - Выберите sync window в списке
   - Переключите "Enabled" switch
   - Sync window будет активирован/деактивирован

---

## Руководство администратора

### Рекомендации по конфигурации

#### Production конфигурация

**Рекомендуемая конфигурация для production:**

```json
{
  "serverUrl": "https://argocd.example.com",
  "enableSSO": true,
  "ssoProvider": "oidc",
  "enableRBAC": true,
  "enableSyncPolicy": true,
  "autoSync": false,
  "syncPolicy": "manual",
  "enableHealthChecks": true,
  "enableNotifications": true,
  "notificationChannels": ["slack", "pagerduty"],
  "syncWindows": [
    {
      "name": "business-hours",
      "schedule": "09:00-17:00",
      "kind": "allow",
      "manualSync": true,
      "enabled": true
    }
  ],
  "projects": [
    {
      "name": "production",
      "sourceRepos": ["https://github.com/example/*"],
      "destinations": [
        {
          "server": "https://kubernetes.default.svc",
          "namespace": "production"
        }
      ]
    }
  ]
}
```

**Ключевые параметры:**
- **enableSSO**: `true` для production аутентификации
- **enableRBAC**: `true` для управления доступом
- **syncPolicy**: `manual` для контроля развертываний
- **syncWindows**: Ограничение времени синхронизации
- **projects**: Изоляция production окружений

#### Development конфигурация

**Рекомендуемая конфигурация для development:**

```json
{
  "serverUrl": "https://argocd-dev.example.com",
  "enableSSO": false,
  "enableRBAC": true,
  "enableSyncPolicy": true,
  "autoSync": true,
  "syncPolicy": {
    "type": "automated",
    "options": {
      "prune": true
    }
  },
  "enableHealthChecks": true,
  "enableNotifications": false
}
```

**Ключевые параметры:**
- **enableSSO**: `false` для упрощения (или `true` для соответствия production)
- **autoSync**: `true` для автоматической синхронизации
- **syncPolicy**: `automated` для быстрого развертывания
- **enableNotifications**: `false` для уменьшения шума

### Оптимизация производительности

#### Настройка Sync Policy

1. **Automated Sync:**
   - Используйте для development и staging окружений
   - Включите `prune` для автоматической очистки
   - Включите `selfHeal` для автоматического восстановления drift
   - Осторожно используйте в production

2. **Manual Sync:**
   - Используйте для production окружений
   - Требует ручного подтверждения развертываний
   - Более безопасный подход

3. **Sync Windows:**
   - Ограничьте время синхронизации для production
   - Используйте allow windows для разрешенного времени
   - Используйте deny windows для запрещенного времени

#### Настройка Health Checks

1. **Health Check Interval:**
   - По умолчанию: 5 минут
   - Уменьшите для критичных applications
   - Увеличьте для снижения нагрузки

2. **Health Check Timeout:**
   - Настройте timeout для health checks
   - Учитывайте время ответа Kubernetes API

#### Настройка Notifications

1. **Notification Channels:**
   - Настройте каналы для различных событий
   - Используйте фильтры для уменьшения шума
   - Группируйте уведомления по проектам

2. **Notification Triggers:**
   - Настройте триггеры для критичных событий
   - Используйте условия для фильтрации
   - Избегайте дублирования уведомлений

### Безопасность

#### RBAC настройка

1. **Роли:**
   - Создайте роли для различных уровней доступа
   - Используйте принцип наименьших привилегий
   - Разделяйте роли по проектам

2. **Политики:**
   - Настройте политики для ограничения доступа
   - Используйте wildcards для гибкости
   - Тестируйте политики перед применением

#### Repository Security

1. **Credentials:**
   - Используйте безопасное хранение credentials
   - Не храните credentials в конфигурации
   - Используйте secrets management

2. **Repository Access:**
   - Ограничьте доступ к repositories через projects
   - Используйте source repos whitelist
   - Проверяйте repository connections регулярно

#### Application Security

1. **Destination Restrictions:**
   - Ограничьте destinations через projects
   - Используйте destination whitelist
   - Проверяйте namespace access

2. **Resource Whitelist:**
   - Ограничьте разрешенные ресурсы
   - Используйте cluster и namespace resource whitelists
   - Запретите опасные ресурсы (например, ClusterRoleBinding)

### Мониторинг и алертинг

#### Метрики для мониторинга

1. **Application Metrics:**
   - `applicationsSynced` - Количество синхронизированных applications
   - `applicationsOutOfSync` - Количество out-of-sync applications
   - `applicationsDegraded` - Количество деградированных applications
   - `applicationsHealthy` - Количество здоровых applications

2. **Sync Metrics:**
   - `syncRate` - Количество синхронизаций в час
   - `averageSyncDuration` - Средняя длительность синхронизации
   - `syncOperationsSuccess` - Количество успешных синхронизаций
   - `syncOperationsFailed` - Количество неудачных синхронизаций

3. **Repository Metrics:**
   - `repositoriesConnected` - Количество подключенных repositories
   - `repositoriesFailed` - Количество repositories с ошибками соединения

#### Интеграция с Prometheus

1. **Экспорт метрик:**
   - Argo CD автоматически экспортирует метрики в Prometheus format
   - Метрики доступны через `exportPrometheusMetrics()`
   - Подключите Prometheus для scraping метрик

2. **Пример конфигурации Prometheus:**
   ```yaml
   scrape_configs:
     - job_name: 'argo-cd'
       static_configs:
         - targets: ['argo-cd:9090']
   ```

#### Интеграция с PagerDuty

1. **Настройка уведомлений:**
   - Создайте notification channel типа `pagerduty`
   - Настройте триггеры для критичных событий
   - Используйте условия для фильтрации

2. **Пример конфигурации:**
   ```json
   {
     "notificationChannelsConfig": [
       {
         "name": "pagerduty-production",
         "type": "pagerduty",
         "enabled": true,
         "config": {
           "serviceKey": "your-pagerduty-service-key"
         },
         "triggers": [
           {
             "event": "sync-failed",
             "condition": "app.project == 'production'"
           },
           {
             "event": "health-degraded",
             "condition": "app.project == 'production'"
           }
         ]
       }
     ]
   }
   ```

---

## Метрики и мониторинг

### Метрики компонента

Argo CD предоставляет следующие метрики компонента (через `ComponentMetrics`):

- **throughput** - Количество синхронизаций в секунду (syncRate / 3600)
- **latency** - Средняя длительность синхронизации в миллисекундах
- **utilization** - Использование (0-1, на основе количества running sync operations)
- **errorRate** - Процент неудачных синхронизаций (0-1, syncOperationsFailed / totalSyncOperations)

### Метрики Argo CD

Argo CD предоставляет следующие специфичные метрики (через `ArgoCDEngineMetrics`):

#### Application Metrics

- **applicationsTotal** - Общее количество applications (gauge)
- **applicationsSynced** - Количество синхронизированных applications (gauge)
- **applicationsOutOfSync** - Количество out-of-sync applications (gauge)
- **applicationsProgressing** - Количество applications в процессе синхронизации (gauge)
- **applicationsDegraded** - Количество деградированных applications (gauge)
- **applicationsHealthy** - Количество здоровых applications (gauge)

#### Sync Operation Metrics

- **syncOperationsTotal** - Общее количество sync operations (counter)
- **syncOperationsSuccess** - Количество успешных sync operations (counter)
- **syncOperationsFailed** - Количество неудачных sync operations (counter)
- **syncOperationsRunning** - Текущее количество running sync operations (gauge)
- **syncRate** - Количество синхронизаций в час (gauge)
- **averageSyncDuration** - Средняя длительность синхронизации в миллисекундах (gauge)

#### Repository Metrics

- **repositoriesTotal** - Общее количество repositories (gauge)
- **repositoriesConnected** - Количество подключенных repositories (gauge)
- **repositoriesFailed** - Количество repositories с ошибками соединения (gauge)

#### Project Metrics

- **projectsTotal** - Общее количество projects (gauge)

#### Request Metrics

- **requestsTotal** - Общее количество запросов (counter)
- **requestsErrors** - Количество ошибок запросов (counter)

### Prometheus Export

Argo CD экспортирует метрики в Prometheus format через `exportPrometheusMetrics()`. Метрики доступны в формате Prometheus exposition format:

```
# HELP argocd_applications_total Total number of applications
# TYPE argocd_applications_total gauge
argocd_applications_total{component_id="argo-cd-1",component_type="argo-cd"} 10 1609459200000

# HELP argocd_applications_synced Number of synced applications
# TYPE argocd_applications_synced gauge
argocd_applications_synced{component_id="argo-cd-1",component_type="argo-cd"} 8 1609459200000

...
```

---

## Примеры использования

### Пример 1: Простое Application

**Конфигурация:**
```json
{
  "applications": [
    {
      "name": "my-app",
      "repository": "https://github.com/example/my-app.git",
      "path": "k8s/",
      "targetRevision": "main",
      "destination": {
        "server": "https://kubernetes.default.svc",
        "namespace": "default"
      },
      "syncPolicy": "manual"
    }
  ]
}
```

**Описание:**
- Простое application с Git репозиторием
- Manual sync policy (требует ручного запуска)
- Развертывание в default namespace

### Пример 2: Application с Automated Sync

**Конфигурация:**
```json
{
  "applications": [
    {
      "name": "my-app",
      "repository": "https://github.com/example/my-app.git",
      "path": "k8s/",
      "targetRevision": "main",
      "destination": {
        "server": "https://kubernetes.default.svc",
        "namespace": "production"
      },
      "syncPolicy": {
        "type": "automated",
        "options": {
          "prune": true,
          "selfHeal": true
        }
      }
    }
  ]
}
```

**Описание:**
- Application с automated sync policy
- Автоматическая синхронизация при изменениях в Git
- Prune и self-heal включены
- Развертывание в production namespace

### Пример 3: Application с Helm Chart

**Конфигурация:**
```json
{
  "repositories": [
    {
      "name": "bitnami",
      "url": "https://charts.bitnami.com/bitnami",
      "type": "helm"
    }
  ],
  "applications": [
    {
      "name": "nginx",
      "repository": "bitnami",
      "path": "nginx",
      "targetRevision": "15.9.0",
      "destination": {
        "server": "https://kubernetes.default.svc",
        "namespace": "default"
      },
      "helm": {
        "chart": "nginx",
        "version": "15.9.0",
        "values": {
          "replicaCount": 3,
          "service": {
            "type": "LoadBalancer"
          }
        }
      },
      "syncPolicy": "manual"
    }
  ]
}
```

**Описание:**
- Application с Helm chart из Helm repository
- Использование Bitnami Helm repository
- Переопределение values для настройки chart
- Manual sync policy

### Пример 4: Application с Sync Windows

**Конфигурация:**
```json
{
  "syncWindows": [
    {
      "name": "business-hours",
      "description": "Allow syncs during business hours",
      "schedule": "09:00-17:00",
      "kind": "allow",
      "applications": ["my-app"],
      "manualSync": true,
      "enabled": true
    }
  ],
  "applications": [
    {
      "name": "my-app",
      "repository": "https://github.com/example/my-app.git",
      "path": "k8s/",
      "targetRevision": "main",
      "destination": {
        "server": "https://kubernetes.default.svc",
        "namespace": "production"
      },
      "syncPolicy": "sync-window"
    }
  ]
}
```

**Описание:**
- Application с sync-window policy
- Синхронизация разрешена только с 9:00 до 17:00
- Manual sync может обойти sync window
- Развертывание в production namespace

### Пример 5: ApplicationSet для Multi-Environment

**Конфигурация:**
```json
{
  "applicationSets": [
    {
      "name": "multi-env-apps",
      "generators": [
        {
          "type": "list",
          "elements": [
            { "env": "dev", "cluster": "https://dev-k8s.example.com" },
            { "env": "staging", "cluster": "https://staging-k8s.example.com" },
            { "env": "production", "cluster": "https://prod-k8s.example.com" }
          ]
        }
      ],
      "template": {
        "name": "my-app-{{env}}",
        "repository": "https://github.com/example/my-app.git",
        "path": "k8s/{{env}}",
        "targetRevision": "main",
        "destination": {
          "server": "{{cluster}}",
          "namespace": "{{env}}"
        },
        "syncPolicy": {
          "type": "automated",
          "options": {
            "prune": true
          }
        }
      },
      "syncPolicy": {
        "type": "automated"
      },
      "enabled": true
    }
  ]
}
```

**Описание:**
- ApplicationSet для развертывания в несколько окружений
- Генерация applications для dev, staging, production
- Разные кластеры и namespaces для каждого окружения
- Automated sync policy с prune

---

## FAQ

### Как создать application?

Откройте вкладку "Applications", нажмите "Add Application", заполните конфигурацию (name, repository, path, destination), настройте sync policy, сохраните application.

### Как синхронизировать application?

Выберите application в списке, нажмите кнопку "Sync" (▶), выберите опции синхронизации (prune, force, dry-run), нажмите "Sync" для запуска.

### Как настроить automated sync?

Установите sync policy в `automated`:
```json
{
  "syncPolicy": {
    "type": "automated",
    "options": {
      "prune": true,
      "selfHeal": true
    }
  }
}
```

### Как добавить Helm repository?

Откройте вкладку "Repositories", нажмите "Add Repository", заполните URL, выберите тип `helm`, сохраните repository. Argo CD автоматически обнаружит доступные charts.

### Как использовать OCI registry?

Откройте вкладку "Repositories", нажмите "Add Repository", заполните URL OCI registry, выберите тип `oci`, сохраните repository. Argo CD автоматически обнаружит доступные charts.

### Как настроить sync windows?

Откройте вкладку "Settings", перейдите в раздел "Sync Windows", нажмите "Add Sync Window", заполните расписание (формат "HH:MM-HH:MM" или cron), выберите тип (allow/deny), укажите applications/projects, сохраните sync window.

### Как настроить RBAC?

Откройте вкладку "RBAC", создайте роли с политиками, назначьте роли группам пользователей. Используйте формат политик: `p, <role>, <resource>, <action>, <object>, <effect>`.

### Как настроить уведомления?

Откройте вкладку "Notifications", нажмите "Add Channel", выберите тип канала (slack, email, pagerduty, etc.), заполните конфигурацию, настройте триггеры для событий, сохраните канал.

### Как использовать ApplicationSet?

Откройте вкладку "ApplicationSets", нажмите "Add ApplicationSet", настройте генераторы (list, git, cluster), создайте шаблон application с переменными, сохраните ApplicationSet. Applications будут автоматически сгенерированы.

### Как интегрировать с GitLab/GitHub webhooks?

Argo CD автоматически обрабатывает webhooks от GitLab, GitHub и Bitbucket. Настройте webhook в вашем Git репозитории, укажите URL Argo CD webhook endpoint. Argo CD автоматически определит application по repository URL и branch из webhook payload.

---

## Дополнительные ресурсы

- [Официальная документация Argo CD](https://argo-cd.readthedocs.io/)
- [Argo CD User Guide](https://argo-cd.readthedocs.io/en/stable/user-guide/)
- [Argo CD Operator Manual](https://argo-cd.readthedocs.io/en/stable/operator-manual/)
- [Argo CD Application CRD](https://argo-cd.readthedocs.io/en/stable/operator-manual/declarative-setup/#applications)
- [Argo CD ApplicationSet](https://argo-cd.readthedocs.io/en/stable/operator-manual/applicationset/)
- [Argo CD RBAC](https://argo-cd.readthedocs.io/en/stable/operator-manual/rbac/)
- [Argo CD Notifications](https://argo-cd.readthedocs.io/en/stable/operator-manual/notifications/)
- [Argo CD Sync Windows](https://argo-cd.readthedocs.io/en/stable/user-guide/sync-windows/)
- [Argo CD Sync Hooks](https://argo-cd.readthedocs.io/en/stable/user-guide/resource_hooks/)
- [Argo CD Helm Support](https://argo-cd.readthedocs.io/en/stable/user-guide/helm/)
- [Argo CD OCI Support](https://argo-cd.readthedocs.io/en/stable/user-guide/helm/#oci-charts)
- [GitOps Principles](https://www.gitops.tech/)

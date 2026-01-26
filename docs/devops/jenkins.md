# Jenkins - Документация компонента

## Обзор

Jenkins - это open-source сервер автоматизации для CI/CD (Continuous Integration / Continuous Delivery). Компонент Jenkins в системе симуляции полностью эмулирует поведение реального Jenkins, включая управление pipelines, builds, executors, nodes, plugins, поддержку различных триггеров (webhook, cron, SCM polling, manual), динамические stages, поддержку различных build tools (Maven, Gradle, npm, Make, custom), SCM интеграцию (Git, SVN, Mercurial), управление артефактами и полный набор метрик производительности.

### Основные возможности

- ✅ **Pipeline Management** - Управление CI/CD pipelines с автоматическим вычислением статусов
- ✅ **Build Management** - Симуляция builds с прогрессом, stages, длительностью и результатами
- ✅ **Executor Management** - Управление executors на master node и agent nodes
- ✅ **Node Management** - Управление Jenkins nodes (master и agents)
- ✅ **Plugin System** - Система плагинов с зависимостями и enabled/disabled статусами
- ✅ **Build Triggers** - Поддержка триггеров: webhook, cron, SCM polling, manual
- ✅ **Dynamic Stages** - Динамические stages из конфигурации pipeline
- ✅ **Build Tools Support** - Поддержка различных build tools (Maven, Gradle, npm, Make, custom)
- ✅ **SCM Integration** - Интеграция с SCM системами (Git, SVN, Mercurial)
- ✅ **Artifact Management** - Управление артефактами с retention policy
- ✅ **Build Parameters** - Поддержка параметров builds (string, choice, boolean, password)
- ✅ **Environment Variables** - Поддержка environment variables для builds
- ✅ **Post-Build Actions** - Email notifications, archive artifacts, publish results, deploy
- ✅ **Метрики Jenkins** - Полный набор метрик производительности и использования

---

## Основные функции

### 1. Pipeline Management (Управление pipelines)

**Описание:** Jenkins управляет CI/CD pipelines для автоматизации процессов сборки, тестирования и развертывания.

**Структура Pipeline:**
```json
{
  "id": "pipeline-1",
  "name": "My Application",
  "status": "success",
  "lastBuild": 42,
  "branch": "main",
  "enabled": true,
  "triggers": [...],
  "parameters": [...],
  "environmentVariables": {...},
  "postBuildActions": [...],
  "scmConfig": {...},
  "buildTool": "gradle",
  "stages": [...]
}
```

**Параметры Pipeline:**
- **id** - Уникальный идентификатор (обязательно)
- **name** - Имя pipeline (обязательно)
- **status** - Статус: `success`, `running`, `failed`, `pending`, `aborted`, `unstable` (вычисляется автоматически)
- **lastBuild** - Номер последнего build
- **branch** - Ветка SCM (по умолчанию: `main`)
- **enabled** - Включен ли pipeline (по умолчанию: `true`)
- **triggers** - Триггеры для автоматического запуска builds
- **parameters** - Параметры builds
- **environmentVariables** - Переменные окружения
- **postBuildActions** - Действия после сборки
- **scmConfig** - Конфигурация SCM
- **buildTool** - Инструмент сборки
- **stages** - Конфигурация stages

**Статусы Pipeline:**
- **success** - Последний build успешен
- **running** - Build выполняется
- **failed** - Последний build провалился
- **pending** - Ожидает запуска
- **aborted** - Build отменен
- **unstable** - Build нестабилен (тесты провалились, но сборка успешна)

### 2. Build Management (Управление builds)

**Описание:** Jenkins выполняет builds (сборки) для каждого pipeline.

**Структура Build:**
```json
{
  "id": "build-1",
  "number": 42,
  "pipelineId": "pipeline-1",
  "status": "success",
  "startTime": 1609459200000,
  "duration": 120000,
  "progress": 100,
  "stages": [
    {
      "name": "Checkout",
      "status": "success",
      "duration": 5000
    },
    {
      "name": "Build",
      "status": "success",
      "duration": 60000
    }
  ],
  "logs": [...],
  "artifacts": ["app-42.jar"],
  "triggeredBy": "webhook",
  "branch": "main",
  "commit": "abc123def456789..."
}
```

**Статусы Build:**
- **success** - Build успешен
- **running** - Build выполняется
- **failed** - Build провалился
- **pending** - Ожидает executor
- **aborted** - Build отменен
- **unstable** - Build нестабилен

**Stages:**
- Build состоит из stages (этапов)
- Stages выполняются последовательно или параллельно
- Каждый stage имеет свой статус и длительность

**Логи:**
- Каждый build генерирует логи выполнения
- Логи включают вывод команд, ошибки, предупреждения
- Логи генерируются на основе build tool и stages

**Артефакты:**
- Build может генерировать артефакты (JAR, WAR, npm packages, Docker images, etc.)
- Артефакты архивируются и хранятся с retention policy
- Паттерны артефактов настраиваются в конфигурации pipeline

### 3. Build Triggers (Триггеры сборки)

**Описание:** Jenkins поддерживает различные триггеры для автоматического запуска builds.

**Типы триггеров:**

#### 3.1. Webhook Trigger

**Описание:** Запуск build при получении webhook от SCM системы.

**Конфигурация:**
```json
{
  "type": "webhook",
  "enabled": true,
  "config": {
    "branches": ["main", "develop"],
    "events": ["push", "pull_request"]
  }
}
```

**Параметры:**
- **branches** - Ветки, для которых срабатывает триггер (опционально)
- **events** - События SCM (push, pull_request, tag, etc.) (опционально)

**Как работает:**
1. SCM система отправляет webhook в Jenkins
2. Jenkins проверяет ветку и событие
3. Если условия выполнены, запускается build

#### 3.2. Cron Trigger

**Описание:** Запуск build по расписанию (cron выражение).

**Конфигурация:**
```json
{
  "type": "cron",
  "enabled": true,
  "config": {
    "schedule": "H/15 * * * *"
  }
}
```

**Cron синтаксис:**
- 5 полей: `minute hour day month weekday`
- Специальные символы:
  - `*` - любое значение
  - `,` - список значений (например: `1,15,30`)
  - `-` - диапазон (например: `1-5`)
  - `/` - шаг (например: `*/15` - каждые 15 минут)
  - `H` - Jenkins hash (случайное значение в диапазоне для распределения нагрузки)
  - `?` - любое значение (только для day/month)

**Jenkins макросы:**
- `@yearly` - Раз в год (0 0 1 1 *)
- `@monthly` - Раз в месяц (0 0 1 * *)
- `@weekly` - Раз в неделю (0 0 * * 0)
- `@daily` - Раз в день (0 0 * * *)
- `@hourly` - Раз в час (0 * * * *)

**Примеры:**
- `H/15 * * * *` - Каждые 15 минут (с hash для распределения нагрузки)
- `0 2 * * *` - Каждый день в 2:00
- `H H/2 * * *` - Каждые 2 часа (с hash)
- `0 0 * * 0` - Каждое воскресенье в полночь

#### 3.3. SCM Polling Trigger

**Описание:** Периодическая проверка SCM на изменения.

**Конфигурация:**
```json
{
  "type": "scm",
  "enabled": true,
  "config": {
    "pollInterval": 5
  }
}
```

**Параметры:**
- **pollInterval** - Интервал проверки в минутах (по умолчанию: `5`)

**Как работает:**
1. Jenkins периодически проверяет SCM на изменения
2. Если обнаружены изменения, запускается build
3. Интервал проверки настраивается в `pollInterval`

#### 3.4. Manual Trigger

**Описание:** Ручной запуск build через UI или API.

**Конфигурация:**
```json
{
  "type": "manual",
  "enabled": true
}
```

**Как работает:**
1. Пользователь нажимает кнопку "Build Now" в UI
2. Или отправляет API запрос для запуска build
3. Build запускается немедленно (если есть доступный executor)

### 4. Build Tools Support (Поддержка build tools)

**Описание:** Jenkins поддерживает различные инструменты сборки.

**Поддерживаемые build tools:**
- **maven** - Apache Maven
- **gradle** - Gradle
- **npm** - npm/yarn
- **make** - Make
- **custom** - Кастомные команды

**Параметры:**
- **buildTool** - Инструмент сборки (по умолчанию: `gradle`)
- **buildCommand** - Кастомная команда сборки (для `custom`)

**Генерация логов:**
- Каждый build tool генерирует реалистичные логи
- Логи включают команды и вывод инструмента
- Логи соответствуют реальному поведению инструмента

**Примеры логов:**

**Maven:**
```
[INFO] Scanning for projects...
[INFO] Building My Application 1.0.0
[INFO] --- maven-compiler-plugin:3.8.1:compile (default-compile) @ my-app ---
[INFO] Changes detected - recompiling the module!
[INFO] Compiling 15 source files to /var/jenkins_home/workspace/my-app/target/classes
[INFO] BUILD SUCCESS
```

**Gradle:**
```
> Task :compileJava
> Task :processResources
> Task :classes
> Task :jar
BUILD SUCCESSFUL in 45s
```

**npm:**
```
npm install
added 1234 packages in 30s
npm run build
> Building...
> Build completed successfully
```

### 5. SCM Integration (Интеграция с SCM)

**Описание:** Jenkins интегрируется с системами контроля версий для получения исходного кода.

**Поддерживаемые SCM:**
- **git** - Git
- **svn** - Subversion
- **mercurial** - Mercurial

**Конфигурация SCM:**
```json
{
  "scmConfig": {
    "type": "git",
    "url": "https://github.com/example/my-app.git",
    "credentials": "github-credentials",
    "branch": "main"
  }
}
```

**Параметры:**
- **type** - Тип SCM (обязательно)
- **url** - URL репозитория (обязательно)
- **credentials** - Учетные данные (опционально)
- **branch** - Ветка (опционально, по умолчанию: `main`)

**Генерация логов:**
- Каждый тип SCM генерирует реалистичные логи
- Логи включают команды checkout, commit hash, branch

**Примеры логов:**

**Git:**
```
Cloning into '/var/jenkins_home/workspace/my-app'...
Commit: abc123def4567890123456789abcdef01234567
Branch: main
```

**SVN:**
```
Checked out revision 1234
```

**Mercurial:**
```
pulling from https://example.com/repo
changeset: 1234:abc123def456
```

### 6. Dynamic Stages (Динамические stages)

**Описание:** Jenkins поддерживает динамические stages из конфигурации pipeline.

**Конфигурация Stages:**
```json
{
  "stages": [
    {
      "name": "Checkout",
      "type": "sequential",
      "steps": ["git checkout", "git pull"]
    },
    {
      "name": "Build",
      "type": "sequential",
      "steps": ["./gradlew build"]
    },
    {
      "name": "Test",
      "type": "parallel",
      "steps": ["./gradlew test", "./gradlew integrationTest"]
    },
    {
      "name": "Deploy",
      "type": "sequential",
      "steps": ["./deploy.sh"]
    }
  ]
}
```

**Типы stages:**
- **sequential** - Последовательное выполнение steps
- **parallel** - Параллельное выполнение steps

**Дефолтные stages:**
- Если stages не указаны, генерируются дефолтные на основе build tool:
  - **Maven**: Checkout, Build, Test, Package, Deploy
  - **Gradle**: Checkout, Build, Test, Deploy
  - **npm**: Checkout, Install, Build, Test, Deploy
  - **Make**: Checkout, Build, Test, Deploy

**Генерация stages:**
- Stages генерируются динамически из конфигурации
- Каждый stage имеет свой статус и длительность
- Логи генерируются для каждого stage

### 7. Artifact Management (Управление артефактами)

**Описание:** Jenkins управляет артефактами, созданными builds.

**Параметры:**
- **enableArtifactArchiving** - Включить архивирование артефактов (по умолчанию: `true`)
- **retentionDays** - Хранение артефактов в днях (по умолчанию: `30`)
- **artifactPatterns** - Паттерны для архивирования (опционально)

**Паттерны артефактов:**
- Поддержка wildcards: `**/*.jar`, `target/*.war`, `dist/**/*`
- Паттерны указываются в конфигурации pipeline

**Типы артефактов:**
- **Java**: JAR, WAR, EAR файлы
- **Node.js**: npm packages, tarballs
- **Python**: wheels, eggs
- **Docker**: image manifests
- **Custom**: любые файлы по паттернам

**Размеры артефактов:**
- Размеры генерируются реалистично на основе типа артефакта
- JAR файлы: 5-50 MB
- WAR файлы: 10-100 MB
- npm packages: 1-20 MB
- Docker images: 50-500 MB

**Retention Policy:**
- Артефакты автоматически удаляются после `retentionDays`
- Старые артефакты очищаются для освобождения места

**Пример конфигурации:**
```json
{
  "enableArtifactArchiving": true,
  "retentionDays": 30,
  "artifactPatterns": ["**/*.jar", "target/*.war", "dist/**/*"]
}
```

### 8. Executor Management (Управление executors)

**Описание:** Jenkins использует executors для выполнения builds.

**Параметры:**
- **executorCount** - Количество executors на master node (по умолчанию: `2`)

**Как работает:**
1. Каждый executor может выполнять один build одновременно
2. Если все executors заняты, builds ожидают в очереди (pending)
3. Executors освобождаются после завершения build
4. Agent nodes имеют свои executors

**Метрики:**
- **executorUtilization** - Использование executors (0-1)
- **executorIdle** - Количество свободных executors
- **executorBusy** - Количество занятых executors

**Пример конфигурации:**
```json
{
  "executorCount": 4
}
```

### 9. Node Management (Управление nodes)

**Описание:** Jenkins управляет nodes (master и agents) для распределения нагрузки.

**Типы nodes:**
- **master** - Master node (встроенный, всегда онлайн)
- **agent** - Agent nodes (добавляются вручную)

**Структура Node:**
```json
{
  "id": "agent-1",
  "name": "agent-1",
  "status": "online",
  "numExecutors": 2,
  "busyExecutors": 1,
  "idleExecutors": 1,
  "labels": ["linux", "docker"]
}
```

**Параметры Node:**
- **id** - Уникальный идентификатор (обязательно)
- **name** - Имя node (обязательно)
- **numExecutors** - Количество executors (по умолчанию: `1`)
- **labels** - Метки для выбора node (опционально)
- **description** - Описание node (опционально)

**Статусы Node:**
- **online** - Node онлайн и доступен
- **offline** - Node офлайн
- **temporarily-offline** - Node временно офлайн

**Labels:**
- Labels используются для выбора node для builds
- Например: `linux`, `docker`, `windows`, `macos`

### 10. Plugin System (Система плагинов)

**Описание:** Jenkins использует плагины для расширения функциональности.

**Параметры:**
- **enablePlugins** - Включить систему плагинов (по умолчанию: `true`)
- **plugins** - Список плагинов (по умолчанию: `['git', 'docker', 'kubernetes']`)

**Формат плагинов:**
```json
{
  "plugins": [
    "git",
    {
      "name": "docker",
      "version": "1.2.9",
      "enabled": true
    }
  ]
}
```

**Категории плагинов:**
- **scm** - SCM интеграция (Git, SVN, Mercurial, GitLab, Bitbucket)
- **build** - Инструменты сборки (Maven, Gradle, npm, Ant, Python)
- **deploy** - Развертывание (Docker, Kubernetes, Ansible, Terraform)
- **ui** - UI улучшения (Blue Ocean, Dashboard View)
- **security** - Безопасность (Credentials, Role-based Authorization)
- **notification** - Уведомления (Email, Slack, Teams)
- **integration** - Интеграции (JIRA, SonarQube, Artifactory)

**Популярные плагины:**
- **Git** - Git интеграция
- **Docker Pipeline** - Docker поддержка
- **Kubernetes** - Kubernetes интеграция
- **Blue Ocean** - Современный UI
- **Pipeline** - Pipeline поддержка
- **Credentials** - Управление учетными данными
- **Email Extension** - Расширенные email уведомления
- **JIRA** - JIRA интеграция
- **SonarQube** - SonarQube интеграция

**Зависимости:**
- Плагины могут иметь зависимости от других плагинов
- Зависимости автоматически разрешаются
- Плагин активен только если все зависимости удовлетворены

### 11. Build Parameters (Параметры builds)

**Описание:** Jenkins поддерживает параметры для настройки builds.

**Типы параметров:**
- **string** - Строковый параметр
- **choice** - Выбор из списка
- **boolean** - Булевый параметр
- **password** - Пароль (скрытый)

**Структура параметра:**
```json
{
  "name": "environment",
  "type": "choice",
  "defaultValue": "staging",
  "description": "Deployment environment",
  "choices": ["staging", "production", "dev"]
}
```

**Использование:**
- Параметры задаются при ручном запуске build
- Параметры доступны в environment variables
- Параметры используются в stages и commands

### 12. Environment Variables (Переменные окружения)

**Описание:** Jenkins поддерживает environment variables для builds.

**Конфигурация:**
```json
{
  "environmentVariables": {
    "NODE_ENV": "production",
    "API_URL": "https://api.example.com",
    "BUILD_NUMBER": "${BUILD_NUMBER}"
  }
}
```

**Встроенные переменные:**
- **BUILD_NUMBER** - Номер build
- **JOB_NAME** - Имя pipeline
- **WORKSPACE** - Путь к workspace
- **BUILD_URL** - URL build
- И другие

**Использование:**
- Переменные доступны в stages и commands
- Переменные могут использоваться в путях и командах

### 13. Post-Build Actions (Действия после сборки)

**Описание:** Jenkins выполняет действия после завершения build.

**Типы действий:**

#### 13.1. Email Notification

**Описание:** Отправка email уведомлений о результатах build.

**Конфигурация:**
```json
{
  "type": "email",
  "enabled": true,
  "config": {
    "recipients": ["dev@example.com", "qa@example.com"]
  }
}
```

#### 13.2. Archive Artifacts

**Описание:** Архивирование артефактов build.

**Конфигурация:**
```json
{
  "type": "archive",
  "enabled": true,
  "config": {
    "archivePattern": "**/*.jar"
  }
}
```

#### 13.3. Publish Results

**Описание:** Публикация результатов (тесты, coverage, etc.).

**Конфигурация:**
```json
{
  "type": "publish",
  "enabled": true,
  "config": {
    "publishTarget": "sonarqube"
  }
}
```

#### 13.4. Deploy

**Описание:** Развертывание артефактов.

**Конфигурация:**
```json
{
  "type": "deploy",
  "enabled": true,
  "config": {
    "deployEnv": "staging"
  }
}
```

---

## Руководство пользователя

### Быстрый старт

1. **Добавление компонента Jenkins:**
   - Перетащите компонент "Jenkins" из библиотеки компонентов на canvas
   - Откройте панель конфигурации компонента

2. **Настройка Jenkins:**
   - Перейдите на вкладку **"Settings"**
   - Укажите **Jenkins URL** (по умолчанию: `http://jenkins:8080`)
   - Укажите **Executor Count** (количество параллельных builds)
   - Включите **Enable Plugins** для использования плагинов

3. **Создание первого Pipeline:**
   - Перейдите на вкладку **"Pipelines"**
   - Нажмите кнопку **"Add Pipeline"**
   - Заполните параметры pipeline
   - Нажмите **"Save"**

4. **Настройка SCM:**
   - В диалоге редактирования pipeline перейдите на вкладку **"Build Configuration"**
   - В секции **"SCM Configuration"** укажите:
     - **Type**: `git`, `svn`, или `mercurial`
     - **URL**: URL репозитория
     - **Branch**: Ветка (опционально)
   - Нажмите **"Save"**

5. **Настройка Build Tool:**
   - В секции **"Build Tool"** выберите инструмент: `maven`, `gradle`, `npm`, `make`, или `custom`
   - Если выбран `custom`, укажите **Build Command**
   - Нажмите **"Save"**

6. **Настройка триггеров:**
   - В секции **"Triggers"** добавьте триггеры:
     - **Webhook** - для автоматического запуска при push
     - **Cron** - для запуска по расписанию
     - **SCM Polling** - для периодической проверки изменений
   - Нажмите **"Save"**

### Работа с Pipelines

#### Создание Pipeline

1. Перейдите на вкладку **"Pipelines"**
2. Нажмите кнопку **"Add Pipeline"**
3. Заполните параметры:
   - **Name** - Имя pipeline (обязательно)
   - **Branch** - Ветка SCM (опционально)
   - **Enabled** - Включить pipeline
4. Нажмите **"Save"**

#### Редактирование Pipeline

1. Найдите pipeline в списке
2. Нажмите кнопку **"Edit"**
3. В диалоге редактирования доступны вкладки:
   - **General** - Общие настройки
   - **Triggers** - Триггеры сборки
   - **Parameters** - Параметры builds
   - **Environment Variables** - Переменные окружения
   - **Post-Build Actions** - Действия после сборки
   - **Build Configuration** - Конфигурация сборки (SCM, Build Tool, Stages, Artifacts)
4. Измените параметры
5. Нажмите **"Save"**

#### Настройка SCM

1. В диалоге редактирования pipeline перейдите на вкладку **"Build Configuration"**
2. В секции **"SCM Configuration"** укажите:
   - **Type** - Тип SCM: `git`, `svn`, или `mercurial`
   - **URL** - URL репозитория (обязательно)
   - **Credentials** - Учетные данные (опционально)
   - **Branch** - Ветка (опционально)
3. Нажмите **"Save"**

**Валидация:** URL валидируется на корректность формата.

#### Настройка Build Tool

1. В секции **"Build Tool"** выберите инструмент:
   - **Maven** - Apache Maven
   - **Gradle** - Gradle
   - **npm** - npm/yarn
   - **Make** - Make
   - **Custom** - Кастомные команды
2. Если выбран **Custom**, укажите **Build Command**
3. Нажмите **"Save"**

#### Настройка Stages

1. В секции **"Stages"** добавьте stages:
   - Нажмите **"Add Stage"**
   - Укажите **Name** и **Type** (sequential или parallel)
   - Укажите **Steps** (команды для выполнения)
   - Нажмите **"Save"**
2. Используйте кнопки **"Up"** и **"Down"** для изменения порядка
3. Нажмите **"Save"** в диалоге pipeline

**Примечание:** Если stages не указаны, генерируются дефолтные на основе build tool.

#### Настройка Artifact Patterns

1. В секции **"Artifact Patterns"** укажите паттерны:
   - `**/*.jar` - Все JAR файлы
   - `target/*.war` - WAR файлы в target
   - `dist/**/*` - Все файлы в dist
2. Каждый паттерн на новой строке
3. Нажмите **"Save"**

**Примечание:** Если паттерны не указаны, генерируются дефолтные на основе build tool.

### Работа с Builds

#### Просмотр Builds

1. Перейдите на вкладку **"Builds"**
2. Просматривайте список builds
3. Фильтруйте builds по статусу: `all`, `active`, `success`, `failed`
4. Используйте поиск для фильтрации по pipeline name

#### Просмотр деталей Build

1. Найдите build в списке
2. Нажмите кнопку **"View"**
3. В диалоге просматривайте:
   - **Status** - Статус build
   - **Stages** - Список stages с прогрессом
   - **Logs** - Логи выполнения
   - **Artifacts** - Артефакты build
   - **Parameters** - Параметры build
   - **Environment Variables** - Переменные окружения

#### Просмотр логов Build

1. В диалоге деталей build перейдите на вкладку **"Logs"**
2. Просматривайте логи выполнения
3. Используйте поиск для фильтрации логов
4. Экспортируйте логи в файл (опционально)

#### Скачивание артефактов

1. В диалоге деталей build перейдите на вкладку **"Artifacts"**
2. Найдите артефакт в списке
3. Нажмите кнопку **"Download"**
4. Артефакт будет загружен

#### Ручной запуск Build

1. Найдите pipeline в списке
2. Нажмите кнопку **"Build Now"**
3. Если pipeline имеет параметры, заполните их
4. Нажмите **"Build"**
5. Build запустится (если есть доступный executor)

#### Отмена Build

1. Найдите активный build в списке
2. Нажмите кнопку **"Cancel"**
3. Подтвердите отмену
4. Build будет отменен, executor освобожден

### Работа с триггерами

#### Настройка Webhook Trigger

1. В диалоге редактирования pipeline перейдите на вкладку **"Triggers"**
2. Нажмите **"Add Trigger"**
3. Выберите тип **"Webhook"**
4. Укажите параметры:
   - **Branches** - Ветки для срабатывания (опционально)
   - **Events** - События SCM (опционально)
5. Нажмите **"Save"**

#### Настройка Cron Trigger

1. Выберите тип **"Cron"**
2. Укажите **Schedule** (cron выражение):
   - `H/15 * * * *` - Каждые 15 минут
   - `0 2 * * *` - Каждый день в 2:00
   - `H H/2 * * *` - Каждые 2 часа
3. Нажмите **"Save"**

**Валидация:** Cron выражение валидируется на корректность формата.

#### Настройка SCM Polling Trigger

1. Выберите тип **"SCM"**
2. Укажите **Poll Interval** (в минутах)
3. Нажмите **"Save"**

### Работа с Nodes

#### Добавление Agent Node

1. Перейдите на вкладку **"Nodes"**
2. Нажмите кнопку **"Add Node"**
3. Заполните параметры:
   - **Name** - Имя node
   - **Executors** - Количество executors
   - **Labels** - Метки (через запятую)
   - **Description** - Описание (опционально)
4. Нажмите **"Save"**

#### Просмотр Nodes

1. Перейдите на вкладку **"Nodes"**
2. Просматривайте список nodes:
   - **Master** - Master node (встроенный)
   - **Agents** - Agent nodes
3. Просматривайте метрики:
   - **Status** - Статус node
   - **Executors** - Количество executors (busy/idle)
   - **Labels** - Метки node

### Работа с Plugins

#### Просмотр Plugins

1. Перейдите на вкладку **"Plugins"**
2. Просматривайте список установленных плагинов
3. Фильтруйте плагины по категории
4. Используйте поиск для фильтрации по имени

#### Установка Plugin

1. Нажмите кнопку **"Install Plugin"**
2. Введите имя плагина
3. Опционально укажите версию
4. Нажмите **"Install"**

**Примечание:** Плагин будет установлен с последней версией, если версия не указана.

#### Включение/отключение Plugin

1. Найдите plugin в списке
2. Переключите переключатель **"Enabled"**
3. Plugin будет включен/отключен

**Примечание:** Плагин активен только если все зависимости удовлетворены.

---

## Руководство администратора

### Рекомендации по конфигурации

#### Production Jenkins

```json
{
  "jenkinsUrl": "https://jenkins.example.com:8080",
  "enableCSRF": true,
  "executorCount": 4,
  "enablePlugins": true,
  "plugins": [
    "git",
    "docker",
    "kubernetes",
    "blue-ocean",
    "credentials",
    "email-ext"
  ],
  "enablePipeline": true,
  "enableArtifactArchiving": true,
  "retentionDays": 30,
  "defaultWorkspacePath": "/var/jenkins_home/workspace/${JOB_NAME}",
  "buildTriggerRate": 0.5,
  "averageBuildDuration": 120000,
  "failureRate": 0.1
}
```

**Рекомендации:**
- Используйте HTTPS для production (`jenkinsUrl` с `https://`)
- Включите CSRF protection (`enableCSRF: true`)
- Настройте разумное количество executors (4-8 для средних нагрузок)
- Используйте необходимые плагины
- Настройте retention policy для артефактов (30 дней рекомендуется)
- Используйте agent nodes для распределения нагрузки

### Оптимизация производительности

#### Executor Count

**Рекомендации:**
- Используйте 2-4 executors для малых нагрузок
- Используйте 4-8 executors для средних нагрузок
- Используйте 8+ executors для больших нагрузок
- Используйте agent nodes для масштабирования

**Влияние на производительность:**
- Больше executors = больше параллельных builds
- Больше executors = больше нагрузка на ресурсы
- Балансируйте между производительностью и ресурсами

#### Agent Nodes

**Рекомендации:**
- Используйте agent nodes для распределения нагрузки
- Настройте labels для выбора nodes
- Используйте разные nodes для разных типов builds (Linux, Windows, Docker)

#### Retention Policy

**Рекомендации:**
- Используйте `retentionDays: 30` для production
- Используйте более короткие retention для development
- Мониторьте использование места для артефактов

### Безопасность

#### CSRF Protection

- Всегда включайте CSRF protection для production (`enableCSRF: true`)
- CSRF protection предотвращает атаки типа Cross-Site Request Forgery

#### Credentials Management

- Используйте плагин Credentials для управления учетными данными
- Не храните пароли в открытом виде
- Регулярно ротируйте credentials

#### Pipeline Security

- Ограничьте доступ к pipelines через roles
- Используйте параметры для безопасной передачи данных
- Валидируйте входные данные в builds

### Мониторинг и алертинг

#### Ключевые метрики

1. **Builds Per Minute**
   - Нормальное значение: зависит от нагрузки
   - Алерт: резкое увеличение может указывать на проблемы

2. **Success Rate**
   - Нормальное значение: > 90%
   - Алерт: successRate < 80% (много провальных builds)

3. **Executor Utilization**
   - Нормальное значение: 50-80%
   - Алерт: executorUtilization > 95% (высокая нагрузка, нужны agent nodes)

4. **Average Build Duration**
   - Нормальное значение: зависит от типа builds
   - Алерт: резкое увеличение может указывать на проблемы

5. **Builds Pending**
   - Нормальное значение: < 10
   - Алерт: buildsPending > 50 (недостаточно executors)

6. **Artifact Storage**
   - Нормальное значение: зависит от retention policy
   - Алерт: artifactStorageBytes > 10GB (нужно увеличить retention или очистить)

#### Рекомендации по алертингу

- Настройте алерты на низкий success rate
- Настройте алерты на высокую executor utilization
- Настройте алерты на большое количество pending builds
- Настройте алерты на высокое использование места для артефактов

---

## Метрики и мониторинг

### Метрики Builds

- **buildsTotal** - Общее количество builds
- **buildsSuccess** - Количество успешных builds
- **buildsFailed** - Количество провальных builds
- **buildsRunning** - Количество выполняющихся builds
- **buildsPending** - Количество ожидающих builds
- **buildsPerMinute** - Скорость builds (builds в минуту)
- **averageBuildDuration** - Средняя длительность build (ms)

### Метрики Executors

- **executorUtilization** - Использование executors (0-1)
- **executorIdle** - Количество свободных executors
- **executorBusy** - Количество занятых executors

### Метрики Pipelines

- **pipelinesTotal** - Общее количество pipelines
- **pipelinesEnabled** - Количество включенных pipelines

### Метрики Nodes

- **nodesTotal** - Общее количество nodes
- **nodesOnline** - Количество онлайн nodes

### Метрики Plugins

- **pluginsTotal** - Общее количество плагинов
- **pluginsActive** - Количество активных плагинов

### Метрики Storage

- **artifactStorageBytes** - Размер хранилища артефактов (bytes)

### Метрики Requests

- **requestsTotal** - Общее количество запросов
- **requestsErrors** - Количество ошибок запросов

### Мониторинг в реальном времени

Все метрики обновляются в реальном времени во время симуляции:
- Метрики синхронизируются из `JenkinsEmulationEngine` каждые 500ms
- Метрики отображаются в UI компонента
- Builds обновляются в реальном времени
- Pipelines обновляются в реальном времени

---

## Примеры использования

### Пример 1: Базовый Pipeline для Java приложения

**Сценарий:** CI/CD pipeline для Java приложения с Maven

```json
{
  "pipelines": [
    {
      "id": "java-app",
      "name": "Java Application",
      "enabled": true,
      "scmConfig": {
        "type": "git",
        "url": "https://github.com/example/java-app.git",
        "branch": "main"
      },
      "buildTool": "maven",
      "triggers": [
        {
          "type": "webhook",
          "enabled": true,
          "config": {
            "branches": ["main", "develop"]
          }
        }
      ],
      "postBuildActions": [
        {
          "type": "email",
          "enabled": true,
          "config": {
            "recipients": ["dev@example.com"]
          }
        },
        {
          "type": "archive",
          "enabled": true,
          "config": {
            "archivePattern": "target/*.jar"
          }
        }
      ]
    }
  ]
}
```

### Пример 2: Pipeline с Cron триггером

**Сценарий:** Ежедневная сборка в 2:00

```json
{
  "pipelines": [
    {
      "id": "nightly-build",
      "name": "Nightly Build",
      "enabled": true,
      "triggers": [
        {
          "type": "cron",
          "enabled": true,
          "config": {
            "schedule": "0 2 * * *"
          }
        }
      ]
    }
  ]
}
```

### Пример 3: Pipeline с параметрами

**Сценарий:** Pipeline с параметрами для выбора окружения развертывания

```json
{
  "pipelines": [
    {
      "id": "deploy-app",
      "name": "Deploy Application",
      "enabled": true,
      "parameters": [
        {
          "name": "environment",
          "type": "choice",
          "defaultValue": "staging",
          "choices": ["staging", "production", "dev"]
        },
        {
          "name": "version",
          "type": "string",
          "defaultValue": "latest"
        }
      ],
      "postBuildActions": [
        {
          "type": "deploy",
          "enabled": true,
          "config": {
            "deployEnv": "${environment}"
          }
        }
      ]
    }
  ]
}
```

### Пример 4: Pipeline с кастомными stages

**Сценарий:** Pipeline с настраиваемыми stages

```json
{
  "pipelines": [
    {
      "id": "custom-pipeline",
      "name": "Custom Pipeline",
      "enabled": true,
      "buildTool": "custom",
      "buildCommand": "./build.sh",
      "stages": [
        {
          "name": "Checkout",
          "type": "sequential",
          "steps": ["git checkout", "git pull"]
        },
        {
          "name": "Build",
          "type": "sequential",
          "steps": ["./build.sh"]
        },
        {
          "name": "Test",
          "type": "parallel",
          "steps": ["./test-unit.sh", "./test-integration.sh"]
        },
        {
          "name": "Deploy",
          "type": "sequential",
          "steps": ["./deploy.sh"]
        }
      ]
    }
  ]
}
```

### Пример 5: Pipeline с Node.js и npm

**Сценарий:** CI/CD pipeline для Node.js приложения

```json
{
  "pipelines": [
    {
      "id": "nodejs-app",
      "name": "Node.js Application",
      "enabled": true,
      "scmConfig": {
        "type": "git",
        "url": "https://github.com/example/nodejs-app.git"
      },
      "buildTool": "npm",
      "artifactPatterns": ["dist/**/*", "*.tgz"],
      "triggers": [
        {
          "type": "webhook",
          "enabled": true
        }
      ]
    }
  ]
}
```

---

## Часто задаваемые вопросы (FAQ)

### Что такое Jenkins?

Jenkins - это open-source сервер автоматизации для CI/CD. Jenkins автоматизирует процессы сборки, тестирования и развертывания приложений.

### Как работает Jenkins?

1. Jenkins получает исходный код из SCM (Git, SVN, Mercurial)
2. Запускает builds на основе триггеров (webhook, cron, SCM polling, manual)
3. Выполняет stages (Checkout, Build, Test, Deploy)
4. Генерирует артефакты
5. Выполняет post-build actions (email, archive, deploy)

### Что такое Pipeline?

Pipeline - это конфигурация CI/CD процесса. Pipeline определяет, как собирать, тестировать и развертывать приложение.

### Что такое Build?

Build - это выполнение pipeline. Каждый build имеет номер, статус, stages, логи и артефакты.

### Что такое Executor?

Executor - это ресурс для выполнения build. Каждый executor может выполнять один build одновременно. Если все executors заняты, builds ожидают в очереди.

### Что такое Node?

Node - это машина для выполнения builds. Master node - это основной Jenkins сервер. Agent nodes - это дополнительные машины для распределения нагрузки.

### Что такое Plugin?

Plugin - это расширение функциональности Jenkins. Плагины добавляют поддержку различных инструментов, интеграций и функций.

### Как настроить триггеры?

1. В диалоге редактирования pipeline перейдите на вкладку **"Triggers"**
2. Нажмите **"Add Trigger"**
3. Выберите тип триггера (webhook, cron, scm, manual)
4. Настройте параметры триггера
5. Нажмите **"Save"**

### Как работает Cron триггер?

Cron триггер запускает builds по расписанию. Используется cron выражение для указания времени срабатывания. Поддерживаются специальные символы: `*`, `,`, `-`, `/`, `H`, `?`.

### Как настроить SCM?

1. В диалоге редактирования pipeline перейдите на вкладку **"Build Configuration"**
2. В секции **"SCM Configuration"** укажите:
   - Тип SCM (git, svn, mercurial)
   - URL репозитория
   - Ветку (опционально)
3. Нажмите **"Save"**

### Как настроить Build Tool?

1. В секции **"Build Tool"** выберите инструмент (maven, gradle, npm, make, custom)
2. Если выбран custom, укажите команду сборки
3. Нажмите **"Save"**

### Как настроить Stages?

1. В секции **"Stages"** добавьте stages
2. Укажите имя, тип (sequential или parallel) и steps
3. Нажмите **"Save"**

**Примечание:** Если stages не указаны, генерируются дефолтные на основе build tool.

### Как настроить Artifact Patterns?

1. В секции **"Artifact Patterns"** укажите паттерны (например: `**/*.jar`, `target/*.war`)
2. Каждый паттерн на новой строке
3. Нажмите **"Save"**

**Примечание:** Если паттерны не указаны, генерируются дефолтные на основе build tool.

### Как мониторить Jenkins?

Используйте метрики Jenkins:
- **Builds Per Minute** - Скорость builds
- **Success Rate** - Процент успешных builds
- **Executor Utilization** - Использование executors
- **Average Build Duration** - Средняя длительность build
- **Builds Pending** - Количество ожидающих builds

---

## Дополнительные ресурсы

- [Jenkins Documentation](https://www.jenkins.io/doc/)
- [Jenkins Pipeline Syntax](https://www.jenkins.io/doc/book/pipeline/syntax/)
- [Jenkins Cron Syntax](https://www.jenkins.io/doc/book/pipeline/syntax/#cron-syntax)
- [Jenkins Plugins](https://plugins.jenkins.io/)
- [Jenkins Best Practices](https://www.jenkins.io/doc/book/pipeline/pipeline-best-practices/)
- [Jenkins API Documentation](https://www.jenkins.io/doc/book/using/remote-access-api/)

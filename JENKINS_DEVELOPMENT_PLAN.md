# План разработки компонента Jenkins

## Обзор

Этот документ описывает план доработки компонента Jenkins для устранения хардкода, улучшения симулятивности и соответствия реальной архитектуре Jenkins. План структурирован так, чтобы можно было продолжать разработку в другом чате Cursor.

## Анализ текущего состояния

### ✅ Что реализовано хорошо

1. **Базовая архитектура симуляции**:
   - `JenkinsEmulationEngine` с управлением pipelines, builds, executors, nodes, plugins
   - Интеграция в `EmulationEngine` и `DataFlowEngine`
   - Метрики в реальном времени
   - Поддержка триггеров (webhook, cron, SCM, manual)

2. **UI компонент**:
   - 7 вкладок (Pipelines, Builds, Plugins, Nodes, Executors, Settings, Metrics)
   - Синхронизация с эмуляцией в реальном времени
   - CRUD операции для всех сущностей
   - Графики метрик

### ❌ Выявленные проблемы

#### 1. Хардкод в генерации логов builds (`generateBuildLogs`)

**Проблемы**:
- Фиксированные пути: `/var/jenkins_home/workspace/${pipelineName}`
- Фиксированные URL: `https://github.com/example/${pipelineName}.git`
- Фиксированные commit hash: `abc123def456789`
- Фиксированные команды: `./gradlew build`, `./gradlew test`
- Фиксированная версия git: `2.39.0`
- Статические stages: всегда Checkout, Build, Test, Deploy

**Требуется**:
- Конфигурируемые пути workspace (из конфига pipeline или глобального)
- Конфигурируемые SCM репозитории (Git, SVN, Mercurial) с URL из конфига
- Генерация реалистичных commit hash (SHA-1 формат)
- Поддержка разных build tools (Maven, Gradle, npm, make, custom scripts)
- Динамические stages из конфига pipeline
- Генерация логов на основе реальных паттернов Jenkins

#### 2. Хардкод в генерации артефактов (`generateArtifacts`)

**Проблемы**:
- Фиксированные имена: `app-${buildNumber}.jar`, `app-${buildNumber}-sources.jar`
- Фиксированные размеры: 15MB, 3MB, 512KB, 2MB
- Всегда одинаковый набор артефактов

**Требуется**:
- Конфигурируемые паттерны артефактов из post-build actions
- Динамические размеры на основе типа build (Java, Node.js, Python, etc.)
- Поддержка разных типов артефактов (JAR, WAR, Docker images, npm packages, etc.)
- Генерация на основе реальных паттернов для разных технологий

#### 3. Хардкод в плагинах (`popularPlugins`)

**Проблемы**:
- Фиксированные версии плагинов
- Ограниченный список популярных плагинов
- Нет динамического обновления версий

**Требуется**:
- Конфигурируемые версии плагинов (из конфига или с дефолтами)
- Расширяемый список плагинов с метаданными
- Поддержка кастомных плагинов
- Валидация совместимости версий

#### 4. Упрощенная логика cron триггеров (`shouldTriggerCron`)

**Проблемы**:
- Не полный парсер cron выражений
- Упрощенная логика (только проверка минуты)
- Не учитывает реальные cron паттерны (H/15 * * * * и т.д.)

**Требуется**:
- Полный парсер cron выражений (5 полей: minute, hour, day, month, weekday)
- Поддержка специальных символов: `*`, `,`, `-`, `/`, `H`, `?`
- Поддержка Jenkins-специфичных паттернов (`H/15 * * * *` - каждые 15 минут)
- Корректная симуляция времени срабатывания

#### 5. Статические stages в builds

**Проблемы**:
- Всегда одинаковые stages: Checkout, Build, Test, Deploy
- Не учитываются настройки pipeline из конфига

**Требуется**:
- Динамические stages из конфига pipeline
- Поддержка параллельных stages
- Поддержка условных stages (when conditions)
- Генерация stages на основе типа pipeline (Freestyle, Declarative Pipeline, Scripted Pipeline)

#### 6. Хардкод в UI

**Проблемы**:
- `default@example.com` в email recipients
- Симуляция артефактов при скачивании

**Требуется**:
- Валидация email адресов
- Реалистичная генерация содержимого артефактов

## План реализации

### Этап 1: Конфигурация pipeline и динамические параметры

#### 1.1 Расширение конфигурации pipeline

**Файл**: `src/core/JenkinsEmulationEngine.ts`

**Изменения**:
- Добавить в `JenkinsEmulationConfig.pipelines[]`:
  - `scmConfig?: { type: 'git' | 'svn' | 'mercurial'; url: string; credentials?: string; branch?: string }`
  - `workspacePath?: string` (дефолт: `/var/jenkins_home/workspace/${name}`)
  - `buildTool?: 'maven' | 'gradle' | 'npm' | 'make' | 'custom'`
  - `buildCommand?: string` (кастомная команда)
  - `stages?: Array<{ name: string; type: 'sequential' | 'parallel'; steps?: string[] }>`
  - `artifactPatterns?: string[]` (паттерны для архивирования)

**Задачи**:
1. Расширить интерфейс `JenkinsEmulationConfig`
2. Обновить `initializePipelines()` для чтения новых полей
3. Сохранить конфигурацию в pipeline объекте

#### 1.2 Генерация реалистичных commit hash

**Файл**: `src/core/JenkinsEmulationEngine.ts`

**Новый метод**:
```typescript
private generateCommitHash(): string {
  // Генерирует SHA-1 формат commit hash (40 символов)
  const chars = '0123456789abcdef';
  let hash = '';
  for (let i = 0; i < 40; i++) {
    hash += chars[Math.floor(Math.random() * chars.length)];
  }
  return hash;
}
```

**Задачи**:
1. Создать метод `generateCommitHash()`
2. Использовать в `generateBuildLogs()` вместо `abc123def456789`
3. Сохранять commit hash в build для консистентности

#### 1.3 Динамические SCM репозитории

**Файл**: `src/core/JenkinsEmulationEngine.ts`

**Изменения в `generateBuildLogs()`**:
- Читать `scmConfig` из pipeline конфига
- Использовать реальный URL вместо `https://github.com/example/`
- Поддерживать разные типы SCM (Git, SVN, Mercurial)
- Генерировать логи в зависимости от типа SCM

**Задачи**:
1. Обновить `generateBuildLogs()` для использования `scmConfig`
2. Создать методы генерации логов для каждого типа SCM:
   - `generateGitLogs()`
   - `generateSvnLogs()`
   - `generateMercurialLogs()`
3. Использовать реальные команды для каждого SCM

### Этап 2: Динамические stages и build tools

#### 2.1 Поддержка разных build tools

**Файл**: `src/core/JenkinsEmulationEngine.ts`

**Новый метод**:
```typescript
private generateBuildToolLogs(
  buildTool: string, 
  buildCommand: string | undefined,
  stageName: string
): string[] {
  // Генерирует логи в зависимости от build tool
  switch (buildTool) {
    case 'maven':
      return this.generateMavenLogs(buildCommand, stageName);
    case 'gradle':
      return this.generateGradleLogs(buildCommand, stageName);
    case 'npm':
      return this.generateNpmLogs(buildCommand, stageName);
    case 'make':
      return this.generateMakeLogs(buildCommand, stageName);
    case 'custom':
      return this.generateCustomLogs(buildCommand || '', stageName);
    default:
      return this.generateGenericLogs(stageName);
  }
}
```

**Задачи**:
1. Создать метод `generateBuildToolLogs()`
2. Реализовать генераторы для каждого build tool:
   - `generateMavenLogs()` - Maven команды и вывод
   - `generateGradleLogs()` - Gradle команды и вывод
   - `generateNpmLogs()` - npm/yarn команды и вывод
   - `generateMakeLogs()` - make команды и вывод
   - `generateCustomLogs()` - кастомные команды
3. Интегрировать в `generateBuildLogs()`

#### 2.2 Динамические stages

**Файл**: `src/core/JenkinsEmulationEngine.ts`

**Изменения в `startBuild()`**:
- Читать `stages` из конфига pipeline
- Если stages не заданы, использовать дефолтные на основе buildTool
- Генерировать stages динамически

**Задачи**:
1. Обновить `startBuild()` для чтения stages из конфига
2. Создать метод `generateStagesFromConfig()` для создания stages
3. Обновить `updateBuildLogs()` для работы с динамическими stages
4. Поддержать параллельные stages (type: 'parallel')

### Этап 3: Улучшение генерации артефактов

#### 3.1 Конфигурируемые паттерны артефактов

**Файл**: `src/core/JenkinsEmulationEngine.ts`

**Изменения в `generateArtifacts()`**:
- Читать `artifactPatterns` из конфига pipeline
- Если паттерны не заданы, использовать дефолтные на основе buildTool
- Генерировать артефакты на основе паттернов

**Новый метод**:
```typescript
private generateArtifactsFromPatterns(
  pipelineName: string,
  buildNumber: number,
  patterns: string[],
  buildTool: string
): Array<{ name: string; size: number }> {
  // Генерирует артефакты на основе паттернов
  // Поддерживает wildcards: **/*.jar, target/*.war, dist/**/*
}
```

**Задачи**:
1. Обновить `generateArtifacts()` для использования паттернов
2. Создать парсер паттернов (поддержка wildcards)
3. Генерировать артефакты на основе buildTool:
   - Java: JAR, WAR, EAR файлы
   - Node.js: npm packages, tarballs
   - Python: wheels, eggs
   - Docker: image manifests
4. Динамические размеры на основе типа артефакта

#### 3.2 Реалистичные размеры артефактов

**Файл**: `src/core/JenkinsEmulationEngine.ts`

**Новый метод**:
```typescript
private estimateArtifactSize(
  artifactName: string,
  buildTool: string
): number {
  // Оценивает размер артефакта на основе имени и build tool
  // Использует реалистичные диапазоны для разных типов
}
```

**Задачи**:
1. Создать метод `estimateArtifactSize()`
2. Определить диапазоны размеров для разных типов артефактов
3. Добавить вариативность (±20-30%)

### Этап 4: Полный парсер cron выражений

#### 4.1 Реализация cron парсера

**Файл**: `src/core/JenkinsEmulationEngine.ts` или `src/utils/cronParser.ts`

**Новый класс/утилита**:
```typescript
class CronParser {
  /**
   * Парсит cron выражение (5 полей: minute hour day month weekday)
   * Поддерживает: *, ,, -, /, H, ?
   */
  static parse(cronExpression: string): CronFields;
  
  /**
   * Проверяет, должен ли триггер сработать в указанное время
   */
  static shouldTrigger(cronExpression: string, currentTime: Date): boolean;
  
  /**
   * Вычисляет следующее время срабатывания
   */
  static getNextTriggerTime(cronExpression: string, fromTime: Date): Date;
}
```

**Задачи**:
1. Создать `CronParser` класс
2. Реализовать парсинг всех полей cron
3. Поддержать специальные символы:
   - `*` - любое значение
   - `,` - список значений
   - `-` - диапазон
   - `/` - шаг
   - `H` - Jenkins hash (случайное значение в диапазоне)
   - `?` - любое значение (только для day/month)
4. Обновить `shouldTriggerCron()` для использования парсера

#### 4.2 Jenkins-специфичные паттерны

**Задачи**:
1. Поддержать `H` символ (hash) для распределения нагрузки
2. Поддержать `@yearly`, `@monthly`, `@weekly`, `@daily`, `@hourly`
3. Валидация cron выражений с понятными ошибками

### Этап 5: Улучшение плагинов

#### 5.1 Конфигурируемые версии плагинов

**Файл**: `src/core/JenkinsEmulationEngine.ts`

**Изменения в `JenkinsEmulationConfig`**:
- Изменить `plugins?: string[]` на `plugins?: Array<string | { name: string; version?: string; enabled?: boolean }>`

**Изменения в `initializePlugins()`**:
- Поддерживать версии из конфига
- Использовать дефолтные версии только если не указаны
- Валидировать формат версий (semver)

**Задачи**:
1. Обновить интерфейс конфигурации
2. Обновить `initializePlugins()` для поддержки версий
3. Добавить валидацию версий
4. Обновить UI для редактирования версий плагинов

#### 5.2 Расширяемый список плагинов

**Файл**: `src/core/JenkinsEmulationEngine.ts` или `src/data/jenkinsPlugins.ts`

**Новый файл с метаданными плагинов**:
```typescript
export const JENKINS_PLUGINS: Record<string, PluginMetadata> = {
  'git': {
    name: 'Git',
    latestVersion: '4.11.0',
    description: 'Git integration plugin',
    dependencies: [],
    category: 'scm',
  },
  // ... больше плагинов
};
```

**Задачи**:
1. Создать файл с метаданными плагинов
2. Расширить список популярных плагинов (50+)
3. Добавить категории плагинов
4. Обновить `initializePlugins()` для использования метаданных

### Этап 6: Улучшение UI

#### 6.1 Конфигурация SCM в UI

**Файл**: `src/components/config/devops/JenkinsConfigAdvanced.tsx`

**Изменения**:
- Добавить секцию "SCM Configuration" в редактирование pipeline
- Поля: тип SCM, URL, credentials, branch
- Валидация URL

**Задачи**:
1. Добавить UI для SCM конфигурации
2. Валидация URL и типа SCM
3. Сохранение в конфиг pipeline

#### 6.2 Конфигурация build tool и stages

**Файл**: `src/components/config/devops/JenkinsConfigAdvanced.tsx`

**Изменения**:
- Добавить выбор build tool
- Добавить редактор stages (добавление/удаление/редактирование)
- Поддержка параллельных stages

**Задачи**:
1. Добавить UI для выбора build tool
2. Создать редактор stages
3. Валидация stages
4. Сохранение в конфиг pipeline

#### 6.3 Конфигурация артефактов

**Файл**: `src/components/config/devops/JenkinsConfigAdvanced.tsx`

**Изменения**:
- Добавить редактор паттернов артефактов
- Предпросмотр сгенерированных артефактов

**Задачи**:
1. Добавить UI для паттернов артефактов
2. Валидация паттернов
3. Предпросмотр артефактов

#### 6.4 Улучшение email конфигурации

**Файл**: `src/components/config/devops/JenkinsConfigAdvanced.tsx`

**Изменения**:
- Валидация email адресов
- Удалить `default@example.com` из дефолтов

**Задачи**:
1. Добавить валидацию email
2. Обновить дефолтные значения
3. Показывать ошибки валидации

### Этап 7: Улучшение workspace и путей

#### 7.1 Конфигурируемые workspace пути

**Файл**: `src/core/JenkinsEmulationEngine.ts`

**Изменения**:
- Добавить глобальную настройку `defaultWorkspacePath` в конфиг
- Поддержать `workspacePath` на уровне pipeline
- Использовать в `generateBuildLogs()`

**Задачи**:
1. Добавить `defaultWorkspacePath` в конфиг
2. Обновить `generateBuildLogs()` для использования workspacePath
3. Поддержать переменные окружения в путях (${WORKSPACE}, ${JOB_NAME})

### Этап 8: Тестирование и валидация

#### 8.1 Тестирование cron парсера

**Задачи**:
1. Создать тесты для всех cron паттернов
2. Тестировать Jenkins-специфичные паттерны
3. Проверить edge cases

#### 8.2 Тестирование генерации логов

**Задачи**:
1. Проверить реалистичность логов для разных build tools
2. Проверить корректность путей и URL
3. Проверить генерацию commit hash

#### 8.3 Тестирование артефактов

**Задачи**:
1. Проверить генерацию артефактов для разных build tools
2. Проверить размеры артефактов
3. Проверить паттерны артефактов

## Приоритеты реализации

### Высокий приоритет (критично для симулятивности)
1. ✅ **ВЫПОЛНЕНО** Этап 1: Конфигурация pipeline и динамические параметры
   - ✅ Расширен интерфейс JenkinsEmulationConfig с новыми полями (scmConfig, workspacePath, buildTool, stages, artifactPatterns)
   - ✅ Реализована генерация реалистичных commit hash (SHA-1 формат, 40 символов)
   - ✅ Реализованы динамические SCM репозитории (Git, SVN, Mercurial) с генерацией логов для каждого типа
   - ✅ Добавлена поддержка defaultWorkspacePath в конфиге
2. ✅ **ВЫПОЛНЕНО** Этап 2: Динамические stages и build tools
   - ✅ Реализована поддержка разных build tools (Maven, Gradle, npm, make, custom)
   - ✅ Созданы методы генерации логов для каждого build tool (generateMavenLogs, generateGradleLogs, generateNpmLogs, generateMakeLogs, generateCustomLogs)
   - ✅ Реализованы динамические stages из конфига pipeline
   - ✅ Добавлена поддержка параллельных stages (type: 'parallel')
   - ✅ Реализован метод getDefaultStages() для генерации дефолтных stages на основе build tool
3. ✅ **ВЫПОЛНЕНО** Этап 4: Полный парсер cron выражений
   - ✅ Создан класс CronParser в src/utils/cronParser.ts
   - ✅ Реализован полный парсер cron выражений (5 полей: minute, hour, day, month, weekday)
   - ✅ Поддержка специальных символов: *, ,, -, /, H, ?
   - ✅ Поддержка Jenkins-специфичных макросов (@yearly, @monthly, @weekly, @daily, @hourly)
   - ✅ Реализованы методы shouldTrigger() и getNextTriggerTime()
   - ✅ Обновлен shouldTriggerCron() для использования CronParser

### Средний приоритет (улучшение реалистичности)
4. ✅ **ВЫПОЛНЕНО** Этап 3: Улучшение генерации артефактов
   - ✅ Реализованы конфигурируемые паттерны артефактов (artifactPatterns)
   - ✅ Создан метод generateArtifactsFromPattern() для парсинга паттернов (поддержка wildcards: **/*.jar, target/*.war)
   - ✅ Реализован метод estimateArtifactSize() для реалистичных размеров артефактов
   - ✅ Добавлена поддержка разных типов артефактов (JAR, WAR, EAR, npm packages, Docker images, etc.)
   - ✅ Реализован метод generateDefaultArtifacts() для генерации дефолтных артефактов на основе build tool
5. ✅ **ВЫПОЛНЕНО** Этап 5: Улучшение плагинов
   - ✅ Обновлен интерфейс JenkinsEmulationConfig для поддержки версий плагинов (Array<string | { name: string; version?: string; enabled?: boolean }>)
   - ✅ Создан файл src/data/jenkinsPlugins.ts с метаданными плагинов (50+ плагинов)
   - ✅ Добавлены категории плагинов (scm, build, deploy, ui, security, notification, integration, other)
   - ✅ Реализована валидация версий плагинов (isValidVersion)
   - ✅ Обновлен initializePlugins() для использования метаданных из базы данных плагинов
6. ✅ **ВЫПОЛНЕНО** Этап 6: Улучшение UI
   - ✅ Убран хардкод email адреса (default@example.com) из executePostBuildActions
   - ✅ Добавлена вкладка "Build Configuration" в диалог редактирования pipeline
   - ✅ Реализован UI для конфигурации SCM (тип, URL, credentials, branch) с валидацией URL
   - ✅ Реализован UI для выбора build tool (Maven, Gradle, npm, Make, Custom) и кастомной команды
   - ✅ Реализован редактор stages (добавление/удаление/редактирование, поддержка параллельных stages)
   - ✅ Реализован редактор паттернов артефактов (многострочный ввод с поддержкой wildcards)
   - ✅ Добавлена валидация email адресов в Post-Build Actions (проверка формата и обязательность)

### Низкий приоритет (полировка)
7. ✅ **ВЫПОЛНЕНО** Этап 7: Улучшение workspace и путей
   - ✅ Добавлена поддержка defaultWorkspacePath в конфиге
   - ✅ Реализована поддержка workspacePath на уровне pipeline
   - ✅ Поддержка переменных окружения в путях (${JOB_NAME}, ${WORKSPACE})
8. ⏳ **ОТЛОЖЕНО** Этап 8: Тестирование и валидация
   - ⏳ Требуется: Создание тестов для cron парсера
   - ⏳ Требуется: Тестирование генерации логов для разных build tools
   - ⏳ Требуется: Тестирование генерации артефактов

## Архитектурные принципы

### 1. Избегание хардкода
- Все значения должны быть конфигурируемыми
- Дефолтные значения должны быть реалистичными
- Использовать конфиг компонента как единственный источник истины

### 2. Соответствие реальности
- Изучать реальное поведение Jenkins
- Использовать реальные паттерны логов, артефактов, метрик
- Поддерживать реальные функции Jenkins

### 3. Уникальность компонента
- Не копировать логику из других компонентов
- Каждый компонент имеет свою специфику
- Jenkins - это CI/CD система, не похожа на GitLab CI или Terraform

### 4. Расширяемость
- Легко добавлять новые build tools
- Легко добавлять новые типы SCM
- Легко добавлять новые типы артефактов

## Файлы для изучения перед началом

### Обязательные
1. `src/core/EmulationEngine.ts` - понять как инициализируются движки
2. `src/core/DataFlowEngine.ts` - понять как обрабатываются потоки данных
3. `src/core/JenkinsEmulationEngine.ts` - текущая реализация
4. `src/components/config/devops/JenkinsConfigAdvanced.tsx` - текущий UI

### Рекомендуемые (для понимания паттернов, НЕ для копирования)
1. `src/core/GitLabCIEmulationEngine.ts` - пример другого CI/CD компонента
2. `src/core/TerraformEmulationEngine.ts` - пример другого DevOps компонента
3. `.cursor/rules/context.mdc` - правила проекта
4. `.cursor/rules/connectionsrules.mdc` - правила подключений

## Ресурсы для изучения реального Jenkins

1. **Официальная документация**: https://www.jenkins.io/doc/
2. **Pipeline синтаксис**: https://www.jenkins.io/doc/book/pipeline/syntax/
3. **Cron триггеры**: https://www.jenkins.io/doc/book/pipeline/syntax/#cron-syntax
4. **SCM плагины**: https://plugins.jenkins.io/?query=scm
5. **Build tools**: Maven, Gradle, npm документация

## Чеклист перед началом работы

- [ ] Прочитан `src/core/EmulationEngine.ts` и понятна инициализация
- [ ] Прочитан `src/core/DataFlowEngine.ts` и понятна обработка данных
- [ ] Прочитан `src/core/JenkinsEmulationEngine.ts` полностью
- [ ] Прочитан `src/components/config/devops/JenkinsConfigAdvanced.tsx` полностью
- [ ] Изучена реальная архитектура Jenkins (документация)
- [ ] Понятны правила из `.cursor/rules/`
- [ ] Выбран этап для реализации
- [ ] Понятны зависимости между этапами

## Примечания для продолжения разработки

1. **Не копировать из других компонентов**: Каждый компонент уникален, Jenkins имеет свою специфику
2. **Следовать правилам курсора**: Всегда проверять `node?.data?.config`, использовать optional chaining
3. **Тестировать изменения**: После каждого этапа проверять работу симуляции
4. **Документировать изменения**: Обновлять комментарии в коде
5. **Избегать хардкода**: Все значения должны быть конфигурируемыми

## Метрики успеха

После реализации всех этапов компонент Jenkins должен:
- ✅ Не содержать хардкода (кроме дефолтных значений)
- ✅ Генерировать реалистичные логи для разных build tools
- ✅ Поддерживать полный парсер cron выражений
- ✅ Генерировать артефакты на основе конфигурации
- ✅ Иметь динамические stages из конфига
- ✅ Соответствовать реальному поведению Jenkins
- ✅ Иметь расширяемую архитектуру

---

**Дата создания**: 2026-01-27  
**Версия плана**: 1.0  
**Статус**: Готов к реализации

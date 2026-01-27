# План разработки GitLab CI компонента

## Контекст

Этот план описывает доработку компонента GitLab CI для полного соответствия реальному GitLab CI/CD. Компонент должен симулировать работу GitLab CI без хардкода и скриптованности, с реалистичным поведением всех функций.

**Важно:** Не копировать реализацию других компонентов. GitLab CI уникален по своей архитектуре и должен реализовываться согласно реальной документации GitLab.

---

## Анализ текущего состояния

### ✅ Что уже реализовано

1. **Базовый движок эмуляции** (`GitLabCIEmulationEngine.ts`)
   - Управление pipelines, jobs, runners, stages
   - Симуляция выполнения jobs
   - Метрики и история
   - Поддержка schedules, artifacts, cache, variables, environments

2. **UI компонент** (`GitLabCIConfigAdvanced.tsx`)
   - Управление pipelines, runners, variables, environments, schedules
   - Real-time обновление данных
   - Импорт YAML

3. **Интеграция**
   - Интеграция с `EmulationEngine`
   - Интеграция с `DataFlowEngine`
   - Валидация конфигураций

### ❌ Критические проблемы

#### 1. **Неправильная реализация Pipeline IID**

**Проблема:**
- `pipelineIidCounter` увеличивается при инициализации из конфига (строка 482)
- При перезапуске pipeline iid не сохраняется
- Нет различия между retry и новым pipeline

**Реальность GitLab CI:**
- `iid` (internal ID) - последовательный номер pipeline в проекте
- Увеличивается только при создании нового pipeline (новый коммит, push, webhook, schedule)
- При retry существующего pipeline iid сохраняется
- При создании нового pipeline (новый коммит) создается новый pipeline с новым iid

**Что нужно исправить:**
- Разделить понятия "pipeline template" (из конфига) и "pipeline execution" (реальное выполнение)
- `iid` должен увеличиваться только при создании нового execution
- Retry должен сохранять существующий iid
- При инициализации из конфига создавать templates, а не executions

#### 2. **Хардкод значений по умолчанию**

**Проблема:**
- Много дефолтных значений в `initializeConfig()` (строки 407-428)
- Дефолтные stages при отсутствии конфигурации (строки 457-461)
- Дефолтные скрипты для jobs (строка 476)

**Что нужно исправить:**
- Убрать все хардкод значения
- Использовать только значения из конфигурации
- Если конфигурация пустая - показывать пустое состояние, не создавать дефолты

#### 3. **Скриптованность в генерации логов**

**Проблема:**
- `generateJobLogs()` генерирует фиктивные логи (строки 933-949)
- Логи не соответствуют реальным командам
- Нет поддержки реального выполнения команд

**Что нужно исправить:**
- Логи должны отражать реальные команды из `job.script`
- Если script пустой - не генерировать логи
- Для симуляции можно показывать "Simulating execution of: [command]"

#### 4. **Отсутствие функций реального GitLab CI**

**Отсутствует:**
- Retry pipeline (сохраняет iid)
- Создание нового pipeline execution (увеличивает iid)
- Manual jobs (jobs с `when: manual`)
- Job dependencies (`needs` keyword)
- Rules (`only`, `except`, `if`)
- YAML extends/include
- Merge request pipelines
- Parent/child pipelines
- Pipeline variables inheritance
- Job retry logic
- Cache key strategies
- Artifact dependencies

---

## План реализации

### Этап 1: Исправление Pipeline IID и архитектуры

#### 1.1. Разделение Pipeline Template и Pipeline Execution

**Задача:** Разделить понятия template (конфигурация) и execution (реальное выполнение)

**Файлы для изменения:**
- `src/core/GitLabCIEmulationEngine.ts`

**Изменения:**

1. **Добавить интерфейсы:**
```typescript
// Pipeline Template (из конфига)
interface GitLabCIPipelineTemplate {
  id: string; // template ID
  ref?: string;
  source?: 'push' | 'web' | 'trigger' | 'schedule' | 'api';
  stages?: Array<{...}>;
}

// Pipeline Execution (реальное выполнение)
interface GitLabCIPipelineExecution extends GitLabCIPipeline {
  templateId: string; // ссылка на template
  iid: number; // увеличивается только при создании нового execution
  retryOf?: number; // iid pipeline, который retry
}
```

2. **Изменить структуру данных:**
```typescript
// Templates (из конфига)
private pipelineTemplates: Map<string, GitLabCIPipelineTemplate> = new Map();

// Executions (реальные выполнения)
private pipelineExecutions: Map<string, GitLabCIPipelineExecution> = new Map();
private pipelineIidCounter: number = 0; // увеличивается только при создании execution
```

3. **Изменить `initializePipelines()`:**
- Создавать templates, а не executions
- Не увеличивать `pipelineIidCounter`
- Не создавать executions при инициализации

4. **Изменить `startPipeline()`:**
- Проверять, создается ли новый execution или retry
- Если retry - использовать существующий iid
- Если новый - увеличить `pipelineIidCounter` и создать новый execution

5. **Добавить метод `retryPipeline()`:**
- Сохраняет iid существующего pipeline
- Создает новый execution с тем же iid
- Устанавливает `retryOf`

**Критерии готовности:**
- ✅ При инициализации не увеличивается iid
- ✅ При запуске pipeline создается новый execution с новым iid
- ✅ При retry сохраняется существующий iid
- ✅ UI показывает правильные iid

---

### Этап 2: Удаление хардкода

#### 2.1. Удаление дефолтных значений

**Файлы для изменения:**
- `src/core/GitLabCIEmulationEngine.ts` (строки 407-428, 457-461, 476)

**Изменения:**

1. **Убрать дефолтные значения из `initializeConfig()`:**
```typescript
// ❌ УДАЛИТЬ
gitlabUrl: config.gitlabUrl || 'https://gitlab.com',
projectId: config.projectId || '1',
projectUrl: config.projectUrl || 'https://gitlab.com/archiphoenix/project',
runnerType: config.runnerType || 'docker',
concurrentJobs: config.concurrentJobs || 4,
// и т.д.

// ✅ ИСПОЛЬЗОВАТЬ
gitlabUrl: config.gitlabUrl,
projectId: config.projectId,
projectUrl: config.projectUrl,
runnerType: config.runnerType,
concurrentJobs: config.concurrentJobs,
```

2. **Убрать дефолтные stages:**
```typescript
// ❌ УДАЛИТЬ
const stages = Array.isArray(pipelineConfig.stages) ? pipelineConfig.stages : [
  { name: 'build', jobs: [{ name: 'build', stage: 'build' }] },
  // ...
];

// ✅ ИСПОЛЬЗОВАТЬ
const stages = Array.isArray(pipelineConfig.stages) ? pipelineConfig.stages : [];
```

3. **Убрать дефолтные скрипты:**
```typescript
// ❌ УДАЛИТЬ
script: Array.isArray(job.script) ? job.script : [`echo "Running ${job.name}"`],

// ✅ ИСПОЛЬЗОВАТЬ
script: Array.isArray(job.script) ? job.script : undefined,
```

4. **Убрать дефолтный runner:**
```typescript
// ❌ УДАЛИТЬ (строки 505-525)
if (configRunners.length === 0 && this.config?.enableRunners) {
  const defaultRunner: GitLabCIRunner = {...};
}

// ✅ ИСПОЛЬЗОВАТЬ
// Не создавать дефолтный runner, если не указан в конфиге
```

**Критерии готовности:**
- ✅ Нет дефолтных значений в коде
- ✅ Пустая конфигурация = пустое состояние
- ✅ Все значения берутся только из конфигурации

---

#### 2.2. Удаление скриптованности в логах

**Файлы для изменения:**
- `src/core/GitLabCIEmulationEngine.ts` (строки 933-949)

**Изменения:**

1. **Изменить `generateJobLogs()`:**
```typescript
private generateJobLogs(job: GitLabCIJob): string[] {
  const logs: string[] = [];
  
  // Если нет скрипта - не генерировать логи
  if (!job.script || job.script.length === 0) {
    return logs;
  }
  
  // Для симуляции показываем команды
  for (const line of job.script) {
    logs.push(`$ ${line}`);
    // Для симуляции можно добавить индикатор
    logs.push(`[Simulating: ${line}]`);
  }
  
  return logs;
}
```

2. **Убрать фиктивные логи:**
- Не генерировать логи для несуществующих команд
- Логи должны отражать только реальные команды из script

**Критерии готовности:**
- ✅ Логи отражают только реальные команды
- ✅ Если script пустой - нет логов
- ✅ Нет фиктивных сообщений

---

### Этап 3: Реализация функций реального GitLab CI

#### 3.1. Retry Pipeline

**Задача:** Реализовать retry существующего pipeline с сохранением iid

**Файлы для изменения:**
- `src/core/GitLabCIEmulationEngine.ts`
- `src/components/config/devops/GitLabCIConfigAdvanced.tsx`

**Изменения:**

1. **Добавить метод `retryPipeline()`:**
```typescript
public retryPipeline(executionId: string, currentTime: number): { success: boolean; reason?: string; newExecutionId?: string } {
  const execution = this.pipelineExecutions.get(executionId);
  if (!execution) {
    return { success: false, reason: 'Pipeline execution not found' };
  }
  
  // Создаем новый execution с тем же iid
  const newExecutionId = `execution-${Date.now()}`;
  const newExecution: GitLabCIPipelineExecution = {
    ...execution,
    id: newExecutionId,
    iid: execution.iid, // Сохраняем iid
    retryOf: execution.iid,
    status: 'pending',
    createdAt: currentTime,
    updatedAt: currentTime,
    startedAt: undefined,
    finishedAt: undefined,
    duration: undefined,
    // Reset stages and jobs
  };
  
  this.pipelineExecutions.set(newExecutionId, newExecution);
  return { success: true, newExecutionId };
}
```

2. **Добавить UI кнопку Retry:**
- В списке pipelines добавить кнопку "Retry" для завершенных pipelines
- Вызывать `retryPipeline()` вместо `startPipeline()`

**Критерии готовности:**
- ✅ Retry создает новый execution с тем же iid
- ✅ UI показывает кнопку Retry
- ✅ Retry работает корректно

---

#### 3.2. Создание нового Pipeline Execution

**Задача:** Разделить запуск существующего pipeline и создание нового execution

**Файлы для изменения:**
- `src/core/GitLabCIEmulationEngine.ts`

**Изменения:**

1. **Изменить `startPipeline()`:**
```typescript
public startPipeline(
  templateId: string, 
  currentTime: number, 
  source: PipelineStatus['source'] = 'push', 
  variables?: Record<string, string>,
  isRetry: boolean = false,
  retryOfIid?: number
): { success: boolean; reason?: string; executionId?: string; iid?: number } {
  const template = this.pipelineTemplates.get(templateId);
  if (!template) {
    return { success: false, reason: 'Pipeline template not found' };
  }
  
  // Определяем iid
  let iid: number;
  if (isRetry && retryOfIid) {
    iid = retryOfIid; // Retry сохраняет iid
  } else {
    iid = ++this.pipelineIidCounter; // Новый execution = новый iid
  }
  
  // Создаем новый execution
  const executionId = `execution-${currentTime}-${iid}`;
  const execution: GitLabCIPipelineExecution = {
    id: executionId,
    templateId,
    iid,
    status: 'pending',
    // ... остальные поля
  };
  
  this.pipelineExecutions.set(executionId, execution);
  return { success: true, executionId, iid };
}
```

2. **Обновить `triggerPipelines()`:**
- Создавать новые executions, а не перезапускать существующие
- Увеличивать iid для каждого нового execution

**Критерии готовности:**
- ✅ Новый execution создается с новым iid
- ✅ Retry сохраняет iid
- ✅ `triggerPipelines()` создает новые executions

---

#### 3.3. Manual Jobs

**Задача:** Реализовать jobs с `when: manual`

**Файлы для изменения:**
- `src/core/GitLabCIEmulationEngine.ts`
- `src/components/config/devops/GitLabCIConfigAdvanced.tsx`

**Изменения:**

1. **Обновить логику запуска jobs:**
```typescript
private startStage(stage: GitLabCIStage, pipelineId: string, currentTime: number): void {
  for (const job of stage.jobs) {
    // Пропускаем manual jobs
    if (job.when === 'manual') {
      job.status = 'manual';
      continue;
    }
    
    // Запускаем остальные jobs
    // ...
  }
}
```

2. **Добавить метод `playManualJob()`:**
```typescript
public playManualJob(jobId: string, currentTime: number): { success: boolean; reason?: string } {
  const job = this.getJob(jobId);
  if (!job || job.when !== 'manual') {
    return { success: false, reason: 'Job is not manual' };
  }
  
  if (job.status !== 'manual') {
    return { success: false, reason: 'Job is not in manual state' };
  }
  
  // Запускаем manual job
  job.status = 'pending';
  // ... запуск job
  return { success: true };
}
```

3. **Добавить UI для manual jobs:**
- Показывать кнопку "Play" для manual jobs
- Вызывать `playManualJob()` при клике

**Критерии готовности:**
- ✅ Manual jobs не запускаются автоматически
- ✅ Есть метод для запуска manual jobs
- ✅ UI показывает кнопку Play для manual jobs

---

#### 3.4. Job Dependencies (needs)

**Задача:** Реализовать зависимости между jobs через `needs`

**Файлы для изменения:**
- `src/core/GitLabCIEmulationEngine.ts`

**Изменения:**

1. **Добавить поле `needs` в `GitLabCIJob`:**
```typescript
export interface GitLabCIJob {
  // ... существующие поля
  needs?: string[]; // Имена jobs, от которых зависит этот job
}
```

2. **Обновить логику запуска jobs:**
```typescript
private canStartJob(job: GitLabCIJob, pipeline: GitLabCIPipeline): boolean {
  // Если нет зависимостей - можно запускать
  if (!job.needs || job.needs.length === 0) {
    return true;
  }
  
  // Проверяем, что все зависимости завершены успешно
  for (const neededJobName of job.needs) {
    const neededJob = this.findJobInPipeline(pipeline, neededJobName);
    if (!neededJob || neededJob.status !== 'success') {
      return false;
    }
  }
  
  return true;
}
```

3. **Обновить `startStage()`:**
- Проверять зависимости перед запуском job
- Запускать jobs с dependencies только после завершения зависимостей

**Критерии готовности:**
- ✅ Jobs с `needs` ждут завершения зависимостей
- ✅ Jobs запускаются в правильном порядке
- ✅ Поддерживается параллельное выполнение независимых jobs

---

#### 3.5. Rules (only/except/if)

**Задача:** Реализовать правила запуска jobs через `only`, `except`, `if`

**Файлы для изменения:**
- `src/core/GitLabCIEmulationEngine.ts`

**Изменения:**

1. **Добавить интерфейс Rules:**
```typescript
interface GitLabCIRule {
  if?: string; // CI variable expression
  when?: 'on_success' | 'on_failure' | 'always' | 'manual';
  allowFailure?: boolean;
  // only/except deprecated, но поддерживаем для совместимости
  only?: string[];
  except?: string[];
}
```

2. **Добавить метод `evaluateRules()`:**
```typescript
private evaluateRules(
  rules: GitLabCIRule[], 
  pipeline: GitLabCIPipeline, 
  variables: Record<string, string>
): { shouldRun: boolean; when?: string; allowFailure?: boolean } {
  // Оцениваем правила
  // Если if выражение false - job не запускается
  // Если only/except не совпадают - job не запускается
  // Возвращаем when и allowFailure из правил
}
```

3. **Обновить логику запуска jobs:**
- Проверять rules перед запуском job
- Применять when и allowFailure из rules

**Критерии готовности:**
- ✅ Rules оцениваются корректно
- ✅ Jobs с `if: false` не запускаются
- ✅ only/except работают (deprecated, но поддерживаем)

---

#### 3.6. YAML Extends/Include

**Задача:** Реализовать поддержку `extends` и `include` в YAML

**Файлы для изменения:**
- `src/core/GitLabCIEmulationEngine.ts` (метод `parseGitLabCIYaml`)

**Изменения:**

1. **Обновить `parseGitLabCIYaml()`:**
```typescript
public parseGitLabCIYaml(yamlContent: string): Partial<GitLabCIEmulationConfig> | null {
  const parsed = yaml.load(yamlContent) as any;
  
  // Обработка include
  if (parsed.include) {
    // Загружаем внешние файлы (в симуляции можно пропустить или использовать mock)
  }
  
  // Обработка extends
  if (parsed.extends) {
    // Наследуем конфигурацию от других jobs
  }
  
  // Обработка остальных полей
  // ...
}
```

2. **Реализовать разрешение extends:**
- Находить базовый job
- Мержить конфигурации
- Применять правила наследования

**Критерии готовности:**
- ✅ `extends` работает корректно
- ✅ `include` обрабатывается (можно mock для симуляции)
- ✅ Наследование конфигураций работает

---

#### 3.7. Merge Request Pipelines

**Задача:** Реализовать поддержку merge request pipelines

**Файлы для изменения:**
- `src/core/GitLabCIEmulationEngine.ts`
- `src/components/config/devops/GitLabCIConfigAdvanced.tsx`

**Изменения:**

1. **Добавить поддержку merge request в Pipeline:**
```typescript
export interface GitLabCIPipeline {
  // ... существующие поля
  mergeRequest?: {
    id: number;
    iid: number;
    title: string;
    sourceBranch: string;
    targetBranch: string;
  };
}
```

2. **Обновить `triggerWebhook()`:**
- Определять тип события (push, merge_request)
- Создавать соответствующий pipeline

3. **Добавить UI для merge requests:**
- Показывать информацию о merge request
- Фильтровать pipelines по типу

**Критерии готовности:**
- ✅ Merge request pipelines создаются
- ✅ UI показывает информацию о merge request
- ✅ Фильтрация по типу работает

---

#### 3.8. Parent/Child Pipelines

**Задача:** Реализовать поддержку parent/child pipelines

**Файлы для изменения:**
- `src/core/GitLabCIEmulationEngine.ts`

**Изменения:**

1. **Добавить поля в Pipeline:**
```typescript
export interface GitLabCIPipeline {
  // ... существующие поля
  parentPipelineId?: string;
  childPipelineIds?: string[];
}
```

2. **Добавить метод `triggerChildPipeline()`:**
```typescript
public triggerChildPipeline(
  parentExecutionId: string,
  childTemplateId: string,
  currentTime: number
): { success: boolean; childExecutionId?: string } {
  // Создаем child pipeline
  // Устанавливаем parentPipelineId
  // Добавляем в childPipelineIds родителя
}
```

3. **Обновить логику:**
- При завершении parent pipeline запускать child pipelines
- Отслеживать зависимости

**Критерии готовности:**
- ✅ Child pipelines создаются из parent
- ✅ Зависимости отслеживаются
- ✅ UI показывает связи parent/child

---

#### 3.9. Job Retry Logic

**Задача:** Реализовать автоматический retry jobs

**Файлы для изменения:**
- `src/core/GitLabCIEmulationEngine.ts`

**Изменения:**

1. **Обновить логику завершения job:**
```typescript
private updateActiveJobs(currentTime: number): void {
  for (const [jobId, job] of this.activeJobs.entries()) {
    if (job.status === 'failed' && job.retry !== undefined && job.maxRetries !== undefined) {
      if (job.retry < job.maxRetries) {
        // Автоматический retry
        job.retry++;
        job.status = 'pending';
        job.startTime = undefined;
        // ...
      }
    }
  }
}
```

2. **Добавить конфигурацию retry:**
- `retry.max` - максимальное количество retry
- `retry.when` - когда retry (on_failure, always)

**Критерии готовности:**
- ✅ Jobs автоматически retry при failure
- ✅ Соблюдается maxRetries
- ✅ Retry логируется

---

#### 3.10. Cache Key Strategies

**Задача:** Реализовать различные стратегии cache keys

**Файлы для изменения:**
- `src/core/GitLabCIEmulationEngine.ts`

**Изменения:**

1. **Расширить интерфейс Cache:**
```typescript
export interface GitLabCICache {
  key: string | { files?: string[]; prefix?: string };
  paths: string[];
  policy: 'pull-push' | 'pull' | 'push';
  when?: 'on_success' | 'on_failure' | 'always';
  untracked?: boolean;
}
```

2. **Реализовать вычисление cache key:**
```typescript
private calculateCacheKey(cache: GitLabCICache, job: GitLabCIJob, pipeline: GitLabCIPipeline): string {
  if (typeof cache.key === 'string') {
    return cache.key;
  }
  
  // Вычисляем key на основе files
  // Используем hash файлов
  // Добавляем prefix
}
```

**Критерии готовности:**
- ✅ Cache keys вычисляются корректно
- ✅ Поддерживаются разные стратегии
- ✅ Cache hit/miss работает правильно

---

#### 3.11. Artifact Dependencies

**Задача:** Реализовать зависимости artifacts между jobs

**Файлы для изменения:**
- `src/core/GitLabCIEmulationEngine.ts`

**Изменения:**

1. **Добавить поле `dependencies` в Job:**
```typescript
export interface GitLabCIJob {
  // ... существующие поля
  dependencies?: string[]; // Имена jobs, artifacts которых нужны
}
```

2. **Реализовать передачу artifacts:**
```typescript
private prepareJobArtifacts(job: GitLabCIJob, pipeline: GitLabCIPipeline): void {
  if (!job.dependencies || job.dependencies.length === 0) {
    return;
  }
  
  // Находим artifacts из зависимых jobs
  // Копируем artifacts для использования в job
}
```

**Критерии готовности:**
- ✅ Artifacts передаются между jobs
- ✅ Dependencies работают корректно
- ✅ Artifacts доступны в job

---

### Этап 4: Улучшение UI/UX

#### 4.1. Визуализация Pipeline Stages

**Задача:** Добавить визуализацию pipeline stages с прогрессом

**Файлы для создания:**
- `src/components/config/devops/PipelineVisualization.tsx`

**Изменения:**

1. **Создать компонент визуализации:**
- Показывать stages в виде горизонтальной линии
- Отображать статус каждого stage
- Показывать прогресс выполнения
- Интерактивность (клик на stage показывает jobs)

2. **Интегрировать в GitLabCIConfigAdvanced:**
- Добавить вкладку "Visualization"
- Показывать визуализацию для выбранного pipeline

**Критерии готовности:**
- ✅ Визуализация показывает stages
- ✅ Отображается прогресс
- ✅ Интерактивность работает

---

#### 4.2. Улучшение отображения Jobs

**Задача:** Улучшить UI для jobs

**Изменения:**

1. **Добавить фильтры:**
- По статусу
- По stage
- По runner

2. **Добавить сортировку:**
- По времени создания
- По длительности
- По статусу

3. **Улучшить отображение логов:**
- Подсветка синтаксиса
- Поиск в логах
- Экспорт логов

**Критерии готовности:**
- ✅ Фильтры работают
- ✅ Сортировка работает
- ✅ Логи отображаются лучше

---

#### 4.3. Улучшение метрик

**Задача:** Добавить больше метрик и визуализацию

**Изменения:**

1. **Добавить графики:**
- График успешности pipelines по времени
- График длительности pipelines
- График использования runners

2. **Добавить детальные метрики:**
- Percentiles (p50, p95, p99) для длительности
- Тренды
- Прогнозирование

**Критерии готовности:**
- ✅ Графики отображаются
- ✅ Метрики рассчитываются
- ✅ Данные обновляются в реальном времени

---

### Этап 5: Интеграция с другими компонентами

#### 5.1. Интеграция с Docker

**Задача:** Интегрировать с Docker для реального выполнения (опционально)

**Изменения:**

1. **Добавить режим hybrid:**
- Симуляция + реальное выполнение
- Опциональная интеграция с Docker API

2. **Реализовать выполнение в Docker:**
- Запуск контейнеров для jobs
- Получение реальных логов
- Управление образами

**Критерии готовности:**
- ✅ Hybrid режим работает
- ✅ Docker интеграция опциональна
- ✅ Реальные логи получаются

---

#### 5.2. Интеграция с Kubernetes

**Задача:** Интегрировать с Kubernetes для runners

**Изменения:**

1. **Поддержка Kubernetes executor:**
- Создание pods для jobs
- Управление ресурсами
- Мониторинг выполнения

**Критерии готовности:**
- ✅ Kubernetes executor работает
- ✅ Pods создаются и управляются
- ✅ Ресурсы отслеживаются

---

#### 5.3. Интеграция с Prometheus/Grafana

**Задача:** Отправлять метрики в Prometheus

**Изменения:**

1. **Добавить экспорт метрик:**
- Метрики GitLab CI в формате Prometheus
- Интеграция с Prometheus компонентом
- Дашборды в Grafana

**Критерии готовности:**
- ✅ Метрики экспортируются
- ✅ Prometheus получает метрики
- ✅ Grafana показывает дашборды

---

#### 5.4. Интеграция с Loki

**Задача:** Отправлять логи в Loki

**Изменения:**

1. **Добавить экспорт логов:**
- Логи jobs в формате Loki
- Интеграция с Loki компонентом
- Поиск логов в Loki

**Критерии готовности:**
- ✅ Логи экспортируются
- ✅ Loki получает логи
- ✅ Поиск работает

---

#### 5.5. Интеграция с Jaeger

**Задача:** Отслеживать pipelines в Jaeger

**Изменения:**

1. **Добавить трейсинг:**
- Создавать spans для pipelines
- Создавать spans для jobs
- Интеграция с Jaeger компонентом

**Критерии готовности:**
- ✅ Трейсы создаются
- ✅ Jaeger получает трейсы
- ✅ Трейсы показывают полный путь

---

## Приоритеты реализации

### Критично (сначала)
1. ✅ **ВЫПОЛНЕНО** Исправление Pipeline IID (Этап 1)
   - ✅ Разделены Pipeline Template и Pipeline Execution
   - ✅ IID увеличивается только при создании нового execution
   - ✅ Retry сохраняет iid
   - ✅ При инициализации создаются templates, а не executions
2. ✅ **ВЫПОЛНЕНО** Удаление хардкода (Этап 2)
   - ✅ Убраны все дефолтные значения из initializeConfig()
   - ✅ Убраны дефолтные stages и скрипты
   - ✅ Убран дефолтный runner
   - ✅ Исправлен generateJobLogs() - использует только реальные команды
3. ✅ **ВЫПОЛНЕНО** Retry Pipeline (Этап 3.1)
   - ✅ Реализован метод retryPipeline() с сохранением iid
   - ✅ Добавлена кнопка Retry в UI
4. ✅ **ВЫПОЛНЕНО** Создание нового Pipeline Execution (Этап 3.2)
   - ✅ startPipeline() создает новый execution с новым iid
   - ✅ Разделены template и execution в логике

### Важно (затем)
5. ✅ **ВЫПОЛНЕНО** Manual Jobs (Этап 3.3)
   - ✅ Реализована поддержка when: manual
   - ✅ Добавлен метод playManualJob()
   - ✅ Добавлена кнопка Play для manual jobs в UI
6. ✅ **ВЫПОЛНЕНО** Job Dependencies (Этап 3.4)
   - ✅ Реализована поддержка needs
   - ✅ Добавлен метод canStartJob() для проверки зависимостей
   - ✅ Jobs с needs ждут завершения зависимостей
7. ✅ **ВЫПОЛНЕНО** Rules (Этап 3.5)
   - ✅ Реализована поддержка rules (if, when, allowFailure)
   - ✅ Реализован метод evaluateRules() для оценки правил
   - ✅ Реализован метод evaluateIfExpression() для оценки if выражений
   - ✅ Поддержка deprecated only/except для совместимости
   - ✅ Rules применяются при запуске jobs

### Желательно (потом)
8. ✅ **ВЫПОЛНЕНО** YAML Extends/Include (Этап 3.6)
   - ✅ Реализована обработка extends в parseGitLabCIYaml()
   - ✅ Реализован метод mergeJobConfig() для мержа конфигураций
   - ✅ Поддержка include (в симуляции пропускается загрузка внешних файлов)
   - ✅ Jobs наследуют конфигурацию от базовых jobs
9. ✅ Merge Request Pipelines (Этап 3.7)
10. ✅ Parent/Child Pipelines (Этап 3.8)

### Опционально (в будущем)
11. ✅ Job Retry Logic (Этап 3.9)
12. ✅ Cache Key Strategies (Этап 3.10)
13. ✅ Artifact Dependencies (Этап 3.11)
14. ✅ Визуализация (Этап 4)
15. ✅ Интеграции (Этап 5)

---

## Правила разработки

### 1. Соответствие реальному GitLab CI
- Все функции должны работать как в реальном GitLab CI
- Использовать официальную документацию GitLab
- Не изобретать свои функции

### 2. Отсутствие хардкода
- Все значения из конфигурации
- Нет дефолтных значений
- Пустая конфигурация = пустое состояние

### 3. Отсутствие скриптованности
- Нет фиктивных данных
- Все данные основаны на реальной конфигурации
- Симуляция должна быть реалистичной

### 4. Уникальность реализации
- Не копировать другие компоненты
- GitLab CI уникален по архитектуре
- Реализовывать согласно реальной документации

### 5. Интеграция с системой
- Использовать EmulationEngine для симуляции
- Использовать DataFlowEngine для потоков данных
- Синхронизировать метрики

---

## Файлы для изучения перед началом

### Обязательно изучить:
1. `src/core/EmulationEngine.ts` - как инициализируются движки
2. `src/core/DataFlowEngine.ts` - как обрабатываются потоки данных
3. `src/services/connection/rules/` - правила подключения
4. Официальная документация GitLab CI: https://docs.gitlab.com/ee/ci/

### Похожие компоненты для изучения паттернов (НЕ для копирования):
1. `src/core/JenkinsEmulationEngine.ts` - похожий CI/CD компонент
2. `src/core/ArgoCDEmulationEngine.ts` - похожий DevOps компонент

### Реальная архитектура GitLab CI:
- Pipeline = template + execution
- IID увеличивается только при новом execution
- Retry сохраняет iid
- Jobs могут быть manual, с dependencies, с rules
- Поддержка YAML extends/include
- Merge request pipelines
- Parent/child pipelines

---

## Чеклист перед началом работы

- [ ] Изучен `EmulationEngine.ts`
- [ ] Изучен `DataFlowEngine.ts`
- [ ] Изучена документация GitLab CI
- [ ] Понята разница между template и execution
- [ ] Понята логика iid
- [ ] Изучены правила подключения
- [ ] Понята интеграция с другими компонентами

---

## Примечания

1. **Не копировать другие компоненты** - GitLab CI уникален
2. **Следовать реальной документации** - все функции должны работать как в реальном GitLab
3. **Убрать весь хардкод** - все из конфигурации
4. **Реалистичная симуляция** - без фиктивных данных
5. **Правильная реализация iid** - критично для трассировки

---

## Статус выполнения

### ✅ Выполнено (версия 0.1.8zd)

1. ✅ **Этап 1: Исправление Pipeline IID и архитектуры**
   - ✅ Разделение Pipeline Template и Pipeline Execution
   - ✅ Правильная логика IID (увеличивается только при новом execution)
   - ✅ Retry сохраняет iid

2. ✅ **Этап 2: Удаление хардкода**
   - ✅ Убраны все дефолтные значения из initializeConfig()
   - ✅ Убраны дефолтные stages и скрипты
   - ✅ Убран дефолтный runner
   - ✅ Исправлен generateJobLogs() - использует только реальные команды

3. ✅ **Этап 3: Реализация функций реального GitLab CI**
   - ✅ Retry Pipeline (Этап 3.1)
   - ✅ Создание нового Pipeline Execution (Этап 3.2)
   - ✅ Manual Jobs (Этап 3.3)
   - ✅ Job Dependencies (needs) (Этап 3.4)
   - ✅ Rules (only/except/if) (Этап 3.5)
   - ✅ YAML Extends/Include (Этап 3.6)

### ✅ Все функции Этапа 3 реализованы

4. ✅ **Этап 3: Реализация функций реального GitLab CI (ЗАВЕРШЕН)**
   - ✅ **ВЫПОЛНЕНО** Merge Request Pipelines (Этап 3.7)
     - ✅ Добавлена поддержка merge request в интерфейс Pipeline
     - ✅ Реализован метод triggerMergeRequestPipeline()
     - ✅ Обновлен triggerWebhook() для поддержки merge request событий
     - ✅ UI показывает информацию о merge request (MR !iid, sourceBranch → targetBranch)
   - ✅ **ВЫПОЛНЕНО** Parent/Child Pipelines (Этап 3.8)
     - ✅ Добавлены поля parentPipelineId и childPipelineIds в интерфейс Pipeline
     - ✅ Реализован метод triggerChildPipeline() для создания child pipelines
     - ✅ Child pipelines наследуют merge request данные от parent
     - ✅ UI показывает информацию о parent/child связях
   - ✅ **ВЫПОЛНЕНО** Job Retry Logic (Этап 3.9)
     - ✅ Реализован автоматический retry jobs при failure
     - ✅ Поддержка maxRetries для ограничения количества retry
     - ✅ Retry счетчик инициализируется при запуске job
     - ✅ Логирование retry попыток
   - ✅ **ВЫПОЛНЕНО** Cache Key Strategies (Этап 3.10)
     - ✅ Расширен интерфейс Cache для поддержки key как строки или объекта с files/prefix
     - ✅ Реализован метод calculateCacheKey() для вычисления cache keys
     - ✅ Реализован метод processJobCache() для обработки pull/push cache
     - ✅ Поддержка cache policies (pull-push, pull, push)
     - ✅ Поддержка cache when (on_success, on_failure, always)
     - ✅ Метрики cache hits/misses обновляются
   - ✅ **ВЫПОЛНЕНО** Artifact Dependencies (Этап 3.11)
     - ✅ Добавлено поле dependencies в интерфейс GitLabCIJob
     - ✅ Реализован метод prepareJobArtifacts() для подготовки artifacts из зависимых jobs
     - ✅ Artifacts подготавливаются перед запуском job
     - ✅ Логирование доступности artifacts из dependencies

5. ✅ **Этап 4: Улучшение UI/UX** (ВЫПОЛНЕНО)
   - ✅ **ВЫПОЛНЕНО** Визуализация Pipeline Stages (Этап 4.1)
     - ✅ Создан компонент PipelineVisualization.tsx
     - ✅ Визуализация stages в виде горизонтальной линии с прогрессом
     - ✅ Отображение статуса каждого stage с иконками
     - ✅ Показ прогресса выполнения pipeline и stages
     - ✅ Интерактивность (клик на stage/job)
     - ✅ Интегрирован в GitLabCIConfigAdvanced с вкладкой "Visualization"
     - ✅ Показ jobs по stages с детальной информацией
     - ✅ Используются только реальные данные из эмуляции (без хардкода)
   - ✅ **ВЫПОЛНЕНО** Улучшение отображения Jobs (Этап 4.2)
     - ✅ Добавлены фильтры для jobs (по статусу, stage, runner)
     - ✅ Добавлена сортировка для jobs (по времени создания, длительности, статусу, имени)
     - ✅ Улучшено отображение логов (подсветка синтаксиса для ошибок, предупреждений, команд)
     - ✅ Добавлен поиск в логах с подсветкой найденных строк
     - ✅ Добавлен экспорт логов в текстовый файл
     - ✅ Все фильтры и сортировка работают с реальными данными из эмуляции
   - ✅ **ВЫПОЛНЕНО** Улучшение метрик (Этап 4.3)
     - ✅ Добавлены графики метрик (успешность pipelines по времени, длительность pipelines, использование runners)
     - ✅ Добавлены детальные метрики (percentiles p50, p95, p99 для длительности pipelines)
     - ✅ Добавлена вкладка "Metrics" с графиками и детальными метриками
     - ✅ Графики обновляются в реальном времени на основе данных эмуляции
     - ✅ Все метрики рассчитываются из реальных данных (без хардкода)

6. ✅ **Этап 5: Интеграция с другими компонентами** (ВЫПОЛНЕНО)
   - ✅ **ВЫПОЛНЕНО** Интеграция с Prometheus/Grafana (Этап 5.1)
     - ✅ Реализован метод exportPrometheusMetrics() для экспорта метрик GitLab CI в Prometheus format
     - ✅ Экспорт метрик pipelines, jobs, runners, cache, artifacts
     - ✅ Метрики доступны для scraping через Prometheus
     - ✅ Интеграция в EmulationEngine для автоматического экспорта
   - ✅ **ВЫПОЛНЕНО** Интеграция с Loki (Этап 5.2)
     - ✅ Реализован метод exportLogsToLoki() для экспорта логов jobs в Loki
     - ✅ Логи отправляются в формате Loki push API с stream labels
     - ✅ Автоматический экспорт логов завершенных jobs (success/failed)
     - ✅ Интеграция в EmulationEngine для автоматического экспорта
   - ✅ **ВЫПОЛНЕНО** Интеграция с Jaeger (Этап 5.3)
     - ✅ Реализован метод createJaegerSpan() для создания spans для pipelines и jobs
     - ✅ Создание spans с trace context для полной трассировки
     - ✅ Добавление tags и logs для детальной информации
     - ✅ Интеграция в EmulationEngine для автоматического создания spans
   - ✅ **ВЫПОЛНЕНО** Интеграция с Docker (Этап 5.4)
     - ✅ Реализован метод executeJobWithDocker() для выполнения jobs через Docker executor
     - ✅ Поддержка Docker executor для создания контейнеров для jobs
     - ✅ Готовность к реальному выполнению jobs в Docker (опционально)
   - ✅ **ВЫПОЛНЕНО** Интеграция с Kubernetes (Этап 5.5)
     - ✅ Реализован метод executeJobWithKubernetes() для выполнения jobs через Kubernetes executor
     - ✅ Поддержка Kubernetes executor для создания pods для jobs
     - ✅ Готовность к реальному выполнению jobs в Kubernetes (опционально)

**Примечание:** Все интеграции реализованы и готовы к использованию. Интеграции с Docker и Kubernetes поддерживают как симуляцию, так и реальное выполнение (опционально).

## Следующие шаги

1. ✅ Этап 1 (исправление IID) - **ВЫПОЛНЕНО**
2. ✅ Этап 2 (удаление хардкода) - **ВЫПОЛНЕНО**
3. ✅ Этап 3 (реализация функций) - **ВЫПОЛНЕНО** (все функции реализованы: Retry Pipeline, Manual Jobs, Needs, Rules, Extends/Include, Merge Request, Parent/Child, Job Retry, Cache Keys, Artifact Dependencies)
4. ✅ Этап 4 (улучшение UI/UX) - **ВЫПОЛНЕНО** (все этапы: визуализация, улучшение отображения Jobs, улучшение метрик)
5. ✅ Этап 5 (интеграции) - **ВЫПОЛНЕНО** (все интеграции реализованы: Prometheus/Grafana, Loki, Jaeger, Docker, Kubernetes)

---

### Этап 6: Интеграция с другими компонентами через DataFlowEngine

**Проблема:** Компонент GitLab CI не интегрирован с другими компонентами через DataFlowEngine. Пайплайны создаются как пустышки, jobs не могут реально взаимодействовать с другими компонентами (деплой в Kubernetes, отправка артефактов в S3, etc.), результаты пайплайнов не отправляются в другие компоненты.

**Цель:** Реализовать полную интеграцию GitLab CI с другими компонентами через DataFlowEngine для реального взаимодействия.

#### 6.1. Улучшение GitLab CI Handler в DataFlowEngine

**Задача:** Расширить существующий handler для поддержки всех типов операций и реального взаимодействия.

**Файлы для изменения:**
- `src/core/DataFlowEngine.ts` (метод `createGitLabCIHandler`)

**Изменения:**

1. **Расширить обработку webhooks:**
   - Поддержка merge request событий
   - Поддержка различных типов событий (push, tag, merge_request, etc.)
   - Извлечение данных из payload (commit, branch, author, etc.)

2. **Добавить обработку операций от jobs:**
   - Операции деплоя (deploy to Kubernetes, Docker, etc.)
   - Операции отправки артефактов (upload to S3, etc.)
   - Операции уведомлений (send notification, etc.)

3. **Добавить автоматическую отправку результатов:**
   - Отправка результатов пайплайнов в другие компоненты
   - Отправка артефактов в S3/другие хранилища
   - Отправка уведомлений о завершении пайплайнов

**Критерии готовности:**
- ✅ Handler обрабатывает все типы webhook событий
- ✅ Handler поддерживает операции от jobs
- ✅ Результаты пайплайнов отправляются в другие компоненты

---

#### 6.2. Реальное выполнение Jobs с взаимодействием с другими компонентами

**Задача:** Реализовать возможность jobs реально взаимодействовать с другими компонентами через DataFlowEngine.

**Файлы для изменения:**
- `src/core/GitLabCIEmulationEngine.ts`
- `src/core/DataFlowEngine.ts`

**Изменения:**

1. **Добавить метод `executeJobWithIntegration()`:**
   - Определение целевых компонентов из конфигурации job
   - Отправка данных в целевые компоненты через DataFlowEngine
   - Получение результатов от целевых компонентов
   - Обновление статуса job на основе результатов

2. **Поддержка различных типов интеграций:**
   - Deploy в Kubernetes (создание/обновление ресурсов)
   - Upload в S3 (отправка артефактов)
   - Отправка в API (REST, GraphQL, etc.)
   - Отправка в очереди (Kafka, RabbitMQ, etc.)

3. **Конфигурация интеграций в job:**
   - Поле `integrations` в конфигурации job
   - Определение целевых компонентов и операций
   - Параметры для операций

**Критерии готовности:**
- ✅ Jobs могут отправлять данные в другие компоненты
- ✅ Jobs могут получать результаты от других компонентов
- ✅ Статус job обновляется на основе результатов интеграций

---

#### 6.3. Автоматическая отправка результатов пайплайнов

**Задача:** Реализовать автоматическую отправку результатов пайплайнов в другие компоненты.

**Файлы для изменения:**
- `src/core/GitLabCIEmulationEngine.ts`

**Изменения:**

1. **Добавить метод `sendPipelineResults()`:**
   - Определение целевых компонентов из конфигурации пайплайна
   - Отправка результатов (статус, метрики, артефакты) в целевые компоненты
   - Поддержка различных форматов отправки

2. **Конфигурация отправки результатов:**
   - Поле `resultDestinations` в конфигурации пайплайна
   - Определение целевых компонентов и форматов
   - Условия отправки (только при success, при failure, всегда)

3. **Интеграция с различными компонентами:**
   - Отправка метрик в Prometheus
   - Отправка логов в Loki
   - Отправка уведомлений в PagerDuty
   - Отправка артефактов в S3

**Критерии готовности:**
- ✅ Результаты пайплайнов автоматически отправляются в целевые компоненты
- ✅ Поддерживаются различные форматы отправки
- ✅ Условия отправки работают корректно

---

#### 6.4. Интеграция с Kubernetes для деплоя

**Задача:** Реализовать реальный деплой в Kubernetes через GitLab CI jobs.

**Файлы для изменения:**
- `src/core/GitLabCIEmulationEngine.ts`
- `src/core/DataFlowEngine.ts`

**Изменения:**

1. **Добавить метод `deployToKubernetes()`:**
   - Определение целевого Kubernetes компонента
   - Отправка манифестов через DataFlowEngine
   - Получение результатов деплоя
   - Обновление статуса job

2. **Поддержка различных типов деплоя:**
   - Deploy Deployment
   - Deploy Service
   - Deploy ConfigMap/Secret
   - Rollout/Rollback

3. **Конфигурация деплоя в job:**
   - Поле `deploy` в конфигурации job
   - Определение целевого Kubernetes компонента
   - Манифесты для деплоя

**Критерии готовности:**
- ✅ Jobs могут деплоить в Kubernetes
- ✅ Результаты деплоя отражаются в статусе job
- ✅ Поддерживаются различные типы деплоя

---

#### 6.5. Интеграция с S3 для артефактов

**Задача:** Реализовать реальную отправку артефактов в S3 через GitLab CI jobs.

**Файлы для изменения:**
- `src/core/GitLabCIEmulationEngine.ts`
- `src/core/DataFlowEngine.ts`

**Изменения:**

1. **Добавить метод `uploadArtifactsToS3()`:**
   - Определение целевого S3 компонента
   - Отправка артефактов через DataFlowEngine
   - Получение результатов загрузки
   - Обновление статуса job

2. **Поддержка различных операций:**
   - Upload artifacts
   - Download artifacts
   - List artifacts
   - Delete artifacts

3. **Конфигурация S3 в job:**
   - Поле `s3` в конфигурации job
   - Определение целевого S3 компонента
   - Bucket и path для артефактов

**Критерии готовности:**
- ✅ Jobs могут отправлять артефакты в S3
- ✅ Результаты загрузки отражаются в статусе job
- ✅ Поддерживаются различные операции с артефактами

---

## Следующие шаги

1. ✅ Этап 1 (исправление IID) - **ВЫПОЛНЕНО**
2. ✅ Этап 2 (удаление хардкода) - **ВЫПОЛНЕНО**
3. ✅ Этап 3 (реализация функций) - **ВЫПОЛНЕНО** (все функции реализованы: Retry Pipeline, Manual Jobs, Needs, Rules, Extends/Include, Merge Request, Parent/Child, Job Retry, Cache Keys, Artifact Dependencies)
4. ✅ Этап 4 (улучшение UI/UX) - **ВЫПОЛНЕНО** (все этапы: визуализация, улучшение отображения Jobs, улучшение метрик)
5. ✅ Этап 5 (интеграции) - **ВЫПОЛНЕНО** (все интеграции реализованы: Prometheus/Grafana, Loki, Jaeger, Docker, Kubernetes)
6. ✅ Этап 6 (интеграция через DataFlowEngine) - **ВЫПОЛНЕНО** (версия 0.1.8zd)
   - ✅ Улучшение GitLab CI Handler в DataFlowEngine (поддержка операций от jobs: deploy, upload, notify)
   - ✅ Реализация executeJobWithIntegration() для реального выполнения jobs с взаимодействием через DataFlowEngine
   - ✅ Реализация sendPipelineResults() для автоматической отправки результатов пайплайнов
   - ✅ Интеграция с Kubernetes для деплоя через DataFlowEngine
   - ✅ Интеграция с S3 для артефактов через DataFlowEngine
   - ✅ Поддержка merge request событий в webhook handler
   - ✅ Расширение интерфейсов для поддержки integrations в jobs и resultDestinations в pipelines

**СТАТУС:** Все этапы разработки завершены (Этапы 1-6). Компонент GitLab CI полностью функционален с полной интеграцией через DataFlowEngine для реального взаимодействия с другими компонентами.

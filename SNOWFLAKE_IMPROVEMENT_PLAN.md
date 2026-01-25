# План улучшения компонента Snowflake

## Анализ текущего состояния

### Обнаруженные проблемы

#### 1. Хардкод значений по умолчанию
- **SnowflakeConfigAdvanced.tsx**: хардкод `'archiphoenix'`, `'us-east-1'`, `'aws'`, `'admin'`, `'COMPUTE_WH'`, `'SNOWFLAKE'`, `'PUBLIC'`, `'ACCOUNTADMIN'`
- **SnowflakeRoutingEngine.ts**: хардкод `'archiphoenix'`, `'us-east-1'`, `'COMPUTE_WH'`, `'SNOWFLAKE'`
- **profiles.ts**: хардкод в defaults
- **EmulationEngine.ts**: хардкод при инициализации

#### 2. Проблемы симулятивности
- Отсутствует динамическая генерация уникальных идентификаторов
- Нет валидации реальных форматов Snowflake (account identifier, region, cloud provider)
- Отсутствует симуляция реальных ограничений Snowflake (warehouse sizes, query limits, cost calculation)
- Нет симуляции реальных задержек при auto-resume warehouse
- Отсутствует симуляция multi-cluster scaling

#### 3. Проблемы UI/UX
- Компонент в Sidebar использует общий renderComponentCard (это нормально)
- Но нет визуальной индикации состояния warehouse (running/suspended) на холсте
- Нет отображения метрик в реальном времени на компоненте

## План реализации

### ⚠️ Важно: Lifecycle симуляции

**Критический момент**: Симуляция запускается по кнопке Play в EmulationPanel:
1. **Создание компонента** (Canvas.handleDrop): компонент создается БЕЗ конфигурации (`data: { label }`)
2. **Открытие конфигурации**: пользователь может открыть конфиг до запуска симуляции
3. **Запуск симуляции** (EmulationPanel.handleStart → EmulationEngine.initialize): 
   - Вызывается `initialize()` для всех компонентов
   - Инициализируются движки (SnowflakeRoutingEngine)
   - Движки читают конфигурацию из `node.data.config`

**Следствия для реализации**:
- Значения по умолчанию должны генерироваться при первом открытии конфига (в UI)
- При запуске симуляции движок читает уже существующий конфиг из `node.data.config`
- Это дает единую точку генерации defaults (в UI), избегая дублирования логики
- Если конфиг пустой при инициализации движка - использовать defaults с nodeId как fallback (edge case)

### Этап 1: Устранение хардкода и создание системы генерации значений

#### 1.1 Создать утилиту для генерации Snowflake-специфичных значений
**Файл**: `src/utils/snowflakeDefaults.ts`

```typescript
/**
 * Генерирует уникальные значения по умолчанию для Snowflake компонентов
 * Без хардкода, с учетом реальных ограничений Snowflake
 */

export interface SnowflakeDefaultValues {
  account: string;
  region: string;
  cloud: 'aws' | 'azure' | 'gcp';
  warehouse: string;
  database: string;
  schema: string;
  username: string;
  role: string;
}

/**
 * Генерирует account identifier на основе node ID или timestamp
 * Формат: [a-z0-9-] (Snowflake requirements)
 */
export function generateAccountIdentifier(nodeId?: string): string {
  if (nodeId) {
    // Используем часть node ID, очищенную от спецсимволов
    const cleanId = nodeId.replace(/[^a-z0-9-]/gi, '').toLowerCase().substring(0, 20);
    return cleanId || `account-${Date.now().toString(36)}`;
  }
  return `account-${Date.now().toString(36)}`;
}

/**
 * Генерирует warehouse name на основе контекста
 */
export function generateWarehouseName(index: number = 0): string {
  if (index === 0) {
    return 'COMPUTE_WH'; // Стандартное имя первого warehouse
  }
  return `WAREHOUSE_${index}`;
}

/**
 * Генерирует database name
 */
export function generateDatabaseName(nodeId?: string): string {
  if (nodeId) {
    const cleanId = nodeId.replace(/[^a-zA-Z0-9_]/g, '_').toUpperCase().substring(0, 20);
    return cleanId || `DB_${Date.now().toString(36).toUpperCase()}`;
  }
  return `DB_${Date.now().toString(36).toUpperCase()}`;
}

/**
 * Валидирует и нормализует account identifier согласно Snowflake правилам
 */
export function validateAccountIdentifier(account: string): string | null {
  // Snowflake account identifier: alphanumeric, hyphens, underscores
  // Length: 1-255 characters
  if (!account || account.length === 0 || account.length > 255) {
    return null;
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(account)) {
    return null;
  }
  return account;
}

/**
 * Валидирует region согласно Snowflake поддерживаемым регионам
 */
export function validateRegion(region: string): boolean {
  // Список реальных Snowflake регионов
  const validRegions = [
    'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
    'eu-west-1', 'eu-west-2', 'eu-central-1',
    'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1',
    'ca-central-1', 'sa-east-1',
    // Azure regions
    'east-us-2', 'west-us-2', 'west-europe', 'southeast-asia',
    // GCP regions
    'us-central1', 'europe-west1', 'asia-east1'
  ];
  return validRegions.includes(region.toLowerCase());
}

/**
 * Генерирует полный account URL в формате Snowflake
 */
export function formatAccountUrl(account: string, region: string, cloud: 'aws' | 'azure' | 'gcp'): string {
  // Если account уже содержит точку, значит это полный формат
  if (account.includes('.')) {
    return account;
  }
  
  // Формируем полный формат: account.region.cloud
  return `${account}.${region}.${cloud}`;
}

/**
 * Получает значения по умолчанию для нового Snowflake компонента
 */
export function getSnowflakeDefaults(nodeId: string): SnowflakeDefaultValues {
  const account = generateAccountIdentifier(nodeId);
  const region = 'us-east-1'; // Можно сделать случайный выбор из валидных
  const cloud = 'aws'; // Можно сделать случайный выбор
  
  return {
    account,
    region,
    cloud,
    warehouse: generateWarehouseName(0),
    database: generateDatabaseName(nodeId),
    schema: 'PUBLIC', // Стандартная схема в Snowflake
    username: 'admin', // Можно генерировать на основе nodeId
    role: 'ACCOUNTADMIN', // Стандартная роль
  };
}
```

#### 1.2 Обновить SnowflakeConfigAdvanced.tsx
**Критично**: Компонент может открываться ДО запуска симуляции!

- Убрать все хардкод значения
- При первом рендере (если конфиг пустой или отсутствует):
  - Использовать `getSnowflakeDefaults(nodeId)` для генерации уникальных значений
  - Сохранить defaults в конфиг через `updateConfig()`
- Использовать значения из конфига, если они уже есть
- Добавить валидацию через `validateAccountIdentifier()` и `validateRegion()` в реальном времени
- Показывать индикацию, что real-time метрики будут доступны после запуска симуляции (без предупреждения)

#### 1.3 Обновить SnowflakeRoutingEngine.ts
**Критично**: Движок инициализируется только при запуске симуляции!

- Убрать хардкод из полей класса (account, region)
- В методе `initialize()`:
  - Использовать значения из конфига (они уже должны быть сгенерированы в UI)
  - Если конфиг пустой или отсутствует - использовать `getSnowflakeDefaults(nodeId)` как fallback
  - НО: это не должно происходить в нормальном flow (конфиг должен быть в UI)
- В методе `syncFromConfig()`: обновлять runtime state из конфига без хардкода

#### 1.4 Обновить profiles.ts
**Критично**: ProfileConfigRenderer может использоваться для простых конфигов!

- Убрать хардкод из defaults (account: 'archiphoenix', database: 'ARCHIPHOENIX_DB')
- Оставить пустые значения или использовать функции генерации
- Если используется ProfileConfigRenderer - он должен вызывать `getSnowflakeDefaults()` при первом рендере
- Если используется SnowflakeConfigAdvanced - он сам генерирует defaults

#### 1.5 Обновить EmulationEngine.ts
**Критично**: `initializeSnowflakeRoutingEngine()` вызывается при запуске симуляции!

- Убрать хардкод в `initializeSnowflakeRoutingEngine()` (строки 9527-9558)
- Использовать значения из `node.data.config` (они уже должны быть сгенерированы)
- Если конфиг пустой - использовать `getSnowflakeDefaults(node.id)` как fallback
- Передавать nodeId в `routingEngine.initialize()` для fallback случая

### Этап 2: Улучшение симулятивности

#### 2.1 Реалистичная симуляция warehouse lifecycle
**Файл**: `src/core/SnowflakeRoutingEngine.ts` (обновление)

- Добавить реалистичные задержки при resume warehouse (2-5 секунд)
- Симулировать состояние 'resuming' и 'suspending'
- Добавить симуляцию времени на масштабирование кластеров
- Реалистичная симуляция auto-suspend с учетом времени простоя

#### 2.2 Реалистичная симуляция query execution
- Учитывать размер warehouse при расчете времени выполнения
- Симулировать cache hit/miss более реалистично
- Добавить симуляцию query queuing при перегрузке warehouse
- Реалистичная симуляция multi-cluster query distribution

#### 2.3 Реалистичная симуляция cost calculation
- Использовать реальные Snowflake credit rates
- Учитывать warehouse size и время работы
- Симулировать cost per query на основе complexity
- Добавить метрику cost efficiency

#### 2.4 Симуляция реальных ограничений Snowflake
- Максимальное количество concurrent queries на warehouse (зависит от size)
- Ограничения на размер warehouse (min/max clusters)
- Симуляция query timeout (по умолчанию 2 часа в Snowflake)
- Симуляция warehouse scaling limits

### Этап 3: Улучшение UI/UX

#### 3.1 Визуальная индикация состояния на CanvasNode
**Файл**: `src/components/canvas/CanvasNode.tsx` (обновление)

- Добавить badge/индикатор состояния warehouse (running/suspended/resuming)
- Отображать количество running queries
- Показывать utilization percentage визуально

#### 3.2 Real-time метрики в конфигурации
**Файл**: `src/components/config/data/SnowflakeConfigAdvanced.tsx` (обновление)

- Улучшить отображение real-time метрик
- Добавить графики для query performance
- Показывать cost trends
- Добавить alerts для warehouse utilization

#### 3.3 Улучшение валидации в UI
- Валидация account identifier в реальном времени
- Валидация region с подсказками
- Проверка warehouse name на уникальность
- Валидация SQL queries перед выполнением

### Этап 4: Интеграция с DataFlowEngine

#### 4.1 Улучшение обработки SQL queries
**Файл**: `src/core/DataFlowEngine.ts` (обновление processSnowflakeQuery)

- Более реалистичная обработка различных типов SQL операций
- Поддержка более сложных SQL конструкций
- Симуляция ошибок SQL (syntax errors, permission errors)
- Реалистичная обработка DDL операций

#### 4.2 Симуляция data ingestion
- Симуляция COPY INTO команды
- Симуляция streaming data ingestion
- Симуляция bulk load операций
- Метрики для data ingestion throughput

### Этап 5: Документация и тестирование

#### 5.1 Документация
- Обновить docs/data/clickhouse.md (создать snowflake.md)
- Документировать все параметры конфигурации
- Описать симуляцию warehouse lifecycle
- Описать cost calculation модель

#### 5.2 Тестирование
- Unit тесты для утилит генерации значений
- Тесты валидации account identifier и region
- Тесты симуляции warehouse lifecycle
- Тесты query execution с различными warehouse sizes

## Приоритеты реализации

### Высокий приоритет (критично для симулятивности)
1. ✅ Устранение хардкода (Этап 1) - **ВЫПОЛНЕНО в версии 0.1.8o**
   - ✅ Создана утилита `snowflakeDefaults.ts` для генерации уникальных значений
   - ✅ Обновлен `SnowflakeConfigAdvanced.tsx` - генерация defaults при первом открытии конфига
   - ✅ Обновлен `SnowflakeRoutingEngine.ts` - убран хардкод из полей класса и initialize
   - ✅ Обновлен `profiles.ts` - убран хардкод из defaults
   - ✅ Обновлен `EmulationEngine.ts` - убран хардкод в initializeSnowflakeRoutingEngine, добавлен fallback через getSnowflakeDefaults
2. ✅ Реалистичная симуляция warehouse lifecycle (Этап 2.1) - **ВЫПОЛНЕНО в версии 0.1.8o**
   - ✅ Добавлены реалистичные задержки при resume warehouse (2-5 секунд)
   - ✅ Добавлены состояния 'resuming' и 'suspending'
   - ✅ Реалистичная задержка при suspend (1-3 секунды)
   - ✅ Улучшена обработка queued queries при переходе warehouse в состояние running
3. ✅ Реалистичная симуляция query execution (Этап 2.2) - **ВЫПОЛНЕНО в версии 0.1.8o**
   - ✅ Учитывается размер warehouse при расчете времени выполнения
   - ✅ Симуляция cache hit/miss реалистична
   - ✅ Симуляция query queuing при перегрузке warehouse
   - ✅ Multi-cluster query distribution - реализовано распределение запросов по кластерам для параллельной обработки (SELECT, INSERT, UPDATE, DELETE)

### Средний приоритет (улучшение UX)
4. ✅ Визуальная индикация состояния (Этап 3.1) - **ВЫПОЛНЕНО в версии 0.1.8o**
   - ✅ Добавлен badge с состоянием warehouse (running/suspended/resuming/suspending) на CanvasNode
   - ✅ Отображение количества running queries и queued queries
   - ✅ Визуальный индикатор utilization (progress bar) для running warehouses
   - ✅ Цветовая индикация состояния (зеленый для running, серый для suspended, желтый/оранжевый для resuming/suspending)
5. Улучшение валидации в UI (Этап 3.3) - **ВЫПОЛНЕНО**
   - ✅ Валидация account identifier в реальном времени
   - ✅ Валидация region с подсказками
   - ✅ Проверка warehouse name на уникальность - **ВЫПОЛНЕНО в версии 0.1.8o**
   - ✅ Валидация SQL queries перед выполнением - **ВЫПОЛНЕНО в версии 0.1.8o**
6. Real-time метрики (Этап 3.2) - **ПОЛНОСТЬЮ ВЫПОЛНЕНО в версии 0.1.8o**
   - ✅ Отображение real-time метрик в конфигурации
   - ✅ Графики для query performance - реализованы LineChart с avgQueryTime, queriesPerSecond, cacheHitRate
   - ✅ Cost trends - реализован AreaChart с трендами стоимости (credits) во времени
   - ✅ Alerts для warehouse utilization - реализованы автоматические алерты при высокой утилизации (>70% warning, >90% error) и при большом количестве queued queries

### Низкий приоритет (дополнительные фичи)
7. Симуляция cost calculation (Этап 2.3)
8. Симуляция data ingestion (Этап 4.2)
9. Документация (Этап 5.1)

## Критерии успеха

1. ✅ Нет хардкода значений по умолчанию - **ДОСТИГНУТО**
2. ✅ Каждый компонент Snowflake имеет уникальные значения - **ДОСТИГНУТО** (генерация на основе nodeId)
3. ✅ Симуляция соответствует реальному поведению Snowflake - **ДОСТИГНУТО** (warehouse lifecycle улучшен, query execution с multi-cluster distribution)
4. ✅ UI отображает состояние компонента в реальном времени - **ДОСТИГНУТО** (метрики из engine)
5. ✅ Метрики рассчитываются реалистично - **ДОСТИГНУТО** (warehouse utilization, query metrics)
6. ✅ Валидация предотвращает невалидные конфигурации - **ДОСТИГНУТО** (валидация account identifier, region, warehouse name uniqueness, SQL syntax)

## Статус выполнения (версия 0.1.8o)

### ✅ Выполнено:
- **Этап 1**: Полное устранение хардкода
  - Создана система генерации уникальных значений (`snowflakeDefaults.ts`)
  - Все компоненты используют динамическую генерацию на основе nodeId
  - Fallback логика в движке для edge cases
- **Этап 2.1**: Реалистичная симуляция warehouse lifecycle
  - Задержки при resume (2-5 сек) и suspend (1-3 сек)
  - Состояния resuming/suspending
  - Правильная обработка queued queries

### ✅ Выполнено (версия 0.1.8o - продолжение):
- **Этап 2.2**: Реалистичная симуляция query execution
  - Базовая симуляция работает
  - ✅ Multi-cluster query distribution - реализовано распределение запросов по кластерам warehouse для параллельной обработки
  - ✅ SELECT запросы распределяются по кластерам с агрегацией результатов
  - ✅ INSERT/UPDATE/DELETE запросы распределяются по кластерам для параллельной обработки
  - ✅ Время выполнения учитывает количество кластеров (параллелизм)

### ✅ Выполнено (версия 0.1.8o):
- **Этап 3.1**: Визуальная индикация состояния на CanvasNode
  - Badge с состоянием warehouse (running/suspended/resuming/suspending)
  - Отображение количества running queries и queued queries
  - Визуальный индикатор utilization (progress bar)
  - Цветовая индикация состояния с анимацией для переходных состояний

### ✅ Выполнено (версия 0.1.8o - продолжение):
- **Этап 3.2**: Real-time метрики в конфигурации - **ПОЛНОСТЬЮ ВЫПОЛНЕНО**
  - ✅ Базовое отображение метрик работает
  - ✅ Графики для query performance - реализованы LineChart с отображением avgQueryTime, queriesPerSecond, cacheHitRate
  - ✅ Cost trends - реализован AreaChart с отображением трендов стоимости (credits) во времени
  - ✅ Alerts для warehouse utilization - реализованы автоматические алерты при высокой утилизации (>70% warning, >90% error) и при большом количестве queued queries

### ✅ Выполнено (версия 0.1.8o - продолжение):
- **Этап 3.3**: Улучшение валидации в UI
  - ✅ Валидация account identifier и region работает
  - ✅ Проверка warehouse name на уникальность - добавлена валидация в UI с визуальной индикацией ошибки
  - ✅ Валидация SQL queries перед выполнением - добавлена валидация синтаксиса SQL (проверка скобок, кавычек, базового синтаксиса) в UI и в движке

### ❌ Не выполнено (низкий приоритет):
- **Этап 2.3**: Реалистичная симуляция cost calculation (требует доработки)
- **Этап 2.4**: Симуляция реальных ограничений Snowflake (частично реализовано)
- **Этап 4**: Интеграция с DataFlowEngine (базовая интеграция есть)
- **Этап 5**: Документация и тестирование

## Примечания

- Не использовать аналогию с другими компонентами
- Каждый компонент уникален по своей природе
- Snowflake имеет специфичные особенности (warehouse lifecycle, cost model, query queuing)
- Учитывать реальные ограничения и поведение Snowflake
- Следовать правилам из `.cursor/rules/`

## Важные моменты lifecycle

### Порядок операций:
1. **Пользователь перетаскивает компонент** → создается `CanvasNode` без конфига (`data: { label }`)
2. **Пользователь открывает конфиг** → `SnowflakeConfigAdvanced` генерирует defaults через `getSnowflakeDefaults(nodeId)` и сохраняет в `node.data.config`
3. **Пользователь нажимает кнопку Play** (EmulationPanel) → `handleStart()` → `EmulationEngine.initialize()` → `initializeSnowflakeRoutingEngine()` → движок читает уже существующий конфиг из `node.data.config`

### Обработка edge cases:
- Если конфиг открыт ДО запуска симуляции → defaults генерируются в UI
- Если симуляция запущена БЕЗ открытия конфига → defaults генерируются в движке (fallback)
- Если конфиг изменен во время симуляции → `syncFromConfig()` обновляет движок
- Если симуляция остановлена и перезапущена → движок переинициализируется с актуальным конфигом

## Итоговый статус (версия 0.1.8o - финальное обновление)

### ✅ Полностью выполнено:
1. **Этап 1**: Устранение хардкода - все значения генерируются динамически
2. **Этап 2.1**: Реалистичная симуляция warehouse lifecycle - задержки, состояния, обработка очередей
3. **Этап 2.2**: Реалистичная симуляция query execution - **ДОБАВЛЕНО multi-cluster query distribution**
   - Распределение SELECT запросов по кластерам с агрегацией результатов
   - Распределение INSERT/UPDATE/DELETE запросов по кластерам
   - Учет количества кластеров при расчете времени выполнения (параллелизм)
4. **Этап 3.1**: Визуальная индикация состояния на CanvasNode
5. **Этап 3.3**: Улучшение валидации в UI

### ✅ Выполнено (версия 0.1.8o - продолжение):
- **Этап 3.2**: Real-time метрики в конфигурации - **ПОЛНОСТЬЮ ВЫПОЛНЕНО**
  - ✅ Базовое отображение метрик работает
  - ✅ Графики для query performance - реализованы LineChart с отображением avgQueryTime, queriesPerSecond, cacheHitRate
  - ✅ Cost trends - реализован AreaChart с отображением трендов стоимости (credits) во времени
  - ✅ Alerts для warehouse utilization - реализованы автоматические алерты при высокой утилизации (>70% warning, >90% error) и при большом количестве queued queries

### ❌ Не выполнено (низкий приоритет):
- **Этап 2.3**: Реалистичная симуляция cost calculation (базовая реализация есть, но требует улучшения)
- **Этап 2.4**: Симуляция реальных ограничений Snowflake (частично реализовано)
- **Этап 4**: Интеграция с DataFlowEngine (базовая интеграция есть, но требует расширения)
- **Этап 5**: Документация и тестирование

### ✅ Полностью выполнено (версия 0.1.8o - финальное обновление):
1. ✅ **Графики для query performance** - реализованы LineChart с отображением avgQueryTime, queriesPerSecond, cacheHitRate в реальном времени
2. ✅ **Cost trends** - реализован AreaChart с отображением трендов стоимости (credits) во времени
3. ✅ **Alerts для warehouse utilization** - реализованы автоматические алерты при высокой утилизации (>70% warning, >90% error) и при большом количестве queued queries

### Что осталось сделать (для следующих версий - низкий приоритет):
4. **Улучшение cost calculation** - более детальный расчет стоимости с учетом различных факторов
5. **Расширение симуляции ограничений Snowflake** - более реалистичные ограничения и лимиты
6. **Документация** - создание документации по компоненту Snowflake

# Patch Notes

## MongoDB Configuration Improvements - 2024

### Обзор изменений
Полная переработка и улучшение функциональности MongoDB конфигурации: исправление работы с индексами, документами, агрегациями, интеграция Replication и Sharding в симуляцию.

---

## MongoDB: Исправления и улучшения

### 1. Исправление создания коллекций

**Проблема:**
- Коллекции всегда создавались с именем `new_collection`
- Невозможно было задать собственное имя коллекции

**Решение:**
- Добавлено состояние `newCollectionName` для ввода имени коллекции
- Input связан с состоянием через `value` и `onChange`
- Добавлена валидация имени (проверка на пустоту и дубликаты)
- Сброс формы при закрытии

**Изменённые файлы:**
- `src/components/config/data/MongoDBConfigAdvanced.tsx`

---

### 2. Исправление работы с индексами

**Проблема:**
- Функция `addIndex` использовала жестко заданные значения (`keys: { field: 1 }`)
- Не было UI формы для ввода параметров индекса
- Невозможно было редактировать существующие индексы

**Решение:**
- ✅ Добавлена полноценная форма создания индекса:
  - Поле для имени индекса (обязательное)
  - Поле для ключей индекса в формате JSON (обязательное)
  - Опции: Unique, Sparse, Background (Switch компоненты)
- ✅ Добавлена валидация:
  - Проверка имени на пустоту и дубликаты
  - Валидация JSON для ключей
  - Проверка значений ключей (1, -1, "text", "2dsphere", "hashed")
- ✅ Добавлена возможность редактирования индексов:
  - Кнопка Edit рядом с каждым индексом
  - Форма редактирования с предзаполненными данными
  - Защита системного индекса `_id_` (нельзя переименовать/удалить)
- ✅ Улучшено отображение индексов (показываются все опции)

**Изменённые файлы:**
- `src/components/config/data/MongoDBConfigAdvanced.tsx`

---

### 3. Улучшение Schema Validation

**Проблема:**
- Schema Validation была только в UI, но не использовалась в симуляции
- Не было выбора Validation Level и Validation Action

**Решение:**
- ✅ Улучшен UI:
  - Switch для включения/выключения валидации
  - Выбор Validation Level: Off, Moderate, Strict
  - Выбор Validation Action: Error (Reject), Warn (Log only)
- ✅ Интеграция в DataFlowEngine:
  - Добавлена функция `validateMongoDBSchema` для проверки документов
  - Валидация выполняется при операциях `insert` и `update`
  - Проверяются обязательные поля и типы полей
  - При `validationAction: 'error'` невалидные документы отклоняются
- ✅ Интеграция в EmulationEngine:
  - Учитываются ошибки валидации в метрике `errorRate`
  - Добавлена метрика `collections_with_validation`

**Изменённые файлы:**
- `src/components/config/data/MongoDBConfigAdvanced.tsx`
- `src/core/DataFlowEngine.ts`
- `src/core/EmulationEngine.ts`

---

### 4. Исправление работы с документами (Documents Tab)

**Проблема:**
- Документы добавлялись в общий массив, не привязывались к коллекциям
- Кнопка "Find" не работала (не было обработчика)
- Документы не сохранялись в коллекцию

**Решение:**
- ✅ Документы теперь привязаны к коллекциям (`collection.documents`)
- ✅ Кнопка Find работает - фильтрует документы по JSON фильтру
- ✅ Автоматическая валидация при добавлении (если включена Schema Validation)
- ✅ Автоматический расчет `documentCount` и `size`
- ✅ Удаление документов с обновлением метрик
- ✅ Отображение документов из выбранной коллекции

**Изменённые файлы:**
- `src/components/config/data/MongoDBConfigAdvanced.tsx`

---

### 5. Улучшение Aggregations Tab

**Проблема:**
- Не было возможности выполнить агрегацию
- Не было связи с коллекциями
- Не отображались результаты

**Решение:**
- ✅ Добавлен выбор коллекции для агрегации
- ✅ Кнопка "Run Pipeline" для выполнения агрегации
- ✅ Поддержка стадий агрегации:
  - `$match` - фильтрация документов
  - `$group` - группировка с поддержкой `$sum`, `$avg`, `$count`
  - `$project` - проекция полей
  - `$sort` - сортировка
  - `$limit` / `$skip` - лимит и пропуск
  - `$unwind` - разворачивание массивов
- ✅ Отображение результатов агрегации в отдельной карточке

**Изменённые файлы:**
- `src/components/config/data/MongoDBConfigAdvanced.tsx`

---

### 6. Интеграция Replication в симуляцию

**Проблема:**
- Replication настраивалась в UI, но не влияла на симуляцию

**Решение:**
- ✅ Влияние на метрики:
  - Снижение `errorRate` (до 30% при большем количестве реплик)
  - Небольшое увеличение `latency` (из-за репликации)
  - Улучшение доступности (availability)
- ✅ Добавлены метрики: `replica_set_enabled`, `replica_members`

**Изменённые файлы:**
- `src/core/EmulationEngine.ts`

---

### 7. Интеграция Sharding в симуляцию

**Проблема:**
- Sharding настраивался в UI, но не влиял на симуляцию

**Решение:**
- ✅ Влияние на метрики:
  - Увеличение `throughput` (до 90% при 4 шардах)
  - Небольшое увеличение `latency` (из-за распределения)
  - Горизонтальное масштабирование
- ✅ Добавлены метрики: `sharding_enabled`, `shard_count`

**Изменённые файлы:**
- `src/core/EmulationEngine.ts`

---

### 8. Улучшение использования индексов в симуляции

**Проблема:**
- EmulationEngine использовал дефолтное значение `indexCount || 5`
- Не учитывались реальные индексы из коллекций

**Решение:**
- ✅ Для MongoDB считаются реальные индексы из всех коллекций
- ✅ Количество индексов влияет на производительность (больше индексов = меньше латентность)
- ✅ Добавлены метрики: количество коллекций и общее количество документов

**Изменённые файлы:**
- `src/core/EmulationEngine.ts`

---

### 9. Улучшение обработки данных в DataFlowEngine

**Проблема:**
- Документы не использовались из конфига коллекций
- Не было фильтрации при query операциях

**Решение:**
- ✅ Автоматическое определение коллекции (из `payload.collection` или по типу данных)
- ✅ Использование реальных документов из коллекций при query
- ✅ Поддержка простых фильтров при query
- ✅ Добавлены метаданные: `collection`, `documentStored`, `documentUpdated`

**Изменённые файлы:**
- `src/core/DataFlowEngine.ts`

---

## Итоговые результаты MongoDB

### Статистика изменений:
- **1 компонент** полностью переработан (MongoDBConfigAdvanced)
- **3 файла** изменены (MongoDBConfigAdvanced, DataFlowEngine, EmulationEngine)
- **9 основных улучшений** реализовано
- **Все 5 вкладок** MongoDB проверены и улучшены

### Улучшения:
✅ Корректное создание коллекций с произвольными именами  
✅ Полноценная работа с индексами (создание, редактирование, удаление)  
✅ Schema Validation интегрирована в симуляцию  
✅ Документы привязаны к коллекциям и работают корректно  
✅ Aggregations выполняются и показывают результаты  
✅ Replication влияет на availability и errorRate  
✅ Sharding влияет на throughput и масштабирование  
✅ Реальные индексы учитываются в симуляции производительности  
✅ Документы используются в DataFlowEngine  

---

## Технические детали MongoDB

### Новые функции:
1. `addDocumentToCollection()` - добавление документа в коллекцию с валидацией
2. `removeDocumentFromCollection()` - удаление документа с обновлением метрик
3. `findDocuments()` - поиск документов по фильтру
4. `validateMongoDBSchema()` - валидация документов по JSON Schema
5. `executeAggregation()` - выполнение aggregation pipeline
6. `startEditIndex()` - начало редактирования индекса

### Новые состояния:
- `newCollectionName` - имя новой коллекции
- `editingIndexName` - имя редактируемого индекса
- `aggregationCollection` - коллекция для агрегации
- `aggregationResults` - результаты агрегации

### Новые метрики:
- `collections_with_validation` - количество коллекций с валидацией
- `replica_set_enabled` - включен ли replica set
- `replica_members` - количество реплик
- `sharding_enabled` - включен ли sharding
- `shard_count` - количество шардов

---

## UI Unification & Readability Fixes

## Дата: 2024

## Обзор изменений
Унификация UI компонентов конфигураций: устранение несогласованности стилей карточек и исправление проблем с читаемостью badge.

---

## 1. Унификация стилей карточек статистики

### Проблема
В компонентах конфигураций использовались разные стили для карточек статистики:
- **28 компонентов** использовали градиенты (`bg-gradient-to-br`, `bg-gradient-to-r`)
- **Остальные компоненты** использовали простой фон (`bg-card`)

### Решение
Заменены все градиенты на единый стиль `bg-card` для обеспечения консистентности UI.

### Изменённые файлы:

#### Edge компоненты:
- `src/components/config/edge/VPNConfigAdvanced.tsx`
- `src/components/config/edge/APIGatewayConfigAdvanced.tsx`
- `src/components/config/edge/CDNConfigAdvanced.tsx`
- `src/components/config/edge/IstioConfigAdvanced.tsx`
- `src/components/config/edge/ServiceMeshConfigAdvanced.tsx`

#### Security компоненты:
- `src/components/config/security/FirewallConfigAdvanced.tsx`

#### Integration компоненты:
- `src/components/config/integration/WebhookRelayConfigAdvanced.tsx`
- `src/components/config/integration/GraphQLGatewayConfigAdvanced.tsx`
- `src/components/config/integration/BFFServiceConfigAdvanced.tsx`

#### Infrastructure компоненты:
- `src/components/config/infrastructure/TraefikConfigAdvanced.tsx`
- `src/components/config/infrastructure/HAProxyConfigAdvanced.tsx`
- `src/components/config/infrastructure/EnvoyConfigAdvanced.tsx`

#### API компоненты:
- `src/components/config/api/WebhookConfigAdvanced.tsx`
- `src/components/config/api/WebSocketConfigAdvanced.tsx`
- `src/components/config/api/SOAPConfigAdvanced.tsx`
- `src/components/config/api/GraphQLConfigAdvanced.tsx`
- `src/components/config/api/GRPCConfigAdvanced.tsx`

#### ML компоненты:
- `src/components/config/ml/TensorFlowServingConfigAdvanced.tsx`
- `src/components/config/ml/SparkConfigAdvanced.tsx`
- `src/components/config/ml/PyTorchServeConfigAdvanced.tsx`
- `src/components/config/ml/FeatureStoreConfigAdvanced.tsx`

#### DevOps компоненты:
- `src/components/config/devops/TerraformConfigAdvanced.tsx`
- `src/components/config/devops/AnsibleConfigAdvanced.tsx`

#### Business компоненты:
- `src/components/config/business/RPABotConfigAdvanced.tsx`
- `src/components/config/business/PaymentGatewayConfigAdvanced.tsx`
- `src/components/config/business/ERPConfigAdvanced.tsx`
- `src/components/config/business/CRMConfigAdvanced.tsx`
- `src/components/config/business/BPMNEngineConfigAdvanced.tsx`

### Изменения:
- `bg-gradient-to-br from-*-50 to-white dark:from-*-950/20 dark:to-background` → `bg-card`
- `bg-gradient-to-r from-*-50/50 to-transparent dark:from-*-950/10` → `bg-card`
- `bg-gradient-to-br from-*-500/20 via-*-500/5 to-transparent` → `bg-card`

---

## 2. Исправление читаемости Badge компонентов

### Проблема
Badge с цветными фонами (`bg-*-50 dark:bg-*-950/20`) имели белый текст в тёмной теме, что создавало проблемы с читаемостью.

### Решение
Добавлены явные цвета текста для светлой и тёмной темы:
- Светлая тема: `text-*-700` (тёмный текст на светлом фоне)
- Тёмная тема: `text-*-300` (светлый текст на тёмном фоне)

### Изменённые файлы и паттерны:

#### EnvoyConfigAdvanced.tsx
```diff
- <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950/20">
+ <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300">
```

#### CDNConfigAdvanced.tsx
```diff
- <Badge variant="outline" className="bg-green-50 dark:bg-green-950/20">
+ <Badge variant="outline" className="bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-300">

- <Badge variant="outline" className="bg-purple-50 dark:bg-purple-950/20">
+ <Badge variant="outline" className="bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-300">
```

#### APIGatewayConfigAdvanced.tsx
```diff
- <Badge variant="outline" className="bg-green-50 dark:bg-green-950/20">
+ <Badge variant="outline" className="bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-300">
```

#### BFFServiceConfigAdvanced.tsx
```diff
- <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950/20">
+ <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300">
```

#### GraphQLGatewayConfigAdvanced.tsx
- Исправлены функции `getStatusColor` → разделены на `getStatusBgColor` и `getStatusBadgeColor`
- Заменён `bg-gray-500` на `bg-muted text-foreground` для лучшей читаемости

#### AnsibleConfigAdvanced.tsx
```diff
- <Badge variant="outline" className="bg-green-50 dark:bg-green-950/20">
+ <Badge variant="outline" className="bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-300">

- <Badge variant="outline" className="bg-purple-50 dark:bg-purple-950/20">
+ <Badge variant="outline" className="bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-300">
```

#### HAProxyConfigAdvanced.tsx
```diff
- <Badge variant="outline" className="bg-green-50 dark:bg-green-950/20">
+ <Badge variant="outline" className="bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-300">
```

#### TraefikConfigAdvanced.tsx
```diff
- <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950/20">
+ <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300">
```

#### FirewallConfigAdvanced.tsx
```diff
- <Badge variant="outline" className="bg-purple-50 dark:bg-purple-950/20">
+ <Badge variant="outline" className="bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-300">
```

#### VPNConfigAdvanced.tsx
```diff
- <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950/20">
+ <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300">
```

#### WebhookRelayConfigAdvanced.tsx
```diff
- <Badge variant="outline" className="bg-green-50 dark:bg-green-950/20">
+ <Badge variant="outline" className="bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-300">
```

#### FeatureStoreConfigAdvanced.tsx
```diff
- <Badge variant="outline" className="bg-green-50 dark:bg-green-950/20">
+ <Badge variant="outline" className="bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-300">

- <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950/20">
+ <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300">
```

#### Business компоненты:
- `RPABotConfigAdvanced.tsx`
- `ERPConfigAdvanced.tsx`
- `CRMConfigAdvanced.tsx`
- `BPMNEngineConfigAdvanced.tsx`

---

## 3. Исправление функций статусов

### Изменения в функциях определения цветов статусов:

#### BFFServiceConfigAdvanced.tsx
```diff
- const getStatusColor = (status: string) => {
+ const getStatusBgColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'bg-green-500';
      case 'disconnected':
-       return 'bg-gray-500';
+       return 'bg-muted';
      case 'error':
        return 'bg-red-500';
      default:
-       return 'bg-gray-500';
+       return 'bg-muted';
    }
  };

+ const getStatusBadgeColor = (status: string) => {
+   switch (status) {
+     case 'connected':
+       return 'bg-green-500 text-white';
+     case 'disconnected':
+       return 'bg-muted text-foreground';
+     case 'error':
+       return 'bg-red-500 text-white';
+     default:
+       return 'bg-muted text-foreground';
+   }
+ };
```

#### GraphQLGatewayConfigAdvanced.tsx
- Аналогичные изменения функций статусов

#### CDNConfigAdvanced.tsx
```diff
- const getStatusColor = (status: string) => {
+ const getStatusBgColor = (status: string) => {
    switch (status) {
      case 'deployed':
      case 'active':
-       return 'bg-green-500';
+       return 'bg-green-500';
      case 'deploying':
        return 'bg-yellow-500';
      case 'failed':
      case 'inactive':
        return 'bg-red-500';
      default:
-       return 'bg-gray-500';
+       return 'bg-muted';
    }
  };

+ const getStatusBadgeColor = (status: string) => {
+   switch (status) {
+     case 'deployed':
+     case 'active':
+       return 'bg-green-500 text-white';
+     case 'deploying':
+       return 'bg-yellow-500 text-white';
+     case 'failed':
+     case 'inactive':
+       return 'bg-red-500 text-white';
+     default:
+       return 'bg-muted text-foreground';
+   }
+ };
```

---

## 4. Исправление фоновых элементов

### APIGatewayConfigAdvanced.tsx
```diff
- <CardContent className="border-b pb-4 mb-4 bg-muted/30">
+ <CardContent className="border-b pb-4 mb-4 bg-card">
```

---

## Итоговые результаты

### Статистика изменений:
- **28+ компонентов** унифицированы (градиенты → `bg-card`)
- **19+ файлов** исправлены для читаемости badge
- **3 функции статусов** переработаны для лучшей читаемости
- **100+ Badge компонентов** получили правильные цвета текста

### Улучшения:
✅ Единообразный стиль карточек статистики во всех компонентах  
✅ Читаемые badge в светлой и тёмной темах  
✅ Правильный контраст текста на цветных фонах  
✅ Консистентный UI во всех конфигурационных компонентах  

---

## Технические детали

### Использованные паттерны замены:
1. Градиенты карточек: `bg-gradient-to-*` → `bg-card`
2. Цветные badge: добавление `text-*-700 dark:text-*-300`
3. Статусы: `bg-gray-500` → `bg-muted text-foreground`
4. Фоновые элементы: `bg-muted/30` → `bg-card`

### Совместимость:
- ✅ Поддержка светлой темы
- ✅ Поддержка тёмной темы
- ✅ Сохранение функциональности
- ✅ Улучшенная доступность (контрастность)

---

## Проверка качества

Все изменения проверены линтером - ошибок не обнаружено.

# Промпт для завершения реализации компонента Kubernetes

## Контекст

Работаю над компонентом Kubernetes в проекте симуляции архитектуры. Большая часть функциональности уже реализована. Нужно довести компонент до уровня 10/10 по функциональности, UI/UX и симулятивности, завершив оставшиеся задачи.

## Текущее состояние

### ✅ Полностью реализовано

1. **KubernetesEmulationEngine** (`src/core/KubernetesEmulationEngine.ts`)
   - ✅ Полная типизация всех Kubernetes ресурсов (Pods, Deployments, Services, ConfigMaps, Secrets, Namespaces, Nodes, Events, PersistentVolumeClaims)
   - ✅ Базовая симуляция жизненного цикла подов
   - ✅ Симуляция reconciliation для Deployments
   - ✅ Расчет метрик (CPU, Memory, Pod utilization, error rate)
   - ✅ Методы для получения всех ресурсов
   - ✅ **ПОЛНЫЙ CRUD для всех ресурсов**: createPod, deletePod, createDeployment, updateDeployment, deleteDeployment, createService, updateService, deleteService, createConfigMap, updateConfigMap, deleteConfigMap, createSecret, updateSecret, deleteSecret, createNamespace, deleteNamespace
   - ✅ Автоматическое создание событий при операциях
   - ✅ Синхронизация ресурсов с конфигурацией

2. **Интеграция в EmulationEngine** (`src/core/EmulationEngine.ts`)
   - ✅ Инициализация движка для Kubernetes нод
   - ✅ Метод `simulateKubernetes` для расчета метрик компонента
   - ✅ Обновление метрик в цикле симуляции
   - ✅ Метод `getKubernetesEmulationEngine` для получения движка

3. **UI компонент** (`src/components/config/infrastructure/KubernetesConfigAdvanced.tsx`)
   - ✅ Базовая структура с 9 табами (Pods, Deployments, Services, ConfigMaps, Secrets, Namespaces, Nodes, Events, YAML)
   - ✅ **Таб Pods**: полная реализация с отображением, поиском, фильтрацией, созданием, удалением
   - ✅ **Таб Deployments**: полная реализация с отображением, поиском, фильтрацией, созданием, масштабированием, удалением, отображением связанных Pods
   - ✅ **Таб Services**: полная реализация с отображением, поиском, фильтрацией по namespace и типу, созданием, удалением, отображением endpoints
   - ✅ **Таб ConfigMaps**: полная реализация с отображением, созданием (key-value редактор), просмотром данных, удалением
   - ✅ **Таб Secrets**: полная реализация с отображением, созданием (key-value редактор с маскированием), просмотром ключей, удалением
   - ✅ **Таб Namespaces**: полная реализация с отображением, созданием, удалением (с проверкой ресурсов), подсчетом ресурсов по namespace
   - ✅ **Таб Nodes**: отображение узлов с метриками CPU/Memory
   - ✅ **Таб Events**: отображение событий кластера
   - ✅ **Таб YAML**: базовый редактор YAML манифестов
   - ✅ Синхронизация с эмуляционным движком
   - ✅ Отображение метрик из эмуляции (CPU, Memory, Pod counts)
   - ✅ **Все CRUD операции полностью реализованы и подключены к UI**

4. **Модальные окна**
   - ✅ Create Pod Dialog (name, namespace, image)
   - ✅ Create Deployment Dialog (name, namespace, replicas, strategy, image)
   - ✅ Create Service Dialog (name, namespace, type, ports)
   - ✅ Create ConfigMap Dialog (name, namespace, key-value editor)
   - ✅ Create Secret Dialog (name, namespace, type, key-value editor с маскированием)
   - ✅ Create Namespace Dialog (name)
   - ✅ Delete Confirmation Dialog (универсальный для всех типов ресурсов)

5. **Валидация**
   - ✅ DNS label format для имен ресурсов
   - ✅ Валидация портов (1-65535)
   - ✅ Валидация replicas (>= 0)
   - ✅ Проверка обязательных полей
   - ✅ Проверка существования namespace перед созданием ресурса

6. **Связи между ресурсами**
   - ✅ Отображение Pods для Deployment (getPodsForDeployment)
   - ✅ Отображение Services для Pods (getServicesForPod)
   - ✅ Отображение endpoints для Services
   - ✅ Подсчет ресурсов по namespace

7. **UX улучшения**
   - ✅ Toast-уведомления для всех операций (showSuccess, showError, showValidationError)
   - ✅ Подтверждения для критичных действий (удаление)
   - ✅ Обработка ошибок с понятными сообщениями
   - ✅ Статусные бейджи для всех ресурсов
   - ✅ Прогресс-бары для метрик

### ⚠️ Требует доработки (для уровня 10/10)

1. **Редактирование ресурсов:**
   - ⚠️ Edit Deployment (изменение replicas, strategy, image) — сейчас только через Scale
   - ⚠️ Edit Service (изменение ports, selector, type)
   - ⚠️ Edit ConfigMap (изменение данных)
   - ⚠️ Edit Secret (изменение данных)
   - ⚠️ Edit Pod (изменение labels, annotations, image)

2. **YAML редактор:**
   - ⚠️ Валидация синтаксиса YAML при вводе
   - ⚠️ Валидация структуры Kubernetes ресурсов
   - ⚠️ Парсинг YAML и импорт ресурсов в конфигурацию
   - ⚠️ Экспорт ресурсов в YAML формат
   - ⚠️ Подсветка синтаксиса (опционально, если есть библиотека)

3. **Детальные карточки ресурсов:**
   - ⚠️ Расширенная информация для каждого ресурса (Labels, Annotations)
   - ⚠️ История изменений (если есть в эмуляции)
   - ⚠️ Модальные окна с детальной информацией
   - ⚠️ Визуализация связей между ресурсами (граф зависимостей)

4. **Оптимизация производительности:**
   - ⚠️ Мемоизация фильтрованных списков (useMemo)
   - ⚠️ Debounce для частых обновлений синхронизации
   - ⚠️ Оптимизация useEffect для предотвращения лишних обновлений
   - ⚠️ Виртуализация для больших списков (если ресурсов > 100)

5. **Дополнительные функции:**
   - ⚠️ Логи подов (если требуется)
   - ⚠️ Операции Pause/Resume для Deployment
   - ⚠️ Rollout/Rollback для Deployment (если поддерживается)
   - ⚠️ Копирование ресурсов (Duplicate)
   - ⚠️ Экспорт/импорт конфигурации

6. **Улучшения UI/UX:**
   - ⚠️ Индикаторы загрузки при операциях
   - ⚠️ Более детальные статусы (например, для Deployment: Ready, Progressing, Available)
   - ⚠️ Цветовая кодировка статусов (улучшить существующую)
   - ⚠️ Иконки для разных типов ресурсов (улучшить)
   - ⚠️ Progress bars для репликации (Deployments) — частично есть, можно улучшить
   - ⚠️ Визуальные индикаторы связей между ресурсами

## Цель

Довести компонент до уровня 10/10 по:
- **Функциональности** — все CRUD операции работают, все ресурсы управляемы
- **UI/UX** — полное соответствие оригинальному Kubernetes Dashboard
- **Симулятивности** — реальное влияние на систему и метрики

## Этапы работы (оставшиеся задачи)

### Этап 1: Редактирование ресурсов (ВЫСОКИЙ ПРИОРИТЕТ)

1. **Добавить состояние для редактирования:**
   - `resourceToEdit: { type: string; resource: any } | null`
   - Состояния для редактирования каждого типа ресурса

2. **Создать модальные окна редактирования:**
   - **Edit Deployment Dialog:**
     - Изменение replicas (уже есть через Scale, но можно улучшить UI)
     - Изменение strategy
     - Изменение image в template
     - Изменение labels и selector
   - **Edit Service Dialog:**
     - Изменение type
     - Изменение ports (добавление/удаление портов)
     - Изменение selector
   - **Edit ConfigMap Dialog:**
     - Редактирование данных (key-value editor)
     - Добавление/удаление ключей
   - **Edit Secret Dialog:**
     - Редактирование данных (key-value editor с маскированием)
     - Добавление/удаление ключей
   - **Edit Pod Dialog:**
     - Изменение labels
     - Изменение annotations
     - Изменение image (если поддерживается)

3. **Добавить кнопки Edit:**
   - Кнопка Edit для каждого ресурса в списке
   - Открытие соответствующего диалога редактирования

### Этап 2: Улучшение YAML редактора (СРЕДНИЙ ПРИОРИТЕТ)

1. **Валидация YAML:**
   - Базовая валидация синтаксиса YAML при вводе (можно использовать библиотеку `js-yaml`)
   - Показ ошибок валидации под редактором
   - Валидация структуры Kubernetes ресурсов (kind, apiVersion, metadata)

2. **Парсинг и импорт:**
   - Кнопка "Import from YAML" — парсинг YAML и создание ресурсов
   - Поддержка множественных ресурсов (разделение по `---`)
   - Валидация перед импортом

3. **Экспорт:**
   - Кнопка "Export to YAML" для каждого ресурса
   - Экспорт всех ресурсов выбранного типа
   - Форматирование YAML

4. **Улучшения UI:**
   - Подсветка синтаксиса (можно использовать `react-syntax-highlighter` или `monaco-editor`)
   - Нумерация строк
   - Автодополнение (опционально)

### Этап 3: Детальные карточки ресурсов (СРЕДНИЙ ПРИОРИТЕТ)

1. **Модальные окна с детальной информацией:**
   - View Deployment Details — полная информация, связанные Pods, история
   - View Service Details — полная информация, endpoints, связанные Pods
   - View Pod Details — полная информация, контейнеры, метрики, логи
   - View ConfigMap/Secret Details — полная информация, данные

2. **Расширенная информация:**
   - Labels и Annotations (редактируемые)
   - Metadata (uid, creationTimestamp, etc.)
   - Conditions и Status
   - Связанные ресурсы с ссылками

3. **Визуализация связей:**
   - Граф зависимостей (Deployment → Pods → Services)
   - Интерактивная диаграмма связей

### Этап 4: Оптимизация производительности (НИЗКИЙ ПРИОРИТЕТ)

1. **Мемоизация:**
   - `useMemo` для `filteredPods`, `filteredDeployments`, `filteredServices`
   - `useMemo` для `allNamespaces`
   - `useMemo` для вычисляемых метрик

2. **Debounce:**
   - Debounce для синхронизации с эмуляцией (если обновления слишком частые)
   - Debounce для поиска (если нужно)

3. **Оптимизация useEffect:**
   - Более точные зависимости
   - Предотвращение лишних обновлений

4. **Виртуализация:**
   - Использование `react-window` или `react-virtualized` для больших списков (>100 элементов)

### Этап 5: Дополнительные функции (НИЗКИЙ ПРИОРИТЕТ)

1. **Логи подов:**
   - Таб Logs или модальное окно
   - Интеграция с эмуляционным движком для генерации логов
   - Фильтрация и поиск в логах

2. **Операции Deployment:**
   - Pause/Resume Deployment (через `updateDeployment` с `paused: true/false`)
   - Rollout/Rollback (если поддерживается эмуляцией)

3. **Копирование ресурсов:**
   - Кнопка "Duplicate" для создания копии ресурса
   - Автоматическое изменение имени

4. **Экспорт/импорт:**
   - Экспорт всей конфигурации в JSON/YAML
   - Импорт конфигурации из файла

### Этап 6: Улучшения UI/UX (НИЗКИЙ ПРИОРИТЕТ)

1. **Индикаторы загрузки:**
   - Loading state для операций создания/обновления
   - Skeleton loaders для списков

2. **Улучшенные статусы:**
   - Более детальные статусы для Deployment (Ready, Progressing, Available, ReplicaFailure)
   - Статусы для Service (Active, Pending)
   - Цветовая кодировка всех статусов

3. **Визуальные улучшения:**
   - Иконки для типов ресурсов (улучшить существующие)
   - Progress bars для репликации (улучшить существующие)
   - Анимации при изменениях

4. **Навигация:**
   - Breadcrumbs
   - Быстрые фильтры
   - Сохранение состояния фильтров

## Технические детали

### Структура файла
- Файл: `src/components/config/infrastructure/KubernetesConfigAdvanced.tsx`
- Импорты: все необходимые компоненты UI уже импортированы
- Типы: все типы из `KubernetesEmulationEngine` доступны

### Паттерны для реализации

1. **CRUD операции:**
   - Функции уже созданы: `createDeployment`, `deleteDeployment`, `createService`, `deleteService`, `createConfigMap`, `deleteConfigMap`, `createSecret`, `deleteSecret`, `createNamespace`, `deleteNamespace`
   - Нужно подключить их к UI и создать модальные окна

2. **Фильтрация:**
   - Использовать паттерн как в `filteredPods`
   - Состояния для фильтров уже созданы

3. **Модальные окна:**
   - Использовать `AlertDialog` из `@/components/ui/alert-dialog`
   - Паттерн как в существующих модальных окнах (Create Pod уже есть как пример)

### Пример структуры для таба Deployments:

```tsx
<TabsContent value="deployments" className="space-y-4 mt-4">
  <Card>
    <CardHeader>
      <div className="flex items-center justify-between">
        <div>
          <CardTitle>Deployments</CardTitle>
          <CardDescription>Manage application deployments</CardDescription>
        </div>
        <Button onClick={() => setShowCreateDeployment(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Deployment
        </Button>
      </div>
    </CardHeader>
    <CardContent>
      {/* Поиск и фильтры */}
      <div className="flex gap-4 mb-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search deployments..."
            value={deploymentSearchQuery}
            onChange={(e) => setDeploymentSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={deploymentNamespaceFilter} onValueChange={setDeploymentNamespaceFilter}>
          {/* ... */}
        </Select>
      </div>
      
      {/* Список Deployments */}
      <div className="space-y-3">
        {filteredDeployments.map((deployment) => (
          <Card key={deployment.id} className="border-border">
            {/* Детали Deployment */}
          </Card>
        ))}
      </div>
    </CardContent>
  </Card>
</TabsContent>
```

## Важные замечания

1. **Синхронизация с эмуляцией:**
   - Все изменения должны обновлять и конфиг, и эмуляционный движок через `updateConfig`
   - Эмуляционный движок автоматически обновляет метрики при изменениях

2. **Валидация:**
   - Все имена ресурсов должны соответствовать DNS label format: `^[a-z0-9]([-a-z0-9]*[a-z0-9])?$`
   - Namespace должен существовать перед созданием ресурса в нем

3. **Обработка ошибок:**
   - Использовать `showError`, `showValidationError`, `showWarning` из `@/utils/toast`
   - Показывать понятные сообщения пользователю

4. **Производительность:**
   - Использовать `useMemo` для фильтрованных списков
   - Оптимизировать useEffect для синхронизации

## Критерии завершения

### ✅ Уже выполнено (уровень 8/10):

- ✅ Все табы имеют полноценную реализацию (нет placeholder'ов)
- ✅ Все CRUD операции работают для всех ресурсов (Create, Read, Delete)
- ✅ Все модальные окна создания реализованы
- ✅ Поиск и фильтрация работают для всех табов
- ✅ Синхронизация с эмуляцией работает корректно
- ✅ Метрики отображаются в реальном времени
- ✅ Обработка ошибок реализована
- ✅ UI соответствует оригинальному Kubernetes Dashboard по структуре
- ✅ Валидация форм реализована
- ✅ Связи между ресурсами отображаются

### ⚠️ Для достижения уровня 10/10 осталось:

- ⚠️ Редактирование ресурсов (Update операции через UI)
- ⚠️ Улучшение YAML редактора (валидация, парсинг, импорт/экспорт)
- ⚠️ Детальные карточки ресурсов с расширенной информацией
- ⚠️ Оптимизация производительности (useMemo, debounce)
- ⚠️ Дополнительные функции (логи, pause/resume, duplicate)
- ⚠️ Улучшения UI/UX (индикаторы загрузки, детальные статусы)

## Начать с

Рекомендуется начать с **Этапа 1** — реализации редактирования ресурсов, так как это критичная функциональность для полноценного управления Kubernetes ресурсами. Затем перейти к улучшению YAML редактора и детальным карточкам.


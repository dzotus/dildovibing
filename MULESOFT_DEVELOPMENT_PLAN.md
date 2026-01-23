# План разработки компонента MuleSoft Anypoint Platform

## Анализ текущего состояния

### Что уже реализовано ✅

1. **Базовая структура UI:**
   - Табы: Applications, Connectors, Monitoring, Settings
   - CRUD операции для Applications
   - CRUD операции для Connectors
   - Базовые настройки (organization, environment, API key)

2. **MuleSoftRoutingEngine:**
   - Обработка приложений и коннекторов
   - Базовая маршрутизация через flows
   - Трансформация данных (упрощенная)
   - Обработка ошибок (error strategies)
   - Метрики приложений и коннекторов

3. **Интеграция в систему:**
   - EmulationEngine: симуляция метрик
   - DataFlowEngine: обработка сообщений
   - Connection Rules: автоматическое создание коннекторов

### Критические проблемы ❌

1. **Отсутствие управления Flows в UI:**
   - Flows - это основные строительные блоки MuleSoft приложений
   - Нет возможности создавать/редактировать flows
   - Нет визуализации структуры flows
   - Нет управления processors внутри flows

2. **Отсутствие DataWeave трансформаций:**
   - DataWeave - это язык трансформации данных MuleSoft
   - Нет UI для создания/редактирования трансформаций
   - Нет поддержки сложных трансформаций (hierarchical mapping, type conversions)

3. **Отсутствие ключевых компонентов Mule:**
   - Try scopes для обработки ошибок
   - Choice router для условной маршрутизации
   - Batch processing
   - Асинхронная обработка
   - Error handlers

4. **Метрики не синхронизированы с эмуляцией:**
   - UI показывает статичные значения (requestCount, errorCount, avgResponseTime)
   - Не обновляются из MuleSoftRoutingEngine
   - Не отражают реальное состояние симуляции

5. **Неполная конфигурация Connectors:**
   - Нет детальных настроек для разных типов коннекторов
   - Нет управления параметрами подключения
   - Нет настройки retry policies для коннекторов

6. **Отсутствие реальных возможностей MuleSoft:**
   - Нет API Management (API Manager)
   - Нет Exchange для обмена коннекторами
   - Нет Runtime Manager для управления деплоями
   - Нет DataGraph для объединения API

---

## План реализации (по этапам)

### Этап 1: Анализ реального MuleSoft Anypoint Platform

**Цель:** Получить полное понимание реального продукта

**Задачи:**
1. Изучить официальную документацию MuleSoft:
   - [Anypoint Platform Overview](https://anypoint.mulesoft.com/)
   - [Mule Runtime Documentation](https://docs.mulesoft.com/mule-runtime/latest/)
   - [DataWeave Documentation](https://docs.mulesoft.com/dataweave/latest/)
   - [Anypoint Connectors](https://docs.mulesoft.com/connectors/)
   - [API Manager](https://docs.mulesoft.com/api-manager/)
   - [Runtime Manager](https://docs.mulesoft.com/runtime-manager/)

2. Изучить ключевые концепции:
   - **Flows** - структура и компоненты
   - **DataWeave** - синтаксис и возможности
   - **Connectors** - типы и конфигурация
   - **Error Handling** - Try scopes, Error handlers
   - **Routers** - Choice, Scatter-Gather, For-Each
   - **Processors** - Transform, Validate, Filter, Enrich, Logger
   - **Batch Processing** - Batch Jobs
   - **Async Processing** - Async scopes

3. Изучить UI/UX реального Anypoint Platform:
   - Design Center (визуальный редактор flows)
   - Runtime Manager (управление деплоями)
   - API Manager (управление API)
   - Exchange (библиотека коннекторов)

**Результат:** Документ с описанием всех функций и UI элементов реального MuleSoft

---

### Этап 2: Расширение MuleSoftRoutingEngine ✅ **ВЫПОЛНЕНО**

**Цель:** Реализовать полную логику обработки MuleSoft приложений

**Статус:** ✅ Завершен

**Задачи:**

#### 2.1. Расширение интерфейсов
```typescript
// Добавить в MuleSoftRoutingEngine.ts:

interface MuleFlow {
  id: string;
  name: string;
  source?: MuleSource; // HTTP Listener, Scheduler, etc.
  processors: MuleProcessor[];
  target?: MuleTarget; // HTTP Request, Database, etc.
  errorHandlers?: MuleErrorHandler[];
  async?: boolean;
}

interface MuleSource {
  type: 'http-listener' | 'scheduler' | 'file-reader' | 'connector';
  config: Record<string, any>;
}

interface MuleTarget {
  type: 'http-request' | 'database' | 'file-writer' | 'connector';
  config: Record<string, any>;
}

interface MuleProcessor {
  id: string;
  type: 'transform' | 'validate' | 'filter' | 'enrich' | 'logger' | 
        'choice' | 'try' | 'batch' | 'async' | 'set-variable' | 'set-payload';
  config: Record<string, any>;
  dataweave?: string; // DataWeave expression для transform
  children?: MuleProcessor[]; // Для choice, try, batch
}

interface MuleErrorHandler {
  type: 'on-error-continue' | 'on-error-propagate';
  errorType?: string;
  processors: MuleProcessor[];
}
```

#### 2.2. Реализация DataWeave трансформаций
- Парсинг DataWeave выражений (упрощенный)
- Поддержка базовых операций:
  - Object-to-object mapping
  - Array-to-array transformation
  - Type conversions
  - String/number/boolean operations
  - Filtering и mapping

#### 2.3. Реализация Processors
- **Transform** - DataWeave трансформации
- **Validate** - валидация данных
- **Filter** - фильтрация сообщений
- **Enrich** - обогащение данных
- **Logger** - логирование
- **Set Variable** - установка переменных
- **Set Payload** - установка payload

#### 2.4. Реализация Routers
- **Choice Router** - условная маршрутизация
- **Scatter-Gather** - параллельная обработка
- **For-Each** - итерация по массивам

#### 2.5. Реализация Error Handling
- **Try Scope** - обработка ошибок с retry
- **Error Handlers** - глобальные обработчики ошибок
- **On-Error-Continue** - продолжение после ошибки
- **On-Error-Propagate** - распространение ошибки

#### 2.6. Реализация Batch Processing
- Batch Jobs
- Batch Steps
- Batch Aggregator

#### 2.7. Реализация Async Processing
- Async scopes
- Non-blocking операции

**Результат:** Полнофункциональный MuleSoftRoutingEngine с поддержкой всех компонентов Mule

---

### Этап 3: Расширение UI - Flows Management ✅ **ВЫПОЛНЕНО**

**Цель:** Добавить полное управление flows в UI

**Статус:** ✅ Завершен (базовая версия)

**Задачи:**

#### 3.1. Вкладка Flows в Applications
- Список flows для каждого приложения
- Кнопка "Create Flow"
- Редактирование flows
- Удаление flows

#### 3.2. Flow Editor (модальное окно или отдельная секция)
- Визуальное представление flow:
  ```
  [Source] → [Processor 1] → [Processor 2] → ... → [Target]
  ```
- Добавление Source:
  - HTTP Listener (path, method, port)
  - Scheduler (cron expression)
  - File Reader (path, pattern)
  - Connector (выбор из доступных)
- Добавление Processors:
  - Transform (с DataWeave редактором)
  - Validate
  - Filter
  - Enrich
  - Logger
  - Set Variable
  - Set Payload
  - Choice Router (с условиями)
  - Try Scope (с error handlers)
- Добавление Target:
  - HTTP Request (URL, method, headers)
  - Database (query, connection)
  - File Writer (path)
  - Connector (выбор из доступных)
- Drag & drop для изменения порядка
- Удаление компонентов

#### 3.3. DataWeave Editor
- Code editor с подсветкой синтаксиса
- Автодополнение
- Валидация синтаксиса
- Примеры трансформаций
- Preview результата (на тестовых данных)

#### 3.4. Processor Configuration
- Модальные окна для каждого типа processor
- Валидация конфигурации
- Подсказки и описания

**Результат:** Полнофункциональный UI для управления flows

---

### Этап 4: Расширение UI - Connectors Management ✅ **ВЫПОЛНЕНО**

**Цель:** Детальная конфигурация коннекторов

**Статус:** ✅ Завершен

**Задачи:**

#### 4.1. Расширенная конфигурация Connectors ✅
- Для Database connectors:
  - Connection string
  - Connection pool settings
  - Query timeout
  - Retry policy
- Для API connectors:
  - Base URL
  - Authentication (OAuth, Basic, API Key)
  - Headers
  - Timeout
  - Retry policy
- Для Messaging connectors:
  - Broker URL
  - Queue/Topic name
  - Connection factory
  - Acknowledgment mode
- Для File connectors:
  - Path
  - Pattern
  - Encoding
  - Buffer size

#### 4.2. Connector Health Monitoring ✅
- Статус подключения (connected/disconnected/error)
- Последняя успешная операция
- Количество ошибок
- Latency метрики
- Автоматическое определение статуса на основе метрик

#### 4.3. Connector Testing ✅
- Кнопка "Test Connection" в модальном окне конфигурации
- Проверка доступности (симулированная)
- Валидация конфигурации

**Результат:** ✅ Детальная конфигурация и мониторинг коннекторов реализованы

---

### Этап 5: Синхронизация метрик с эмуляцией ✅ **ВЫПОЛНЕНО**

**Цель:** Отображение реальных метрик из симуляции

**Статус:** ✅ Завершен

**Задачи:**

#### 5.1. Получение метрик из MuleSoftRoutingEngine
- Методы для получения метрик приложений
- Методы для получения метрик flows
- Методы для получения метрик коннекторов

#### 5.2. Обновление UI в реальном времени
- Подписка на изменения метрик
- Обновление каждые N секунд (или при изменениях)
- Отображение метрик в карточках приложений
- Отображение метрик в Monitoring tab

#### 5.3. Детальные метрики
- Requests per second
- Error rate
- Average latency
- P50, P95, P99 latency
- Throughput
- Utilization

**Результат:** Реальные метрики из симуляции в UI

---

### Этап 6: Дополнительные функции MuleSoft

**Цель:** Реализовать дополнительные возможности платформы

**Задачи:**

#### 6.1. API Management (упрощенная версия)
- API Manager tab
- API Definitions
- API Versions
- API Policies (rate limiting, authentication)
- API Analytics

#### 6.2. Exchange (упрощенная версия)
- Библиотека коннекторов
- Поиск коннекторов
- Установка коннекторов
- Управление версиями

#### 6.3. Runtime Manager (упрощенная версия)
- Управление деплоями
- История деплоев
- Rollback
- Environment management

**Результат:** Дополнительные функции платформы

---

### Этап 7: Улучшение симулятивности

**Цель:** Сделать симуляцию максимально реалистичной

**Задачи:**

#### 7.1. Реалистичные метрики
- Учет сложности flows (количество processors)
- Учет типов коннекторов (database медленнее API)
- Учет DataWeave трансформаций (сложность влияет на latency)
- Учет error handling (retry увеличивает latency)

#### 7.2. Реалистичное поведение
- Connection pooling для database connectors
- Retry logic с exponential backoff
- Circuit breaker для недоступных сервисов
- Rate limiting для API connectors
- Batch processing влияет на throughput

#### 7.3. Реалистичные ошибки
- Connection errors
- Timeout errors
- Validation errors
- Transformation errors
- Ошибки зависят от конфигурации

**Результат:** Реалистичная симуляция поведения MuleSoft

---

### Этап 8: Исправление багов и оптимизация

**Цель:** Устранить все проблемы и оптимизировать код

**Задачи:**

#### 8.1. Исправление багов
- Проверка всех интерактивных элементов
- Исправление сохранения конфигурации
- Исправление синхронизации с эмуляцией
- Исправление валидации

#### 8.2. Оптимизация
- Оптимизация рендеринга UI
- Оптимизация вычислений метрик
- Оптимизация обработки сообщений
- Кэширование где возможно

#### 8.3. Удаление хардкода
- Все значения из конфигурации
- Нет магических чисел
- Все строки локализованы (если нужно)

**Результат:** Чистый, оптимизированный код без багов

---

## Критерии качества (10/10)

### Функциональность (10/10)
- [ ] Все функции реального MuleSoft реализованы
- [ ] Flows полностью функциональны
- [ ] DataWeave трансформации работают
- [ ] Все processors реализованы
- [ ] Error handling работает корректно
- [ ] Batch processing работает
- [ ] Async processing работает
- [ ] Все CRUD операции работают
- [ ] Валидация данных корректна
- [ ] Обработка ошибок реализована

### UI/UX (10/10)
- [ ] Структура соответствует реальному Anypoint Platform
- [ ] Flow editor интуитивен
- [ ] DataWeave editor удобен
- [ ] Все элементы интерактивны
- [ ] Навигация логична
- [ ] Визуальный стиль соответствует оригиналу
- [ ] Адаптивность (табы переносятся на новую строку)
- [ ] Toast-уведомления для операций
- [ ] Подтверждения для критичных действий
- [ ] Подсказки и описания

### Симулятивность (10/10)
- [ ] Компонент влияет на метрики системы
- [ ] Метрики отражают реальное состояние
- [ ] Конфигурация влияет на поведение
- [ ] Flows влияют на обработку данных
- [ ] DataWeave трансформации влияют на latency
- [ ] Error handling влияет на error rate
- [ ] Connectors влияют на throughput
- [ ] Интеграция с другими компонентами работает
- [ ] Метрики реалистичны
- [ ] Поведение соответствует реальному MuleSoft

---

## Приоритеты реализации

### Высокий приоритет (MVP)
1. ✅ Управление Flows в UI - **ВЫПОЛНЕНО**
   - Добавлен таб Flows в Applications
   - Реализован Flow Editor (модальное окно)
   - CRUD операции для flows
   - Добавление/удаление processors в flows
   - Конфигурация Source и Target для flows
2. ✅ DataWeave трансформации (базовые) - **ВЫПОЛНЕНО**
   - Реализован базовый парсер DataWeave
   - Расчет сложности трансформаций
   - Влияние на latency симуляции
   - DataWeave Editor в Flow Editor
3. ✅ Синхронизация метрик с эмуляцией - **ВЫПОЛНЕНО**
   - Метрики обновляются из MuleSoftRoutingEngine в реальном времени
   - requestCount, errorCount, avgResponseTime синхронизируются
   - Обновление каждые 2 секунды во время симуляции
4. ✅ Расширение Processors (Transform, Validate, Filter, Logger) - **ВЫПОЛНЕНО**
   - Transform с DataWeave поддержкой
   - Validate с конфигурацией
   - Filter с условиями
   - Logger с сообщениями
5. ✅ Choice Router - **ВЫПОЛНЕНО**
   - Условная маршрутизация
   - Поддержка when условий
   - Вложенные processors в routes
6. ✅ Try Scope с error handling - **ВЫПОЛНЕНО**
   - Try scope с обработкой ошибок
   - Error handlers (on-error-continue, on-error-propagate)
   - Интеграция с flow error handlers

### Средний приоритет
1. ✅ Enrich processor - **ВЫПОЛНЕНО**
   - Конфигурация source (connector/variable/payload)
   - Конфигурация targetVariable
   - Поддержка DataWeave для трансформации
   - Интеграция с connectors для обогащения данных
   - Учет retry policy при обогащении через connectors
2. ✅ Set Variable/Payload processors - **ВЫПОЛНЕНО**
   - Конфигурация Set Variable (name, value)
   - Конфигурация Set Payload (value, DataWeave)
   - Поддержка DataWeave для set-payload
3. ✅ Детальная конфигурация Connectors - **ВЫПОЛНЕНО**
   - Database: connection string, pool size, query timeout, retry policy
   - API: base URL, authentication, timeout, retry policy
   - Messaging: broker URL, queue/topic, acknowledgment mode
   - File: path, pattern, encoding, buffer size
   - Модальное окно для конфигурации каждого типа
4. ✅ Connector health monitoring - **ВЫПОЛНЕНО**
   - Статус подключения (connected/disconnected/error)
   - Синхронизация метрик из эмуляции
   - Отображение error count и latency
   - Автоматическое определение статуса
5. API Management (базовая версия)

### Низкий приоритет (Nice to have)
1. Batch Processing
2. Async Processing
3. Scatter-Gather router
4. Exchange
5. Runtime Manager

---

## Технические детали

### Структура файлов
```
src/
  components/
    config/
      integration/
        MuleSoftConfigAdvanced.tsx (основной UI)
        MuleSoftFlowEditor.tsx (редактор flows)
        MuleSoftDataWeaveEditor.tsx (редактор DataWeave)
        MuleSoftProcessorConfig.tsx (конфигурация processors)
  core/
    MuleSoftRoutingEngine.ts (расширенный)
    MuleSoftDataWeave.ts (парсер DataWeave)
  services/
    connection/
      rules/
        mulesoftRules.ts (уже есть)
```

### Зависимости
- Code editor для DataWeave (можно использовать Monaco Editor или CodeMirror)
- Drag & drop для Flow Editor (можно использовать react-dnd или dnd-kit)

---

## Примечания

1. **Не делать по аналогии с другими компонентами:**
   - MuleSoft уникален по архитектуре (Flows, DataWeave)
   - Не копировать логику из Kong/Apigee
   - Каждый компонент должен быть уникальным

2. **Избегать хардкода:**
   - Все значения из конфигурации
   - Нет магических чисел
   - Все параметры настраиваемы

3. **Соответствие реальности:**
   - Изучать официальную документацию
   - Следовать реальной архитектуре
   - Реалистичные метрики и поведение

4. **Качество превыше скорости:**
   - Делать тщательно
   - Тестировать каждый шаг
   - Не спешить

---

## Следующие шаги

1. Начать с Этапа 1: Анализ реального MuleSoft
2. Составить детальный список всех функций
3. Создать TODO-лист для каждого этапа
4. Реализовывать пошагово, тестируя каждый шаг

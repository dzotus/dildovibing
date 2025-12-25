# Промпт: Интеграция реального Docker API в систему симуляции

## Контекст
Текущая система симуляции архитектуры использует полностью симулированный Docker компонент через `DockerEmulationEngine`. Требуется добавить возможность работы с реальным Docker daemon через Docker API, сохранив при этом возможность работы в режиме симуляции.

## Цель
Реализовать гибридную систему, которая позволяет:
1. Работать в режиме симуляции (текущий функционал)
2. Подключаться к реальному Docker daemon и управлять реальными ресурсами
3. Переключаться между режимами без потери функциональности
4. Получать реальные метрики из Docker daemon

## Требования

### 1. Архитектура

#### 1.1. Docker API Adapter
Создать слой абстракции `DockerAPIAdapter`:
- Подключение к Docker daemon (local socket или remote TCP)
- Обработка всех операций через Docker Engine API
- Обработка ошибок и fallback логика
- Кэширование для оптимизации производительности
- Поддержка Docker Events API для real-time обновлений

#### 1.2. Режимы работы
Реализовать три режима:
- **Simulation Mode** (по умолчанию) — текущая симуляция через `DockerEmulationEngine`
- **Real Docker Mode** — подключение к реальному Docker daemon
- **Hybrid Mode** — комбинация: часть контейнеров реальные, часть симулированные

#### 1.3. Единый интерфейс
Создать единый интерфейс `IDockerProvider`:
```typescript
interface IDockerProvider {
  // Containers
  listContainers(): Promise<DockerContainer[]>;
  getContainer(id: string): Promise<DockerContainer | null>;
  createContainer(config: ContainerCreateConfig): Promise<DockerContainer>;
  startContainer(id: string): Promise<void>;
  stopContainer(id: string): Promise<void>;
  pauseContainer(id: string): Promise<void>;
  unpauseContainer(id: string): Promise<void>;
  restartContainer(id: string): Promise<void>;
  removeContainer(id: string): Promise<void>;
  
  // Images
  listImages(): Promise<DockerImage[]>;
  pullImage(repository: string, tag: string): Promise<DockerImage>;
  buildImage(config: BuildImageConfig): Promise<DockerImage>;
  removeImage(id: string): Promise<void>;
  
  // Networks
  listNetworks(): Promise<DockerNetwork[]>;
  createNetwork(config: NetworkCreateConfig): Promise<DockerNetwork>;
  removeNetwork(id: string): Promise<void>;
  
  // Volumes
  listVolumes(): Promise<DockerVolume[]>;
  createVolume(config: VolumeCreateConfig): Promise<DockerVolume>;
  removeVolume(id: string): Promise<void>;
  
  // Metrics
  getContainerStats(id: string): Promise<ContainerStats>;
  getSystemInfo(): Promise<DockerSystemInfo>;
  
  // Events
  subscribeToEvents(callback: (event: DockerEvent) => void): () => void;
}
```

### 2. Реализация DockerAPIAdapter

#### 2.1. Использование библиотеки
Использовать официальную библиотеку Docker SDK:
- `dockerode` для Node.js/TypeScript
- Или прямые HTTP запросы к Docker Engine API

#### 2.2. Подключение
- Поддержка `unix:///var/run/docker.sock` (локальный)
- Поддержка `tcp://host:port` (удаленный)
- Поддержка Docker contexts (Docker Desktop)
- Настройка таймаутов и retry логики

#### 2.3. Маппинг данных
Преобразование данных Docker API в формат системы:
- Docker API контейнеры → `DockerContainer`
- Docker API образы → `DockerImage`
- Docker API сети → `DockerNetwork`
- Docker API тома → `DockerVolume`
- Docker stats → метрики системы

#### 2.4. Обработка ошибок
- Обработка недоступности Docker daemon
- Обработка ошибок API (404, 500, timeout)
- Fallback на симуляцию при ошибках
- Логирование всех операций

### 3. Модификация DockerEmulationEngine

#### 3.1. Поддержка режимов
Добавить в `DockerEmulationEngine`:
- Поле `mode: 'simulation' | 'real' | 'hybrid'`
- Поле `dockerAdapter?: DockerAPIAdapter` (для real/hybrid режимов)
- Метод `setMode(mode)` для переключения режимов

#### 3.2. Делегирование операций
В режиме `real` или `hybrid`:
- Проверять, нужно ли использовать реальный Docker
- Делегировать операции в `DockerAPIAdapter`
- Сохранять симуляцию для метрик и визуализации

#### 3.3. Синхронизация
- Периодическая синхронизация реальных данных (polling)
- Подписка на Docker Events для real-time обновлений
- Обновление внутреннего состояния движка

### 4. UI изменения

#### 4.1. Переключатель режимов
Добавить в header компонента Docker:
- Toggle/Switch для переключения между Simulation и Real Docker
- Индикатор статуса подключения (подключен/отключен/ошибка)
- Настройки подключения (модальное окно)

#### 4.2. Настройки подключения
Модальное окно с полями:
- Docker daemon URL (по умолчанию: `unix:///var/run/docker.sock`)
- Режим подключения (Local Socket / Remote TCP)
- Для Remote TCP: Host, Port, TLS настройки
- Кнопка "Test Connection"
- Сохранение настроек в конфигурации компонента

#### 4.3. Визуальные индикаторы
- Бейдж "Real" или "Simulated" для каждого ресурса
- Разные цвета/иконки для реальных vs симулированных контейнеров
- Индикатор синхронизации (когда идет обновление данных)
- Предупреждения при работе с реальными ресурсами

#### 4.4. Предупреждения
- Toast-уведомления при переключении в Real режим
- Диалоги подтверждения для критичных операций с реальными ресурсами
- Предупреждение о том, что операции влияют на реальный Docker

### 5. Конфигурация

#### 5.1. Структура конфига
Добавить в `DockerConfig`:
```typescript
interface DockerConfig {
  // ... существующие поля
  
  // Режим работы
  mode?: 'simulation' | 'real' | 'hybrid';
  
  // Настройки подключения к реальному Docker
  dockerConnection?: {
    type: 'local' | 'remote';
    url?: string; // unix:///var/run/docker.sock или tcp://host:port
    host?: string;
    port?: number;
    useTLS?: boolean;
    caCert?: string;
    clientCert?: string;
    clientKey?: string;
  };
  
  // Настройки синхронизации
  syncSettings?: {
    enabled: boolean;
    interval?: number; // ms для polling
    useEvents?: boolean; // использовать Docker Events API
  };
}
```

### 6. Метрики и мониторинг

#### 6.1. Получение реальных метрик
- Использовать `docker stats` API для получения CPU, memory, network
- Периодический polling (каждые 1-2 секунды)
- Кэширование для снижения нагрузки
- Преобразование в формат `ComponentMetrics`

#### 6.2. Системная информация
- Получение информации о Docker host через `/info` endpoint
- Отображение версии Docker, OS, ресурсов хоста
- Использование для валидации и ограничений

### 7. Безопасность

#### 7.1. Валидация операций
- Проверка прав доступа перед выполнением операций
- Валидация параметров (имена, ресурсы)
- Предотвращение опасных операций (удаление всех контейнеров)

#### 7.2. Sandbox режим
- Опциональный режим "read-only" — только чтение данных
- Режим "safe" — только безопасные операции
- Режим "full" — все операции разрешены

#### 7.3. Логирование
- Логирование всех операций с реальным Docker
- Аудит изменений (кто, что, когда)
- Сохранение истории операций

### 8. Производительность

#### 8.1. Оптимизация запросов
- Кэширование списков контейнеров/образов
- Debouncing для частых обновлений
- Batch операции где возможно
- Виртуализация списков в UI при большом количестве ресурсов

#### 8.2. Асинхронность
- Все операции с Docker API должны быть асинхронными
- Не блокировать UI при выполнении операций
- Показывать индикаторы загрузки

### 9. Обработка edge cases

#### 9.1. Недоступность Docker
- Graceful degradation — fallback на симуляцию
- Понятные сообщения об ошибках
- Автоматическая попытка переподключения

#### 9.2. Конфликты имен
- Проверка уникальности имен перед созданием
- Предупреждения о конфликтах
- Автоматическое разрешение конфликтов (добавление суффиксов)

#### 9.3. Параллельные изменения
- Обработка изменений, сделанных вне системы
- Синхронизация при обнаружении расхождений
- Версионирование для разрешения конфликтов

### 10. Тестирование

#### 10.1. Unit тесты
- Тесты для DockerAPIAdapter
- Тесты для маппинга данных
- Тесты для обработки ошибок

#### 10.2. Integration тесты
- Тесты подключения к реальному Docker
- Тесты CRUD операций
- Тесты синхронизации

#### 10.3. E2E тесты
- Тесты переключения режимов
- Тесты работы с реальными контейнерами
- Тесты обработки ошибок

## Этапы реализации

### Этап 1: Базовая инфраструктура (1-2 дня)
1. Создать `DockerAPIAdapter` с базовым подключением
2. Реализовать интерфейс `IDockerProvider`
3. Добавить настройки подключения в конфиг
4. Реализовать переключение режимов в `DockerEmulationEngine`

### Этап 2: Чтение данных (2-3 дня)
1. Реализовать `listContainers()`, `listImages()`, `listNetworks()`, `listVolumes()`
2. Маппинг данных Docker API → формат системы
3. Периодическая синхронизация (polling)
4. Отображение реальных данных в UI

### Этап 3: CRUD операции (3-4 дня)
1. Реализовать создание контейнеров через API
2. Реализовать start/stop/pause/restart/remove
3. Реализовать pull/build/remove образов
4. Реализовать создание/удаление сетей и томов
5. Обработка ошибок и валидация

### Этап 4: Метрики и события (2-3 дня)
1. Реализовать получение метрик через `docker stats`
2. Подписка на Docker Events API
3. Real-time обновления в UI
4. Преобразование метрик в формат системы

### Этап 5: UI улучшения (2-3 дня)
1. Переключатель режимов в header
2. Модальное окно настроек подключения
3. Визуальные индикаторы (Real/Simulated)
4. Предупреждения и подтверждения
5. Индикаторы статуса подключения

### Этап 6: Безопасность и оптимизация (2-3 дня)
1. Валидация операций
2. Sandbox режимы
3. Логирование и аудит
4. Оптимизация производительности
5. Кэширование и debouncing

### Этап 7: Тестирование и документация (2-3 дня)
1. Unit тесты
2. Integration тесты
3. E2E тесты
4. Документация API
5. Руководство пользователя

## Критерии успеха

1. ✅ Успешное подключение к реальному Docker daemon
2. ✅ Чтение списков контейнеров, образов, сетей, томов
3. ✅ Выполнение CRUD операций через API
4. ✅ Получение реальных метрик (CPU, memory, network)
5. ✅ Real-time обновления через Events API
6. ✅ Переключение между режимами без потери функциональности
7. ✅ Graceful fallback на симуляцию при ошибках
8. ✅ Безопасная работа с реальными ресурсами
9. ✅ Производительность не страдает при большом количестве ресурсов
10. ✅ Понятный UI с индикаторами режима работы

## Важные замечания

1. **Безопасность превыше всего** — все операции с реальным Docker должны быть валидированы и подтверждены
2. **Обратная совместимость** — режим симуляции должен продолжать работать как раньше
3. **Производительность** — не должно быть блокировок UI при работе с реальным Docker
4. **Обработка ошибок** — система должна gracefully обрабатывать все возможные ошибки
5. **Документация** — важно документировать все изменения и новые возможности

## Дополнительные возможности (опционально)

1. **Docker Compose интеграция** — чтение/запись docker-compose.yml файлов
2. **Multi-host support** — управление несколькими Docker hosts одновременно
3. **Container orchestration** — интеграция с Kubernetes через Docker API
4. **Image registry sync** — синхронизация с Docker Hub/private registries
5. **Backup/restore** — экспорт/импорт конфигураций контейнеров
6. **Templates** — предустановленные шаблоны для популярных контейнеров

## Вопросы для уточнения

1. Какой Docker SDK использовать? (dockerode, docker-client, прямые HTTP запросы)
2. Нужна ли поддержка Docker Desktop contexts?
3. Какие операции должны быть доступны в read-only режиме?
4. Нужна ли поддержка Docker Swarm?
5. Как обрабатывать конфликты при параллельных изменениях?
6. Нужна ли поддержка Docker Compose?
7. Какие метрики критичны для отображения?
8. Нужна ли поддержка удаленных Docker hosts с TLS?

---

**Приоритет:** Высокий  
**Сложность:** Средняя-Высокая  
**Ориентировочное время:** 14-20 дней разработки  
**Зависимости:** Docker daemon должен быть доступен, библиотека Docker SDK


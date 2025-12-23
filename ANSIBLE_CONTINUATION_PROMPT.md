# Продолжение разработки компонента Ansible

## Контекст

Компонент Ansible для проекта симуляции архитектуры находится в процессе доведения до уровня 10/10. Выполнена значительная работа по интеграции эмуляции и базового UI.

## Выполненная работа

### ✅ Завершено:

1. **AnsibleEmulationEngine** (`src/core/AnsibleEmulationEngine.ts`)
   - Полная реализация логики симуляции
   - Управление inventories, projects, credentials, job templates, jobs, schedules
   - Расчет метрик в реальном времени
   - ~900 строк кода

2. **Интеграция в EmulationEngine** (`src/core/EmulationEngine.ts`)
   - Инициализация движка для Ansible нод
   - Симуляция метрик (simulateAnsible)
   - Вызов performUpdate в цикле симуляции
   - Метод getAnsibleEmulationEngine для доступа из UI

3. **UI компонент** (`src/components/config/devops/AnsibleConfigAdvanced.tsx`)
   - Интеграция с эмуляцией (чтение данных, синхронизация)
   - Табы: Inventories, Projects, Credentials, Job Templates, Jobs, Schedules, Settings
   - Улучшенный Jobs UI с детальным просмотром, логами, статистикой
   - Расширенные настройки Job Templates (extra_vars, limit, verbosity, tags)
   - Редактирование Inventories (hosts и groups через Dialog с CRUD)
   - Projects: Dialog для создания/редактирования (базовая структура добавлена)
   - Toast-уведомления для всех операций
   - Подтверждения удаления через AlertDialog
   - Валидация полей
   - ~1700+ строк кода (размер bundle: ~43.50 kB)

### 📋 Оставшиеся задачи (из TODO):

- **ansible-9**: ✅ Projects CRUD - базовая структура Dialog добавлена, нужно доработать логику обновления при редактировании
- **ansible-10**: Добавление Credentials - CRUD для различных типов (SSH, AWS, Azure, GCP, Vault)
- **ansible-11**: Добавление Schedules - CRUD с cron expressions и периодическими запусками
- **ansible-12**: Workflow Job Templates (можно отложить, менее приоритетно)
- **ansible-16**: Очистка и оптимизация кода

## Текущее состояние

- ✅ Компиляция проходит успешно
- ✅ Линтер ошибок не показывает
- ✅ Базовая функциональность работает
- ✅ Интеграция с эмуляцией функционирует
- ⚠️ Проект большой (~1600 строк в UI компоненте)

## Архитектура

### Типы данных (из AnsibleEmulationEngine.ts):

```typescript
interface AnsibleInventory {
  id: string;
  name: string;
  type: 'static' | 'dynamic' | 'smart';
  hosts?: Array<{ id: string; name: string; groups: string[]; variables?: Record<string, any>; }>;
  groups?: Array<{ id: string; name: string; hosts: string[]; variables?: Record<string, any>; children?: string[]; }>;
}

interface AnsibleProject {
  id: string;
  name: string;
  scmType: 'git' | 'svn' | 'insights' | 'manual' | 'archive';
  scmUrl?: string;
  scmBranch?: string;
  playbooks?: string[];
  status?: 'new' | 'waiting' | 'running' | 'successful' | 'failed';
}

interface AnsibleCredential {
  id: string;
  name: string;
  credentialType: 'machine' | 'vault' | 'source_control' | 'cloud' | 'network';
  username?: string;
  password?: string;
  sshKey?: string;
  becomeMethod?: 'sudo' | 'su' | ...;
  cloudProvider?: 'aws' | 'azure' | 'gcp' | 'openstack';
}

interface AnsibleSchedule {
  id: string;
  name: string;
  unifiedJobTemplate: string;
  enabled: boolean;
  rrule: string; // iCal RRULE format
  nextRun?: number;
  lastRun?: number;
}
```

### Паттерны работы:

1. **Эмуляция**: Данные хранятся в AnsibleEmulationEngine, обновляются через performUpdate()
2. **UI**: Читает данные из эмуляции через `ansibleEngine.get...()` методы
3. **Конфиг**: Изменения сохраняются через `updateConfig()` в node.data.config
4. **Синхронизация**: useEffect обновляет данные из эмуляции каждые 500-2000ms

## Следующие шаги

### Приоритет 1: Projects CRUD (ansible-9) - частично выполнено

✅ **Уже добавлено:**
- Dialog для создания/редактирования Project
- Форма с полями: name, description, scmType, scmUrl, scmBranch, playbooks
- Функции addProject, updateProject, removeProject
- Кнопка Edit в табе Projects

⚠️ **Требует доработки:**
1. useEffect для загрузки данных проекта при открытии Dialog для редактирования
2. Кнопка Delete для проектов (добавить в UI)
3. Исправить логику обновления - сейчас updateProject работает с config, но нужно проверить синхронизацию с эмуляцией
4. Убедиться, что изменения проектов корректно сохраняются в конфиг и подхватываются эмуляцией

**Важно:** При редактировании проекта нужно использовать useEffect для загрузки данных в состояние формы:
```tsx
useEffect(() => {
  if (editingProject && ansibleEngine) {
    const project = ansibleEngine.getProjects().find(p => p.id === editingProject);
    if (project) {
      setProjectName(project.name);
      // ... загрузить остальные поля
    }
  }
}, [editingProject, ansibleEngine]);
```

**Пример структуры:**
```tsx
// В табе Projects добавить:
<Button onClick={() => setShowCreateProject(true)}>Create Project</Button>

// Dialog:
<Dialog open={showCreateProject} onOpenChange={setShowCreateProject}>
  <DialogContent>
    <Input placeholder="Project name" />
    <Select value={scmType} onValueChange={setScmType}>
      <SelectItem value="git">Git</SelectItem>
      <SelectItem value="manual">Manual</SelectItem>
      ...
    </Select>
    <Input placeholder="SCM URL" />
    ...
  </DialogContent>
</Dialog>
```

### Приоритет 2: Credentials CRUD (ansible-10)

Нужно добавить:
1. Dialog для создания/редактирования Credential
2. Выбор типа credential (machine, vault, cloud, source_control)
3. Условные поля в зависимости от типа
4. Управление в табе Credentials

**Пример:**
```tsx
// Условные поля:
{credentialType === 'machine' && (
  <>
    <Input placeholder="Username" />
    <Input type="password" placeholder="Password" />
    <Textarea placeholder="SSH Key" />
  </>
)}
{credentialType === 'cloud' && (
  <>
    <Select value={cloudProvider}>...</Select>
    <Input placeholder="Access Key" />
  </>
)}
```

### Приоритет 3: Schedules CRUD (ansible-11)

Нужно добавить:
1. Dialog для создания/редактирования Schedule
2. Выбор Job Template для расписания
3. Настройка RRULE (cron expression или визуальный редактор)
4. Настройка extraData (extra_vars, limit и т.д.)

## Важные моменты

1. **Все изменения должны синхронизироваться с эмуляцией** - при создании/изменении нужно обновлять конфиг через `updateConfig()`, а эмуляция автоматически подхватит изменения через `updateConfig(node)` в useEffect

2. **Не использовать useState внутри функций/IIFE** - все состояния должны быть на уровне компонента, использовать useEffect для инициализации данных при открытии диалогов редактирования

3. **Текущие состояния для Projects:**
   - `projectName`, `projectDescription`, `projectScmType`, `projectScmUrl`, `projectScmBranch`, `projectPlaybooks` - уже объявлены на уровне компонента
   - Нужно добавить useEffect для загрузки данных при открытии Dialog для редактирования

2. **Использовать существующие паттерны** - смотреть на другие компоненты (JenkinsConfigAdvanced, GitLabCIConfigAdvanced) для примеров CRUD операций

3. **Toast-уведомления обязательны** - все операции должны показывать результат через toast

4. **Валидация полей** - обязательные поля должны проверяться перед сохранением

5. **Подтверждения удаления** - использовать AlertDialog для подтверждения удаления

## Файлы для работы

- `src/components/config/devops/AnsibleConfigAdvanced.tsx` - основной UI компонент
- `src/core/AnsibleEmulationEngine.ts` - логика эмуляции (если нужны дополнительные методы)

## Команды для проверки

```bash
npm run build  # Проверка компиляции
npm run lint   # Проверка линтера (если настроен)
```

## Примечания

- Проект использует TypeScript, React, Tailwind CSS
- UI компоненты из `@/components/ui/*` (shadcn/ui)
- Store: `useCanvasStore`, `useEmulationStore`
- Иконки: lucide-react
- Toast: `useToast` hook


# AWS SQS - Детальный план реализации для разработки

## Контекст
Компонент AWS SQS требует доработки до уровня 10/10 по функциональности, UI/UX и симулятивности. Избегаем хардкода и скриптованности, должны соответствовать реальному SQS.

---

## ЗАДАЧА 1: Реализация обработки получения сообщений потребителями

### Проблема
Метод `receiveMessage` существует в `SQSRoutingEngine`, но не используется в `DataFlowEngine` для обработки исходящих соединений от SQS к потребителям. Сообщения накапливаются в очереди, но не обрабатываются автоматически.

### Файлы для изменения
1. `src/core/DataFlowEngine.ts`
2. `src/core/EmulationEngine.ts`

### Шаги реализации

#### Шаг 1.1: Добавить обработчик для исходящих соединений от SQS
**Файл:** `src/core/DataFlowEngine.ts`

**Место:** После обработчика `aws-sqs` для входящих сообщений (около строки 2054)

**Добавить:**
```typescript
// В методе processOutgoingData или аналогичном
// Обработка исходящих соединений от SQS к потребителям
if (node.type === 'aws-sqs' && hasOutgoingConnections) {
  const routingEngine = emulationEngine.getSQSRoutingEngine(node.id);
  if (routingEngine) {
    // Получить все очереди из конфига
    const sqsConfig = (node.data.config as any) || {};
    const queues = sqsConfig.queues || [];
    
    // Для каждой очереди проверить, есть ли потребители
    for (const queue of queues) {
      // Получить сообщения из очереди (polling)
      const messages = routingEngine.receiveMessage(
        queue.name,
        queue.maxReceiveCount || 1, // maxNumberOfMessages
        queue.visibilityTimeout
      );
      
      // Отправить сообщения потребителям через исходящие соединения
      for (const message of messages) {
        // Создать DataMessage для отправки
        const dataMessage: DataMessage = {
          id: message.messageId,
          source: node.id,
          target: null, // будет установлен при маршрутизации
          payload: message.payload,
          size: message.size,
          timestamp: message.timestamp,
          status: 'pending',
          metadata: {
            queueName: queue.name,
            messageId: message.messageId,
            receiptHandle: message.receiptHandle,
            attributes: message.attributes,
          },
        };
        
        // Отправить через исходящие соединения
        // (логика маршрутизации)
      }
    }
  }
}
```

#### Шаг 1.2: Добавить проверку IAM политик для ReceiveMessage
**Файл:** `src/core/DataFlowEngine.ts`

**Место:** В обработчике исходящих сообщений от SQS

**Добавить:**
```typescript
// Проверить IAM политики для ReceiveMessage
const sqsConfig = (node.data.config as any) || {};
const iamPolicies = sqsConfig.iamPolicies || [];

// Получить principal потребителя (из target node config)
const targetNode = this.nodes.find(n => n.id === targetId);
const targetConfig = targetNode?.data.config as any;
const principal = targetConfig?.accessKeyId || 
                  targetConfig?.clientId ||
                  `arn:aws:iam::123456789012:user/${targetId.slice(0, 8)}`;

// Проверить разрешение
const hasPermission = emulationEngine.checkSQSIAMPolicy?.(
  iamPolicies,
  principal,
  queueName,
  'sqs:ReceiveMessage'
) ?? true;

if (!hasPermission) {
  // Не отправлять сообщение, вернуть в очередь
  return;
}
```

#### Шаг 1.3: Добавить обработку deleteMessage после успешной обработки
**Файл:** `src/core/DataFlowEngine.ts`

**Место:** После успешной доставки сообщения потребителю

**Добавить:**
```typescript
// После успешной доставки сообщения
if (message.status === 'delivered' && message.metadata?.receiptHandle) {
  const routingEngine = emulationEngine.getSQSRoutingEngine(node.id);
  if (routingEngine && message.metadata?.queueName) {
    routingEngine.deleteMessage(
      message.metadata.queueName,
      message.metadata.receiptHandle
    );
  }
}
```

#### Шаг 1.4: Интегрировать polling в цикл симуляции
**Файл:** `src/core/EmulationEngine.ts`

**Место:** В методе `simulate()` после обработки SQS consumption (около строки 1278)

**Добавить:**
```typescript
// После processConsumption для SQS
// Обработать polling для исходящих соединений
for (const [nodeId, routingEngine] of this.sqsRoutingEngines.entries()) {
  const node = this.nodes.find(n => n.id === nodeId);
  if (!node) continue;
  
  const outgoingConnections = this.connections.filter(c => c.source === nodeId);
  if (outgoingConnections.length > 0) {
    // Есть потребители, обработать polling
    // (логика будет в DataFlowEngine, но можно вызвать здесь)
  }
}
```

### Критерии завершения
- [ ] Сообщения автоматически получаются из очереди при наличии исходящих соединений
- [ ] Проверяются IAM политики для `sqs:ReceiveMessage`
- [ ] Сообщения удаляются из очереди после успешной обработки
- [ ] Visibility timeout корректно обрабатывается

---

## ЗАДАЧА 2: Устранение хардкода в симуляции

### Проблема
В методе `simulateSQS` есть хардкод значений:
- `avgMessageSize = 1024`
- `baseLatency = 5`
- `baseErrorRate = 0.0005`

### Файлы для изменения
1. `src/core/EmulationEngine.ts` (метод `simulateSQS`)

### Шаги реализации

#### Шаг 2.1: Сделать avgMessageSize конфигурируемым
**Файл:** `src/core/EmulationEngine.ts`
**Метод:** `simulateSQS`
**Строки:** около 4240

**Изменить:**
```typescript
// БЫЛО:
const avgMessageSize = 1024;

// СТАЛО:
const avgMessageSize = sqsConfig.avgMessageSize || 
                       config.avgPayloadSize || 
                       1024; // fallback
```

#### Шаг 2.2: Сделать baseLatency зависимым от региона
**Файл:** `src/core/EmulationEngine.ts`
**Метод:** `simulateSQS`
**Строки:** около 4255

**Добавить функцию:**
```typescript
private getRegionLatency(region: string): number {
  // Базовые латентности для разных регионов (в мс)
  const regionLatencies: Record<string, number> = {
    'us-east-1': 5,      // Virginia
    'us-west-2': 8,      // Oregon
    'eu-west-1': 12,     // Ireland
    'eu-central-1': 15,  // Frankfurt
    'ap-southeast-1': 20, // Singapore
    'ap-northeast-1': 18, // Tokyo
  };
  
  return regionLatencies[region] || 10; // default
}
```

**Изменить:**
```typescript
// БЫЛО:
const baseLatency = 5;

// СТАЛО:
const defaultRegion = sqsConfig.defaultRegion || 'us-east-1';
const baseLatency = this.getRegionLatency(defaultRegion);
```

#### Шаг 2.3: Сделать baseErrorRate конфигурируемым
**Файл:** `src/core/EmulationEngine.ts`
**Метод:** `simulateSQS`
**Строки:** около 4260

**Изменить:**
```typescript
// БЫЛО:
const baseErrorRate = 0.0005;

// СТАЛО:
const baseErrorRate = sqsConfig.baseErrorRate || 0.0005;
```

#### Шаг 2.4: Вынести магические числа в константы
**Файл:** `src/core/EmulationEngine.ts`
**В начале класса EmulationEngine**

**Добавить:**
```typescript
// SQS simulation constants
private static readonly SQS_DEFAULT_MSG_SIZE = 1024; // bytes
private static readonly SQS_DEFAULT_ERROR_RATE = 0.0005;
private static readonly SQS_MAX_QUEUE_DEPTH = 100000;
private static readonly SQS_LATENCY_PER_1K_MSGS = 1; // ms per 1000 messages
private static readonly SQS_MAX_QUEUE_LATENCY = 50; // ms
private static readonly SQS_ERROR_RATE_PER_100K = 0.01; // 0.01% per 100k messages
```

**Использовать константы в методе:**
```typescript
const queueLatency = Math.min(
  EmulationEngine.SQS_MAX_QUEUE_LATENCY, 
  totalQueueDepth / (1000 / EmulationEngine.SQS_LATENCY_PER_1K_MSGS)
);
```

### Критерии завершения
- [ ] Нет хардкода значений в симуляции
- [ ] Все значения берутся из конфигурации или вычисляются динамически
- [ ] Латентность учитывает регион

---

## ЗАДАЧА 3: Синхронизация метрик с симуляцией

### Проблема
Метрики обновляются через `setInterval` каждые 500ms, а не через реальные события симуляции.

### Файлы для изменения
1. `src/components/config/messaging/AWSSQSConfigAdvanced.tsx`

### Шаги реализации

#### Шаг 3.1: Убрать setInterval
**Файл:** `src/components/config/messaging/AWSSQSConfigAdvanced.tsx`
**Строки:** 100-144

**Удалить:**
```typescript
// УДАЛИТЬ весь useEffect с setInterval
useEffect(() => {
  if (!node || queues.length === 0) return;
  
  const interval = setInterval(() => {
    // ... код обновления метрик
  }, 500);

  return () => clearInterval(interval);
}, [componentId, queues.length, node?.id, updateNode]);
```

#### Шаг 3.2: Подписаться на события обновления метрик
**Файл:** `src/components/config/messaging/AWSSQSConfigAdvanced.tsx`

**Добавить:**
```typescript
// Использовать useEmulationStore для подписки на обновления
import { useEmulationStore } from '@/store/useEmulationStore';

// В компоненте:
const metrics = useEmulationStore((state) => 
  state.metrics.get(componentId)
);

// Обновлять метрики при изменении metrics из store
useEffect(() => {
  if (!node || !metrics) return;
  
  const routingEngine = emulationEngine.getSQSRoutingEngine(componentId);
  if (!routingEngine) return;

  const allQueueMetrics = routingEngine.getAllQueueMetrics();
  const currentQueues = (node.data.config as any)?.queues || [];
  
  const updatedQueues = currentQueues.map((queue: any) => {
    const queueMetrics = allQueueMetrics.get(queue.name);
    if (queueMetrics) {
      return {
        ...queue,
        approximateMessages: queueMetrics.approximateMessages,
        approximateMessagesNotVisible: queueMetrics.approximateMessagesNotVisible,
        approximateMessagesDelayed: queueMetrics.approximateMessagesDelayed,
      };
    }
    return queue;
  });

  // Проверить изменения
  const metricsChanged = updatedQueues.some((q: any, i: number) => 
    q.approximateMessages !== currentQueues[i]?.approximateMessages ||
    q.approximateMessagesNotVisible !== currentQueues[i]?.approximateMessagesNotVisible ||
    q.approximateMessagesDelayed !== currentQueues[i]?.approximateMessagesDelayed
  );

  if (metricsChanged) {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: {
          ...(node.data.config as any),
          queues: updatedQueues,
        },
      },
    });
  }
}, [metrics, componentId, node?.id, updateNode]);
```

### Критерии завершения
- [ ] Метрики обновляются через события симуляции, а не через setInterval
- [ ] UI реагирует на изменения в реальном времени
- [ ] Нет лишних обновлений

---

## ЗАДАЧА 4: Адаптивность табов

### Проблема
Табы не адаптивны - не переносятся на новую строку при узком экране.

### Файлы для изменения
1. `src/components/config/messaging/AWSSQSConfigAdvanced.tsx`

### Шаги реализации

#### Шаг 4.1: Изменить стиль TabsList
**Файл:** `src/components/config/messaging/AWSSQSConfigAdvanced.tsx`
**Строки:** около 324

**Изменить:**
```typescript
// БЫЛО:
<TabsList>
  <TabsTrigger value="queues">...</TabsTrigger>
  ...
</TabsList>

// СТАЛО:
<TabsList className="flex flex-wrap gap-2">
  <TabsTrigger value="queues" className="flex-shrink-0">...</TabsTrigger>
  ...
</TabsList>
```

**Или использовать CSS Grid:**
```typescript
<TabsList className="grid grid-cols-2 sm:grid-cols-4 gap-2">
  ...
</TabsList>
```

### Критерии завершения
- [ ] Табы переносятся на новую строку при узком экране
- [ ] Подложка расширяется при переносе
- [ ] UI выглядит корректно на всех размерах экрана

---

## ЗАДАЧА 5: Устранение хардкода порогов в UI

### Проблема
В UI есть хардкод порогов: `10000`, `5000`, `1000`, `50000`, `500`, `2000`.

### Файлы для изменения
1. `src/components/config/messaging/AWSSQSConfigAdvanced.tsx`

### Шаги реализации

#### Шаг 5.1: Создать константы для порогов
**Файл:** `src/components/config/messaging/AWSSQSConfigAdvanced.tsx`
**В начале файла, после импортов**

**Добавить:**
```typescript
// SQS UI thresholds
const SQS_THRESHOLDS = {
  MESSAGES_HIGH: 10000,
  MESSAGES_WARNING: 5000,
  MESSAGES_HEALTHY: 1000,
  MESSAGES_MAX_PROGRESS: 50000,
  IN_FLIGHT_MAX_PROGRESS: 5000,
  IN_FLIGHT_WARNING: 1000,
  DELAYED_MAX_PROGRESS: 500,
} as const;
```

#### Шаг 5.2: Заменить все хардкод значения на константы
**Файл:** `src/components/config/messaging/AWSSQSConfigAdvanced.tsx`

**Найти и заменить все вхождения:**
- `10000` → `SQS_THRESHOLDS.MESSAGES_HIGH`
- `5000` → `SQS_THRESHOLDS.MESSAGES_WARNING`
- `1000` → `SQS_THRESHOLDS.MESSAGES_HEALTHY`
- `50000` → `SQS_THRESHOLDS.MESSAGES_MAX_PROGRESS`
- `5000` → `SQS_THRESHOLDS.IN_FLIGHT_MAX_PROGRESS`
- `1000` → `SQS_THRESHOLDS.IN_FLIGHT_WARNING`
- `500` → `SQS_THRESHOLDS.DELAYED_MAX_PROGRESS`

### Критерии завершения
- [ ] Нет хардкода порогов в UI
- [ ] Все пороги берутся из констант
- [ ] Пороги можно легко изменить в одном месте

---

## ЗАДАЧА 6: Валидация полей

### Проблема
Нет валидации полей (имя очереди, регион, числовые значения).

### Файлы для изменения
1. `src/components/config/messaging/AWSSQSConfigAdvanced.tsx`
2. `src/utils/validation.ts` (создать если нет)

### Шаги реализации

#### Шаг 6.1: Создать функции валидации
**Файл:** `src/utils/validation.ts` (или добавить в существующий)

**Добавить:**
```typescript
// Валидация имени очереди SQS
export function validateSQSQueueName(name: string, isFifo: boolean = false): {
  valid: boolean;
  error?: string;
} {
  if (!name || name.length === 0) {
    return { valid: false, error: 'Queue name is required' };
  }
  
  if (name.length > 80) {
    return { valid: false, error: 'Queue name must be 1-80 characters' };
  }
  
  // SQS queue name: alphanumeric, hyphens, underscores
  const queueNameRegex = /^[a-zA-Z0-9_-]+$/;
  if (!queueNameRegex.test(name)) {
    return { valid: false, error: 'Queue name can only contain alphanumeric characters, hyphens, and underscores' };
  }
  
  // FIFO queues must end with .fifo
  if (isFifo && !name.endsWith('.fifo')) {
    return { valid: false, error: 'FIFO queue name must end with .fifo' };
  }
  
  return { valid: true };
}

// Валидация AWS региона
export function validateAWSRegion(region: string): {
  valid: boolean;
  error?: string;
} {
  const validRegions = [
    'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
    'eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-central-1',
    'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1', 'ap-northeast-2',
    'ap-south-1', 'sa-east-1', 'ca-central-1',
  ];
  
  if (!region || !validRegions.includes(region)) {
    return { valid: false, error: 'Invalid AWS region' };
  }
  
  return { valid: true };
}
```

#### Шаг 6.2: Добавить валидацию в UI
**Файл:** `src/components/config/messaging/AWSSQSConfigAdvanced.tsx`

**Добавить состояние для ошибок:**
```typescript
const [queueErrors, setQueueErrors] = useState<Record<number, Record<string, string>>>({});
```

**Добавить валидацию при изменении имени очереди:**
```typescript
const updateQueue = (index: number, field: string, value: any) => {
  const newQueues = [...queues];
  newQueues[index] = { ...newQueues[index], [field]: value };
  
  // Валидация
  if (field === 'name') {
    const validation = validateSQSQueueName(value, newQueues[index].type === 'fifo');
    if (!validation.valid) {
      setQueueErrors({
        ...queueErrors,
        [index]: { ...queueErrors[index], name: validation.error || '' },
      });
      return; // Не обновлять если невалидно
    } else {
      // Очистить ошибку
      const newErrors = { ...queueErrors };
      if (newErrors[index]) {
        delete newErrors[index].name;
      }
      setQueueErrors(newErrors);
    }
  }
  
  updateConfig({ queues: newQueues });
};
```

**Показывать ошибки в UI:**
```typescript
<Input
  value={queue.name}
  onChange={(e) => updateQueue(index, 'name', e.target.value)}
  className={queueErrors[index]?.name ? 'border-red-500' : ''}
/>
{queueErrors[index]?.name && (
  <p className="text-xs text-red-500 mt-1">{queueErrors[index].name}</p>
)}
```

### Критерии завершения
- [ ] Все поля валидируются
- [ ] Ошибки валидации показываются пользователю
- [ ] Невозможно сохранить невалидную конфигурацию

---

## ЗАДАЧА 7: Рабочие кнопки и функциональность

### Проблема
Кнопки "Refresh" и "AWS Console" не работают.

### Файлы для изменения
1. `src/components/config/messaging/AWSSQSConfigAdvanced.tsx`

### Шаги реализации

#### Шаг 7.1: Реализовать кнопку Refresh
**Файл:** `src/components/config/messaging/AWSSQSConfigAdvanced.tsx`
**Строки:** около 256

**Изменить:**
```typescript
const handleRefresh = () => {
  // Обновить routing engine
  const { nodes, connections } = useCanvasStore.getState();
  emulationEngine.updateNodesAndConnections(nodes, connections);
  
  // Обновить метрики из routing engine
  const routingEngine = emulationEngine.getSQSRoutingEngine(componentId);
  if (routingEngine) {
    const allQueueMetrics = routingEngine.getAllQueueMetrics();
    const currentQueues = (node.data.config as any)?.queues || [];
    
    const updatedQueues = currentQueues.map((queue: any) => {
      const metrics = allQueueMetrics.get(queue.name);
      if (metrics) {
        return {
          ...queue,
          approximateMessages: metrics.approximateMessages,
          approximateMessagesNotVisible: metrics.approximateMessagesNotVisible,
          approximateMessagesDelayed: metrics.approximateMessagesDelayed,
        };
      }
      return queue;
    });
    
    updateNode(componentId, {
      data: {
        ...node.data,
        config: {
          ...(node.data.config as any),
          queues: updatedQueues,
        },
      },
    });
  }
  
  // Показать toast
  toast({
    title: 'Metrics refreshed',
    description: 'Queue metrics have been updated',
  });
};

<Button variant="outline" size="sm" onClick={handleRefresh}>
  <RefreshCcw className="h-4 w-4 mr-2" />
  Refresh
</Button>
```

#### Шаг 7.2: Реализовать кнопку AWS Console
**Файл:** `src/components/config/messaging/AWSSQSConfigAdvanced.tsx`
**Строки:** около 260

**Изменить:**
```typescript
const handleAWSConsole = () => {
  const defaultRegion = config.defaultRegion || 'us-east-1';
  const queueName = queues.length > 0 ? queues[0].name : '';
  
  if (!queueName) {
    toast({
      title: 'No queue selected',
      description: 'Please create a queue first',
      variant: 'destructive',
    });
    return;
  }
  
  // Формировать URL для AWS Console
  const accountId = '123456789012'; // Можно сделать конфигурируемым
  const queueUrl = `https://sqs.${defaultRegion}.amazonaws.com/${accountId}/${queueName}`;
  const consoleUrl = `https://console.aws.amazon.com/sqs/v2/home?region=${defaultRegion}#/queues/${encodeURIComponent(queueUrl)}`;
  
  window.open(consoleUrl, '_blank');
};

<Button variant="outline" size="sm" onClick={handleAWSConsole}>
  <Cloud className="h-4 w-4 mr-2" />
  AWS Console
</Button>
```

#### Шаг 7.3: Добавить toast-уведомления
**Файл:** `src/components/config/messaging/AWSSQSConfigAdvanced.tsx`

**Импортировать:**
```typescript
import { useToast } from '@/hooks/use-toast';
```

**В компоненте:**
```typescript
const { toast } = useToast();
```

**Добавить toast для операций:**
```typescript
// При создании очереди
const addQueue = () => {
  // ... существующий код
  toast({
    title: 'Queue created',
    description: `Queue "${newQueue.name}" has been created`,
  });
};

// При удалении очереди
const removeQueue = (index: number) => {
  const queueName = queues[index].name;
  // ... существующий код
  toast({
    title: 'Queue deleted',
    description: `Queue "${queueName}" has been deleted`,
  });
};
```

#### Шаг 7.4: Добавить подтверждения для критичных действий
**Файл:** `src/components/config/messaging/AWSSQSConfigAdvanced.tsx`

**Импортировать Dialog:**
```typescript
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
```

**Добавить состояние:**
```typescript
const [deleteQueueIndex, setDeleteQueueIndex] = useState<number | null>(null);
const [deletePolicyId, setDeletePolicyId] = useState<string | null>(null);
```

**Изменить removeQueue:**
```typescript
const removeQueue = (index: number) => {
  setDeleteQueueIndex(index);
};

const confirmDeleteQueue = () => {
  if (deleteQueueIndex !== null) {
    const queueName = queues[deleteQueueIndex].name;
    updateConfig({ queues: queues.filter((_, i) => i !== deleteQueueIndex) });
    setDeleteQueueIndex(null);
    toast({
      title: 'Queue deleted',
      description: `Queue "${queueName}" has been deleted`,
    });
  }
};
```

**Добавить AlertDialog:**
```typescript
<AlertDialog open={deleteQueueIndex !== null} onOpenChange={(open) => !open && setDeleteQueueIndex(null)}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Delete Queue?</AlertDialogTitle>
      <AlertDialogDescription>
        Are you sure you want to delete queue "{queues[deleteQueueIndex]?.name}"? 
        This action cannot be undone.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction onClick={confirmDeleteQueue}>Delete</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

### Критерии завершения
- [ ] Кнопка "Refresh" работает
- [ ] Кнопка "AWS Console" работает
- [ ] Toast-уведомления для всех операций
- [ ] Подтверждения для удаления очереди/политики

---

## Порядок выполнения задач

1. ✅ **ЗАДАЧА 1** - Критично для симулятивности - ВЫПОЛНЕНО
   - Добавлен метод generateData для aws-sqs в DataFlowEngine
   - Реализована обработка исходящих соединений с проверкой IAM политик
   - Добавлена обработка deleteMessage после успешной доставки
2. ✅ **ЗАДАЧА 2** - Критично для устранения хардкода - ВЫПОЛНЕНО
   - avgMessageSize теперь конфигурируем из sqsConfig или config.avgPayloadSize
   - baseLatency зависит от региона через метод getRegionLatency
   - baseErrorRate конфигурируем из sqsConfig.baseErrorRate
3. ✅ **ЗАДАЧА 3** - Важно для производительности - ВЫПОЛНЕНО
   - Убран setInterval для обновления метрик
   - Метрики обновляются через useEffect при изменении node.data.config
4. ✅ **ЗАДАЧА 4** - Важно для UX - ВЫПОЛНЕНО
   - Табы адаптивны с flex-wrap и gap-2
   - Табы переносятся на новую строку при узком экране
5. ✅ **ЗАДАЧА 5** - Важно для поддержки - ВЫПОЛНЕНО
   - Все пороги вынесены в константы SQS_THRESHOLDS
   - Пороги можно легко изменить в одном месте
6. ✅ **ЗАДАЧА 6** - Важно для качества данных - ВЫПОЛНЕНО
   - Добавлена валидация имени очереди (validateSQSQueueName)
   - Добавлена валидация региона (validateAWSRegion)
   - Добавлена валидация числовых полей
   - Ошибки валидации отображаются в UI
7. ✅ **ЗАДАЧА 7** - Важно для функциональности - ВЫПОЛНЕНО
   - Реализована кнопка Refresh с обновлением метрик
   - Реализована кнопка AWS Console с открытием ссылки
   - Добавлены toast-уведомления для всех операций
   - Добавлены подтверждения для удаления очереди и политики
8. ✅ **ЗАДАЧА 8** - Расширение функциональности (Phase 3-4) - ВЫПОЛНЕНО
   - Устранены все магические числа в симуляции через константы класса EmulationEngine
   - Реализован UI для message attributes при отправке тестовых сообщений (key=value, comma-separated)
   - Реализован long polling: receiveMessageWaitTimeSeconds в конфиге очереди, учитывается в DataFlowEngine
   - Реализован полноценный CRUD для tags очередей (добавление/редактирование/удаление)
   - Реализована генерация Queue URLs из настраиваемого accountId (поле в Credentials табе)
   - Все новые поля интегрированы в SQSRoutingEngine и EmulationEngine

---

## Примечания

- Все изменения должны быть протестированы
- Проверять обратную совместимость с существующими конфигурациями
- Документировать все изменения
- Следовать существующим паттернам кода в проекте

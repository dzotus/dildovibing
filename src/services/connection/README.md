# Connection System - Умная система автоматического обновления конфигов

## Описание

Система автоматически обновляет конфиги компонентов при создании связей между ними, избегая необходимости вручную настраивать каждый компонент.

## Как это работает

1. **Пользователь создает связь** между двумя компонентами на canvas
2. **ConnectionHandler** находит подходящие правила для этой пары компонентов
3. **Правила обновляют конфиги** обоих компонентов автоматически
4. **ServiceDiscovery** автоматически определяет хосты и порты компонентов

## Примеры

### Envoy → Backend Service
При создании связи Envoy автоматически добавляет cluster в свой конфиг:
```typescript
{
  clusters: [
    {
      name: "rest-api-12345-cluster",
      type: "STRICT_DNS",
      hosts: [{ address: "my-service", port: 8080 }],
      healthChecks: true
    }
  ]
}
```

### API Gateway → REST API
При создании связи API Gateway автоматически создает API endpoint:
```typescript
{
  apis: [
    {
      name: "My API-api",
      path: "/api/rest",
      method: "GET",
      backendUrl: "http://my-service:8080",
      enabled: true
    }
  ]
}
```

### NGINX → Backend
При создании связи NGINX автоматически добавляет upstream:
```typescript
{
  upstreams: [
    {
      name: "rest-upstream",
      servers: [{ host: "my-service", port: 8080 }],
      loadBalancing: "round-robin"
    }
  ]
}
```

## Добавление новых правил

Чтобы добавить правило для нового типа компонента:

1. Создайте файл в `src/services/connection/rules/`
2. Экспортируйте функцию, которая создает правило:

```typescript
import { ConnectionRule } from '../types';
import { ServiceDiscovery } from '../ServiceDiscovery';

export function createMyComponentRule(discovery: ServiceDiscovery): ConnectionRule {
  return {
    sourceType: 'my-component',
    targetTypes: ['target-type-1', 'target-type-2'],
    priority: 10,
    
    updateSourceConfig: (source, target, connection, metadata) => {
      // Логика обновления конфига источника
      return {
        // обновления конфига
      };
    },
    
    extractMetadata: (source, target, connection) => {
      return discovery.getConnectionMetadata(source, target, connection);
    },
  };
}
```

3. Добавьте правило в `src/services/connection/rules/index.ts`:

```typescript
import { createMyComponentRule } from './myComponentRules';

export function initializeConnectionRules(discovery: ServiceDiscovery): ConnectionRule[] {
  return [
    // ... существующие правила
    createMyComponentRule(discovery),
  ];
}
```

## Структура

```
src/services/connection/
├── types.ts                    # Типы и интерфейсы
├── ServiceDiscovery.ts         # Автоматическое разрешение имен/портов
├── ConnectionRuleRegistry.ts   # Реестр правил
├── ConnectionHandler.ts        # Главный обработчик
├── connectionHandlerInstance.ts # Singleton instance
├── index.ts                    # Экспорты
├── rules/                      # Правила для компонентов
│   ├── index.ts
│   ├── envoyRules.ts
│   ├── apiGatewayRules.ts
│   ├── serviceMeshRules.ts
│   ├── loadBalancerRules.ts
│   ├── databaseRules.ts
│   └── messagingRules.ts
└── README.md                   # Эта документация
```

## Поддерживаемые компоненты

### Infrastructure & Proxy
- ✅ Envoy Proxy
- ✅ NGINX
- ✅ HAProxy
- ✅ Traefik

### Edge & Gateway
- ✅ API Gateway
- ✅ Service Mesh
- ✅ Istio

### Database & Messaging
- ✅ Database Clients → Databases
- ✅ Messaging Producers → Message Queues

## Расширение

Система легко расширяется добавлением новых правил. Каждое правило:
- Декларативно описывает поведение
- Изолировано от других правил
- Легко тестируется
- Не требует изменения основного кода

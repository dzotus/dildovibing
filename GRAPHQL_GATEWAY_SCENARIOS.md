# GraphQL Gateway — Сценарии использования (Presets)

Этот документ описывает готовые пресеты конфигурации GraphQL Gateway для различных реальных сценариев использования. Каждый пресет можно использовать как шаблон для быстрого воспроизведения типичных конфигураций gateway.

---

## 1. Single-Service Monolith

**Описание**: Простой gateway для одного GraphQL сервиса без федерации, базовые лимиты, минимальный кэш.

**Использование**: Малые и средние приложения с одним GraphQL бэкендом.

```json
{
  "services": [
    {
      "id": "svc-1",
      "name": "main-service",
      "endpoint": "http://localhost:4000/graphql",
      "status": "connected"
    }
  ],
  "federation": {
    "enabled": false,
    "services": []
  },
  "endpoint": "/graphql",
  "enableIntrospection": true,
  "enableQueryComplexityAnalysis": true,
  "enableRateLimiting": false,
  "maxQueryDepth": 15,
  "maxQueryComplexity": 1000,
  "cacheTtl": 60,
  "persistQueries": false,
  "variability": {
    "latencyJitterMultiplier": 0.5,
    "baseRandomErrorRate": 0.001,
    "federationOverheadMs": 0
  }
}
```

---

## 2. Multi-Service без федерации

**Описание**: Gateway для нескольких независимых GraphQL сервисов без федерации, умеренные лимиты.

**Использование**: Микросервисная архитектура с несколькими GraphQL бэкендами, но без необходимости объединения схем.

```json
{
  "services": [
    {
      "id": "svc-1",
      "name": "user-service",
      "endpoint": "http://localhost:4001/graphql",
      "status": "connected"
    },
    {
      "id": "svc-2",
      "name": "product-service",
      "endpoint": "http://localhost:4002/graphql",
      "status": "connected"
    },
    {
      "id": "svc-3",
      "name": "order-service",
      "endpoint": "http://localhost:4003/graphql",
      "status": "connected"
    }
  ],
  "federation": {
    "enabled": false,
    "services": []
  },
  "endpoint": "/graphql",
  "enableIntrospection": true,
  "enableQueryComplexityAnalysis": true,
  "enableRateLimiting": true,
  "globalRateLimitPerMinute": 200,
  "maxQueryDepth": 15,
  "maxQueryComplexity": 1000,
  "cacheTtl": 120,
  "persistQueries": true,
  "variability": {
    "latencyJitterMultiplier": 1.0,
    "baseRandomErrorRate": 0.002,
    "federationOverheadMs": 0
  }
}
```

---

## 3. Federated v1

**Описание**: Gateway с GraphQL Federation v1, несколько federated сервисов, базовые настройки.

**Использование**: Микросервисная архитектура с необходимостью объединения схем через Federation v1.

```json
{
  "services": [
    {
      "id": "svc-1",
      "name": "accounts-service",
      "endpoint": "http://localhost:4001/graphql",
      "status": "connected"
    },
    {
      "id": "svc-2",
      "name": "reviews-service",
      "endpoint": "http://localhost:4002/graphql",
      "status": "connected"
    },
    {
      "id": "svc-3",
      "name": "products-service",
      "endpoint": "http://localhost:4003/graphql",
      "status": "connected"
    }
  ],
  "federation": {
    "enabled": true,
    "version": "1",
    "services": ["accounts-service", "reviews-service", "products-service"],
    "compositionStatus": "ok"
  },
  "endpoint": "/graphql",
  "enableIntrospection": true,
  "enableQueryComplexityAnalysis": true,
  "enableRateLimiting": true,
  "globalRateLimitPerMinute": 300,
  "maxQueryDepth": 20,
  "maxQueryComplexity": 1500,
  "cacheTtl": 180,
  "persistQueries": true,
  "variability": {
    "latencyJitterMultiplier": 1.2,
    "baseRandomErrorRate": 0.003,
    "federationOverheadMs": 4
  }
}
```

---

## 4. Federated v2

**Описание**: Gateway с GraphQL Federation v2, оптимизированные настройки для меньшего overhead.

**Использование**: Современная микросервисная архитектура с Federation v2 для лучшей производительности.

```json
{
  "services": [
    {
      "id": "svc-1",
      "name": "accounts-service",
      "endpoint": "http://localhost:4001/graphql",
      "status": "connected"
    },
    {
      "id": "svc-2",
      "name": "reviews-service",
      "endpoint": "http://localhost:4002/graphql",
      "status": "connected"
    },
    {
      "id": "svc-3",
      "name": "products-service",
      "endpoint": "http://localhost:4003/graphql",
      "status": "connected"
    },
    {
      "id": "svc-4",
      "name": "inventory-service",
      "endpoint": "http://localhost:4004/graphql",
      "status": "connected"
    }
  ],
  "federation": {
    "enabled": true,
    "version": "2",
    "services": ["accounts-service", "reviews-service", "products-service", "inventory-service"],
    "compositionStatus": "ok"
  },
  "endpoint": "/graphql",
  "enableIntrospection": true,
  "enableQueryComplexityAnalysis": true,
  "enableRateLimiting": true,
  "globalRateLimitPerMinute": 500,
  "maxQueryDepth": 20,
  "maxQueryComplexity": 2000,
  "cacheTtl": 300,
  "persistQueries": true,
  "variability": {
    "latencyJitterMultiplier": 1.0,
    "baseRandomErrorRate": 0.002,
    "federationOverheadMs": 2
  }
}
```

---

## 5. High-Load API

**Описание**: Gateway для высоконагруженного API с жёсткими лимитами complexity, агрессивным кэшем и строгим rate limiting.

**Использование**: Публичные API с высоким трафиком, требующие защиты от злоупотреблений и оптимизации производительности.

```json
{
  "services": [
    {
      "id": "svc-1",
      "name": "api-service",
      "endpoint": "http://api.example.com/graphql",
      "status": "connected"
    }
  ],
  "federation": {
    "enabled": false,
    "services": []
  },
  "endpoint": "/graphql",
  "enableIntrospection": false,
  "enableQueryComplexityAnalysis": true,
  "enableRateLimiting": true,
  "globalRateLimitPerMinute": 1000,
  "maxQueryDepth": 10,
  "maxQueryComplexity": 500,
  "cacheTtl": 600,
  "persistQueries": true,
  "variability": {
    "latencyJitterMultiplier": 0.3,
    "baseRandomErrorRate": 0.0005,
    "federationOverheadMs": 0
  }
}
```

---

## 6. Development/Staging

**Описание**: Мягкие настройки для разработки и тестирования, включена интроспекция, высокие лимиты.

**Использование**: Локальная разработка и staging окружения.

```json
{
  "services": [
    {
      "id": "svc-1",
      "name": "dev-service",
      "endpoint": "http://localhost:4000/graphql",
      "status": "connected"
    }
  ],
  "federation": {
    "enabled": false,
    "services": []
  },
  "endpoint": "/graphql",
  "enableIntrospection": true,
  "enableQueryComplexityAnalysis": false,
  "enableRateLimiting": false,
  "maxQueryDepth": 50,
  "maxQueryComplexity": 5000,
  "cacheTtl": 0,
  "persistQueries": false,
  "variability": {
    "latencyJitterMultiplier": 2.0,
    "baseRandomErrorRate": 0.01,
    "federationOverheadMs": 0
  }
}
```

---

## Применение пресетов

1. Скопируйте JSON конфигурацию нужного пресета.
2. В UI GraphQL Gateway (`GraphQLGatewayConfigAdvanced`) вручную заполните поля конфигурации или используйте импорт конфигурации (если реализован).
3. Настройте `services` под ваши реальные GraphQL бэкенды (endpoints, имена).
4. При необходимости скорректируйте лимиты и настройки кэша под ваши требования.

---

## Рекомендации по выбору пресета

- **Single-Service Monolith**: Для простых приложений с одним бэкендом.
- **Multi-Service без федерации**: Для микросервисов без необходимости объединения схем.
- **Federated v1**: Для legacy систем или когда требуется совместимость с Apollo Federation v1.
- **Federated v2**: Для новых проектов с современной архитектурой (рекомендуется).
- **High-Load API**: Для публичных API с высоким трафиком и требованиями безопасности.
- **Development/Staging**: Для разработки и тестирования (не использовать в production).

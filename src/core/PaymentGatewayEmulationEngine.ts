import { CanvasNode } from '@/types';

/**
 * Payment Transaction Status
 */
export type TransactionStatus = 'succeeded' | 'pending' | 'failed' | 'refunded' | 'cancelled' | 'processing';

/**
 * Payment Method Type
 */
export type PaymentMethodType = 'card' | 'bank_transfer' | 'paypal' | 'apple_pay' | 'google_pay' | 'ach' | 'cryptocurrency';

/**
 * Payment Transaction
 */
export interface PaymentTransaction {
  id: string;
  amount: number;
  currency: string;
  status: TransactionStatus;
  paymentMethod: PaymentMethodType;
  customerId?: string;
  timestamp: number;
  description?: string;
  fee?: number;
  refundedAmount?: number;
  metadata?: Record<string, any>;
}

/**
 * Webhook Configuration
 */
export interface PaymentWebhook {
  id: string;
  url: string;
  events: string[];
  enabled: boolean;
  secret?: string;
  lastTriggered?: number;
  successCount?: number;
  failureCount?: number;
  // Retry tracking
  pendingRetries?: Map<string, { // transactionId -> retry info
    retryCount: number;
    nextRetryTime: number;
    lastAttemptTime: number;
  }>;
}

/**
 * Payment Gateway Configuration
 */
export interface PaymentGatewayEmulationConfig {
  gatewayType: 'stripe' | 'paypal' | 'square' | 'adyen';
  apiKey?: string;
  secretKey?: string;
  enableCreditCards: boolean;
  enableDebitCards: boolean;
  enableACH: boolean;
  enableCryptocurrency: boolean;
  enable3DSecure: boolean;
  enableFraudDetection: boolean;
  enableRefunds: boolean;
  enableRecurringPayments: boolean;
  supportedCurrencies: string[];
  supportedMethods: PaymentMethodType[];
  webhooks: PaymentWebhook[];
  transactions: PaymentTransaction[];
  requestsPerSecond?: number;
  averageResponseTime?: number;
  errorRate?: number;
  successRate?: number;
  fraudDetectionRate?: number;
  refundRate?: number;
  // Simulation parameters (configurable)
  connectionThroughputMultiplier?: number; // Multiplier for connection count impact on throughput (default: 0.2)
  baseTransactionCount?: number; // Base number of transactions per generation cycle (default: 2)
  highLoadLatencyMultiplier?: Array<{ threshold: number; multiplierMin: number; multiplierMax: number }>; // Latency multipliers at different utilization thresholds
  highLoadErrorRateMultiplier?: Array<{ threshold: number; multiplier: number }>; // Error rate multipliers at different utilization thresholds
  fraudDetectionMultipliers?: { // Multipliers for fraud detection probability
    largeAmount: number; // Multiplier for large amounts (>$500) (default: 2.5)
    newCustomer: number; // Multiplier for new customers (default: 1.8)
    unusualMethod: number; // Multiplier for unusual payment methods (default: 1.5)
    suspiciousIP: number; // Multiplier for suspicious IPs (default: 2.0)
  };
  falsePositiveRate?: number; // Rate of false positive fraud detections (default: 0.075)
  immediateSuccessRate?: { // Immediate success rate (without processing delay)
    with3DSecure: number; // With 3D Secure enabled (default: 0.6)
    without3DSecure: number; // Without 3D Secure (default: 0.7)
  };
  processingTimeMultipliers?: { // Multipliers for processing time
    largeAmount: number; // Multiplier for large amounts (default: 1.3)
    nightWeekend: number; // Multiplier for night/weekend processing (default: 1.3)
  };
  refundChanceMultiplier?: number; // Multiplier for refund chance per update cycle (default: 0.0001)
  refundAmountRange?: { // Range for refund amounts (as fraction of transaction amount)
    min: number; // Minimum refund fraction (default: 0.5)
    max: number; // Maximum refund fraction (default: 1.0)
  };
  // Webhook simulation parameters
  webhookDelay?: { // Delay before sending webhook
    min: number; // Minimum delay in ms (default: 50)
    max: number; // Maximum delay in ms (default: 200)
  };
  webhookRetry?: { // Retry configuration for failed webhooks
    maxRetries: number; // Maximum number of retries (default: 3)
    initialBackoff: number; // Initial backoff delay in ms (default: 100)
    maxBackoff: number; // Maximum backoff delay in ms (default: 5000)
    backoffMultiplier: number; // Exponential backoff multiplier (default: 2.0)
  };
  // Refund pattern parameters
  refundPatterns?: {
    largeAmountMultiplier?: number; // Multiplier for refund chance on large amounts (default: 2.0)
    methodMultipliers?: Record<PaymentMethodType, number>; // Multipliers per payment method (default: paypal: 1.5, others: 1.0)
    holidayMultiplier?: number; // Multiplier for refunds after holidays (default: 1.5)
    holidayDays?: number; // Days after holiday to apply multiplier (default: 7)
  };
}

/**
 * Gateway Profile - характеристики конкретного типа gateway
 */
export interface GatewayProfile {
  latency: number; // средняя latency в ms
  successRate: number; // базовый success rate (0-1)
  feePercentage: number; // процент комиссии (0.029 = 2.9%)
  feeFixed: number; // фиксированная комиссия в долларах
}

/**
 * Payment Method Profile - характеристики конкретного метода оплаты
 */
export interface PaymentMethodProfile {
  latency: number; // средняя latency в ms
  successRate: number; // базовый success rate (0-1)
  processingTimeMin: number; // минимальное время обработки в ms
  processingTimeMax: number; // максимальное время обработки в ms
}

/**
 * Метрики по методу оплаты
 */
export interface PaymentMethodMetrics {
  count: number;
  successCount: number;
  failedCount: number;
  successRate: number;
  avgAmount: number;
  totalAmount: number;
}

/**
 * Payment Gateway Engine Metrics
 */
export interface PaymentGatewayEngineMetrics {
  transactionsTotal: number;
  transactionsSucceeded: number;
  transactionsPending: number;
  transactionsFailed: number;
  transactionsRefunded: number;
  totalAmount: number;
  totalAmountSucceeded: number;
  totalAmountRefunded: number;
  averageAmount: number;
  successRate: number;
  failureRate: number;
  refundRate: number;
  fraudDetected: number;
  requestsPerSecond: number;
  averageResponseTime: number;
  errorRate: number;
  apiUtilization: number;
  processingUtilization: number;
  webhooksTotal: number;
  webhooksEnabled: number;
  webhooksTriggered: number;
  webhooksFailed: number;
  // Conversion funnel metrics
  conversionFunnel: {
    pending: number;
    processing: number;
    succeeded: number;
    failed: number;
    refunded: number;
  };
  chargebackRate: number; // 0-1
  disputeRate: number; // 0-1
  averageProcessingTime: number; // milliseconds
  // Специфичные метрики для Payment Gateway (будут переданы в customMetrics)
  // Не дублируем глобальные метрики (latencyP50, latencyP99 уже есть в ComponentMetrics)
}

/**
 * Payment Gateway Emulation Engine
 * Симулирует работу платежного шлюза: транзакции, обработка платежей, webhooks, метрики
 */
export class PaymentGatewayEmulationEngine {
  private config: PaymentGatewayEmulationConfig | null = null;
  
  // Data stores
  private transactions: Map<string, PaymentTransaction> = new Map();
  private webhooks: Map<string, PaymentWebhook> = new Map();
  
  // Metrics
  private pgMetrics: PaymentGatewayEngineMetrics = {
    transactionsTotal: 0,
    transactionsSucceeded: 0,
    transactionsPending: 0,
    transactionsFailed: 0,
    transactionsRefunded: 0,
    totalAmount: 0,
    totalAmountSucceeded: 0,
    totalAmountRefunded: 0,
    averageAmount: 0,
    successRate: 0,
    failureRate: 0,
    refundRate: 0,
    fraudDetected: 0,
    requestsPerSecond: 0,
    averageResponseTime: 0,
    errorRate: 0,
    apiUtilization: 0,
    processingUtilization: 0,
    webhooksTotal: 0,
    webhooksEnabled: 0,
    webhooksTriggered: 0,
    webhooksFailed: 0,
    conversionFunnel: {
      pending: 0,
      processing: 0,
      succeeded: 0,
      failed: 0,
      refunded: 0,
    },
    chargebackRate: 0,
    disputeRate: 0,
    averageProcessingTime: 0,
  };
  
  // Tracking for processing times
  private processingTimes: number[] = [];
  private readonly MAX_PROCESSING_TIMES = 1000;
  
  // Временные хранилища для метрик (будут переданы в customMetrics)
  private metricsByPaymentMethod: Map<PaymentMethodType, PaymentMethodMetrics> = new Map();
  private metricsByCurrency: Map<string, { count: number; totalAmount: number; avgAmount: number }> = new Map();
  
  // Request history for metrics
  private requestHistory: Array<{ timestamp: number; latency: number; success: boolean }> = [];
  private readonly MAX_REQUEST_HISTORY = 1000;
  
  // Last update time
  private lastUpdateTime: number = Date.now();
  
  // Transaction generation tracking
  private lastTransactionGeneration: number = 0;
  private readonly TRANSACTION_GENERATION_INTERVAL = 2000; // 2 seconds
  
  // Pending transactions (for status progression)
  private pendingTransactions: Set<string> = new Set();
  
  // Customer information cache (for fraud detection improvement)
  private customerInfoCache: Map<string, {
    hasPaymentHistory: boolean;
    isVipCustomer: boolean;
    totalSpent: number;
    lastUpdated: number;
  }> = new Map();
  
  // Transaction limits (from ERP)
  private transactionLimits?: {
    maxTransactionAmount: number;
    dailyLimit: number;
    lastUpdated: number;
  };
  
  // Data flow tracking
  private sentTransactionIds: Set<string> = new Set();
  private statusChangedTransactions: Set<string> = new Set();
  private lastDataSyncTime: number = Date.now();
  
  /**
   * Возвращает профиль характеристик для типа gateway
   */
  private getGatewayProfile(gatewayType: 'stripe' | 'paypal' | 'square' | 'adyen'): GatewayProfile {
    const profiles: Record<string, GatewayProfile> = {
      stripe: {
        latency: 150,
        successRate: 0.97,
        feePercentage: 0.029,
        feeFixed: 0.30,
      },
      paypal: {
        latency: 300,
        successRate: 0.94,
        feePercentage: 0.029,
        feeFixed: 0.30,
      },
      square: {
        latency: 120,
        successRate: 0.96,
        feePercentage: 0.026,
        feeFixed: 0.10,
      },
      adyen: {
        latency: 100,
        successRate: 0.98,
        feePercentage: 0.025,
        feeFixed: 0.20,
      },
    };
    
    return profiles[gatewayType] || profiles.stripe;
  }
  
  /**
   * Генерирует реалистичную сумму транзакции на основе распределения Парето
   * и метода оплаты
   */
  private generateRealisticAmount(method: PaymentMethodType): number {
    // Распределение Парето для сумм транзакций:
    // 70% транзакций: <$50
    // 20% транзакций: $50-200
    // 8% транзакций: $200-500
    // 2% транзакций: >$500
    
    const random = Math.random();
    let amount: number;
    
    if (random < 0.70) {
      // 70%: <$50
      amount = Math.random() * 50;
    } else if (random < 0.90) {
      // 20%: $50-200
      amount = 50 + Math.random() * 150;
    } else if (random < 0.98) {
      // 8%: $200-500
      amount = 200 + Math.random() * 300;
    } else {
      // 2%: >$500
      amount = 500 + Math.random() * 5000; // До $5500
    }
    
    // Корреляция с методом оплаты
    if (method === 'ach') {
      // ACH: обычно крупные (>$100)
      if (amount < 100) {
        amount = 100 + Math.random() * 400; // $100-500
      }
    } else if (method === 'cryptocurrency') {
      // Крипто: переменные, часто крупные
      if (Math.random() < 0.5) {
        // 50% шанс на крупную сумму
        amount = 200 + Math.random() * 3000; // $200-3200
      }
    } else if (method === 'card' || method === 'apple_pay' || method === 'google_pay') {
      // Карты: любые суммы (уже распределены по Парето)
      // Ничего не меняем
    } else if (method === 'bank_transfer') {
      // Банковские переводы: обычно средние-крупные
      if (amount < 50) {
        amount = 50 + Math.random() * 150; // $50-200
      }
    }
    
    // Округляем до 2 знаков после запятой
    return Math.floor(amount * 100) / 100;
  }
  
  /**
   * Возвращает множитель нагрузки на основе времени суток
   */
  private getTimeBasedLoadMultiplier(currentTime: number): number {
    const date = new Date(currentTime);
    const hour = date.getHours();
    const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    
    // Пики: 9-12 и 18-21 (множитель 1.5-2.0)
    const isMorningPeak = hour >= 9 && hour < 12;
    const isEveningPeak = hour >= 18 && hour < 21;
    
    if (isMorningPeak || isEveningPeak) {
      // В пиковые часы: 1.5-2.0
      const baseMultiplier = 1.5;
      const variation = Math.random() * 0.5; // 0-0.5
      return baseMultiplier + variation;
    }
    
    // Норма: 12-18 (множитель 1.0)
    if (hour >= 12 && hour < 18) {
      return 1.0;
    }
    
    // Низкая активность: 21-9 (множитель 0.3-0.5)
    const lowActivityBase = 0.3;
    const lowActivityVariation = Math.random() * 0.2; // 0-0.2
    let multiplier = lowActivityBase + lowActivityVariation;
    
    // Выходные: множитель 0.7
    if (isWeekend) {
      multiplier *= 0.7;
    }
    
    // Случайные всплески (Black Friday, распродажи) с вероятностью 1%
    if (Math.random() < 0.01) {
      multiplier *= 2.5; // Всплеск в 2.5 раза
    }
    
    return multiplier;
  }
  
  /**
   * Возвращает профиль характеристик для метода оплаты
   */
  private getPaymentMethodProfile(method: PaymentMethodType): PaymentMethodProfile {
    const profiles: Record<PaymentMethodType, PaymentMethodProfile> = {
      card: {
        latency: 200,
        successRate: 0.95,
        processingTimeMin: 1000,
        processingTimeMax: 3000,
      },
      bank_transfer: {
        latency: 3000, // 2-5s average
        successRate: 0.98,
        processingTimeMin: 2000,
        processingTimeMax: 5000,
      },
      paypal: {
        latency: 300,
        successRate: 0.94,
        processingTimeMin: 2000,
        processingTimeMax: 4000,
      },
      apple_pay: {
        latency: 150,
        successRate: 0.96,
        processingTimeMin: 500,
        processingTimeMax: 2000,
      },
      google_pay: {
        latency: 150,
        successRate: 0.96,
        processingTimeMin: 500,
        processingTimeMax: 2000,
      },
      ach: {
        latency: 172800000, // 1-3 дня в среднем (2 дня)
        successRate: 0.99,
        processingTimeMin: 86400000, // 1 день
        processingTimeMax: 259200000, // 3 дня
      },
      cryptocurrency: {
        latency: 900000, // 5-30 минут в среднем (15 минут)
        successRate: 0.90,
        processingTimeMin: 300000, // 5 минут
        processingTimeMax: 1800000, // 30 минут
      },
    };
    
    return profiles[method] || profiles.card;
  }
  
  /**
   * Инициализирует конфигурацию Payment Gateway из конфига компонента
   */
  initializeConfig(node: CanvasNode): void {
    const config = node.data.config || {};
    
    this.config = {
      gatewayType: config.gatewayType || 'stripe',
      apiKey: config.apiKey || '',
      secretKey: config.secretKey || '',
      enableCreditCards: config.enableCreditCards ?? true,
      enableDebitCards: config.enableDebitCards ?? true,
      enableACH: config.enableACH ?? false,
      enableCryptocurrency: config.enableCryptocurrency ?? false,
      enable3DSecure: config.enable3DSecure ?? true,
      enableFraudDetection: config.enableFraudDetection ?? true,
      enableRefunds: config.enableRefunds ?? true,
      enableRecurringPayments: config.enableRecurringPayments ?? true,
      supportedCurrencies: config.supportedCurrencies || ['USD', 'EUR', 'GBP', 'JPY'],
      supportedMethods: config.supportedMethods || ['card', 'bank_transfer', 'paypal', 'apple_pay'],
      webhooks: config.webhooks || [],
      transactions: config.transactions || [],
      requestsPerSecond: config.requestsPerSecond || 50,
      averageResponseTime: config.averageResponseTime || 200,
      errorRate: config.errorRate || 0.01,
      successRate: config.successRate || 0.95,
      fraudDetectionRate: config.fraudDetectionRate || 0.02,
      refundRate: config.refundRate || 0.05,
      // Simulation parameters with defaults
      connectionThroughputMultiplier: config.connectionThroughputMultiplier ?? 0.2,
      baseTransactionCount: config.baseTransactionCount ?? 2,
      highLoadLatencyMultiplier: config.highLoadLatencyMultiplier ?? [
        { threshold: 0.95, multiplierMin: 1.5, multiplierMax: 2.0 },
        { threshold: 0.80, multiplierMin: 1.2, multiplierMax: 1.5 },
      ],
      highLoadErrorRateMultiplier: config.highLoadErrorRateMultiplier ?? [
        { threshold: 0.95, multiplier: 2.0 },
        { threshold: 0.80, multiplier: 1.5 },
      ],
      fraudDetectionMultipliers: config.fraudDetectionMultipliers ?? {
        largeAmount: 2.5,
        newCustomer: 1.8,
        unusualMethod: 1.5,
        suspiciousIP: 2.0,
      },
      falsePositiveRate: config.falsePositiveRate ?? 0.075,
      immediateSuccessRate: config.immediateSuccessRate ?? {
        with3DSecure: 0.6,
        without3DSecure: 0.7,
      },
      processingTimeMultipliers: config.processingTimeMultipliers ?? {
        largeAmount: 1.3,
        nightWeekend: 1.3,
      },
      refundChanceMultiplier: config.refundChanceMultiplier ?? 0.0001,
      refundAmountRange: config.refundAmountRange ?? {
        min: 0.5,
        max: 1.0,
      },
      // Webhook simulation parameters
      webhookDelay: config.webhookDelay ?? {
        min: 50,
        max: 200,
      },
      webhookRetry: config.webhookRetry ?? {
        maxRetries: 3,
        initialBackoff: 100,
        maxBackoff: 5000,
        backoffMultiplier: 2.0,
      },
      // Refund pattern parameters
      refundPatterns: config.refundPatterns ?? {
        largeAmountMultiplier: 2.0,
        methodMultipliers: {
          paypal: 1.5,
          card: 1.0,
          bank_transfer: 1.0,
          apple_pay: 1.0,
          google_pay: 1.0,
          ach: 1.0,
          cryptocurrency: 1.0,
        },
        holidayMultiplier: 1.5,
        holidayDays: 7,
      },
    };
    
    // Initialize data from config
    this.initializeTransactions();
    this.initializeWebhooks();
  }
  
  /**
   * Инициализирует транзакции из конфига
   */
  private initializeTransactions(): void {
    this.transactions.clear();
    if (this.config?.transactions) {
      for (const transaction of this.config.transactions) {
        this.transactions.set(transaction.id, {
          ...transaction,
          timestamp: transaction.timestamp || Date.now(),
        });
        if (transaction.status === 'pending' || transaction.status === 'processing') {
          this.pendingTransactions.add(transaction.id);
        }
      }
    }
  }
  
  /**
   * Инициализирует webhooks из конфига
   */
  private initializeWebhooks(): void {
    this.webhooks.clear();
    if (this.config?.webhooks) {
      for (const webhook of this.config.webhooks) {
        this.webhooks.set(webhook.id, {
          ...webhook,
          successCount: webhook.successCount || 0,
          failureCount: webhook.failureCount || 0,
          pendingRetries: webhook.pendingRetries || new Map(),
        });
      }
    }
  }
  
  /**
   * Выполняет один цикл обновления Payment Gateway
   * Должен вызываться периодически в EmulationEngine
   */
  performUpdate(currentTime: number, hasIncomingConnections: boolean = false, connectionCount: number = 0): void {
    if (!this.config) return;
    
    const deltaTime = currentTime - this.lastUpdateTime;
    const oldLastUpdateTime = this.lastUpdateTime;
    this.lastUpdateTime = currentTime;
    
    // Simulate API requests if there are incoming connections
    if (hasIncomingConnections) {
      this.simulateAPIRequests(currentTime, connectionCount);
    }
    
    // Generate new transactions
    if (currentTime - this.lastTransactionGeneration > this.TRANSACTION_GENERATION_INTERVAL) {
      this.generateTransactions(currentTime, connectionCount);
      this.lastTransactionGeneration = currentTime;
    }
    
    // Отслеживаем изменения статусов транзакций
    this.trackStatusChanges(oldLastUpdateTime);
    
    // Process pending transactions (status progression)
    this.processPendingTransactions(currentTime);
    
    // Simulate refunds
    if (this.config.enableRefunds) {
      this.simulateRefunds(currentTime);
    }
    
    // Trigger webhooks for completed transactions
    this.triggerWebhooks(currentTime);
    
    // Update metrics
    this.updateMetrics();
  }
  
  /**
   * Отслеживает изменения статусов транзакций
   */
  private trackStatusChanges(currentTime: number): void {
    // Этот метод будет вызываться после processPendingTransactions
    // для отслеживания изменений статусов
    // Реализация будет в processPendingTransactions
  }
  
  /**
   * Симулирует API запросы к Payment Gateway
   */
  private simulateAPIRequests(currentTime: number, connectionCount: number = 0): void {
    if (!this.config) return;
    
    // Применяем временной множитель нагрузки
    const loadMultiplier = this.getTimeBasedLoadMultiplier(currentTime);
    const baseRequestsPerSecond = this.config.requestsPerSecond || 50;
    
    // Влияние входящих соединений на throughput
    // Больше соединений → больше запросов
    const connectionThroughputMultiplier = this.config.connectionThroughputMultiplier ?? 0.2;
    const connectionMultiplier = 1 + (connectionCount * connectionThroughputMultiplier);
    const requestsPerSecond = baseRequestsPerSecond * loadMultiplier * connectionMultiplier;
    const requestsPerUpdate = (requestsPerSecond * 0.1); // 100ms update interval
    
    // Получаем профиль gateway для базовой latency
    const gatewayProfile = this.getGatewayProfile(this.config.gatewayType);
    let baseLatency = gatewayProfile.latency;
    
    // Влияние 3D Secure на latency
    if (this.config.enable3DSecure) {
      baseLatency += 50; // +50ms при включенном 3D Secure
    }
    
    // Влияние нагрузки на latency (на основе текущей utilization)
    const currentUtilization = this.pgMetrics.apiUtilization || 0;
    const highLoadLatencyMultiplier = this.config.highLoadLatencyMultiplier ?? [
      { threshold: 0.95, multiplierMin: 1.5, multiplierMax: 2.0 },
      { threshold: 0.80, multiplierMin: 1.2, multiplierMax: 1.5 },
    ];
    
    for (const threshold of highLoadLatencyMultiplier) {
      if (currentUtilization > threshold.threshold) {
        const multiplier = threshold.multiplierMin + 
          Math.random() * (threshold.multiplierMax - threshold.multiplierMin);
        baseLatency *= multiplier;
        break; // Применяем только первый подходящий порог
      }
    }
    
    for (let i = 0; i < requestsPerUpdate; i++) {
      if (Math.random() < 0.2) { // 20% chance per update cycle
        // Используем latency из профиля gateway, но учитываем конфиг если он задан
        const latency = this.config.averageResponseTime || baseLatency;
        const baseErrorRate = this.config.errorRate || 0.01;
        
        // Увеличиваем error rate при высокой нагрузке
        const highLoadErrorRateMultiplier = this.config.highLoadErrorRateMultiplier ?? [
          { threshold: 0.95, multiplier: 2.0 },
          { threshold: 0.80, multiplier: 1.5 },
        ];
        
        let errorRate = baseErrorRate;
        for (const threshold of highLoadErrorRateMultiplier) {
          if (currentUtilization > threshold.threshold) {
            errorRate = baseErrorRate * threshold.multiplier;
            break; // Применяем только первый подходящий порог
          }
        }
        
        const error = Math.random() < errorRate;
        const actualLatency = latency + (Math.random() - 0.5) * latency * 0.4; // ±40% variation
        
        this.requestHistory.push({
          timestamp: currentTime,
          latency: actualLatency,
          success: !error,
        });
        
        // Keep history size limited
        if (this.requestHistory.length > this.MAX_REQUEST_HISTORY) {
          this.requestHistory.shift();
        }
      }
    }
  }
  
  /**
   * Генерирует новые транзакции
   */
  private generateTransactions(currentTime: number, connectionCount: number = 0): void {
    if (!this.config) return;
    
    // Применяем временной множитель нагрузки
    const loadMultiplier = this.getTimeBasedLoadMultiplier(currentTime);
    const baseNumTransactions = this.config.baseTransactionCount ?? 2;
    
    // Влияние входящих соединений на throughput
    // Больше соединений → больше транзакций
    const connectionThroughputMultiplier = this.config.connectionThroughputMultiplier ?? 0.2;
    const connectionMultiplier = 1 + (connectionCount * connectionThroughputMultiplier);
    const numTransactions = Math.floor(Math.random() * (baseNumTransactions * loadMultiplier * connectionMultiplier * 2));
    
    // Получаем профиль gateway для success rate и fee
    const gatewayProfile = this.getGatewayProfile(this.config.gatewayType);
    const baseSuccessRate = gatewayProfile.successRate;
    
    for (let i = 0; i < numTransactions; i++) {
      const paymentMethod = this.config.supportedMethods[
        Math.floor(Math.random() * this.config.supportedMethods.length)
      ];
      
      // Генерируем реалистичную сумму на основе метода оплаты
      const amount = this.generateRealisticAmount(paymentMethod);
      
      const currency = this.config.supportedCurrencies[
        Math.floor(Math.random() * this.config.supportedCurrencies.length)
      ];
      
      // Check if payment method is enabled
      if (paymentMethod === 'card' && !this.config.enableCreditCards && !this.config.enableDebitCards) continue;
      if (paymentMethod === 'ach' && !this.config.enableACH) continue;
      if (paymentMethod === 'cryptocurrency' && !this.config.enableCryptocurrency) continue;
      
      // Получаем профиль метода оплаты
      const methodProfile = this.getPaymentMethodProfile(paymentMethod);
      
      // Комбинируем success rate: gateway profile + method profile
      // Используем более низкий из двух (консервативный подход)
      let methodSuccessRate = methodProfile.successRate;
      let combinedSuccessRate = Math.min(baseSuccessRate, methodSuccessRate);
      
      // Влияние 3D Secure на success rate и conversion
      if (this.config.enable3DSecure) {
        // +2% success rate (меньше fraud), но -1% conversion (дополнительный шаг)
        combinedSuccessRate = Math.min(1.0, combinedSuccessRate + 0.02);
        // Conversion penalty применяется через вероятность немедленного успеха
        // (будет учтено ниже при определении статуса)
      } else {
        // Без 3D Secure больше fraud, но выше conversion
        // Это уже учтено в базовых success rate профилей
      }
      
      const successRate = this.config.successRate !== undefined 
        ? Math.min(this.config.successRate, methodSuccessRate) 
        : combinedSuccessRate;
      
      // Улучшенная логика fraud detection
      let fraudProbability = this.config.fraudDetectionRate || 0.02;
      const fraudMultipliers = this.config.fraudDetectionMultipliers ?? {
        largeAmount: 2.5,
        newCustomer: 1.8,
        unusualMethod: 1.5,
        suspiciousIP: 2.0,
      };
      
      // Больше fraud на крупных суммах (>$500)
      if (amount > 500) {
        fraudProbability *= fraudMultipliers.largeAmount;
      }
      
      // Используем информацию о клиенте из кэша (если есть)
      let customerId: string | undefined;
      let customerInfo: { hasPaymentHistory: boolean; isVipCustomer: boolean; totalSpent: number } | undefined;
      
      // Генерируем или используем существующий customerId
      if (Math.random() < 0.7) { // 70% транзакций с известными клиентами
        // Выбираем случайного клиента из кэша или создаем нового
        const cachedCustomerIds = Array.from(this.customerInfoCache.keys());
        if (cachedCustomerIds.length > 0 && Math.random() < 0.8) {
          // 80% шанс использовать существующего клиента
          customerId = cachedCustomerIds[Math.floor(Math.random() * cachedCustomerIds.length)];
          customerInfo = this.customerInfoCache.get(customerId);
        } else {
          // Создаем нового клиента
          customerId = `customer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        }
      }
      
      // Если есть информация о клиенте, используем её для улучшения fraud detection
      const isNewCustomer = !customerInfo || !customerInfo.hasPaymentHistory;
      if (isNewCustomer) {
        fraudProbability *= fraudMultipliers.newCustomer;
      } else {
        // Клиент с историей - снижаем вероятность fraud
        if (customerInfo.hasPaymentHistory) {
          fraudProbability *= 0.6; // -40% для клиентов с историей
        }
        if (customerInfo.isVipCustomer) {
          fraudProbability *= 0.5; // -50% для VIP клиентов
        }
      }
      
      // Проверяем лимиты транзакций (от ERP)
      if (this.transactionLimits) {
        if (amount > this.transactionLimits.maxTransactionAmount) {
          // Превышен лимит на транзакцию
          status = 'failed';
          // Не создаем транзакцию, если превышен лимит
          continue;
        }
      }
      
      // Больше fraud на необычных методах оплаты
      const unusualMethods: PaymentMethodType[] = ['cryptocurrency', 'ach'];
      if (unusualMethods.includes(paymentMethod)) {
        fraudProbability *= fraudMultipliers.unusualMethod;
      }
      
      // Больше fraud на транзакциях из подозрительных IP
      // Симулируем: некоторые IP более подозрительны
      const suspiciousIP = Math.random() < 0.1; // 10% подозрительных IP
      if (suspiciousIP) {
        fraudProbability *= fraudMultipliers.suspiciousIP;
      }
      
      // Если fraud detection выключен, но есть подозрительные факторы, все равно учитываем
      const isFraud = Math.random() < Math.min(fraudProbability, 0.5); // Максимум 50% вероятность
      
      // Ложные срабатывания: 5-10% легитимных транзакций помечаются как fraud
      const falsePositiveRate = this.config.falsePositiveRate ?? 0.075;
      const isFalsePositive = !isFraud && Math.random() < falsePositiveRate;
      const finalFraudDecision = isFraud || (isFalsePositive && this.config.enableFraudDetection);
      
      // Determine initial status based on success rate and fraud detection
      let status: TransactionStatus = 'pending';
      const willSucceed = Math.random() < successRate;
      
      // Влияние fraud detection на latency (дополнительная проверка)
      let fraudCheckLatency = 0;
      if (this.config.enableFraudDetection && (finalFraudDecision || Math.random() < 0.3)) {
        // Проверка занимает 100-200ms
        fraudCheckLatency = 100 + Math.random() * 100;
      }
      
      // Определяем статус транзакции
      if (finalFraudDecision && this.config.enableFraudDetection) {
        status = 'failed';
      } else if (willSucceed) {
        // Conversion rate зависит от 3D Secure
        // С 3D Secure: меньше немедленных успехов (дополнительный шаг)
        // Без 3D Secure: больше немедленных успехов
        const immediateSuccessRateConfig = this.config.immediateSuccessRate ?? {
          with3DSecure: 0.6,
          without3DSecure: 0.7,
        };
        const immediateSuccessRate = this.config.enable3DSecure 
          ? immediateSuccessRateConfig.with3DSecure 
          : immediateSuccessRateConfig.without3DSecure;
        status = Math.random() < immediateSuccessRate ? 'succeeded' : 'processing';
      } else {
        status = 'failed';
      }
      
      // Используем fee из профиля gateway
      const fee = amount * gatewayProfile.feePercentage + gatewayProfile.feeFixed;
      
      // Генерируем IP адрес
      const ipAddress = `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
      
      // Формируем metadata
      const metadata: Record<string, any> = {
        source: 'api',
        ip: ipAddress,
        fraudCheckLatency: fraudCheckLatency,
        isNewCustomer: isNewCustomer,
      };
      
      // Добавляем информацию о fraud в metadata если обнаружен
      if (finalFraudDecision && this.config.enableFraudDetection) {
        metadata.fraudDetected = true;
        metadata.fraudReason = isFalsePositive ? 'false_positive' : 'suspicious_activity';
      }
      
      const transaction: PaymentTransaction = {
        id: `txn_${currentTime}_${i}_${Math.random().toString(36).substr(2, 9)}`,
        amount,
        currency,
        status,
        paymentMethod,
        customerId: customerId || `cust_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: currentTime,
        description: `Payment for order #${Math.floor(Math.random() * 10000)}`,
        fee: fee,
        metadata: metadata,
      };
      
      this.transactions.set(transaction.id, transaction);
      
      if (status === 'pending' || status === 'processing') {
        this.pendingTransactions.add(transaction.id);
      }
    }
  }
  
  /**
   * Обрабатывает pending транзакции (прогрессия статусов)
   */
  private processPendingTransactions(currentTime: number): void {
    if (!this.config) return;
    
    for (const transactionId of Array.from(this.pendingTransactions)) {
      const transaction = this.transactions.get(transactionId);
      if (!transaction) {
        this.pendingTransactions.delete(transactionId);
        continue;
      }
      
      const transactionAge = currentTime - transaction.timestamp;
      
      // Получаем профиль метода оплаты для определения времени обработки
      const methodProfile = this.getPaymentMethodProfile(transaction.paymentMethod);
      const processingTime = methodProfile.processingTimeMin + 
        Math.random() * (methodProfile.processingTimeMax - methodProfile.processingTimeMin);
      
      // Учитываем размер транзакции: крупные суммы проверяются дольше
      const isLargeAmount = transaction.amount > 500;
      const processingTimeMultipliers = this.config.processingTimeMultipliers ?? {
        largeAmount: 1.3,
        nightWeekend: 1.3,
      };
      const processingTimeMultiplier = isLargeAmount ? processingTimeMultipliers.largeAmount : 1.0;
      const adjustedProcessingTime = processingTime * processingTimeMultiplier;
      
      // Учитываем время суток: ночью/выходные медленнее
      const now = new Date(currentTime);
      const hour = now.getHours();
      const dayOfWeek = now.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isNight = hour < 9 || hour > 21;
      const timeMultiplier = (isWeekend || isNight) ? processingTimeMultipliers.nightWeekend : 1.0;
      const finalProcessingTime = adjustedProcessingTime * timeMultiplier;
      
      if (transactionAge > finalProcessingTime) {
        if (transaction.status === 'pending' || transaction.status === 'processing') {
          // Используем success rate из профилей gateway и метода оплаты
          const gatewayProfile = this.getGatewayProfile(this.config.gatewayType);
          const baseSuccessRate = gatewayProfile.successRate;
          const methodSuccessRate = methodProfile.successRate;
          const combinedSuccessRate = Math.min(baseSuccessRate, methodSuccessRate);
          const successRate = this.config.successRate !== undefined 
            ? Math.min(this.config.successRate, methodSuccessRate) 
            : combinedSuccessRate;
          
          // Determine final status
          const oldStatus = transaction.status;
          const willSucceed = Math.random() < successRate;
          transaction.status = willSucceed ? 'succeeded' : 'failed';
          
          // Отслеживаем время обработки
          const processingTime = currentTime - transaction.timestamp;
          this.processingTimes.push(processingTime);
          if (this.processingTimes.length > this.MAX_PROCESSING_TIMES) {
            this.processingTimes.shift();
          }
          
          // Отслеживаем изменение статуса
          if (oldStatus !== transaction.status) {
            this.statusChangedTransactions.add(transactionId);
          }
          
          this.pendingTransactions.delete(transactionId);
        }
      }
    }
  }
  
  /**
   * Симулирует возвраты средств (refunds)
   * Улучшенная логика с учетом паттернов: крупные суммы, методы оплаты, временные паттерны
   */
  private simulateRefunds(currentTime: number): void {
    if (!this.config) return;
    
    const refundRate = this.config.refundRate || 0.05;
    const refundChanceMultiplier = this.config.refundChanceMultiplier ?? 0.0001;
    const refundAmountRange = this.config.refundAmountRange ?? {
      min: 0.5,
      max: 1.0,
    };
    const refundPatterns = this.config.refundPatterns ?? {
      largeAmountMultiplier: 2.0,
      methodMultipliers: {
        paypal: 1.5,
        card: 1.0,
        bank_transfer: 1.0,
        apple_pay: 1.0,
        google_pay: 1.0,
        ach: 1.0,
        cryptocurrency: 1.0,
      },
      holidayMultiplier: 1.5,
      holidayDays: 7,
    };
    
    // Check succeeded transactions for potential refunds
    for (const transaction of this.transactions.values()) {
      if (transaction.status === 'succeeded' && !transaction.refundedAmount) {
        // Base refund chance
        let refundChance = refundRate * refundChanceMultiplier;
        
        // Больше возвратов для крупных сумм (>$500)
        if (transaction.amount > 500) {
          refundChance *= refundPatterns.largeAmountMultiplier ?? 2.0;
        }
        
        // Больше возвратов для определенных методов (PayPal)
        const methodMultiplier = refundPatterns.methodMultipliers?.[transaction.paymentMethod] ?? 1.0;
        refundChance *= methodMultiplier;
        
        // Временные паттерны: больше возвратов после праздников
        // Симулируем: проверяем, не было ли недавно "праздника" (случайное событие)
        // В реальной системе это было бы на основе календаря
        const transactionAge = currentTime - transaction.timestamp;
        const daysSinceTransaction = transactionAge / (1000 * 60 * 60 * 24);
        
        // Симулируем праздничные периоды: случайные всплески возвратов
        // В реальной системе это было бы на основе календаря праздников
        const isHolidayPeriod = Math.random() < 0.1; // 10% шанс на "праздничный период"
        if (isHolidayPeriod && daysSinceTransaction <= (refundPatterns.holidayDays ?? 7)) {
          refundChance *= refundPatterns.holidayMultiplier ?? 1.5;
        }
        
        // Проверяем, должен ли произойти возврат
        if (Math.random() < refundChance) {
          // Частичные возвраты (не всегда 100%)
          const refundFraction = refundAmountRange.min + 
            Math.random() * (refundAmountRange.max - refundAmountRange.min);
          const refundAmount = transaction.amount * refundFraction;
          transaction.status = 'refunded';
          transaction.refundedAmount = refundAmount;
        }
      }
    }
  }
  
  /**
   * Триггерит webhooks для завершенных транзакций
   * Реализует реалистичные задержки и retry логику
   */
  private triggerWebhooks(currentTime: number): void {
    if (!this.config) return;
    
    const webhookDelay = this.config.webhookDelay ?? { min: 50, max: 200 };
    const webhookRetry = this.config.webhookRetry ?? {
      maxRetries: 3,
      initialBackoff: 100,
      maxBackoff: 5000,
      backoffMultiplier: 2.0,
    };
    
    // Find recently completed transactions (within last 5 seconds)
    const recentThreshold = currentTime - 5000;
    const recentTransactions = Array.from(this.transactions.values()).filter(
      t => t.timestamp >= recentThreshold && 
           (t.status === 'succeeded' || t.status === 'failed' || t.status === 'refunded')
    );
    
    for (const webhook of this.webhooks.values()) {
      if (!webhook.enabled) continue;
      
      // Initialize pending retries map if needed
      if (!webhook.pendingRetries) {
        webhook.pendingRetries = new Map();
      }
      
      // Process pending retries first
      for (const [transactionId, retryInfo] of Array.from(webhook.pendingRetries.entries())) {
        if (currentTime >= retryInfo.nextRetryTime) {
          // Time to retry
          const transaction = this.transactions.get(transactionId);
          if (!transaction) {
            // Transaction no longer exists, remove retry
            webhook.pendingRetries.delete(transactionId);
            continue;
          }
          
          // Attempt retry
          const success = Math.random() > 0.05; // 95% success rate
          
          if (success) {
            // Retry succeeded
            webhook.successCount = (webhook.successCount || 0) + 1;
            webhook.pendingRetries.delete(transactionId);
            this.pgMetrics.webhooksTriggered++;
          } else {
            // Retry failed, schedule next retry or give up
            if (retryInfo.retryCount < webhookRetry.maxRetries) {
              // Calculate exponential backoff
              const backoffDelay = Math.min(
                webhookRetry.initialBackoff * Math.pow(webhookRetry.backoffMultiplier, retryInfo.retryCount),
                webhookRetry.maxBackoff
              );
              
              retryInfo.retryCount++;
              retryInfo.nextRetryTime = currentTime + backoffDelay;
              retryInfo.lastAttemptTime = currentTime;
            } else {
              // Max retries reached, give up
              webhook.failureCount = (webhook.failureCount || 0) + 1;
              webhook.pendingRetries.delete(transactionId);
              this.pgMetrics.webhooksFailed++;
            }
          }
        }
      }
      
      // Process new transactions
      // Track which transactions have been processed to avoid duplicates
      const processedTransactions = new Set<string>();
      
      for (const transaction of recentTransactions) {
        // Check if this transaction was already processed or is being retried
        if (webhook.pendingRetries.has(transaction.id) || processedTransactions.has(transaction.id)) {
          continue;
        }
        
        // Check if webhook should be triggered for this event
        const eventType = `payment.${transaction.status}`;
        if (webhook.events.includes(eventType) || webhook.events.includes('payment.*')) {
          // Simulate webhook delay (50-200ms) - in real system this would be async
          // For simulation, we trigger immediately but account for delay in metrics
          const delay = webhookDelay.min + Math.random() * (webhookDelay.max - webhookDelay.min);
          
          // Simulate webhook trigger with delay
          // In real system, this would be async, but for simulation we do it synchronously
          const success = Math.random() > 0.05; // 95% success rate
          
          if (success) {
            webhook.successCount = (webhook.successCount || 0) + 1;
            webhook.lastTriggered = currentTime;
            this.pgMetrics.webhooksTriggered++;
            processedTransactions.add(transaction.id);
          } else {
            // Failed, schedule retry with exponential backoff
            const backoffDelay = webhookRetry.initialBackoff;
            webhook.pendingRetries.set(transaction.id, {
              retryCount: 0,
              nextRetryTime: currentTime + backoffDelay + delay, // Include initial delay
              lastAttemptTime: currentTime,
            });
            this.pgMetrics.webhooksFailed++;
            processedTransactions.add(transaction.id);
          }
        }
      }
    }
  }
  
  /**
   * Обновляет метрики на основе текущего состояния
   */
  private updateMetrics(): void {
    // Transaction metrics
    this.pgMetrics.transactionsTotal = this.transactions.size;
    this.pgMetrics.transactionsSucceeded = Array.from(this.transactions.values())
      .filter(t => t.status === 'succeeded').length;
    this.pgMetrics.transactionsPending = Array.from(this.transactions.values())
      .filter(t => t.status === 'pending' || t.status === 'processing').length;
    this.pgMetrics.transactionsFailed = Array.from(this.transactions.values())
      .filter(t => t.status === 'failed').length;
    this.pgMetrics.transactionsRefunded = Array.from(this.transactions.values())
      .filter(t => t.status === 'refunded').length;
    
    // Amount metrics
    const allTransactions = Array.from(this.transactions.values());
    this.pgMetrics.totalAmount = allTransactions.reduce((sum, t) => sum + t.amount, 0);
    this.pgMetrics.totalAmountSucceeded = allTransactions
      .filter(t => t.status === 'succeeded')
      .reduce((sum, t) => sum + t.amount, 0);
    this.pgMetrics.totalAmountRefunded = allTransactions
      .filter(t => t.refundedAmount)
      .reduce((sum, t) => sum + (t.refundedAmount || 0), 0);
    
    if (this.pgMetrics.transactionsTotal > 0) {
      this.pgMetrics.averageAmount = this.pgMetrics.totalAmount / this.pgMetrics.transactionsTotal;
    }
    
    // Success and failure rates
    if (this.pgMetrics.transactionsTotal > 0) {
      this.pgMetrics.successRate = this.pgMetrics.transactionsSucceeded / this.pgMetrics.transactionsTotal;
      this.pgMetrics.failureRate = this.pgMetrics.transactionsFailed / this.pgMetrics.transactionsTotal;
      this.pgMetrics.refundRate = this.pgMetrics.transactionsRefunded / this.pgMetrics.transactionsSucceeded || 0;
    }
    
    // Fraud detection
    this.pgMetrics.fraudDetected = Array.from(this.transactions.values())
      .filter(t => t.status === 'failed' && t.metadata?.fraudDetected).length;
    
    // Performance metrics from request history
    if (this.requestHistory.length > 0) {
      const recentRequests = this.requestHistory.slice(-100); // Last 100 requests
      const timeWindow = 10000; // 10 seconds
      const recentTime = Date.now() - timeWindow;
      const requestsInWindow = recentRequests.filter(r => r.timestamp >= recentTime);
      
      this.pgMetrics.requestsPerSecond = requestsInWindow.length / (timeWindow / 1000);
      this.pgMetrics.averageResponseTime = recentRequests.reduce((sum, r) => sum + r.latency, 0) / recentRequests.length;
      this.pgMetrics.errorRate = recentRequests.filter(r => !r.success).length / recentRequests.length;
    }
    
    // Utilization (based on request rate vs capacity)
    const maxRequestsPerSecond = this.config?.requestsPerSecond || 50;
    this.pgMetrics.apiUtilization = Math.min(1, this.pgMetrics.requestsPerSecond / maxRequestsPerSecond);
    
    // Processing utilization (based on pending transactions)
    const maxConcurrentTransactions = 1000;
    this.pgMetrics.processingUtilization = Math.min(1, this.pgMetrics.transactionsPending / maxConcurrentTransactions);
    
    // Webhook metrics
    this.pgMetrics.webhooksTotal = this.webhooks.size;
    this.pgMetrics.webhooksEnabled = Array.from(this.webhooks.values())
      .filter(w => w.enabled).length;
    
    // Метрики по методам оплаты (для customMetrics)
    this.metricsByPaymentMethod.clear();
    const methodStats = new Map<PaymentMethodType, { count: number; successCount: number; failedCount: number; totalAmount: number }>();
    
    for (const transaction of allTransactions) {
      const method = transaction.paymentMethod;
      if (!methodStats.has(method)) {
        methodStats.set(method, { count: 0, successCount: 0, failedCount: 0, totalAmount: 0 });
      }
      
      const stats = methodStats.get(method)!;
      stats.count++;
      stats.totalAmount += transaction.amount;
      
      if (transaction.status === 'succeeded') {
        stats.successCount++;
      } else if (transaction.status === 'failed') {
        stats.failedCount++;
      }
    }
    
    for (const [method, stats] of methodStats.entries()) {
      this.metricsByPaymentMethod.set(method, {
        count: stats.count,
        successCount: stats.successCount,
        failedCount: stats.failedCount,
        successRate: stats.count > 0 ? stats.successCount / stats.count : 0,
        avgAmount: stats.count > 0 ? stats.totalAmount / stats.count : 0,
        totalAmount: stats.totalAmount,
      });
    }
    
    // Метрики по валютам (для customMetrics)
    this.metricsByCurrency.clear();
    const currencyStats = new Map<string, { count: number; totalAmount: number }>();
    
    for (const transaction of allTransactions) {
      const currency = transaction.currency;
      if (!currencyStats.has(currency)) {
        currencyStats.set(currency, { count: 0, totalAmount: 0 });
      }
      
      const stats = currencyStats.get(currency)!;
      stats.count++;
      stats.totalAmount += transaction.amount;
    }
    
    for (const [currency, stats] of currencyStats.entries()) {
      this.metricsByCurrency.set(currency, {
        count: stats.count,
        totalAmount: stats.totalAmount,
        avgAmount: stats.count > 0 ? stats.totalAmount / stats.count : 0,
      });
    }
    
    // Conversion funnel metrics
    this.pgMetrics.conversionFunnel = {
      pending: Array.from(this.transactions.values()).filter(t => t.status === 'pending').length,
      processing: Array.from(this.transactions.values()).filter(t => t.status === 'processing').length,
      succeeded: this.pgMetrics.transactionsSucceeded,
      failed: this.pgMetrics.transactionsFailed,
      refunded: this.pgMetrics.transactionsRefunded,
    };
    
    // Chargeback rate: процент успешных транзакций, которые получили chargeback
    // Симулируем: 0.5-1% успешных транзакций получают chargeback
    const succeededTransactions = Array.from(this.transactions.values())
      .filter(t => t.status === 'succeeded');
    const chargebackCount = succeededTransactions.filter(t => 
      t.metadata?.chargeback || t.metadata?.disputeType === 'chargeback'
    ).length;
    this.pgMetrics.chargebackRate = succeededTransactions.length > 0 
      ? chargebackCount / succeededTransactions.length 
      : 0;
    
    // Dispute rate: процент транзакций с disputes (включая chargebacks)
    const disputeCount = Array.from(this.transactions.values()).filter(t => 
      t.metadata?.dispute || t.metadata?.disputeType
    ).length;
    this.pgMetrics.disputeRate = this.pgMetrics.transactionsTotal > 0 
      ? disputeCount / this.pgMetrics.transactionsTotal 
      : 0;
    
    // Average processing time: среднее время от pending до succeeded/failed
    if (this.processingTimes.length > 0) {
      this.pgMetrics.averageProcessingTime = 
        this.processingTimes.reduce((sum, t) => sum + t, 0) / this.processingTimes.length;
    } else {
      this.pgMetrics.averageProcessingTime = 0;
    }
    
    // Percentiles latency УЖЕ рассчитываются в EmulationEngine через updateLatencyPercentiles()
    // Не дублируем здесь!
  }
  
  /**
   * Возвращает текущие метрики
   */
  getMetrics(): PaymentGatewayEngineMetrics {
    return { ...this.pgMetrics };
  }
  
  /**
   * Возвращает метрики по методам оплаты (для customMetrics)
   */
  getMetricsByPaymentMethod(): Map<PaymentMethodType, PaymentMethodMetrics> {
    return new Map(this.metricsByPaymentMethod);
  }
  
  /**
   * Возвращает метрики по валютам (для customMetrics)
   */
  getMetricsByCurrency(): Map<string, { count: number; totalAmount: number; avgAmount: number }> {
    return new Map(this.metricsByCurrency);
  }
  
  /**
   * Возвращает все транзакции
   */
  getTransactions(): PaymentTransaction[] {
    return Array.from(this.transactions.values());
  }
  
  /**
   * Возвращает все webhooks
   */
  getWebhooks(): PaymentWebhook[] {
    return Array.from(this.webhooks.values());
  }
  
  /**
   * Добавляет транзакцию
   */
  addTransaction(transaction: PaymentTransaction): void {
    this.transactions.set(transaction.id, transaction);
    if (transaction.status === 'pending' || transaction.status === 'processing') {
      this.pendingTransactions.add(transaction.id);
    }
    this.updateMetrics();
  }
  
  /**
   * Обновляет транзакцию
   */
  updateTransaction(id: string, updates: Partial<PaymentTransaction>): void {
    const transaction = this.transactions.get(id);
    if (transaction) {
      const oldStatus = transaction.status;
      this.transactions.set(id, { ...transaction, ...updates });
      
      // Update pending set
      if (oldStatus === 'pending' || oldStatus === 'processing') {
        this.pendingTransactions.delete(id);
      }
      if (updates.status === 'pending' || updates.status === 'processing') {
        this.pendingTransactions.add(id);
      }
      
      this.updateMetrics();
    }
  }
  
  /**
   * Удаляет транзакцию
   */
  removeTransaction(id: string): void {
    this.transactions.delete(id);
    this.pendingTransactions.delete(id);
    this.updateMetrics();
  }
  
  /**
   * Добавляет webhook
   */
  addWebhook(webhook: PaymentWebhook): void {
    this.webhooks.set(webhook.id, {
      ...webhook,
      successCount: webhook.successCount || 0,
      failureCount: webhook.failureCount || 0,
      pendingRetries: webhook.pendingRetries || new Map(),
    });
    this.updateMetrics();
  }
  
  /**
   * Обновляет webhook
   */
  updateWebhook(id: string, updates: Partial<PaymentWebhook>): void {
    const webhook = this.webhooks.get(id);
    if (webhook) {
      this.webhooks.set(id, { ...webhook, ...updates });
      this.updateMetrics();
    }
  }
  
  /**
   * Удаляет webhook
   */
  removeWebhook(id: string): void {
    this.webhooks.delete(id);
    this.updateMetrics();
  }
  
  /**
   * Возвращает конфигурацию
   */
  getConfig(): PaymentGatewayEmulationConfig | null {
    return this.config;
  }
  
  /**
   * Обновляет конфигурацию
   */
  updateConfig(updates: Partial<PaymentGatewayEmulationConfig>): void {
    if (this.config) {
      this.config = { ...this.config, ...updates };
      
      // Reinitialize if needed
      if (updates.transactions !== undefined) {
        this.initializeTransactions();
      }
      if (updates.webhooks !== undefined) {
        this.initializeWebhooks();
      }
    }
  }
  
  /**
   * Возвращает новые транзакции для отправки в DataFlow
   * (только те, которые еще не были отправлены)
   */
  getNewTransactionsForDataFlow(): PaymentTransaction[] {
    const newTransactions: PaymentTransaction[] = [];
    
    for (const transaction of this.transactions.values()) {
      if (!this.sentTransactionIds.has(transaction.id)) {
        newTransactions.push(transaction);
        this.sentTransactionIds.add(transaction.id);
      }
    }
    
    return newTransactions;
  }
  
  /**
   * Возвращает транзакции с изменившимся статусом
   */
  getStatusChangedTransactions(): PaymentTransaction[] {
    const changedTransactions: PaymentTransaction[] = [];
    
    for (const transactionId of Array.from(this.statusChangedTransactions)) {
      const transaction = this.transactions.get(transactionId);
      if (transaction) {
        changedTransactions.push(transaction);
      }
    }
    
    // Очищаем отслеживание после получения
    this.statusChangedTransactions.clear();
    
    return changedTransactions;
  }
  
  /**
   * Сбрасывает отслеживание отправленных транзакций (для тестирования)
   */
  resetDataFlowTracking(): void {
    this.sentTransactionIds.clear();
    this.statusChangedTransactions.clear();
    this.lastDataSyncTime = Date.now();
  }
  
  /**
   * Обрабатывает входящие данные от других компонентов
   * Используется для двусторонней интеграции: получение данных от CRM, ERP, Fraud Detection
   */
  processIncomingData(message: { payload: unknown; source?: string; metadata?: Record<string, unknown> }): {
    processed: boolean;
    fraudScoreUpdated?: boolean;
    transactionLimitUpdated?: boolean;
    customerInfoUpdated?: boolean;
    error?: string;
  } {
    if (!this.config) {
      return { processed: false, error: 'Configuration not initialized' };
    }

    try {
      const payload = message.payload as any;
      const sourceType = message.metadata?.sourceType as string || message.source;
      let fraudScoreUpdated = false;
      let transactionLimitUpdated = false;
      let customerInfoUpdated = false;

      // Обработка данных от CRM (информация о клиенте для fraud detection)
      if (sourceType === 'crm' || payload?.type === 'contact' || payload?.operation === 'update') {
        const customerData = payload?.data || payload;
        const customerId = customerData?.customerId || customerData?.id;
        
        if (customerId) {
          // Обновляем информацию о клиенте для улучшения fraud detection
          // В реальной системе это бы обновляло кэш/базу данных клиентов
          // Здесь мы просто отмечаем, что информация получена
          customerInfoUpdated = true;
          
          // Используем информацию о клиенте для улучшения fraud detection
          // Например, если клиент имеет историю платежей, снижаем вероятность fraud
          const hasPaymentHistory = customerData?.totalSpent > 0 || customerData?.paymentCount > 0;
          const isVipCustomer = customerData?.status === 'vip' || customerData?.value > 10000;
          
          // Сохраняем информацию о клиенте в metadata транзакций
          // Это будет использоваться при генерации новых транзакций
          if (!this.customerInfoCache) {
            this.customerInfoCache = new Map();
          }
          
          this.customerInfoCache.set(customerId, {
            hasPaymentHistory,
            isVipCustomer,
            totalSpent: customerData?.totalSpent || 0,
            lastUpdated: Date.now(),
          });
        }
      }

      // Обработка данных от ERP (лимиты на транзакции)
      if (sourceType === 'erp' || payload?.type === 'financial_transaction' || payload?.operation === 'create') {
        const financialData = payload?.data || payload;
        const transactionLimit = financialData?.transactionLimit;
        const dailyLimit = financialData?.dailyLimit;
        
        if (transactionLimit !== undefined || dailyLimit !== undefined) {
          // Обновляем лимиты транзакций
          if (!this.transactionLimits) {
            this.transactionLimits = {
              maxTransactionAmount: transactionLimit || 10000,
              dailyLimit: dailyLimit || 50000,
              lastUpdated: Date.now(),
            };
          } else {
            if (transactionLimit !== undefined) {
              this.transactionLimits.maxTransactionAmount = transactionLimit;
            }
            if (dailyLimit !== undefined) {
              this.transactionLimits.dailyLimit = dailyLimit;
            }
            this.transactionLimits.lastUpdated = Date.now();
          }
          
          transactionLimitUpdated = true;
        }
      }

      // Обработка данных от Fraud Detection (результаты проверки)
      if (sourceType === 'fraud-detection' || payload?.type === 'fraud_check' || payload?.event === 'fraud.detected') {
        const fraudData = payload?.data || payload;
        const transactionId = fraudData?.transactionId || fraudData?.id;
        const fraudScore = fraudData?.fraudScore;
        const isFraud = fraudData?.isFraud || fraudData?.fraudulent;
        
        if (transactionId && this.transactions.has(transactionId)) {
          const transaction = this.transactions.get(transactionId)!;
          
          // Обновляем метаданные транзакции с информацией о fraud check
          if (!transaction.metadata) {
            transaction.metadata = {};
          }
          
          transaction.metadata.fraudCheck = {
            score: fraudScore,
            isFraud,
            checkedAt: Date.now(),
            source: 'external',
          };
          
          // Если fraud обнаружен, обновляем статус транзакции
          if (isFraud && transaction.status === 'pending') {
            transaction.status = 'failed';
            transaction.metadata.failureReason = 'fraud_detected';
            
            // Обновляем метрики
            this.pgMetrics.fraudDetected++;
            this.pgMetrics.transactionsFailed++;
            this.pgMetrics.transactionsPending--;
          }
          
          fraudScoreUpdated = true;
        }
      }

      return {
        processed: true,
        fraudScoreUpdated,
        transactionLimitUpdated,
        customerInfoUpdated,
      };
    } catch (error) {
      return {
        processed: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Форматирует транзакцию для целевого компонента
   */
  formatTransactionForTarget(transaction: PaymentTransaction, targetType: string): Record<string, unknown> {
    // База данных (postgres, mongodb, cassandra, clickhouse, snowflake, elasticsearch, redis)
    const databaseTypes = ['postgres', 'mongodb', 'cassandra', 'clickhouse', 'snowflake', 'elasticsearch', 'redis'];
    if (databaseTypes.includes(targetType)) {
      return {
        operation: 'insert',
        collection: targetType === 'postgres' ? 'transactions' : 'transactions',
        table: targetType === 'postgres' ? 'transactions' : undefined,
        document: {
          id: transaction.id,
          amount: transaction.amount,
          currency: transaction.currency,
          status: transaction.status,
          paymentMethod: transaction.paymentMethod,
          customerId: transaction.customerId,
          timestamp: new Date(transaction.timestamp).toISOString(),
          description: transaction.description,
          fee: transaction.fee,
          refundedAmount: transaction.refundedAmount,
          metadata: transaction.metadata,
        },
      };
    }
    
    // CRM
    if (targetType === 'crm') {
      return {
        operation: 'update',
        type: 'contact',
        data: {
          customerId: transaction.customerId,
          paymentInfo: {
            transactionId: transaction.id,
            amount: transaction.amount,
            currency: transaction.currency,
            status: transaction.status,
            paymentMethod: transaction.paymentMethod,
            timestamp: new Date(transaction.timestamp).toISOString(),
          },
          lastPaymentDate: new Date(transaction.timestamp).toISOString(),
          totalSpent: transaction.amount, // В реальности это было бы накопление
        },
      };
    }
    
    // ERP
    if (targetType === 'erp') {
      return {
        operation: 'create',
        type: 'financial_transaction',
        data: {
          transactionId: transaction.id,
          amount: transaction.amount,
          currency: transaction.currency,
          status: transaction.status,
          paymentMethod: transaction.paymentMethod,
          customerId: transaction.customerId,
          timestamp: new Date(transaction.timestamp).toISOString(),
          fee: transaction.fee,
          netAmount: transaction.amount - (transaction.fee || 0),
          refundedAmount: transaction.refundedAmount,
          description: transaction.description,
        },
      };
    }
    
    // Message Queue (kafka, rabbitmq, redis-streams)
    const queueTypes = ['kafka', 'rabbitmq', 'redis-streams'];
    if (queueTypes.includes(targetType)) {
      const eventType = `payment.${transaction.status}`;
      return {
        event: eventType,
        eventType: eventType,
        data: {
          id: transaction.id,
          amount: transaction.amount,
          currency: transaction.currency,
          status: transaction.status,
          paymentMethod: transaction.paymentMethod,
          customerId: transaction.customerId,
          timestamp: new Date(transaction.timestamp).toISOString(),
          description: transaction.description,
          fee: transaction.fee,
          refundedAmount: transaction.refundedAmount,
          metadata: transaction.metadata,
        },
        timestamp: new Date(transaction.timestamp).toISOString(),
      };
    }
    
    // Data Warehouse / Analytics (bigquery, snowflake, redshift)
    const warehouseTypes = ['bigquery', 'redshift'];
    if (warehouseTypes.includes(targetType)) {
      return {
        operation: 'insert',
        dataset: 'payments',
        table: 'transactions',
        data: {
          transaction_id: transaction.id,
          amount: transaction.amount,
          currency: transaction.currency,
          status: transaction.status,
          payment_method: transaction.paymentMethod,
          customer_id: transaction.customerId,
          timestamp: new Date(transaction.timestamp).toISOString(),
          description: transaction.description,
          fee: transaction.fee,
          refunded_amount: transaction.refundedAmount,
        },
      };
    }
    
    // По умолчанию - стандартный формат
    return {
      operation: 'process',
      type: 'transaction',
      data: {
        id: transaction.id,
        amount: transaction.amount,
        currency: transaction.currency,
        status: transaction.status,
        paymentMethod: transaction.paymentMethod,
        customerId: transaction.customerId,
        timestamp: new Date(transaction.timestamp).toISOString(),
        description: transaction.description,
        fee: transaction.fee,
        refundedAmount: transaction.refundedAmount,
        metadata: transaction.metadata,
      },
    };
  }
}

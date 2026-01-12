import { CanvasNode } from '@/types';

/**
 * ERP Type
 */
export type ERPType = 'sap' | 'oracle' | 'dynamics' | 'netsuite';

/**
 * Order Status
 */
export type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

/**
 * Inventory Status
 */
export type InventoryStatus = 'in-stock' | 'low-stock' | 'out-of-stock' | 'reserved' | 'damaged';

/**
 * Financial Transaction Type
 */
export type TransactionType = 'invoice' | 'payment' | 'refund' | 'expense' | 'revenue' | 'adjustment';

/**
 * HR Employee Status
 */
export type EmployeeStatus = 'active' | 'on-leave' | 'terminated' | 'contractor';

/**
 * Manufacturing Order Status
 */
export type ManufacturingOrderStatus = 'planned' | 'released' | 'in-progress' | 'completed' | 'cancelled';

/**
 * Supply Chain Item Status
 */
export type SupplyItemStatus = 'ordered' | 'in-transit' | 'received' | 'delayed' | 'cancelled';

/**
 * ERP Order
 */
export interface ERPOrder {
  id: string;
  orderNumber: string;
  customer: string;
  customerId?: string;
  status: OrderStatus;
  total: number;
  items: Array<{
    id: string;
    sku: string;
    name: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  orderDate: number; // Timestamp
  expectedDelivery?: number; // Timestamp
  actualDelivery?: number; // Timestamp
  shippingAddress?: string;
  billingAddress?: string;
  paymentMethod?: string;
  notes?: string;
}

/**
 * ERP Inventory Item
 */
export interface ERPInventoryItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  quantity: number;
  reservedQuantity: number;
  reorderLevel: number;
  reorderQuantity: number;
  unitPrice: number;
  unitCost: number;
  status: InventoryStatus;
  location?: string;
  supplier?: string;
  lastRestocked?: number; // Timestamp
  lastSold?: number; // Timestamp
}

/**
 * ERP Financial Transaction
 */
export interface ERPFinancialTransaction {
  id: string;
  transactionNumber: string;
  type: TransactionType;
  amount: number;
  currency: string;
  account: string;
  accountId?: string;
  description: string;
  date: number; // Timestamp
  reference?: string; // Order ID, Invoice ID, etc.
  status: 'pending' | 'posted' | 'reconciled' | 'voided';
  category?: string;
}

/**
 * ERP HR Employee
 */
export interface ERPEmployee {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  department: string;
  position: string;
  status: EmployeeStatus;
  hireDate: number; // Timestamp
  salary?: number;
  managerId?: string;
  location?: string;
}

/**
 * ERP Manufacturing Order
 */
export interface ERPManufacturingOrder {
  id: string;
  orderNumber: string;
  productId: string;
  productName: string;
  quantity: number;
  status: ManufacturingOrderStatus;
  startDate?: number; // Timestamp
  completionDate?: number; // Timestamp
  materials: Array<{
    id: string;
    sku: string;
    name: string;
    quantity: number;
    unitCost: number;
  }>;
  laborCost?: number;
  overheadCost?: number;
  totalCost?: number;
}

/**
 * ERP Supply Chain Item
 */
export interface ERPSupplyItem {
  id: string;
  purchaseOrderNumber: string;
  supplier: string;
  supplierId?: string;
  item: string;
  itemId?: string;
  quantity: number;
  unitPrice: number;
  total: number;
  status: SupplyItemStatus;
  orderDate: number; // Timestamp
  expectedDelivery?: number; // Timestamp
  actualDelivery?: number; // Timestamp
}

/**
 * ERP Configuration
 */
export interface ERPEmulationConfig {
  erpType?: ERPType;
  apiEndpoint?: string;
  enableFinance?: boolean;
  enableHR?: boolean;
  enableSupplyChain?: boolean;
  enableManufacturing?: boolean;
  enableSales?: boolean;
  enableInventory?: boolean;
  enableReporting?: boolean;
  orders?: ERPOrder[];
  inventory?: ERPInventoryItem[];
  transactions?: ERPFinancialTransaction[];
  employees?: ERPEmployee[];
  manufacturingOrders?: ERPManufacturingOrder[];
  supplyItems?: ERPSupplyItem[];
  // Simulation parameters
  requestsPerSecond?: number;
  averageResponseTime?: number;
  errorRate?: number;
  orderProcessingTime?: number; // hours
  inventoryReplenishmentTime?: number; // hours
  manufacturingCycleTime?: number; // hours
}

/**
 * ERP Engine Metrics
 */
export interface ERPEngineMetrics {
  // Orders
  ordersTotal: number;
  ordersPending: number;
  ordersProcessing: number;
  ordersShipped: number;
  ordersDelivered: number;
  ordersValue: number; // Total value of all orders
  
  // Inventory
  inventoryItemsTotal: number;
  inventoryValue: number; // Total inventory value
  inventoryLowStock: number;
  inventoryOutOfStock: number;
  inventoryTurnover: number; // Annual turnover rate
  
  // Finance
  transactionsTotal: number;
  revenue: number; // Total revenue
  expenses: number; // Total expenses
  profit: number; // Revenue - Expenses
  accountsReceivable: number;
  accountsPayable: number;
  
  // HR
  employeesTotal: number;
  employeesActive: number;
  employeesOnLeave: number;
  totalPayroll: number; // Monthly payroll
  
  // Manufacturing
  manufacturingOrdersTotal: number;
  manufacturingOrdersInProgress: number;
  manufacturingOrdersCompleted: number;
  manufacturingCapacity: number; // 0-1 utilization
  
  // Supply Chain
  supplyItemsTotal: number;
  supplyItemsInTransit: number;
  supplyItemsDelayed: number;
  supplyValue: number; // Total value of supply orders
  
  // Performance metrics
  requestsPerSecond: number;
  averageResponseTime: number; // milliseconds
  errorRate: number; // 0-1
  
  // Utilization
  apiUtilization: number; // 0-1
  databaseUtilization: number; // 0-1
  systemUtilization: number; // 0-1
}

/**
 * ERP Emulation Engine
 * Симулирует работу ERP системы: заказы, инвентарь, финансы, HR, производство, цепочка поставок
 */
export class ERPEmulationEngine {
  private config: ERPEmulationConfig | null = null;
  
  // Data stores
  private orders: Map<string, ERPOrder> = new Map();
  private inventory: Map<string, ERPInventoryItem> = new Map();
  private transactions: Map<string, ERPFinancialTransaction> = new Map();
  private employees: Map<string, ERPEmployee> = new Map();
  private manufacturingOrders: Map<string, ERPManufacturingOrder> = new Map();
  private supplyItems: Map<string, ERPSupplyItem> = new Map();
  
  // Metrics
  private erpMetrics: ERPEngineMetrics = {
    ordersTotal: 0,
    ordersPending: 0,
    ordersProcessing: 0,
    ordersShipped: 0,
    ordersDelivered: 0,
    ordersValue: 0,
    inventoryItemsTotal: 0,
    inventoryValue: 0,
    inventoryLowStock: 0,
    inventoryOutOfStock: 0,
    inventoryTurnover: 0,
    transactionsTotal: 0,
    revenue: 0,
    expenses: 0,
    profit: 0,
    accountsReceivable: 0,
    accountsPayable: 0,
    employeesTotal: 0,
    employeesActive: 0,
    employeesOnLeave: 0,
    totalPayroll: 0,
    manufacturingOrdersTotal: 0,
    manufacturingOrdersInProgress: 0,
    manufacturingOrdersCompleted: 0,
    manufacturingCapacity: 0,
    supplyItemsTotal: 0,
    supplyItemsInTransit: 0,
    supplyItemsDelayed: 0,
    supplyValue: 0,
    requestsPerSecond: 0,
    averageResponseTime: 0,
    errorRate: 0,
    apiUtilization: 0,
    databaseUtilization: 0,
    systemUtilization: 0,
  };
  
  // Request history for metrics
  private requestHistory: Array<{ timestamp: number; latency: number; success: boolean }> = [];
  private readonly MAX_REQUEST_HISTORY = 1000;
  
  // Last update time
  private lastUpdateTime: number = Date.now();
  
  // Revenue/Expense tracking (for profit calculation)
  private monthlyRevenue: number = 0;
  private monthlyExpenses: number = 0;
  private lastMonthReset: number = Date.now();
  
  /**
   * Инициализирует конфигурацию ERP из конфига компонента
   */
  initializeConfig(node: CanvasNode): void {
    const config = node.data.config || {};
    
    this.config = {
      erpType: config.erpType || 'sap',
      apiEndpoint: config.apiEndpoint || 'https://sap.example.com',
      enableFinance: config.enableFinance ?? true,
      enableHR: config.enableHR ?? true,
      enableSupplyChain: config.enableSupplyChain ?? true,
      enableManufacturing: config.enableManufacturing ?? true,
      enableSales: config.enableSales ?? true,
      enableInventory: config.enableInventory ?? true,
      enableReporting: config.enableReporting ?? true,
      orders: config.orders || [],
      inventory: config.inventory || [],
      transactions: config.transactions || [],
      employees: config.employees || [],
      manufacturingOrders: config.manufacturingOrders || [],
      supplyItems: config.supplyItems || [],
      requestsPerSecond: config.requestsPerSecond || 50,
      averageResponseTime: config.averageResponseTime || 200,
      errorRate: config.errorRate || 0.01,
      orderProcessingTime: config.orderProcessingTime || 24, // hours
      inventoryReplenishmentTime: config.inventoryReplenishmentTime || 48, // hours
      manufacturingCycleTime: config.manufacturingCycleTime || 72, // hours
    };
    
    // Initialize data from config
    this.initializeOrders();
    this.initializeInventory();
    this.initializeTransactions();
    this.initializeEmployees();
    this.initializeManufacturingOrders();
    this.initializeSupplyItems();
  }
  
  /**
   * Инициализирует заказы из конфига
   */
  private initializeOrders(): void {
    this.orders.clear();
    if (this.config?.orders) {
      for (const order of this.config.orders) {
        this.orders.set(order.id, {
          ...order,
          orderDate: order.orderDate || Date.now(),
        });
      }
    }
  }
  
  /**
   * Инициализирует инвентарь из конфига
   */
  private initializeInventory(): void {
    this.inventory.clear();
    if (this.config?.inventory) {
      for (const item of this.config.inventory) {
        this.inventory.set(item.id, {
          ...item,
          lastRestocked: item.lastRestocked || Date.now(),
        });
      }
    }
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
          date: transaction.date || Date.now(),
        });
      }
    }
  }
  
  /**
   * Инициализирует сотрудников из конфига
   */
  private initializeEmployees(): void {
    this.employees.clear();
    if (this.config?.employees) {
      for (const employee of this.config.employees) {
        this.employees.set(employee.id, {
          ...employee,
          hireDate: employee.hireDate || Date.now(),
        });
      }
    }
  }
  
  /**
   * Инициализирует производственные заказы из конфига
   */
  private initializeManufacturingOrders(): void {
    this.manufacturingOrders.clear();
    if (this.config?.manufacturingOrders) {
      for (const order of this.config.manufacturingOrders) {
        this.manufacturingOrders.set(order.id, order);
      }
    }
  }
  
  /**
   * Инициализирует элементы цепочки поставок из конфига
   */
  private initializeSupplyItems(): void {
    this.supplyItems.clear();
    if (this.config?.supplyItems) {
      for (const item of this.config.supplyItems) {
        this.supplyItems.set(item.id, {
          ...item,
          orderDate: item.orderDate || Date.now(),
        });
      }
    }
  }
  
  /**
   * Выполняет один цикл обновления ERP
   * Должен вызываться периодически в EmulationEngine
   */
  performUpdate(currentTime: number, hasIncomingConnections: boolean = false): void {
    if (!this.config) return;
    
    const deltaTime = currentTime - this.lastUpdateTime;
    this.lastUpdateTime = currentTime;
    
    // Reset monthly metrics if needed
    if (currentTime - this.lastMonthReset > 30 * 24 * 3600000) { // 30 days
      this.monthlyRevenue = 0;
      this.monthlyExpenses = 0;
      this.lastMonthReset = currentTime;
    }
    
    // Simulate API requests if there are incoming connections
    if (hasIncomingConnections) {
      this.simulateAPIRequests(currentTime);
    }
    
    // Simulate order processing
    if (this.config.enableSales) {
      this.simulateOrderProcessing(currentTime);
    }
    
    // Simulate inventory replenishment
    if (this.config.enableInventory) {
      this.simulateInventoryReplenishment(currentTime);
    }
    
    // Simulate manufacturing
    if (this.config.enableManufacturing) {
      this.simulateManufacturing(currentTime);
    }
    
    // Simulate supply chain
    if (this.config.enableSupplyChain) {
      this.simulateSupplyChain(currentTime);
    }
    
    // Simulate financial transactions
    if (this.config.enableFinance) {
      this.simulateFinancialTransactions(currentTime);
    }
    
    // Update metrics
    this.updateMetrics();
  }
  
  /**
   * Симулирует API запросы к ERP
   */
  private simulateAPIRequests(currentTime: number): void {
    if (!this.config) return;
    
    const requestsPerSecond = this.config.requestsPerSecond || 50;
    const requestsPerUpdate = (requestsPerSecond * 0.1); // 100ms update interval
    
    for (let i = 0; i < requestsPerUpdate; i++) {
      if (Math.random() < 0.2) { // 20% chance per update cycle
        const latency = this.config.averageResponseTime || 200;
        const error = Math.random() < (this.config.errorRate || 0.01);
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
   * Симулирует обработку заказов
   */
  private simulateOrderProcessing(currentTime: number): void {
    if (!this.config) return;
    
    const processingTime = (this.config.orderProcessingTime || 24) * 3600000; // hours to ms
    
    for (const order of this.orders.values()) {
      if (order.status === 'delivered' || order.status === 'cancelled') continue;
      
      const orderAge = currentTime - order.orderDate;
      const progressProbability = Math.min(1, orderAge / processingTime);
      
      if (order.status === 'pending' && Math.random() < progressProbability * 0.01) {
        order.status = 'processing';
      } else if (order.status === 'processing' && Math.random() < progressProbability * 0.01) {
        order.status = 'shipped';
        order.expectedDelivery = currentTime + (24 * 3600000); // 24 hours
      } else if (order.status === 'shipped' && order.expectedDelivery && currentTime >= order.expectedDelivery) {
        order.status = 'delivered';
        order.actualDelivery = currentTime;
        
        // Create revenue transaction
        if (this.config.enableFinance) {
          this.createRevenueTransaction(order);
        }
        
        // Update inventory
        if (this.config.enableInventory) {
          this.updateInventoryFromOrder(order);
        }
      }
    }
  }
  
  /**
   * Создает транзакцию дохода из заказа
   */
  private createRevenueTransaction(order: ERPOrder): void {
    const transaction: ERPFinancialTransaction = {
      id: `txn-${order.id}-${Date.now()}`,
      transactionNumber: `TXN-${Date.now()}`,
      type: 'revenue',
      amount: order.total,
      currency: 'USD',
      account: 'Sales Revenue',
      description: `Revenue from order ${order.orderNumber}`,
      date: Date.now(),
      reference: order.id,
      status: 'posted',
      category: 'Sales',
    };
    
    this.transactions.set(transaction.id, transaction);
    this.monthlyRevenue += order.total;
  }
  
  /**
   * Обновляет инвентарь на основе заказа
   */
  private updateInventoryFromOrder(order: ERPOrder): void {
    for (const orderItem of order.items) {
      const inventoryItem = Array.from(this.inventory.values()).find(i => i.sku === orderItem.sku);
      if (inventoryItem) {
        inventoryItem.quantity = Math.max(0, inventoryItem.quantity - orderItem.quantity);
        inventoryItem.lastSold = Date.now();
        
        // Update status
        if (inventoryItem.quantity === 0) {
          inventoryItem.status = 'out-of-stock';
        } else if (inventoryItem.quantity <= inventoryItem.reorderLevel) {
          inventoryItem.status = 'low-stock';
        }
      }
    }
  }
  
  /**
   * Симулирует пополнение инвентаря
   */
  private simulateInventoryReplenishment(currentTime: number): void {
    if (!this.config) return;
    
    const replenishmentTime = (this.config.inventoryReplenishmentTime || 48) * 3600000; // hours to ms
    
    for (const item of this.inventory.values()) {
      if (item.status === 'low-stock' || item.status === 'out-of-stock') {
        // Check if we need to create a supply order
        if (!this.hasActiveSupplyOrder(item.id)) {
          // Auto-reorder if enabled
          if (item.quantity <= item.reorderLevel && this.config.enableSupplyChain) {
            this.createSupplyOrder(item, currentTime);
          }
        }
      }
      
      // Simulate restocking from supply orders
      const supplyItem = Array.from(this.supplyItems.values())
        .find(s => s.itemId === item.id && s.status === 'received');
      
      if (supplyItem && item.lastRestocked) {
        const timeSinceRestock = currentTime - item.lastRestocked;
        if (timeSinceRestock >= replenishmentTime) {
          item.quantity += supplyItem.quantity;
          item.lastRestocked = currentTime;
          
          // Update status
          if (item.quantity > item.reorderLevel) {
            item.status = 'in-stock';
          }
        }
      }
    }
  }
  
  /**
   * Проверяет наличие активного заказа поставки для товара
   */
  private hasActiveSupplyOrder(itemId: string): boolean {
    return Array.from(this.supplyItems.values()).some(s => 
      s.itemId === itemId && 
      (s.status === 'ordered' || s.status === 'in-transit')
    );
  }
  
  /**
   * Создает заказ поставки для товара
   */
  private createSupplyOrder(item: ERPInventoryItem, currentTime: number): void {
    const supplyItem: ERPSupplyItem = {
      id: `supply-${item.id}-${currentTime}`,
      purchaseOrderNumber: `PO-${Date.now()}`,
      supplier: item.supplier || 'Default Supplier',
      item: item.name,
      itemId: item.id,
      quantity: item.reorderQuantity || item.reorderLevel * 2,
      unitPrice: item.unitCost || item.unitPrice * 0.7, // Assume 30% margin
      total: (item.reorderQuantity || item.reorderLevel * 2) * (item.unitCost || item.unitPrice * 0.7),
      status: 'ordered',
      orderDate: currentTime,
      expectedDelivery: currentTime + (48 * 3600000), // 48 hours
    };
    
    this.supplyItems.set(supplyItem.id, supplyItem);
  }
  
  /**
   * Симулирует производство
   */
  private simulateManufacturing(currentTime: number): void {
    if (!this.config) return;
    
    const cycleTime = (this.config.manufacturingCycleTime || 72) * 3600000; // hours to ms
    
    for (const order of this.manufacturingOrders.values()) {
      if (order.status === 'completed' || order.status === 'cancelled') continue;
      
      if (order.status === 'planned' && Math.random() < 0.001) {
        order.status = 'released';
        order.startDate = currentTime;
      } else if (order.status === 'released' && Math.random() < 0.001) {
        order.status = 'in-progress';
      } else if (order.status === 'in-progress' && order.startDate) {
        const elapsed = currentTime - order.startDate;
        const progress = elapsed / cycleTime;
        
        if (progress >= 1 || Math.random() < 0.001) {
          order.status = 'completed';
          order.completionDate = currentTime;
          
          // Add to inventory
          if (this.config.enableInventory) {
            this.addManufacturedItemToInventory(order);
          }
        }
      }
    }
  }
  
  /**
   * Добавляет произведенный товар в инвентарь
   */
  private addManufacturedItemToInventory(order: ERPManufacturingOrder): void {
    let inventoryItem = Array.from(this.inventory.values()).find(i => i.id === order.productId);
    
    if (!inventoryItem) {
      // Create new inventory item
      inventoryItem = {
        id: order.productId,
        sku: `SKU-${order.productId}`,
        name: order.productName,
        category: 'Manufactured',
        quantity: 0,
        reservedQuantity: 0,
        reorderLevel: order.quantity * 0.2,
        reorderQuantity: order.quantity,
        unitPrice: (order.totalCost || 0) / order.quantity * 1.3, // 30% margin
        unitCost: (order.totalCost || 0) / order.quantity,
        status: 'in-stock',
        lastRestocked: Date.now(),
      };
    }
    
    inventoryItem.quantity += order.quantity;
    inventoryItem.lastRestocked = Date.now();
    
    if (inventoryItem.quantity > inventoryItem.reorderLevel) {
      inventoryItem.status = 'in-stock';
    }
    
    this.inventory.set(inventoryItem.id, inventoryItem);
  }
  
  /**
   * Симулирует цепочку поставок
   */
  private simulateSupplyChain(currentTime: number): void {
    for (const item of this.supplyItems.values()) {
      if (item.status === 'received' || item.status === 'cancelled') continue;
      
      if (item.status === 'ordered' && Math.random() < 0.001) {
        item.status = 'in-transit';
      } else if (item.status === 'in-transit' && item.expectedDelivery) {
        if (currentTime >= item.expectedDelivery) {
          if (Math.random() < 0.9) { // 90% on-time delivery
            item.status = 'received';
            item.actualDelivery = currentTime;
          } else {
            item.status = 'delayed';
            item.expectedDelivery = currentTime + (24 * 3600000); // Delay by 24 hours
          }
        }
      } else if (item.status === 'delayed' && item.expectedDelivery && currentTime >= item.expectedDelivery) {
        item.status = 'received';
        item.actualDelivery = currentTime;
      }
    }
  }
  
  /**
   * Симулирует финансовые транзакции
   */
  private simulateFinancialTransactions(currentTime: number): void {
    // Generate periodic transactions based on orders, supply items, etc.
    if (Math.random() < 0.001) { // Small chance per update
      // Create expense transaction for supply items
      const pendingSupplyItems = Array.from(this.supplyItems.values())
        .filter(s => s.status === 'received' && !this.hasTransactionForSupply(s.id));
      
      if (pendingSupplyItems.length > 0) {
        const supplyItem = pendingSupplyItems[0];
        const transaction: ERPFinancialTransaction = {
          id: `txn-supply-${supplyItem.id}`,
          transactionNumber: `TXN-${Date.now()}`,
          type: 'expense',
          amount: supplyItem.total,
          currency: 'USD',
          account: 'Cost of Goods Sold',
          description: `Purchase from ${supplyItem.supplier}`,
          date: currentTime,
          reference: supplyItem.id,
          status: 'posted',
          category: 'Purchasing',
        };
        
        this.transactions.set(transaction.id, transaction);
        this.monthlyExpenses += supplyItem.total;
      }
    }
  }
  
  /**
   * Проверяет наличие транзакции для заказа поставки
   */
  private hasTransactionForSupply(supplyId: string): boolean {
    return Array.from(this.transactions.values()).some(t => t.reference === supplyId);
  }
  
  /**
   * Обновляет метрики на основе текущего состояния
   */
  private updateMetrics(): void {
    // Orders metrics
    this.erpMetrics.ordersTotal = this.orders.size;
    this.erpMetrics.ordersPending = Array.from(this.orders.values()).filter(o => o.status === 'pending').length;
    this.erpMetrics.ordersProcessing = Array.from(this.orders.values()).filter(o => o.status === 'processing').length;
    this.erpMetrics.ordersShipped = Array.from(this.orders.values()).filter(o => o.status === 'shipped').length;
    this.erpMetrics.ordersDelivered = Array.from(this.orders.values()).filter(o => o.status === 'delivered').length;
    this.erpMetrics.ordersValue = Array.from(this.orders.values())
      .filter(o => o.status !== 'cancelled')
      .reduce((sum, o) => sum + o.total, 0);
    
    // Inventory metrics
    this.erpMetrics.inventoryItemsTotal = this.inventory.size;
    this.erpMetrics.inventoryValue = Array.from(this.inventory.values())
      .reduce((sum, i) => sum + (i.quantity * i.unitPrice), 0);
    this.erpMetrics.inventoryLowStock = Array.from(this.inventory.values())
      .filter(i => i.status === 'low-stock').length;
    this.erpMetrics.inventoryOutOfStock = Array.from(this.inventory.values())
      .filter(i => i.status === 'out-of-stock').length;
    
    // Calculate inventory turnover (simplified)
    const totalCost = Array.from(this.inventory.values())
      .reduce((sum, i) => sum + (i.quantity * i.unitCost), 0);
    const sales = this.monthlyRevenue;
    this.erpMetrics.inventoryTurnover = totalCost > 0 ? (sales / totalCost) * 12 : 0; // Annualized
    
    // Finance metrics
    this.erpMetrics.transactionsTotal = this.transactions.size;
    this.erpMetrics.revenue = this.monthlyRevenue;
    this.erpMetrics.expenses = this.monthlyExpenses;
    this.erpMetrics.profit = this.monthlyRevenue - this.monthlyExpenses;
    
    // Accounts Receivable (unpaid orders)
    this.erpMetrics.accountsReceivable = Array.from(this.orders.values())
      .filter(o => o.status !== 'delivered' && o.status !== 'cancelled')
      .reduce((sum, o) => sum + o.total, 0);
    
    // Accounts Payable (unpaid supply items)
    this.erpMetrics.accountsPayable = Array.from(this.supplyItems.values())
      .filter(s => s.status === 'received' && !this.hasTransactionForSupply(s.id))
      .reduce((sum, s) => sum + s.total, 0);
    
    // HR metrics
    this.erpMetrics.employeesTotal = this.employees.size;
    this.erpMetrics.employeesActive = Array.from(this.employees.values())
      .filter(e => e.status === 'active').length;
    this.erpMetrics.employeesOnLeave = Array.from(this.employees.values())
      .filter(e => e.status === 'on-leave').length;
    this.erpMetrics.totalPayroll = Array.from(this.employees.values())
      .filter(e => e.status === 'active' && e.salary)
      .reduce((sum, e) => sum + (e.salary || 0), 0);
    
    // Manufacturing metrics
    this.erpMetrics.manufacturingOrdersTotal = this.manufacturingOrders.size;
    this.erpMetrics.manufacturingOrdersInProgress = Array.from(this.manufacturingOrders.values())
      .filter(o => o.status === 'in-progress').length;
    this.erpMetrics.manufacturingOrdersCompleted = Array.from(this.manufacturingOrders.values())
      .filter(o => o.status === 'completed').length;
    this.erpMetrics.manufacturingCapacity = Math.min(1, 
      this.erpMetrics.manufacturingOrdersInProgress / Math.max(1, this.erpMetrics.manufacturingOrdersTotal * 0.5)
    );
    
    // Supply Chain metrics
    this.erpMetrics.supplyItemsTotal = this.supplyItems.size;
    this.erpMetrics.supplyItemsInTransit = Array.from(this.supplyItems.values())
      .filter(s => s.status === 'in-transit').length;
    this.erpMetrics.supplyItemsDelayed = Array.from(this.supplyItems.values())
      .filter(s => s.status === 'delayed').length;
    this.erpMetrics.supplyValue = Array.from(this.supplyItems.values())
      .filter(s => s.status !== 'cancelled')
      .reduce((sum, s) => sum + s.total, 0);
    
    // Performance metrics from request history
    if (this.requestHistory.length > 0) {
      const recentRequests = this.requestHistory.slice(-100); // Last 100 requests
      const timeWindow = 10000; // 10 seconds
      const recentTime = Date.now() - timeWindow;
      const requestsInWindow = recentRequests.filter(r => r.timestamp >= recentTime);
      
      this.erpMetrics.requestsPerSecond = requestsInWindow.length / (timeWindow / 1000);
      this.erpMetrics.averageResponseTime = recentRequests.reduce((sum, r) => sum + r.latency, 0) / recentRequests.length;
      this.erpMetrics.errorRate = recentRequests.filter(r => !r.success).length / recentRequests.length;
    }
    
    // Utilization
    const maxRequestsPerSecond = this.config?.requestsPerSecond || 50;
    this.erpMetrics.apiUtilization = Math.min(1, this.erpMetrics.requestsPerSecond / maxRequestsPerSecond);
    this.erpMetrics.databaseUtilization = Math.min(1, 
      (this.orders.size + this.inventory.size + this.transactions.size + this.employees.size) / 50000
    );
    this.erpMetrics.systemUtilization = Math.max(
      this.erpMetrics.apiUtilization,
      this.erpMetrics.databaseUtilization,
      this.erpMetrics.manufacturingCapacity
    );
  }
  
  /**
   * Возвращает текущие метрики
   */
  getMetrics(): ERPEngineMetrics {
    return { ...this.erpMetrics };
  }
  
  /**
   * Возвращает все заказы
   */
  getOrders(): ERPOrder[] {
    return Array.from(this.orders.values());
  }
  
  /**
   * Возвращает все элементы инвентаря
   */
  getInventory(): ERPInventoryItem[] {
    return Array.from(this.inventory.values());
  }
  
  /**
   * Возвращает все транзакции
   */
  getTransactions(): ERPFinancialTransaction[] {
    return Array.from(this.transactions.values());
  }
  
  /**
   * Возвращает всех сотрудников
   */
  getEmployees(): ERPEmployee[] {
    return Array.from(this.employees.values());
  }
  
  /**
   * Возвращает все производственные заказы
   */
  getManufacturingOrders(): ERPManufacturingOrder[] {
    return Array.from(this.manufacturingOrders.values());
  }
  
  /**
   * Возвращает все элементы цепочки поставок
   */
  getSupplyItems(): ERPSupplyItem[] {
    return Array.from(this.supplyItems.values());
  }
  
  // CRUD operations for Orders
  addOrder(order: ERPOrder): void {
    this.orders.set(order.id, order);
    this.updateMetrics();
  }
  
  updateOrder(id: string, updates: Partial<ERPOrder>): void {
    const order = this.orders.get(id);
    if (order) {
      this.orders.set(id, { ...order, ...updates });
      this.updateMetrics();
    }
  }
  
  removeOrder(id: string): void {
    this.orders.delete(id);
    this.updateMetrics();
  }
  
  // CRUD operations for Inventory
  addInventoryItem(item: ERPInventoryItem): void {
    this.inventory.set(item.id, item);
    this.updateMetrics();
  }
  
  updateInventoryItem(id: string, updates: Partial<ERPInventoryItem>): void {
    const item = this.inventory.get(id);
    if (item) {
      this.inventory.set(id, { ...item, ...updates });
      this.updateMetrics();
    }
  }
  
  removeInventoryItem(id: string): void {
    this.inventory.delete(id);
    this.updateMetrics();
  }
  
  // CRUD operations for Transactions
  addTransaction(transaction: ERPFinancialTransaction): void {
    this.transactions.set(transaction.id, transaction);
    if (transaction.type === 'revenue') {
      this.monthlyRevenue += transaction.amount;
    } else if (transaction.type === 'expense') {
      this.monthlyExpenses += transaction.amount;
    }
    this.updateMetrics();
  }
  
  updateTransaction(id: string, updates: Partial<ERPFinancialTransaction>): void {
    const transaction = this.transactions.get(id);
    if (transaction) {
      // Adjust revenue/expenses if amount changed
      if (updates.amount !== undefined) {
        if (transaction.type === 'revenue') {
          this.monthlyRevenue = this.monthlyRevenue - transaction.amount + updates.amount;
        } else if (transaction.type === 'expense') {
          this.monthlyExpenses = this.monthlyExpenses - transaction.amount + updates.amount;
        }
      }
      
      this.transactions.set(id, { ...transaction, ...updates });
      this.updateMetrics();
    }
  }
  
  removeTransaction(id: string): void {
    const transaction = this.transactions.get(id);
    if (transaction) {
      if (transaction.type === 'revenue') {
        this.monthlyRevenue -= transaction.amount;
      } else if (transaction.type === 'expense') {
        this.monthlyExpenses -= transaction.amount;
      }
      this.transactions.delete(id);
      this.updateMetrics();
    }
  }
  
  // CRUD operations for Employees
  addEmployee(employee: ERPEmployee): void {
    this.employees.set(employee.id, employee);
    this.updateMetrics();
  }
  
  updateEmployee(id: string, updates: Partial<ERPEmployee>): void {
    const employee = this.employees.get(id);
    if (employee) {
      this.employees.set(id, { ...employee, ...updates });
      this.updateMetrics();
    }
  }
  
  removeEmployee(id: string): void {
    this.employees.delete(id);
    this.updateMetrics();
  }
  
  // CRUD operations for Manufacturing Orders
  addManufacturingOrder(order: ERPManufacturingOrder): void {
    this.manufacturingOrders.set(order.id, order);
    this.updateMetrics();
  }
  
  updateManufacturingOrder(id: string, updates: Partial<ERPManufacturingOrder>): void {
    const order = this.manufacturingOrders.get(id);
    if (order) {
      this.manufacturingOrders.set(id, { ...order, ...updates });
      this.updateMetrics();
    }
  }
  
  removeManufacturingOrder(id: string): void {
    this.manufacturingOrders.delete(id);
    this.updateMetrics();
  }
  
  // CRUD operations for Supply Items
  addSupplyItem(item: ERPSupplyItem): void {
    this.supplyItems.set(item.id, item);
    this.updateMetrics();
  }
  
  updateSupplyItem(id: string, updates: Partial<ERPSupplyItem>): void {
    const item = this.supplyItems.get(id);
    if (item) {
      this.supplyItems.set(id, { ...item, ...updates });
      this.updateMetrics();
    }
  }
  
  removeSupplyItem(id: string): void {
    this.supplyItems.delete(id);
    this.updateMetrics();
  }
  
  /**
   * Синхронизирует данные с конфигом компонента
   */
  syncToConfig(): ERPEmulationConfig {
    return {
      ...this.config,
      orders: this.getOrders(),
      inventory: this.getInventory(),
      transactions: this.getTransactions(),
      employees: this.getEmployees(),
      manufacturingOrders: this.getManufacturingOrders(),
      supplyItems: this.getSupplyItems(),
    };
  }
}

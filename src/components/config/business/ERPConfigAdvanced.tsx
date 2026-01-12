import { useCanvasStore } from '@/store/useCanvasStore';
import { useEmulationStore } from '@/store/useEmulationStore';
import { emulationEngine } from '@/core/EmulationEngine';
import { CanvasNode } from '@/types';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect, useMemo } from 'react';
import { 
  Settings, 
  Activity,
  Plus,
  Trash2,
  Edit,
  RefreshCcw,
  Building,
  Package,
  Users,
  DollarSign,
  TrendingUp,
  FileText,
  Search,
  Filter,
  X,
  AlertCircle,
  Factory,
  Truck,
  BarChart3,
  CreditCard,
  Briefcase,
  Calendar,
  Clock,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Loader2
} from 'lucide-react';
import type {
  ERPOrder,
  ERPInventoryItem,
  ERPFinancialTransaction,
  ERPEmployee,
  ERPManufacturingOrder,
  ERPSupplyItem,
  OrderStatus,
  InventoryStatus,
  TransactionType,
  EmployeeStatus,
  ManufacturingOrderStatus,
  SupplyItemStatus,
  ERPEmulationConfig
} from '@/core/ERPEmulationEngine';

interface ERPConfigProps {
  componentId: string;
}

interface ERPConfig extends ERPEmulationConfig {
  // Extended config with all ERP modules
}

export function ERPConfigAdvanced({ componentId }: ERPConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const { getComponentMetrics } = useEmulationStore();
  const { toast } = useToast();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  // Get ERP emulation engine for real-time metrics
  const erpEngine = emulationEngine.getERPEmulationEngine(componentId);
  const componentMetrics = getComponentMetrics(componentId);
  const customMetrics = componentMetrics?.customMetrics || {};

  const config = (node.data.config as any) || {} as ERPConfig;
  const orders = config.orders || [];
  const inventory = config.inventory || [];
  const transactions = config.transactions || [];
  const employees = config.employees || [];
  const manufacturingOrders = config.manufacturingOrders || [];
  const supplyItems = config.supplyItems || [];

  // Get real-time metrics from emulation engine or fallback to config
  const erpMetrics = erpEngine?.getMetrics();
  const totalOrders = erpMetrics?.ordersTotal ?? orders.length;
  const totalInventory = erpMetrics?.inventoryItemsTotal ?? inventory.length;
  const inventoryValue = erpMetrics?.inventoryValue ?? inventory.reduce((sum, i) => sum + (i.quantity * i.unitPrice), 0);
  const lowStockItems = erpMetrics?.inventoryLowStock ?? inventory.filter((i) => i.status === 'low-stock' || i.status === 'out-of-stock').length;
  const revenue = erpMetrics?.revenue ?? 0;
  const expenses = erpMetrics?.expenses ?? 0;
  const profit = erpMetrics?.profit ?? 0;
  const accountsReceivable = erpMetrics?.accountsReceivable ?? 0;
  const accountsPayable = erpMetrics?.accountsPayable ?? 0;
  const employeesTotal = erpMetrics?.employeesTotal ?? employees.length;
  const employeesActive = erpMetrics?.employeesActive ?? employees.filter(e => e.status === 'active').length;
  const totalPayroll = erpMetrics?.totalPayroll ?? employees.filter(e => e.status === 'active' && e.salary).reduce((sum, e) => sum + (e.salary || 0), 0);
  const manufacturingOrdersTotal = erpMetrics?.manufacturingOrdersTotal ?? manufacturingOrders.length;
  const manufacturingOrdersInProgress = erpMetrics?.manufacturingOrdersInProgress ?? manufacturingOrders.filter(o => o.status === 'in-progress').length;
  const manufacturingCapacity = erpMetrics?.manufacturingCapacity ?? 0;
  const supplyItemsTotal = erpMetrics?.supplyItemsTotal ?? supplyItems.length;
  const supplyItemsInTransit = erpMetrics?.supplyItemsInTransit ?? supplyItems.filter(s => s.status === 'in-transit').length;
  const supplyItemsDelayed = erpMetrics?.supplyItemsDelayed ?? supplyItems.filter(s => s.status === 'delayed').length;
  const supplyValue = erpMetrics?.supplyValue ?? supplyItems.filter(s => s.status !== 'cancelled').reduce((sum, s) => sum + s.total, 0);

  // State for dialogs
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [inventoryDialogOpen, setInventoryDialogOpen] = useState(false);
  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false);
  const [employeeDialogOpen, setEmployeeDialogOpen] = useState(false);
  const [manufacturingDialogOpen, setManufacturingDialogOpen] = useState(false);
  const [supplyDialogOpen, setSupplyDialogOpen] = useState(false);

  // State for editing
  const [editingOrder, setEditingOrder] = useState<ERPOrder | null>(null);
  const [editingInventory, setEditingInventory] = useState<ERPInventoryItem | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<ERPFinancialTransaction | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<ERPEmployee | null>(null);
  const [editingManufacturing, setEditingManufacturing] = useState<ERPManufacturingOrder | null>(null);
  const [editingSupply, setEditingSupply] = useState<ERPSupplyItem | null>(null);

  // State for form items (order items and manufacturing materials)
  const [orderFormItems, setOrderFormItems] = useState<Array<{ id: string; sku: string; name: string; quantity: number; unitPrice: number; total: number }>>([]);
  const [manufacturingFormMaterials, setManufacturingFormMaterials] = useState<Array<{ id: string; sku: string; name: string; quantity: number; unitCost: number }>>([]);

  // State for form validation errors
  const [inventoryErrors, setInventoryErrors] = useState<Record<string, string>>({});
  const [employeeErrors, setEmployeeErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  // State for search and filters
  const [searchQuery, setSearchQuery] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');
  const [inventoryStatusFilter, setInventoryStatusFilter] = useState<string>('all');
  const [transactionTypeFilter, setTransactionTypeFilter] = useState<string>('all');
  const [employeeStatusFilter, setEmployeeStatusFilter] = useState<string>('all');
  const [manufacturingStatusFilter, setManufacturingStatusFilter] = useState<string>('all');
  const [supplyStatusFilter, setSupplyStatusFilter] = useState<string>('all');

  // State for delete confirmations
  const [deleteOrderConfirm, setDeleteOrderConfirm] = useState<string | null>(null);
  const [deleteInventoryConfirm, setDeleteInventoryConfirm] = useState<string | null>(null);
  const [deleteTransactionConfirm, setDeleteTransactionConfirm] = useState<string | null>(null);
  const [deleteEmployeeConfirm, setDeleteEmployeeConfirm] = useState<string | null>(null);
  const [deleteManufacturingConfirm, setDeleteManufacturingConfirm] = useState<string | null>(null);
  const [deleteSupplyConfirm, setDeleteSupplyConfirm] = useState<string | null>(null);

  // State for sorting
  const [orderSortField, setOrderSortField] = useState<string>('orderDate');
  const [orderSortDirection, setOrderSortDirection] = useState<'asc' | 'desc'>('desc');
  const [inventorySortField, setInventorySortField] = useState<string>('name');
  const [inventorySortDirection, setInventorySortDirection] = useState<'asc' | 'desc'>('asc');
  const [transactionSortField, setTransactionSortField] = useState<string>('date');
  const [transactionSortDirection, setTransactionSortDirection] = useState<'asc' | 'desc'>('desc');
  const [employeeSortField, setEmployeeSortField] = useState<string>('lastName');
  const [employeeSortDirection, setEmployeeSortDirection] = useState<'asc' | 'desc'>('asc');
  const [manufacturingSortField, setManufacturingSortField] = useState<string>('orderNumber');
  const [manufacturingSortDirection, setManufacturingSortDirection] = useState<'asc' | 'desc'>('desc');
  const [supplySortField, setSupplySortField] = useState<string>('orderDate');
  const [supplySortDirection, setSupplySortDirection] = useState<'asc' | 'desc'>('desc');

  // Sync with emulation engine
  useEffect(() => {
    if (erpEngine) {
      // Sync data from engine to config
      const engineData = erpEngine.syncToConfig();
      if (engineData.orders && engineData.orders.length !== orders.length) {
        updateConfig({ orders: engineData.orders });
      }
      if (engineData.inventory && engineData.inventory.length !== inventory.length) {
        updateConfig({ inventory: engineData.inventory });
      }
      if (engineData.transactions && engineData.transactions.length !== transactions.length) {
        updateConfig({ transactions: engineData.transactions });
      }
      if (engineData.employees && engineData.employees.length !== employees.length) {
        updateConfig({ employees: engineData.employees });
      }
      if (engineData.manufacturingOrders && engineData.manufacturingOrders.length !== manufacturingOrders.length) {
        updateConfig({ manufacturingOrders: engineData.manufacturingOrders });
      }
      if (engineData.supplyItems && engineData.supplyItems.length !== supplyItems.length) {
        updateConfig({ supplyItems: engineData.supplyItems });
      }
    }
  }, [erpEngine, orders.length, inventory.length, transactions.length, employees.length, manufacturingOrders.length, supplyItems.length]);

  const updateConfig = (updates: Partial<ERPConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  // Orders CRUD
  const openOrderDialog = (order?: ERPOrder) => {
    setEditingOrder(order || null);
    setOrderFormItems(order?.items || []);
    setOrderDialogOpen(true);
  };

  const saveOrder = (orderData: Partial<ERPOrder>) => {
    if (!orderData.orderNumber || !orderData.customer || !orderData.items || orderData.items.length === 0) {
      toast({
        title: 'Validation error',
        description: 'Order number, customer, and at least one item are required',
        variant: 'destructive',
      });
      return;
    }

    const total = orderData.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    const updatedOrders = editingOrder
      ? orders.map(o => o.id === editingOrder.id ? { ...o, ...orderData, total } as ERPOrder : o)
      : [...orders, {
          id: `order-${Date.now()}`,
          orderNumber: orderData.orderNumber!,
          customer: orderData.customer!,
          customerId: orderData.customerId,
          status: orderData.status || 'pending',
          total,
          items: orderData.items!,
          orderDate: orderData.orderDate || Date.now(),
          expectedDelivery: orderData.expectedDelivery,
          shippingAddress: orderData.shippingAddress,
          billingAddress: orderData.billingAddress,
          paymentMethod: orderData.paymentMethod,
          notes: orderData.notes,
        } as ERPOrder];

    updateConfig({ orders: updatedOrders });
    
    if (erpEngine) {
      if (editingOrder) {
        erpEngine.updateOrder(editingOrder.id, { ...orderData, total } as Partial<ERPOrder>);
      } else {
        const newOrder = updatedOrders[updatedOrders.length - 1];
        erpEngine.addOrder(newOrder);
      }
    }

    setOrderDialogOpen(false);
    toast({
      title: editingOrder ? 'Order updated' : 'Order created',
      description: `Order ${orderData.orderNumber} has been ${editingOrder ? 'updated' : 'created'}.`,
    });
  };

  const removeOrder = (id: string) => {
    const order = orders.find(o => o.id === id);
    setDeleteOrderConfirm(id);
  };

  const confirmRemoveOrder = () => {
    if (!deleteOrderConfirm) return;
    const order = orders.find(o => o.id === deleteOrderConfirm);
    updateConfig({ orders: orders.filter((o) => o.id !== deleteOrderConfirm) });
    if (erpEngine) {
      erpEngine.removeOrder(deleteOrderConfirm);
    }
    toast({
      title: 'Order removed',
      description: `Order ${order?.orderNumber || ''} has been removed.`,
    });
    setDeleteOrderConfirm(null);
  };

  // Inventory CRUD
  const openInventoryDialog = (item?: ERPInventoryItem) => {
    setEditingInventory(item || null);
    setInventoryErrors({});
    setInventoryDialogOpen(true);
  };

  // Validation functions
  const validateEmail = (email: string): string => {
    if (!email) return '';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) ? '' : 'Invalid email format';
  };

  const validateInventoryItem = (itemData: Partial<ERPInventoryItem>): Record<string, string> => {
    const errors: Record<string, string> = {};
    
    if (!itemData.sku || itemData.sku.trim() === '') {
      errors.sku = 'SKU is required';
    } else {
      // Check SKU uniqueness
      const existingItem = inventory.find(i => 
        i.sku.toLowerCase() === itemData.sku!.toLowerCase() && 
        (!editingInventory || i.id !== editingInventory.id)
      );
      if (existingItem) {
        errors.sku = 'SKU must be unique';
      }
    }
    
    if (!itemData.name || itemData.name.trim() === '') {
      errors.name = 'Name is required';
    }
    
    if (itemData.quantity === undefined || itemData.quantity < 0) {
      errors.quantity = 'Quantity must be a non-negative number';
    }
    
    if (itemData.reorderLevel !== undefined && itemData.reorderLevel < 0) {
      errors.reorderLevel = 'Reorder level cannot be negative';
    }
    
    if (itemData.unitPrice !== undefined && itemData.unitPrice < 0) {
      errors.unitPrice = 'Unit price cannot be negative';
    }
    
    if (itemData.unitCost !== undefined && itemData.unitCost < 0) {
      errors.unitCost = 'Unit cost cannot be negative';
    }
    
    return errors;
  };

  const validateEmployee = (employeeData: Partial<ERPEmployee>): Record<string, string> => {
    const errors: Record<string, string> = {};
    
    if (!employeeData.employeeNumber || employeeData.employeeNumber.trim() === '') {
      errors.employeeNumber = 'Employee number is required';
    } else {
      // Check employee number uniqueness
      const existingEmployee = employees.find(e => 
        e.employeeNumber.toLowerCase() === employeeData.employeeNumber!.toLowerCase() && 
        (!editingEmployee || e.id !== editingEmployee.id)
      );
      if (existingEmployee) {
        errors.employeeNumber = 'Employee number must be unique';
      }
    }
    
    if (!employeeData.firstName || employeeData.firstName.trim() === '') {
      errors.firstName = 'First name is required';
    }
    
    if (!employeeData.lastName || employeeData.lastName.trim() === '') {
      errors.lastName = 'Last name is required';
    }
    
    if (employeeData.email && employeeData.email.trim() !== '') {
      const emailError = validateEmail(employeeData.email);
      if (emailError) {
        errors.email = emailError;
      }
    }
    
    if (employeeData.salary !== undefined && employeeData.salary < 0) {
      errors.salary = 'Salary cannot be negative';
    }
    
    return errors;
  };

  const saveInventoryItem = (itemData: Partial<ERPInventoryItem>) => {
    const errors = validateInventoryItem(itemData);
    setInventoryErrors(errors);
    
    if (Object.keys(errors).length > 0) {
      toast({
        title: 'Validation error',
        description: 'Please fix the errors in the form',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    // Auto-update status based on quantity
    let status: InventoryStatus = 'in-stock';
    if (itemData.quantity === 0) {
      status = 'out-of-stock';
    } else if (itemData.reorderLevel && itemData.quantity <= itemData.reorderLevel) {
      status = 'low-stock';
    }

    const updatedInventory = editingInventory
      ? inventory.map(i => i.id === editingInventory.id ? { ...i, ...itemData, status } as ERPInventoryItem : i)
      : [...inventory, {
          id: `inventory-${Date.now()}`,
          sku: itemData.sku!,
          name: itemData.name!,
          category: itemData.category || 'General',
          quantity: itemData.quantity!,
          reservedQuantity: itemData.reservedQuantity || 0,
          reorderLevel: itemData.reorderLevel || 10,
          reorderQuantity: itemData.reorderQuantity || 20,
          unitPrice: itemData.unitPrice || 0,
          unitCost: itemData.unitCost || 0,
          status,
          location: itemData.location,
          supplier: itemData.supplier,
          lastRestocked: itemData.lastRestocked || Date.now(),
        } as ERPInventoryItem];

    try {
      updateConfig({ inventory: updatedInventory });
      
      if (erpEngine) {
        if (editingInventory) {
          erpEngine.updateInventoryItem(editingInventory.id, { ...itemData, status } as Partial<ERPInventoryItem>);
        } else {
          const newItem = updatedInventory[updatedInventory.length - 1];
          erpEngine.addInventoryItem(newItem);
        }
      }

      setInventoryDialogOpen(false);
      setInventoryErrors({});
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save inventory item',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
    toast({
      title: editingInventory ? 'Inventory item updated' : 'Inventory item created',
      description: `Item ${itemData.sku} has been ${editingInventory ? 'updated' : 'created'}.`,
    });
  };

  const removeInventoryItem = (id: string) => {
    setDeleteInventoryConfirm(id);
  };

  const confirmRemoveInventoryItem = () => {
    if (!deleteInventoryConfirm) return;
    const item = inventory.find(i => i.id === deleteInventoryConfirm);
    updateConfig({ inventory: inventory.filter((i) => i.id !== deleteInventoryConfirm) });
    if (erpEngine) {
      erpEngine.removeInventoryItem(deleteInventoryConfirm);
    }
    toast({
      title: 'Inventory item removed',
      description: `Item ${item?.sku || ''} has been removed.`,
    });
    setDeleteInventoryConfirm(null);
  };

  // Transactions CRUD
  const openTransactionDialog = (transaction?: ERPFinancialTransaction) => {
    setEditingTransaction(transaction || null);
    setTransactionDialogOpen(true);
  };

  const saveTransaction = (transactionData: Partial<ERPFinancialTransaction>) => {
    if (!transactionData.transactionNumber || !transactionData.type || !transactionData.amount) {
      toast({
        title: 'Validation error',
        description: 'Transaction number, type, and amount are required',
        variant: 'destructive',
      });
      return;
    }

    const updatedTransactions = editingTransaction
      ? transactions.map(t => t.id === editingTransaction.id ? { ...t, ...transactionData } as ERPFinancialTransaction : t)
      : [...transactions, {
          id: `transaction-${Date.now()}`,
          transactionNumber: transactionData.transactionNumber!,
          type: transactionData.type!,
          amount: transactionData.amount!,
          currency: transactionData.currency || 'USD',
          account: transactionData.account || 'General',
          accountId: transactionData.accountId,
          description: transactionData.description || '',
          date: transactionData.date || Date.now(),
          reference: transactionData.reference,
          status: transactionData.status || 'pending',
          category: transactionData.category,
        } as ERPFinancialTransaction];

    updateConfig({ transactions: updatedTransactions });
    
    if (erpEngine) {
      if (editingTransaction) {
        erpEngine.updateTransaction(editingTransaction.id, transactionData as Partial<ERPFinancialTransaction>);
      } else {
        const newTransaction = updatedTransactions[updatedTransactions.length - 1];
        erpEngine.addTransaction(newTransaction);
      }
    }

    setTransactionDialogOpen(false);
    toast({
      title: editingTransaction ? 'Transaction updated' : 'Transaction created',
      description: `Transaction ${transactionData.transactionNumber} has been ${editingTransaction ? 'updated' : 'created'}.`,
    });
  };

  const removeTransaction = (id: string) => {
    setDeleteTransactionConfirm(id);
  };

  const confirmRemoveTransaction = () => {
    if (!deleteTransactionConfirm) return;
    const transaction = transactions.find(t => t.id === deleteTransactionConfirm);
    updateConfig({ transactions: transactions.filter((t) => t.id !== deleteTransactionConfirm) });
    if (erpEngine) {
      erpEngine.removeTransaction(deleteTransactionConfirm);
    }
    toast({
      title: 'Transaction removed',
      description: `Transaction ${transaction?.transactionNumber || ''} has been removed.`,
    });
    setDeleteTransactionConfirm(null);
  };

  // Employees CRUD
  const openEmployeeDialog = (employee?: ERPEmployee) => {
    setEditingEmployee(employee || null);
    setEmployeeErrors({});
    setEmployeeDialogOpen(true);
  };

  const saveEmployee = (employeeData: Partial<ERPEmployee>) => {
    const errors = validateEmployee(employeeData);
    setEmployeeErrors(errors);
    
    if (Object.keys(errors).length > 0) {
      toast({
        title: 'Validation error',
        description: 'Please fix the errors in the form',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    const updatedEmployees = editingEmployee
      ? employees.map(e => e.id === editingEmployee.id ? { ...e, ...employeeData } as ERPEmployee : e)
      : [...employees, {
          id: `employee-${Date.now()}`,
          employeeNumber: employeeData.employeeNumber!,
          firstName: employeeData.firstName!,
          lastName: employeeData.lastName!,
          email: employeeData.email,
          phone: employeeData.phone,
          department: employeeData.department || 'General',
          position: employeeData.position || 'Employee',
          status: employeeData.status || 'active',
          hireDate: employeeData.hireDate || Date.now(),
          salary: employeeData.salary,
          managerId: employeeData.managerId,
          location: employeeData.location,
        } as ERPEmployee];

    try {
      updateConfig({ employees: updatedEmployees });
      
      if (erpEngine) {
        if (editingEmployee) {
          erpEngine.updateEmployee(editingEmployee.id, employeeData as Partial<ERPEmployee>);
        } else {
          const newEmployee = updatedEmployees[updatedEmployees.length - 1];
          erpEngine.addEmployee(newEmployee);
        }
      }

      setEmployeeDialogOpen(false);
      setEmployeeErrors({});
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save employee',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
    toast({
      title: editingEmployee ? 'Employee updated' : 'Employee created',
      description: `Employee ${employeeData.employeeNumber} has been ${editingEmployee ? 'updated' : 'created'}.`,
    });
  };

  const removeEmployee = (id: string) => {
    setDeleteEmployeeConfirm(id);
  };

  const confirmRemoveEmployee = () => {
    if (!deleteEmployeeConfirm) return;
    const employee = employees.find(e => e.id === deleteEmployeeConfirm);
    updateConfig({ employees: employees.filter((e) => e.id !== deleteEmployeeConfirm) });
    if (erpEngine) {
      erpEngine.removeEmployee(deleteEmployeeConfirm);
    }
    toast({
      title: 'Employee removed',
      description: `Employee ${employee?.employeeNumber || ''} has been removed.`,
    });
    setDeleteEmployeeConfirm(null);
  };

  // Manufacturing Orders CRUD
  const openManufacturingDialog = (order?: ERPManufacturingOrder) => {
    setEditingManufacturing(order || null);
    setManufacturingFormMaterials(order?.materials || []);
    setManufacturingDialogOpen(true);
  };

  const saveManufacturingOrder = (orderData: Partial<ERPManufacturingOrder>) => {
    if (!orderData.orderNumber || !orderData.productId || !orderData.productName || !orderData.quantity) {
      toast({
        title: 'Validation error',
        description: 'Order number, product ID, product name, and quantity are required',
        variant: 'destructive',
      });
      return;
    }

    const totalCost = (orderData.laborCost || 0) + (orderData.overheadCost || 0) + 
      (orderData.materials?.reduce((sum, m) => sum + (m.quantity * m.unitCost), 0) || 0);

    const updatedOrders = editingManufacturing
      ? manufacturingOrders.map(o => o.id === editingManufacturing.id ? { ...o, ...orderData, totalCost } as ERPManufacturingOrder : o)
      : [...manufacturingOrders, {
          id: `manufacturing-${Date.now()}`,
          orderNumber: orderData.orderNumber!,
          productId: orderData.productId!,
          productName: orderData.productName!,
          quantity: orderData.quantity!,
          status: orderData.status || 'planned',
          materials: orderData.materials || [],
          laborCost: orderData.laborCost,
          overheadCost: orderData.overheadCost,
          totalCost,
        } as ERPManufacturingOrder];

    updateConfig({ manufacturingOrders: updatedOrders });
    
    if (erpEngine) {
      if (editingManufacturing) {
        erpEngine.updateManufacturingOrder(editingManufacturing.id, { ...orderData, totalCost } as Partial<ERPManufacturingOrder>);
      } else {
        const newOrder = updatedOrders[updatedOrders.length - 1];
        erpEngine.addManufacturingOrder(newOrder);
      }
    }

    setManufacturingDialogOpen(false);
    toast({
      title: editingManufacturing ? 'Manufacturing order updated' : 'Manufacturing order created',
      description: `Order ${orderData.orderNumber} has been ${editingManufacturing ? 'updated' : 'created'}.`,
    });
  };

  const removeManufacturingOrder = (id: string) => {
    setDeleteManufacturingConfirm(id);
  };

  const confirmRemoveManufacturingOrder = () => {
    if (!deleteManufacturingConfirm) return;
    const order = manufacturingOrders.find(o => o.id === deleteManufacturingConfirm);
    updateConfig({ manufacturingOrders: manufacturingOrders.filter((o) => o.id !== deleteManufacturingConfirm) });
    if (erpEngine) {
      erpEngine.removeManufacturingOrder(deleteManufacturingConfirm);
    }
    toast({
      title: 'Manufacturing order removed',
      description: `Order ${order?.orderNumber || ''} has been removed.`,
    });
    setDeleteManufacturingConfirm(null);
  };

  // Supply Items CRUD
  const openSupplyDialog = (item?: ERPSupplyItem) => {
    setEditingSupply(item || null);
    setSupplyDialogOpen(true);
  };

  const saveSupplyItem = (itemData: Partial<ERPSupplyItem>) => {
    if (!itemData.purchaseOrderNumber || !itemData.supplier || !itemData.item || !itemData.quantity || !itemData.unitPrice) {
      toast({
        title: 'Validation error',
        description: 'PO number, supplier, item, quantity, and unit price are required',
        variant: 'destructive',
      });
      return;
    }

    const total = itemData.quantity! * itemData.unitPrice!;
    const updatedItems = editingSupply
      ? supplyItems.map(i => i.id === editingSupply.id ? { ...i, ...itemData, total } as ERPSupplyItem : i)
      : [...supplyItems, {
          id: `supply-${Date.now()}`,
          purchaseOrderNumber: itemData.purchaseOrderNumber!,
          supplier: itemData.supplier!,
          supplierId: itemData.supplierId,
          item: itemData.item!,
          itemId: itemData.itemId,
          quantity: itemData.quantity!,
          unitPrice: itemData.unitPrice!,
          total,
          status: itemData.status || 'ordered',
          orderDate: itemData.orderDate || Date.now(),
          expectedDelivery: itemData.expectedDelivery,
        } as ERPSupplyItem];

    updateConfig({ supplyItems: updatedItems });
    
    if (erpEngine) {
      if (editingSupply) {
        erpEngine.updateSupplyItem(editingSupply.id, { ...itemData, total } as Partial<ERPSupplyItem>);
      } else {
        const newItem = updatedItems[updatedItems.length - 1];
        erpEngine.addSupplyItem(newItem);
      }
    }

    setSupplyDialogOpen(false);
    toast({
      title: editingSupply ? 'Supply item updated' : 'Supply item created',
      description: `PO ${itemData.purchaseOrderNumber} has been ${editingSupply ? 'updated' : 'created'}.`,
    });
  };

  const removeSupplyItem = (id: string) => {
    setDeleteSupplyConfirm(id);
  };

  const confirmRemoveSupplyItem = () => {
    if (!deleteSupplyConfirm) return;
    const item = supplyItems.find(s => s.id === deleteSupplyConfirm);
    updateConfig({ supplyItems: supplyItems.filter((i) => i.id !== deleteSupplyConfirm) });
    if (erpEngine) {
      erpEngine.removeSupplyItem(deleteSupplyConfirm);
    }
    toast({
      title: 'Supply item removed',
      description: `Purchase order ${item?.purchaseOrderNumber || ''} has been removed.`,
    });
    setDeleteSupplyConfirm(null);
  };

  // Helper function for sorting
  const sortData = <T,>(data: T[], field: string, direction: 'asc' | 'desc'): T[] => {
    return [...data].sort((a, b) => {
      const aVal = (a as any)[field];
      const bVal = (b as any)[field];
      if (aVal === undefined || aVal === null) return 1;
      if (bVal === undefined || bVal === null) return -1;
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return direction === 'asc' 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return direction === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return 0;
    });
  };

  // Filtered and sorted data
  const filteredOrders = useMemo(() => {
    let filtered = orders;
    if (searchQuery) {
      filtered = filtered.filter(o => 
        o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.customer.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    if (orderStatusFilter !== 'all') {
      filtered = filtered.filter(o => o.status === orderStatusFilter);
    }
    return sortData(filtered, orderSortField, orderSortDirection);
  }, [orders, searchQuery, orderStatusFilter, orderSortField, orderSortDirection]);

  const filteredInventory = useMemo(() => {
    let filtered = inventory;
    if (searchQuery) {
      filtered = filtered.filter(i => 
        i.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.category.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    if (inventoryStatusFilter !== 'all') {
      filtered = filtered.filter(i => i.status === inventoryStatusFilter);
    }
    return sortData(filtered, inventorySortField, inventorySortDirection);
  }, [inventory, searchQuery, inventoryStatusFilter, inventorySortField, inventorySortDirection]);

  const filteredTransactions = useMemo(() => {
    let filtered = transactions;
    if (searchQuery) {
      filtered = filtered.filter(t => 
        t.transactionNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.account.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    if (transactionTypeFilter !== 'all') {
      filtered = filtered.filter(t => t.type === transactionTypeFilter);
    }
    return sortData(filtered, transactionSortField, transactionSortDirection);
  }, [transactions, searchQuery, transactionTypeFilter, transactionSortField, transactionSortDirection]);

  const filteredEmployees = useMemo(() => {
    let filtered = employees;
    if (searchQuery) {
      filtered = filtered.filter(e => 
        e.employeeNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.department.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    if (employeeStatusFilter !== 'all') {
      filtered = filtered.filter(e => e.status === employeeStatusFilter);
    }
    return sortData(filtered, employeeSortField, employeeSortDirection);
  }, [employees, searchQuery, employeeStatusFilter, employeeSortField, employeeSortDirection]);

  const filteredManufacturingOrders = useMemo(() => {
    let filtered = manufacturingOrders;
    if (searchQuery) {
      filtered = filtered.filter(o => 
        o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.productName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    if (manufacturingStatusFilter !== 'all') {
      filtered = filtered.filter(o => o.status === manufacturingStatusFilter);
    }
    return sortData(filtered, manufacturingSortField, manufacturingSortDirection);
  }, [manufacturingOrders, searchQuery, manufacturingStatusFilter, manufacturingSortField, manufacturingSortDirection]);

  const filteredSupplyItems = useMemo(() => {
    let filtered = supplyItems;
    if (searchQuery) {
      filtered = filtered.filter(i => 
        i.purchaseOrderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.supplier.toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.item.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    if (supplyStatusFilter !== 'all') {
      filtered = filtered.filter(i => i.status === supplyStatusFilter);
    }
    return sortData(filtered, supplySortField, supplySortDirection);
  }, [supplyItems, searchQuery, supplyStatusFilter, supplySortField, supplySortDirection]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered':
      case 'in-stock':
      case 'active':
      case 'completed':
      case 'received':
      case 'posted':
        return 'bg-green-500';
      case 'processing':
      case 'shipped':
      case 'low-stock':
      case 'in-progress':
      case 'in-transit':
      case 'reconciled':
        return 'bg-yellow-500';
      case 'cancelled':
      case 'out-of-stock':
      case 'terminated':
      case 'delayed':
      case 'voided':
        return 'bg-red-500';
      case 'pending':
      case 'planned':
      case 'ordered':
        return 'bg-blue-500';
      case 'released':
      case 'on-leave':
        return 'bg-purple-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase text-muted-foreground tracking-wide">ERP System</p>
            <h2 className="text-2xl font-bold text-foreground">Enterprise Resource Planning</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Integrated business management system
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <RefreshCcw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          <Card className="border-l-4 border-l-blue-500 min-w-0">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm font-medium text-muted-foreground truncate">Orders</CardTitle>
                <FileText className="h-4 w-4 text-blue-500 flex-shrink-0" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2 min-w-0">
                <span className="text-2xl sm:text-3xl font-bold text-blue-600 dark:text-blue-400 truncate">{totalOrders}</span>
                <span className="text-xs text-muted-foreground flex-shrink-0">total</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500 min-w-0">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm font-medium text-muted-foreground truncate">Inventory</CardTitle>
                <Package className="h-4 w-4 text-green-500 flex-shrink-0" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2 min-w-0">
                <span className="text-2xl sm:text-3xl font-bold text-green-600 dark:text-green-400 truncate">{totalInventory}</span>
                <span className="text-xs text-muted-foreground flex-shrink-0">items</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-purple-500 min-w-0">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm font-medium text-muted-foreground truncate">Inventory Value</CardTitle>
                <DollarSign className="h-4 w-4 text-purple-500 flex-shrink-0" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2 min-w-0">
                <span className="text-2xl sm:text-3xl font-bold text-purple-600 dark:text-purple-400 truncate">${(inventoryValue / 1000).toFixed(0)}K</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-red-500 min-w-0">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm font-medium text-muted-foreground truncate">Low Stock</CardTitle>
                <TrendingUp className="h-4 w-4 text-red-500 flex-shrink-0" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2 min-w-0">
                <span className="text-2xl sm:text-3xl font-bold text-red-600 dark:text-red-400 truncate">{lowStockItems}</span>
                <span className="text-xs text-muted-foreground flex-shrink-0">items</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-cyan-500 min-w-0">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm font-medium text-muted-foreground truncate">Revenue</CardTitle>
                <DollarSign className="h-4 w-4 text-cyan-500 flex-shrink-0" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2 min-w-0">
                <span className="text-2xl sm:text-3xl font-bold text-cyan-600 dark:text-cyan-400 truncate">${(revenue / 1000).toFixed(0)}K</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-orange-500 min-w-0">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm font-medium text-muted-foreground truncate">Profit</CardTitle>
                <TrendingUp className="h-4 w-4 text-orange-500 flex-shrink-0" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2 min-w-0">
                <span className="text-2xl sm:text-3xl font-bold text-orange-600 dark:text-orange-400 truncate">${(profit / 1000).toFixed(0)}K</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="orders" className="space-y-4">
          <TabsList className="flex flex-wrap gap-2">
            <TabsTrigger value="orders">
              <FileText className="h-4 w-4 mr-2" />
              Orders ({orders.length})
            </TabsTrigger>
            <TabsTrigger value="inventory">
              <Package className="h-4 w-4 mr-2" />
              Inventory ({inventory.length})
            </TabsTrigger>
            <TabsTrigger value="finance">
              <CreditCard className="h-4 w-4 mr-2" />
              Finance ({transactions.length})
            </TabsTrigger>
            <TabsTrigger value="hr">
              <Users className="h-4 w-4 mr-2" />
              HR ({employees.length})
            </TabsTrigger>
            <TabsTrigger value="manufacturing">
              <Factory className="h-4 w-4 mr-2" />
              Manufacturing ({manufacturingOrders.length})
            </TabsTrigger>
            <TabsTrigger value="supply">
              <Truck className="h-4 w-4 mr-2" />
              Supply Chain ({supplyItems.length})
            </TabsTrigger>
            <TabsTrigger value="analytics">
              <BarChart3 className="h-4 w-4 mr-2" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="orders" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Orders</CardTitle>
                    <CardDescription>Customer orders and fulfillment</CardDescription>
                  </div>
                  <Button onClick={() => openOrderDialog()} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Order
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 mb-4 flex-wrap">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search orders..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select value={orderStatusFilter} onValueChange={setOrderStatusFilter}>
                    <SelectTrigger className="w-[180px]">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="processing">Processing</SelectItem>
                      <SelectItem value="shipped">Shipped</SelectItem>
                      <SelectItem value="delivered">Delivered</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={orderSortField} onValueChange={setOrderSortField}>
                    <SelectTrigger className="w-[150px]">
                      <ArrowUpDown className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="orderNumber">Order Number</SelectItem>
                      <SelectItem value="customer">Customer</SelectItem>
                      <SelectItem value="orderDate">Date</SelectItem>
                      <SelectItem value="total">Total</SelectItem>
                      <SelectItem value="status">Status</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setOrderSortDirection(orderSortDirection === 'asc' ? 'desc' : 'asc')}
                    className="w-[40px]"
                  >
                    {orderSortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                  </Button>
                </div>
                {filteredOrders.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No orders found</p>
                    <p className="text-xs mt-2">Click "Create Order" to add a new order</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredOrders.map((order) => (
                    <Card key={order.id} className="border-l-4 border-l-blue-500 hover:shadow-md transition-shadow bg-gradient-to-r from-blue-50/50 to-transparent dark:from-blue-950/10">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg ${getStatusColor(order.status)}/20`}>
                              <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                              <CardTitle className="text-lg font-semibold">{order.orderNumber}</CardTitle>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant="outline" className={getStatusColor(order.status)}>
                                  {order.status}
                                </Badge>
                                <Badge variant="outline">
                                  <Building className="h-3 w-3 mr-1" />
                                  {order.customer}
                                </Badge>
                                <Badge variant="outline" className="bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-300">
                                  ${order.total.toLocaleString()}
                                </Badge>
                                <Badge variant="outline">{order.items.length} items</Badge>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openOrderDialog(order)}
                              className="hover:bg-blue-50 dark:hover:bg-blue-950/20"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeOrder(order.id)}
                              className="hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="text-sm">
                          <span className="text-muted-foreground">Order Date:</span>
                          <span className="ml-2 font-semibold">{new Date(order.orderDate).toLocaleString()}</span>
                        </div>
                        {order.expectedDelivery && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Expected delivery: {new Date(order.expectedDelivery).toLocaleDateString()}
                          </div>
                        )}
                        {order.items && order.items.length > 0 && (
                          <div className="mt-2">
                            <span className="text-muted-foreground text-xs">Items: </span>
                            <span className="text-xs">{order.items.map(i => `${i.name} (${i.quantity})`).join(', ')}</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="inventory" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Inventory Management</CardTitle>
                    <CardDescription>Product inventory and stock levels</CardDescription>
                  </div>
                  <Button onClick={() => openInventoryDialog()} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Item
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 mb-4 flex-wrap">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search inventory..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select value={inventoryStatusFilter} onValueChange={setInventoryStatusFilter}>
                    <SelectTrigger className="w-[180px]">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="in-stock">In Stock</SelectItem>
                      <SelectItem value="low-stock">Low Stock</SelectItem>
                      <SelectItem value="out-of-stock">Out of Stock</SelectItem>
                      <SelectItem value="reserved">Reserved</SelectItem>
                      <SelectItem value="damaged">Damaged</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={inventorySortField} onValueChange={setInventorySortField}>
                    <SelectTrigger className="w-[150px]">
                      <ArrowUpDown className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sku">SKU</SelectItem>
                      <SelectItem value="name">Name</SelectItem>
                      <SelectItem value="category">Category</SelectItem>
                      <SelectItem value="quantity">Quantity</SelectItem>
                      <SelectItem value="unitPrice">Unit Price</SelectItem>
                      <SelectItem value="status">Status</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setInventorySortDirection(inventorySortDirection === 'asc' ? 'desc' : 'asc')}
                    className="w-[40px]"
                  >
                    {inventorySortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                  </Button>
                </div>
                {filteredInventory.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No inventory items found</p>
                    <p className="text-xs mt-2">Click "Add Item" to add inventory items</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredInventory.map((item) => (
                    <Card key={item.id} className="border-l-4 border-l-green-500 hover:shadow-md transition-shadow bg-gradient-to-r from-green-50/50 to-transparent dark:from-green-950/10">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg ${getStatusColor(item.status)}/20`}>
                              <Package className="h-5 w-5 text-green-600 dark:text-green-400" />
                            </div>
                            <div>
                              <CardTitle className="text-lg font-semibold">{item.name}</CardTitle>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant="outline" className="font-mono text-xs">{item.sku}</Badge>
                                <Badge variant="outline">{item.category}</Badge>
                                <Badge variant="outline" className={getStatusColor(item.status)}>
                                  {item.status}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openInventoryDialog(item)}
                              className="hover:bg-green-50 dark:hover:bg-green-950/20"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeInventoryItem(item.id)}
                              className="hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Quantity:</span>
                            <span className="ml-2 font-semibold">{item.quantity}</span>
                            {item.reservedQuantity > 0 && (
                              <span className="ml-2 text-xs text-muted-foreground">({item.reservedQuantity} reserved)</span>
                            )}
                          </div>
                          <div>
                            <span className="text-muted-foreground">Reorder Level:</span>
                            <span className="ml-2 font-semibold">{item.reorderLevel}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Unit Price:</span>
                            <span className="ml-2 font-semibold">${item.unitPrice.toFixed(2)}</span>
                          </div>
                        </div>
                        <div className="text-sm mt-2">
                          <span className="text-muted-foreground">Total Value:</span>
                          <span className="ml-2 font-semibold">${(item.quantity * item.unitPrice).toLocaleString()}</span>
                        </div>
                        {item.location && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Location: {item.location}
                          </div>
                        )}
                        {item.supplier && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Supplier: {item.supplier}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="finance" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Financial Transactions</CardTitle>
                    <CardDescription>Revenue, expenses, and financial records</CardDescription>
                  </div>
                  <Button onClick={() => openTransactionDialog()} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Transaction
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 mb-4 flex-wrap">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search transactions..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select value={transactionTypeFilter} onValueChange={setTransactionTypeFilter}>
                    <SelectTrigger className="w-[180px]">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Filter by type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="invoice">Invoice</SelectItem>
                      <SelectItem value="payment">Payment</SelectItem>
                      <SelectItem value="refund">Refund</SelectItem>
                      <SelectItem value="expense">Expense</SelectItem>
                      <SelectItem value="revenue">Revenue</SelectItem>
                      <SelectItem value="adjustment">Adjustment</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={transactionSortField} onValueChange={setTransactionSortField}>
                    <SelectTrigger className="w-[150px]">
                      <ArrowUpDown className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="transactionNumber">Transaction #</SelectItem>
                      <SelectItem value="type">Type</SelectItem>
                      <SelectItem value="date">Date</SelectItem>
                      <SelectItem value="amount">Amount</SelectItem>
                      <SelectItem value="status">Status</SelectItem>
                      <SelectItem value="account">Account</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setTransactionSortDirection(transactionSortDirection === 'asc' ? 'desc' : 'asc')}
                    className="w-[40px]"
                  >
                    {transactionSortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <Card className="border-l-4 border-l-green-500">
                    <CardContent className="pt-4">
                      <div className="text-sm text-muted-foreground">Revenue</div>
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">${(revenue / 1000).toFixed(1)}K</div>
                    </CardContent>
                  </Card>
                  <Card className="border-l-4 border-l-red-500">
                    <CardContent className="pt-4">
                      <div className="text-sm text-muted-foreground">Expenses</div>
                      <div className="text-2xl font-bold text-red-600 dark:text-red-400">${(expenses / 1000).toFixed(1)}K</div>
                    </CardContent>
                  </Card>
                  <Card className="border-l-4 border-l-blue-500">
                    <CardContent className="pt-4">
                      <div className="text-sm text-muted-foreground">Profit</div>
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">${(profit / 1000).toFixed(1)}K</div>
                    </CardContent>
                  </Card>
                </div>
                {filteredTransactions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CreditCard className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No transactions found</p>
                    <p className="text-xs mt-2">Click "Add Transaction" to create a new transaction</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredTransactions.map((transaction) => (
                    <Card key={transaction.id} className="border-l-4 border-l-purple-500 hover:shadow-md transition-shadow">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg ${getStatusColor(transaction.status)}/20`}>
                              <CreditCard className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                            </div>
                            <div>
                              <CardTitle className="text-lg font-semibold">{transaction.transactionNumber}</CardTitle>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant="outline">{transaction.type}</Badge>
                                <Badge variant="outline" className={transaction.amount >= 0 ? 'bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-300' : 'bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300'}>
                                  ${Math.abs(transaction.amount).toLocaleString()} {transaction.currency}
                                </Badge>
                                <Badge variant="outline" className={getStatusColor(transaction.status)}>
                                  {transaction.status}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openTransactionDialog(transaction)}
                              className="hover:bg-purple-50 dark:hover:bg-purple-950/20"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeTransaction(transaction.id)}
                              className="hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="text-sm">
                          <div className="mb-2">
                            <span className="text-muted-foreground">Account:</span>
                            <span className="ml-2 font-semibold">{transaction.account}</span>
                          </div>
                          {transaction.description && (
                            <div className="mb-2 text-muted-foreground">{transaction.description}</div>
                          )}
                          <div className="text-xs text-muted-foreground">
                            Date: {new Date(transaction.date).toLocaleString()}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="hr" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Human Resources</CardTitle>
                    <CardDescription>Employee management and payroll</CardDescription>
                  </div>
                  <Button onClick={() => openEmployeeDialog()} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Employee
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <Card className="border-l-4 border-l-blue-500">
                    <CardContent className="pt-4">
                      <div className="text-sm text-muted-foreground">Total Employees</div>
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{employeesTotal}</div>
                    </CardContent>
                  </Card>
                  <Card className="border-l-4 border-l-green-500">
                    <CardContent className="pt-4">
                      <div className="text-sm text-muted-foreground">Active</div>
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">{employeesActive}</div>
                    </CardContent>
                  </Card>
                  <Card className="border-l-4 border-l-purple-500">
                    <CardContent className="pt-4">
                      <div className="text-sm text-muted-foreground">Monthly Payroll</div>
                      <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">${(totalPayroll / 1000).toFixed(1)}K</div>
                    </CardContent>
                  </Card>
                </div>
                <div className="flex gap-2 mb-4 flex-wrap">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search employees..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select value={employeeStatusFilter} onValueChange={setEmployeeStatusFilter}>
                    <SelectTrigger className="w-[180px]">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="on-leave">On Leave</SelectItem>
                      <SelectItem value="terminated">Terminated</SelectItem>
                      <SelectItem value="contractor">Contractor</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={employeeSortField} onValueChange={setEmployeeSortField}>
                    <SelectTrigger className="w-[150px]">
                      <ArrowUpDown className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="employeeNumber">Employee #</SelectItem>
                      <SelectItem value="lastName">Last Name</SelectItem>
                      <SelectItem value="firstName">First Name</SelectItem>
                      <SelectItem value="department">Department</SelectItem>
                      <SelectItem value="position">Position</SelectItem>
                      <SelectItem value="status">Status</SelectItem>
                      <SelectItem value="salary">Salary</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setEmployeeSortDirection(employeeSortDirection === 'asc' ? 'desc' : 'asc')}
                    className="w-[40px]"
                  >
                    {employeeSortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                  </Button>
                </div>
                {filteredEmployees.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No employees found</p>
                    <p className="text-xs mt-2">Click "Add Employee" to create a new employee</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredEmployees.map((employee) => (
                    <Card key={employee.id} className="border-l-4 border-l-blue-500 hover:shadow-md transition-shadow">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg ${getStatusColor(employee.status)}/20`}>
                              <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                              <CardTitle className="text-lg font-semibold">{employee.firstName} {employee.lastName}</CardTitle>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant="outline" className="font-mono text-xs">{employee.employeeNumber}</Badge>
                                <Badge variant="outline">{employee.department}</Badge>
                                <Badge variant="outline">{employee.position}</Badge>
                                <Badge variant="outline" className={getStatusColor(employee.status)}>
                                  {employee.status}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEmployeeDialog(employee)}
                              className="hover:bg-blue-50 dark:hover:bg-blue-950/20"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeEmployee(employee.id)}
                              className="hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          {employee.email && (
                            <div>
                              <span className="text-muted-foreground">Email:</span>
                              <span className="ml-2">{employee.email}</span>
                            </div>
                          )}
                          {employee.phone && (
                            <div>
                              <span className="text-muted-foreground">Phone:</span>
                              <span className="ml-2">{employee.phone}</span>
                            </div>
                          )}
                          {employee.salary && (
                            <div>
                              <span className="text-muted-foreground">Salary:</span>
                              <span className="ml-2 font-semibold">${employee.salary.toLocaleString()}</span>
                            </div>
                          )}
                          {employee.location && (
                            <div>
                              <span className="text-muted-foreground">Location:</span>
                              <span className="ml-2">{employee.location}</span>
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-2">
                          Hire Date: {new Date(employee.hireDate).toLocaleDateString()}
                        </div>
                      </CardContent>
                    </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="manufacturing" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Manufacturing Orders</CardTitle>
                    <CardDescription>Production planning and execution</CardDescription>
                  </div>
                  <Button onClick={() => openManufacturingDialog()} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Order
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <Card className="border-l-4 border-l-blue-500">
                    <CardContent className="pt-4">
                      <div className="text-sm text-muted-foreground">Total Orders</div>
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{manufacturingOrdersTotal}</div>
                    </CardContent>
                  </Card>
                  <Card className="border-l-4 border-l-yellow-500">
                    <CardContent className="pt-4">
                      <div className="text-sm text-muted-foreground">In Progress</div>
                      <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{manufacturingOrdersInProgress}</div>
                    </CardContent>
                  </Card>
                  <Card className="border-l-4 border-l-green-500">
                    <CardContent className="pt-4">
                      <div className="text-sm text-muted-foreground">Capacity</div>
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">{(manufacturingCapacity * 100).toFixed(0)}%</div>
                    </CardContent>
                  </Card>
                </div>
                <div className="flex gap-2 mb-4 flex-wrap">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search manufacturing orders..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select value={manufacturingStatusFilter} onValueChange={setManufacturingStatusFilter}>
                    <SelectTrigger className="w-[180px]">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="planned">Planned</SelectItem>
                      <SelectItem value="released">Released</SelectItem>
                      <SelectItem value="in-progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={manufacturingSortField} onValueChange={setManufacturingSortField}>
                    <SelectTrigger className="w-[150px]">
                      <ArrowUpDown className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="orderNumber">Order Number</SelectItem>
                      <SelectItem value="productName">Product Name</SelectItem>
                      <SelectItem value="quantity">Quantity</SelectItem>
                      <SelectItem value="status">Status</SelectItem>
                      <SelectItem value="totalCost">Total Cost</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setManufacturingSortDirection(manufacturingSortDirection === 'asc' ? 'desc' : 'asc')}
                    className="w-[40px]"
                  >
                    {manufacturingSortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                  </Button>
                </div>
                {filteredManufacturingOrders.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Factory className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No manufacturing orders found</p>
                    <p className="text-xs mt-2">Click "Add Order" to create a new manufacturing order</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredManufacturingOrders.map((order) => (
                    <Card key={order.id} className="border-l-4 border-l-orange-500 hover:shadow-md transition-shadow">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg ${getStatusColor(order.status)}/20`}>
                              <Factory className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                            </div>
                            <div>
                              <CardTitle className="text-lg font-semibold">{order.orderNumber}</CardTitle>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant="outline">{order.productName}</Badge>
                                <Badge variant="outline">Qty: {order.quantity}</Badge>
                                <Badge variant="outline" className={getStatusColor(order.status)}>
                                  {order.status}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openManufacturingDialog(order)}
                              className="hover:bg-orange-50 dark:hover:bg-orange-950/20"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeManufacturingOrder(order.id)}
                              className="hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="text-sm">
                          {order.materials && order.materials.length > 0 && (
                            <div className="mb-2">
                              <span className="text-muted-foreground">Materials: </span>
                              <span>{order.materials.map(m => `${m.name} (${m.quantity})`).join(', ')}</span>
                            </div>
                          )}
                          {order.totalCost && (
                            <div className="mb-2">
                              <span className="text-muted-foreground">Total Cost:</span>
                              <span className="ml-2 font-semibold">${order.totalCost.toLocaleString()}</span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="supply" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Supply Chain</CardTitle>
                    <CardDescription>Purchase orders and supplier management</CardDescription>
                  </div>
                  <Button onClick={() => openSupplyDialog()} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add PO
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <Card className="border-l-4 border-l-blue-500">
                    <CardContent className="pt-4">
                      <div className="text-sm text-muted-foreground">Total POs</div>
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{supplyItemsTotal}</div>
                    </CardContent>
                  </Card>
                  <Card className="border-l-4 border-l-yellow-500">
                    <CardContent className="pt-4">
                      <div className="text-sm text-muted-foreground">In Transit</div>
                      <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{supplyItemsInTransit}</div>
                    </CardContent>
                  </Card>
                  <Card className="border-l-4 border-l-red-500">
                    <CardContent className="pt-4">
                      <div className="text-sm text-muted-foreground">Delayed</div>
                      <div className="text-2xl font-bold text-red-600 dark:text-red-400">{supplyItemsDelayed}</div>
                    </CardContent>
                  </Card>
                </div>
                <div className="flex gap-2 mb-4 flex-wrap">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search supply items..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select value={supplyStatusFilter} onValueChange={setSupplyStatusFilter}>
                    <SelectTrigger className="w-[180px]">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="ordered">Ordered</SelectItem>
                      <SelectItem value="in-transit">In Transit</SelectItem>
                      <SelectItem value="received">Received</SelectItem>
                      <SelectItem value="delayed">Delayed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={supplySortField} onValueChange={setSupplySortField}>
                    <SelectTrigger className="w-[150px]">
                      <ArrowUpDown className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="purchaseOrderNumber">PO Number</SelectItem>
                      <SelectItem value="supplier">Supplier</SelectItem>
                      <SelectItem value="item">Item</SelectItem>
                      <SelectItem value="orderDate">Order Date</SelectItem>
                      <SelectItem value="quantity">Quantity</SelectItem>
                      <SelectItem value="total">Total</SelectItem>
                      <SelectItem value="status">Status</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setSupplySortDirection(supplySortDirection === 'asc' ? 'desc' : 'asc')}
                    className="w-[40px]"
                  >
                    {supplySortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                  </Button>
                </div>
                {filteredSupplyItems.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Truck className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No supply items found</p>
                    <p className="text-xs mt-2">Click "Add PO" to create a new purchase order</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredSupplyItems.map((item) => (
                    <Card key={item.id} className="border-l-4 border-l-teal-500 hover:shadow-md transition-shadow">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg ${getStatusColor(item.status)}/20`}>
                              <Truck className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                            </div>
                            <div>
                              <CardTitle className="text-lg font-semibold">{item.purchaseOrderNumber}</CardTitle>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant="outline">{item.supplier}</Badge>
                                <Badge variant="outline">{item.item}</Badge>
                                <Badge variant="outline" className="bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-300">
                                  ${item.total.toLocaleString()}
                                </Badge>
                                <Badge variant="outline" className={getStatusColor(item.status)}>
                                  {item.status}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openSupplyDialog(item)}
                              className="hover:bg-teal-50 dark:hover:bg-teal-950/20"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeSupplyItem(item.id)}
                              className="hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="text-sm">
                          <div className="mb-2">
                            <span className="text-muted-foreground">Quantity:</span>
                            <span className="ml-2 font-semibold">{item.quantity}</span>
                            <span className="text-muted-foreground ml-2">@ ${item.unitPrice.toFixed(2)}</span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Order Date: {new Date(item.orderDate).toLocaleDateString()}
                            {item.expectedDelivery && (
                              <span className="ml-4">Expected: {new Date(item.expectedDelivery).toLocaleDateString()}</span>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Analytics & KPIs</CardTitle>
                <CardDescription>Key performance indicators and business metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Orders Value</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">${(erpMetrics?.ordersValue || 0).toLocaleString()}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Accounts Receivable</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">${(accountsReceivable / 1000).toFixed(1)}K</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Accounts Payable</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">${(accountsPayable / 1000).toFixed(1)}K</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Inventory Turnover</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{(erpMetrics?.inventoryTurnover || 0).toFixed(1)}x</div>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>ERP Settings</CardTitle>
                <CardDescription>System configuration and module settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>ERP Type</Label>
                  <Select value={config.erpType || 'sap'} onValueChange={(value) => updateConfig({ erpType: value as any })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sap">SAP</SelectItem>
                      <SelectItem value="oracle">Oracle</SelectItem>
                      <SelectItem value="dynamics">Microsoft Dynamics</SelectItem>
                      <SelectItem value="netsuite">NetSuite</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>API Endpoint</Label>
                  <Input
                    value={config.apiEndpoint || ''}
                    onChange={(e) => updateConfig({ apiEndpoint: e.target.value })}
                    placeholder="https://erp.example.com"
                  />
                </div>
                <Separator />
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Enable Finance</Label>
                      <p className="text-xs text-muted-foreground">Financial transactions and accounting</p>
                    </div>
                    <Switch checked={config.enableFinance ?? true} onCheckedChange={(checked) => updateConfig({ enableFinance: checked })} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Enable HR</Label>
                      <p className="text-xs text-muted-foreground">Human resources and payroll</p>
                    </div>
                    <Switch checked={config.enableHR ?? true} onCheckedChange={(checked) => updateConfig({ enableHR: checked })} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Enable Supply Chain</Label>
                      <p className="text-xs text-muted-foreground">Purchase orders and supplier management</p>
                    </div>
                    <Switch checked={config.enableSupplyChain ?? true} onCheckedChange={(checked) => updateConfig({ enableSupplyChain: checked })} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Enable Manufacturing</Label>
                      <p className="text-xs text-muted-foreground">Production planning and execution</p>
                    </div>
                    <Switch checked={config.enableManufacturing ?? true} onCheckedChange={(checked) => updateConfig({ enableManufacturing: checked })} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Enable Sales</Label>
                      <p className="text-xs text-muted-foreground">Order processing and fulfillment</p>
                    </div>
                    <Switch checked={config.enableSales ?? true} onCheckedChange={(checked) => updateConfig({ enableSales: checked })} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Enable Inventory</Label>
                      <p className="text-xs text-muted-foreground">Inventory tracking and management</p>
                    </div>
                    <Switch checked={config.enableInventory ?? true} onCheckedChange={(checked) => updateConfig({ enableInventory: checked })} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Enable Reporting</Label>
                      <p className="text-xs text-muted-foreground">Analytics and reporting</p>
                    </div>
                    <Switch checked={config.enableReporting ?? true} onCheckedChange={(checked) => updateConfig({ enableReporting: checked })} />
                  </div>
                </div>
                <Separator />
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Requests Per Second</Label>
                    <Input
                      type="number"
                      value={config.requestsPerSecond || 50}
                      onChange={(e) => updateConfig({ requestsPerSecond: parseInt(e.target.value) || 50 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Average Response Time (ms)</Label>
                    <Input
                      type="number"
                      value={config.averageResponseTime || 200}
                      onChange={(e) => updateConfig({ averageResponseTime: parseInt(e.target.value) || 200 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Error Rate (0-1)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={config.errorRate || 0.01}
                      onChange={(e) => updateConfig({ errorRate: parseFloat(e.target.value) || 0.01 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Order Processing Time (hours)</Label>
                    <Input
                      type="number"
                      value={config.orderProcessingTime || 24}
                      onChange={(e) => updateConfig({ orderProcessingTime: parseInt(e.target.value) || 24 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Inventory Replenishment Time (hours)</Label>
                    <Input
                      type="number"
                      value={config.inventoryReplenishmentTime || 48}
                      onChange={(e) => updateConfig({ inventoryReplenishmentTime: parseInt(e.target.value) || 48 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Manufacturing Cycle Time (hours)</Label>
                    <Input
                      type="number"
                      value={config.manufacturingCycleTime || 72}
                      onChange={(e) => updateConfig({ manufacturingCycleTime: parseInt(e.target.value) || 72 })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Order Dialog */}
        <Dialog open={orderDialogOpen} onOpenChange={setOrderDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingOrder ? 'Edit Order' : 'Create Order'}</DialogTitle>
              <DialogDescription>
                {editingOrder ? 'Update order details' : 'Add a new customer order'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Order Number *</Label>
                  <Input
                    defaultValue={editingOrder?.orderNumber || ''}
                    placeholder="ORD-001"
                    id="orderNumber"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Customer *</Label>
                  <Input
                    defaultValue={editingOrder?.customer || ''}
                    placeholder="Customer Name"
                    id="customer"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select defaultValue={editingOrder?.status || 'pending'}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="processing">Processing</SelectItem>
                      <SelectItem value="shipped">Shipped</SelectItem>
                      <SelectItem value="delivered">Delivered</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  <Input
                    defaultValue={editingOrder?.paymentMethod || ''}
                    placeholder="Credit Card"
                    id="paymentMethod"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Shipping Address</Label>
                <Textarea
                  defaultValue={editingOrder?.shippingAddress || ''}
                  placeholder="123 Main St, City, State, ZIP"
                  id="shippingAddress"
                />
              </div>
              <div className="space-y-2">
                <Label>Billing Address</Label>
                <Textarea
                  defaultValue={editingOrder?.billingAddress || ''}
                  placeholder="123 Main St, City, State, ZIP"
                  id="billingAddress"
                />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  defaultValue={editingOrder?.notes || ''}
                  placeholder="Additional notes..."
                  id="notes"
                />
              </div>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Order Items *</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setOrderFormItems([...orderFormItems, {
                        id: `item-${Date.now()}`,
                        sku: '',
                        name: '',
                        quantity: 1,
                        unitPrice: 0,
                        total: 0,
                      }]);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Item
                  </Button>
                </div>
                {orderFormItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No items added. Click "Add Item" to add items to this order.</p>
                ) : (
                  <div className="space-y-2">
                    {orderFormItems.map((item, index) => (
                      <Card key={item.id} className="p-3">
                        <div className="grid grid-cols-12 gap-2 items-end">
                          <div className="col-span-3 space-y-1">
                            <Label className="text-xs">SKU</Label>
                            <Input
                              value={item.sku}
                              onChange={(e) => {
                                const updated = [...orderFormItems];
                                updated[index].sku = e.target.value;
                                setOrderFormItems(updated);
                              }}
                              placeholder="SKU-001"
                              className="h-8"
                            />
                          </div>
                          <div className="col-span-4 space-y-1">
                            <Label className="text-xs">Name</Label>
                            <Input
                              value={item.name}
                              onChange={(e) => {
                                const updated = [...orderFormItems];
                                updated[index].name = e.target.value;
                                setOrderFormItems(updated);
                              }}
                              placeholder="Product Name"
                              className="h-8"
                            />
                          </div>
                          <div className="col-span-2 space-y-1">
                            <Label className="text-xs">Qty</Label>
                            <Input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => {
                                const updated = [...orderFormItems];
                                updated[index].quantity = parseInt(e.target.value) || 0;
                                updated[index].total = updated[index].quantity * updated[index].unitPrice;
                                setOrderFormItems(updated);
                              }}
                              className="h-8"
                            />
                          </div>
                          <div className="col-span-2 space-y-1">
                            <Label className="text-xs">Unit Price</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={item.unitPrice}
                              onChange={(e) => {
                                const updated = [...orderFormItems];
                                updated[index].unitPrice = parseFloat(e.target.value) || 0;
                                updated[index].total = updated[index].quantity * updated[index].unitPrice;
                                setOrderFormItems(updated);
                              }}
                              className="h-8"
                            />
                          </div>
                          <div className="col-span-1 space-y-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => {
                                setOrderFormItems(orderFormItems.filter((_, i) => i !== index));
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                        {item.total > 0 && (
                          <div className="mt-2 text-xs text-muted-foreground">
                            Total: ${item.total.toFixed(2)}
                          </div>
                        )}
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setOrderDialogOpen(false);
                setOrderFormItems([]);
              }}>Cancel</Button>
              <Button onClick={() => {
                if (orderFormItems.length === 0) {
                  toast({
                    title: 'Validation error',
                    description: 'At least one item is required',
                    variant: 'destructive',
                  });
                  return;
                }
                const form = document.getElementById('orderNumber') as HTMLInputElement;
                const customer = document.getElementById('customer') as HTMLInputElement;
                const statusSelect = document.querySelector('[id^="order-status"]') as HTMLSelectElement || 
                  document.querySelector('select') as HTMLSelectElement;
                const status = statusSelect?.value || editingOrder?.status || 'pending';
                const paymentMethod = document.getElementById('paymentMethod') as HTMLInputElement;
                const shippingAddress = document.getElementById('shippingAddress') as HTMLTextAreaElement;
                const billingAddress = document.getElementById('billingAddress') as HTMLTextAreaElement;
                const notes = document.getElementById('notes') as HTMLTextAreaElement;
                
                // Validate items
                const validItems = orderFormItems.filter(item => item.sku && item.name && item.quantity > 0 && item.unitPrice > 0);
                if (validItems.length === 0) {
                  toast({
                    title: 'Validation error',
                    description: 'All items must have SKU, name, quantity > 0, and unit price > 0',
                    variant: 'destructive',
                  });
                  return;
                }
                
                saveOrder({
                  orderNumber: form?.value || editingOrder?.orderNumber || '',
                  customer: customer?.value || editingOrder?.customer || '',
                  status: status as OrderStatus,
                  paymentMethod: paymentMethod?.value,
                  shippingAddress: shippingAddress?.value,
                  billingAddress: billingAddress?.value,
                  notes: notes?.value,
                  items: validItems.map(item => ({
                    ...item,
                    total: item.quantity * item.unitPrice,
                  })),
                });
                setOrderFormItems([]);
              }}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Inventory Dialog */}
        <Dialog open={inventoryDialogOpen} onOpenChange={setInventoryDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingInventory ? 'Edit Inventory Item' : 'Create Inventory Item'}</DialogTitle>
              <DialogDescription>
                {editingInventory ? 'Update inventory item details' : 'Add a new inventory item'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>SKU *</Label>
                  <Input
                    defaultValue={editingInventory?.sku || ''}
                    placeholder="SKU-001"
                    id="sku"
                    className={inventoryErrors.sku ? 'border-destructive' : ''}
                  />
                  {inventoryErrors.sku && (
                    <p className="text-xs text-destructive">{inventoryErrors.sku}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input
                    defaultValue={editingInventory?.name || ''}
                    placeholder="Product Name"
                    id="name"
                    className={inventoryErrors.name ? 'border-destructive' : ''}
                  />
                  {inventoryErrors.name && (
                    <p className="text-xs text-destructive">{inventoryErrors.name}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Input
                    defaultValue={editingInventory?.category || ''}
                    placeholder="Category"
                    id="category"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Quantity *</Label>
                  <Input
                    type="number"
                    defaultValue={editingInventory?.quantity || 0}
                    id="quantity"
                    className={inventoryErrors.quantity ? 'border-destructive' : ''}
                  />
                  {inventoryErrors.quantity && (
                    <p className="text-xs text-destructive">{inventoryErrors.quantity}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Reorder Level</Label>
                  <Input
                    type="number"
                    defaultValue={editingInventory?.reorderLevel || 10}
                    id="reorderLevel"
                    className={inventoryErrors.reorderLevel ? 'border-destructive' : ''}
                  />
                  {inventoryErrors.reorderLevel && (
                    <p className="text-xs text-destructive">{inventoryErrors.reorderLevel}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Reorder Quantity</Label>
                  <Input
                    type="number"
                    defaultValue={editingInventory?.reorderQuantity || 20}
                    id="reorderQuantity"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Unit Price</Label>
                  <Input
                    type="number"
                    step="0.01"
                    defaultValue={editingInventory?.unitPrice || 0}
                    id="unitPrice"
                    className={inventoryErrors.unitPrice ? 'border-destructive' : ''}
                  />
                  {inventoryErrors.unitPrice && (
                    <p className="text-xs text-destructive">{inventoryErrors.unitPrice}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Unit Cost</Label>
                  <Input
                    type="number"
                    step="0.01"
                    defaultValue={editingInventory?.unitCost || 0}
                    id="unitCost"
                    className={inventoryErrors.unitCost ? 'border-destructive' : ''}
                  />
                  {inventoryErrors.unitCost && (
                    <p className="text-xs text-destructive">{inventoryErrors.unitCost}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Location</Label>
                  <Input
                    defaultValue={editingInventory?.location || ''}
                    placeholder="Warehouse A"
                    id="location"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Supplier</Label>
                  <Input
                    defaultValue={editingInventory?.supplier || ''}
                    placeholder="Supplier Name"
                    id="supplier"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setInventoryDialogOpen(false);
                setInventoryErrors({});
              }} disabled={loading}>Cancel</Button>
              <Button onClick={() => {
                const sku = document.getElementById('sku') as HTMLInputElement;
                const name = document.getElementById('name') as HTMLInputElement;
                const category = document.getElementById('category') as HTMLInputElement;
                const quantity = document.getElementById('quantity') as HTMLInputElement;
                const reorderLevel = document.getElementById('reorderLevel') as HTMLInputElement;
                const reorderQuantity = document.getElementById('reorderQuantity') as HTMLInputElement;
                const unitPrice = document.getElementById('unitPrice') as HTMLInputElement;
                const unitCost = document.getElementById('unitCost') as HTMLInputElement;
                const location = document.getElementById('location') as HTMLInputElement;
                const supplier = document.getElementById('supplier') as HTMLInputElement;
                
                saveInventoryItem({
                  sku: sku?.value || '',
                  name: name?.value || '',
                  category: category?.value || 'General',
                  quantity: parseInt(quantity?.value || '0'),
                  reorderLevel: parseInt(reorderLevel?.value || '10'),
                  reorderQuantity: parseInt(reorderQuantity?.value || '20'),
                  unitPrice: parseFloat(unitPrice?.value || '0'),
                  unitCost: parseFloat(unitCost?.value || '0'),
                  location: location?.value,
                  supplier: supplier?.value,
                });
              }} disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Transaction Dialog */}
        <Dialog open={transactionDialogOpen} onOpenChange={setTransactionDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingTransaction ? 'Edit Transaction' : 'Create Transaction'}</DialogTitle>
              <DialogDescription>
                {editingTransaction ? 'Update transaction details' : 'Add a new financial transaction'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Transaction Number *</Label>
                  <Input
                    defaultValue={editingTransaction?.transactionNumber || ''}
                    placeholder="TXN-001"
                    id="transactionNumber"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Type *</Label>
                  <Select defaultValue={editingTransaction?.type || 'invoice'}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="invoice">Invoice</SelectItem>
                      <SelectItem value="payment">Payment</SelectItem>
                      <SelectItem value="refund">Refund</SelectItem>
                      <SelectItem value="expense">Expense</SelectItem>
                      <SelectItem value="revenue">Revenue</SelectItem>
                      <SelectItem value="adjustment">Adjustment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Amount *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    defaultValue={editingTransaction?.amount || 0}
                    id="transactionAmount"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Input
                    defaultValue={editingTransaction?.currency || 'USD'}
                    id="currency"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Account</Label>
                  <Input
                    defaultValue={editingTransaction?.account || ''}
                    placeholder="Account Name"
                    id="account"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select defaultValue={editingTransaction?.status || 'pending'}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="posted">Posted</SelectItem>
                      <SelectItem value="reconciled">Reconciled</SelectItem>
                      <SelectItem value="voided">Voided</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  defaultValue={editingTransaction?.description || ''}
                  placeholder="Transaction description"
                  id="transactionDescription"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTransactionDialogOpen(false)}>Cancel</Button>
              <Button onClick={() => {
                const transactionNumber = document.getElementById('transactionNumber') as HTMLInputElement;
                const type = document.querySelector('[value="invoice"]')?.parentElement?.querySelector('select')?.value || 'invoice';
                const amount = document.getElementById('transactionAmount') as HTMLInputElement;
                const currency = document.getElementById('currency') as HTMLInputElement;
                const account = document.getElementById('account') as HTMLInputElement;
                const description = document.getElementById('transactionDescription') as HTMLTextAreaElement;
                const status = document.querySelector('[value="pending"]')?.parentElement?.querySelector('select')?.value || 'pending';
                
                saveTransaction({
                  transactionNumber: transactionNumber?.value || '',
                  type: type as TransactionType,
                  amount: parseFloat(amount?.value || '0'),
                  currency: currency?.value || 'USD',
                  account: account?.value || 'General',
                  description: description?.value || '',
                  status: status as any,
                });
              }}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Employee Dialog */}
        <Dialog open={employeeDialogOpen} onOpenChange={setEmployeeDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingEmployee ? 'Edit Employee' : 'Create Employee'}</DialogTitle>
              <DialogDescription>
                {editingEmployee ? 'Update employee details' : 'Add a new employee'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Employee Number *</Label>
                  <Input
                    defaultValue={editingEmployee?.employeeNumber || ''}
                    placeholder="EMP-001"
                    id="employeeNumber"
                    className={employeeErrors.employeeNumber ? 'border-destructive' : ''}
                  />
                  {employeeErrors.employeeNumber && (
                    <p className="text-xs text-destructive">{employeeErrors.employeeNumber}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>First Name *</Label>
                  <Input
                    defaultValue={editingEmployee?.firstName || ''}
                    placeholder="John"
                    id="firstName"
                    className={employeeErrors.firstName ? 'border-destructive' : ''}
                  />
                  {employeeErrors.firstName && (
                    <p className="text-xs text-destructive">{employeeErrors.firstName}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Last Name *</Label>
                  <Input
                    defaultValue={editingEmployee?.lastName || ''}
                    placeholder="Doe"
                    id="lastName"
                    className={employeeErrors.lastName ? 'border-destructive' : ''}
                  />
                  {employeeErrors.lastName && (
                    <p className="text-xs text-destructive">{employeeErrors.lastName}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    defaultValue={editingEmployee?.email || ''}
                    placeholder="john.doe@example.com"
                    id="email"
                    className={employeeErrors.email ? 'border-destructive' : ''}
                  />
                  {employeeErrors.email && (
                    <p className="text-xs text-destructive">{employeeErrors.email}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    defaultValue={editingEmployee?.phone || ''}
                    placeholder="+1 234 567 8900"
                    id="phone"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Input
                    defaultValue={editingEmployee?.department || ''}
                    placeholder="Sales"
                    id="department"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Position</Label>
                  <Input
                    defaultValue={editingEmployee?.position || ''}
                    placeholder="Manager"
                    id="position"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select defaultValue={editingEmployee?.status || 'active'}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="on-leave">On Leave</SelectItem>
                      <SelectItem value="terminated">Terminated</SelectItem>
                      <SelectItem value="contractor">Contractor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Salary</Label>
                  <Input
                    type="number"
                    defaultValue={editingEmployee?.salary || 0}
                    id="salary"
                    className={employeeErrors.salary ? 'border-destructive' : ''}
                  />
                  {employeeErrors.salary && (
                    <p className="text-xs text-destructive">{employeeErrors.salary}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Location</Label>
                  <Input
                    defaultValue={editingEmployee?.location || ''}
                    placeholder="New York"
                    id="location"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setEmployeeDialogOpen(false);
                setEmployeeErrors({});
              }} disabled={loading}>Cancel</Button>
              <Button onClick={() => {
                const employeeNumber = document.getElementById('employeeNumber') as HTMLInputElement;
                const firstName = document.getElementById('firstName') as HTMLInputElement;
                const lastName = document.getElementById('lastName') as HTMLInputElement;
                const email = document.getElementById('email') as HTMLInputElement;
                const phone = document.getElementById('phone') as HTMLInputElement;
                const department = document.getElementById('department') as HTMLInputElement;
                const position = document.getElementById('position') as HTMLInputElement;
                const status = document.querySelector('[value="active"]')?.parentElement?.querySelector('select')?.value || 'active';
                const salary = document.getElementById('salary') as HTMLInputElement;
                const location = document.getElementById('location') as HTMLInputElement;
                
                saveEmployee({
                  employeeNumber: employeeNumber?.value || '',
                  firstName: firstName?.value || '',
                  lastName: lastName?.value || '',
                  email: email?.value,
                  phone: phone?.value,
                  department: department?.value || 'General',
                  position: position?.value || 'Employee',
                  status: status as EmployeeStatus,
                  salary: salary?.value ? parseFloat(salary.value) : undefined,
                  location: location?.value,
                });
              }} disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Manufacturing Order Dialog */}
        <Dialog open={manufacturingDialogOpen} onOpenChange={setManufacturingDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingManufacturing ? 'Edit Manufacturing Order' : 'Create Manufacturing Order'}</DialogTitle>
              <DialogDescription>
                {editingManufacturing ? 'Update manufacturing order details' : 'Add a new manufacturing order'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Order Number *</Label>
                  <Input
                    defaultValue={editingManufacturing?.orderNumber || ''}
                    placeholder="MO-001"
                    id="manufacturingOrderNumber"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Product ID *</Label>
                  <Input
                    defaultValue={editingManufacturing?.productId || ''}
                    placeholder="PROD-001"
                    id="productId"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Product Name *</Label>
                  <Input
                    defaultValue={editingManufacturing?.productName || ''}
                    placeholder="Product Name"
                    id="productName"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Quantity *</Label>
                  <Input
                    type="number"
                    defaultValue={editingManufacturing?.quantity || 0}
                    id="manufacturingQuantity"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select defaultValue={editingManufacturing?.status || 'planned'}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="planned">Planned</SelectItem>
                      <SelectItem value="released">Released</SelectItem>
                      <SelectItem value="in-progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Labor Cost</Label>
                  <Input
                    type="number"
                    step="0.01"
                    defaultValue={editingManufacturing?.laborCost || 0}
                    id="laborCost"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Overhead Cost</Label>
                  <Input
                    type="number"
                    step="0.01"
                    defaultValue={editingManufacturing?.overheadCost || 0}
                    id="overheadCost"
                  />
                </div>
              </div>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Materials</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setManufacturingFormMaterials([...manufacturingFormMaterials, {
                        id: `material-${Date.now()}`,
                        sku: '',
                        name: '',
                        quantity: 1,
                        unitCost: 0,
                      }]);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Material
                  </Button>
                </div>
                {manufacturingFormMaterials.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No materials added. Click "Add Material" to add materials to this order.</p>
                ) : (
                  <div className="space-y-2">
                    {manufacturingFormMaterials.map((material, index) => (
                      <Card key={material.id} className="p-3">
                        <div className="grid grid-cols-12 gap-2 items-end">
                          <div className="col-span-3 space-y-1">
                            <Label className="text-xs">SKU</Label>
                            <Input
                              value={material.sku}
                              onChange={(e) => {
                                const updated = [...manufacturingFormMaterials];
                                updated[index].sku = e.target.value;
                                setManufacturingFormMaterials(updated);
                              }}
                              placeholder="SKU-001"
                              className="h-8"
                            />
                          </div>
                          <div className="col-span-4 space-y-1">
                            <Label className="text-xs">Name</Label>
                            <Input
                              value={material.name}
                              onChange={(e) => {
                                const updated = [...manufacturingFormMaterials];
                                updated[index].name = e.target.value;
                                setManufacturingFormMaterials(updated);
                              }}
                              placeholder="Material Name"
                              className="h-8"
                            />
                          </div>
                          <div className="col-span-2 space-y-1">
                            <Label className="text-xs">Qty</Label>
                            <Input
                              type="number"
                              value={material.quantity}
                              onChange={(e) => {
                                const updated = [...manufacturingFormMaterials];
                                updated[index].quantity = parseInt(e.target.value) || 0;
                                setManufacturingFormMaterials(updated);
                              }}
                              className="h-8"
                            />
                          </div>
                          <div className="col-span-2 space-y-1">
                            <Label className="text-xs">Unit Cost</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={material.unitCost}
                              onChange={(e) => {
                                const updated = [...manufacturingFormMaterials];
                                updated[index].unitCost = parseFloat(e.target.value) || 0;
                                setManufacturingFormMaterials(updated);
                              }}
                              className="h-8"
                            />
                          </div>
                          <div className="col-span-1 space-y-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => {
                                setManufacturingFormMaterials(manufacturingFormMaterials.filter((_, i) => i !== index));
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                        {material.quantity > 0 && material.unitCost > 0 && (
                          <div className="mt-2 text-xs text-muted-foreground">
                            Total: ${(material.quantity * material.unitCost).toFixed(2)}
                          </div>
                        )}
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setManufacturingDialogOpen(false);
                setManufacturingFormMaterials([]);
              }}>Cancel</Button>
              <Button onClick={() => {
                const orderNumber = document.getElementById('manufacturingOrderNumber') as HTMLInputElement;
                const productId = document.getElementById('productId') as HTMLInputElement;
                const productName = document.getElementById('productName') as HTMLInputElement;
                const quantity = document.getElementById('manufacturingQuantity') as HTMLInputElement;
                const statusSelect = document.querySelector('select') as HTMLSelectElement;
                const status = statusSelect?.value || editingManufacturing?.status || 'planned';
                const laborCost = document.getElementById('laborCost') as HTMLInputElement;
                const overheadCost = document.getElementById('overheadCost') as HTMLInputElement;
                
                saveManufacturingOrder({
                  orderNumber: orderNumber?.value || '',
                  productId: productId?.value || '',
                  productName: productName?.value || '',
                  quantity: parseInt(quantity?.value || '0'),
                  status: status as ManufacturingOrderStatus,
                  materials: manufacturingFormMaterials.filter(m => m.sku && m.name && m.quantity > 0 && m.unitCost > 0),
                  laborCost: laborCost?.value ? parseFloat(laborCost.value) : undefined,
                  overheadCost: overheadCost?.value ? parseFloat(overheadCost.value) : undefined,
                });
                setManufacturingFormMaterials([]);
              }}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Supply Item Dialog */}
        <Dialog open={supplyDialogOpen} onOpenChange={setSupplyDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingSupply ? 'Edit Supply Item' : 'Create Supply Item'}</DialogTitle>
              <DialogDescription>
                {editingSupply ? 'Update supply item details' : 'Add a new purchase order'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>PO Number *</Label>
                  <Input
                    defaultValue={editingSupply?.purchaseOrderNumber || ''}
                    placeholder="PO-001"
                    id="purchaseOrderNumber"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Supplier *</Label>
                  <Input
                    defaultValue={editingSupply?.supplier || ''}
                    placeholder="Supplier Name"
                    id="supplier"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Item *</Label>
                  <Input
                    defaultValue={editingSupply?.item || ''}
                    placeholder="Item Name"
                    id="supplyItem"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Quantity *</Label>
                  <Input
                    type="number"
                    defaultValue={editingSupply?.quantity || 0}
                    id="supplyQuantity"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Unit Price *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    defaultValue={editingSupply?.unitPrice || 0}
                    id="supplyUnitPrice"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select defaultValue={editingSupply?.status || 'ordered'}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ordered">Ordered</SelectItem>
                      <SelectItem value="in-transit">In Transit</SelectItem>
                      <SelectItem value="received">Received</SelectItem>
                      <SelectItem value="delayed">Delayed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSupplyDialogOpen(false)}>Cancel</Button>
              <Button onClick={() => {
                const purchaseOrderNumber = document.getElementById('purchaseOrderNumber') as HTMLInputElement;
                const supplier = document.getElementById('supplier') as HTMLInputElement;
                const item = document.getElementById('supplyItem') as HTMLInputElement;
                const quantity = document.getElementById('supplyQuantity') as HTMLInputElement;
                const unitPrice = document.getElementById('supplyUnitPrice') as HTMLInputElement;
                const status = document.querySelector('[value="ordered"]')?.parentElement?.querySelector('select')?.value || 'ordered';
                
                saveSupplyItem({
                  purchaseOrderNumber: purchaseOrderNumber?.value || '',
                  supplier: supplier?.value || '',
                  item: item?.value || '',
                  quantity: parseInt(quantity?.value || '0'),
                  unitPrice: parseFloat(unitPrice?.value || '0'),
                  status: status as SupplyItemStatus,
                });
              }}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialogs */}
        <AlertDialog open={!!deleteOrderConfirm} onOpenChange={(open) => !open && setDeleteOrderConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete order <strong>{orders.find(o => o.id === deleteOrderConfirm)?.orderNumber || ''}</strong>? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmRemoveOrder}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!deleteInventoryConfirm} onOpenChange={(open) => !open && setDeleteInventoryConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete inventory item <strong>{inventory.find(i => i.id === deleteInventoryConfirm)?.sku || ''}</strong>? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmRemoveInventoryItem}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!deleteTransactionConfirm} onOpenChange={(open) => !open && setDeleteTransactionConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete transaction <strong>{transactions.find(t => t.id === deleteTransactionConfirm)?.transactionNumber || ''}</strong>? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmRemoveTransaction}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!deleteEmployeeConfirm} onOpenChange={(open) => !open && setDeleteEmployeeConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete employee <strong>{employees.find(e => e.id === deleteEmployeeConfirm)?.employeeNumber || ''}</strong>? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmRemoveEmployee}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!deleteManufacturingConfirm} onOpenChange={(open) => !open && setDeleteManufacturingConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete manufacturing order <strong>{manufacturingOrders.find(o => o.id === deleteManufacturingConfirm)?.orderNumber || ''}</strong>? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmRemoveManufacturingOrder}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!deleteSupplyConfirm} onOpenChange={(open) => !open && setDeleteSupplyConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete purchase order <strong>{supplyItems.find(s => s.id === deleteSupplyConfirm)?.purchaseOrderNumber || ''}</strong>? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmRemoveSupplyItem}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}


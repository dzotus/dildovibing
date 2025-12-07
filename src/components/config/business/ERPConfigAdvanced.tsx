import { useCanvasStore } from '@/store/useCanvasStore';
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
import { useState } from 'react';
import { 
  Settings, 
  Activity,
  Plus,
  Trash2,
  RefreshCcw,
  Building,
  Package,
  Users,
  DollarSign,
  TrendingUp,
  FileText
} from 'lucide-react';

interface ERPConfigProps {
  componentId: string;
}

interface Order {
  id: string;
  orderNumber: string;
  customer: string;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  total: number;
  items: number;
  orderDate: string;
  expectedDelivery?: string;
}

interface Inventory {
  id: string;
  sku: string;
  name: string;
  category: string;
  quantity: number;
  reorderLevel: number;
  unitPrice: number;
  status: 'in-stock' | 'low-stock' | 'out-of-stock';
}

interface ERPConfig {
  orders?: Order[];
  inventory?: Inventory[];
  totalOrders?: number;
  totalInventory?: number;
  totalValue?: number;
  lowStockItems?: number;
}

export function ERPConfigAdvanced({ componentId }: ERPConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as ERPConfig;
  const orders = config.orders || [];
  const inventory = config.inventory || [];
  const totalOrders = config.totalOrders || orders.length;
  const totalInventory = config.totalInventory || inventory.length;
  const totalValue = config.totalValue || inventory.reduce((sum, i) => sum + (i.quantity * i.unitPrice), 0);
  const lowStockItems = config.lowStockItems || inventory.filter((i) => i.status === 'low-stock' || i.status === 'out-of-stock').length;

  const [showCreateOrder, setShowCreateOrder] = useState(false);

  const updateConfig = (updates: Partial<ERPConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered':
      case 'in-stock':
        return 'bg-green-500';
      case 'processing':
      case 'shipped':
      case 'low-stock':
        return 'bg-yellow-500';
      case 'cancelled':
      case 'out-of-stock':
        return 'bg-red-500';
      case 'pending':
        return 'bg-blue-500';
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

        <div className="grid grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-blue-500 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20 dark:to-background">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Orders</CardTitle>
                <FileText className="h-4 w-4 text-blue-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">{totalOrders}</span>
                <span className="text-xs text-muted-foreground">active</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500 bg-gradient-to-br from-green-50 to-white dark:from-green-950/20 dark:to-background">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Inventory</CardTitle>
                <Package className="h-4 w-4 text-green-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-green-600 dark:text-green-400">{totalInventory}</span>
                <span className="text-xs text-muted-foreground">items</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-purple-500 bg-gradient-to-br from-purple-50 to-white dark:from-purple-950/20 dark:to-background">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Inventory Value</CardTitle>
                <DollarSign className="h-4 w-4 text-purple-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-purple-600 dark:text-purple-400">${(totalValue / 1000).toFixed(0)}K</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-red-500 bg-gradient-to-br from-red-50 to-white dark:from-red-950/20 dark:to-background">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Low Stock</CardTitle>
                <TrendingUp className="h-4 w-4 text-red-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-red-600 dark:text-red-400">{lowStockItems}</span>
                <span className="text-xs text-muted-foreground">items</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="orders" className="space-y-4">
          <TabsList>
            <TabsTrigger value="orders">
              <FileText className="h-4 w-4 mr-2" />
              Orders ({orders.length})
            </TabsTrigger>
            <TabsTrigger value="inventory">
              <Package className="h-4 w-4 mr-2" />
              Inventory ({inventory.length})
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
                  <Button onClick={() => setShowCreateOrder(true)} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Order
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {orders.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No orders configured</p>
                    <p className="text-xs mt-2">Click "Create Order" to add a new order</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {orders.map((order) => (
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
                                <Badge variant="outline" className="bg-green-50 dark:bg-green-950/20">
                                  ${order.total.toLocaleString()}
                                </Badge>
                                <Badge variant="outline">{order.items} items</Badge>
                              </div>
                            </div>
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
                <CardTitle>Inventory Management</CardTitle>
                <CardDescription>Product inventory and stock levels</CardDescription>
              </CardHeader>
              <CardContent>
                {inventory.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No inventory items configured</p>
                    <p className="text-xs mt-2">Click "Add Item" to add inventory items</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {inventory.map((item) => (
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
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Quantity:</span>
                            <span className="ml-2 font-semibold">{item.quantity}</span>
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
                      </CardContent>
                    </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>ERP Settings</CardTitle>
                <CardDescription>System configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Enable Order Processing</Label>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Enable Inventory Tracking</Label>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Enable Auto Reorder</Label>
                  <Switch />
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label>Default Currency</Label>
                  <Select defaultValue="USD">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Default Order Status</Label>
                  <Select defaultValue="pending">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="processing">Processing</SelectItem>
                      <SelectItem value="shipped">Shipped</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}


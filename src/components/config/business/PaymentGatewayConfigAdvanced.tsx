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
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect, useMemo } from 'react';
import { 
  Settings, 
  Activity,
  Plus,
  Trash2,
  Edit,
  RefreshCcw,
  CreditCard,
  DollarSign,
  CheckCircle,
  XCircle,
  Clock,
  Shield,
  TrendingUp,
  Search,
  Filter,
  AlertCircle,
  HelpCircle
} from 'lucide-react';
import type { 
  PaymentTransaction, PaymentWebhook, PaymentGatewayEmulationConfig,
  TransactionStatus, PaymentMethodType
} from '@/core/PaymentGatewayEmulationEngine';

interface PaymentGatewayConfigProps {
  componentId: string;
}

interface PaymentGatewayConfig extends PaymentGatewayEmulationConfig {
  // Extended config interface
}

export function PaymentGatewayConfigAdvanced({ componentId }: PaymentGatewayConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const { getComponentMetrics } = useEmulationStore();
  const { toast } = useToast();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  // Get Payment Gateway emulation engine for real-time metrics
  const pgEngine = emulationEngine.getPaymentGatewayEmulationEngine(componentId);
  const componentMetrics = getComponentMetrics(componentId);
  const customMetrics = componentMetrics?.customMetrics || {};

  const config = (node.data.config as any) || {} as PaymentGatewayConfig;
  
  // Initialize emulation engine on mount and when config changes
  useEffect(() => {
    if (pgEngine && node) {
      pgEngine.initializeConfig(node);
    }
  }, [node.id, JSON.stringify(node.data.config), pgEngine]);

  // Get transactions and webhooks from emulation engine if available, otherwise from config
  const engineTransactions = pgEngine?.getTransactions() || [];
  const engineWebhooks = pgEngine?.getWebhooks() || [];
  const configTransactions = config.transactions || [];
  const configWebhooks = config.webhooks || [];

  // Use engine data if available and initialized, otherwise fall back to config
  const transactions = useMemo(() => {
    if (engineTransactions.length > 0) {
      return engineTransactions.map(t => ({
        id: t.id,
        amount: t.amount,
        currency: t.currency,
        status: t.status,
        paymentMethod: t.paymentMethod,
        customerId: t.customerId,
        timestamp: new Date(t.timestamp).toISOString(),
        description: t.description,
        fee: t.fee,
        refundedAmount: t.refundedAmount,
      }));
    }
    return configTransactions;
  }, [engineTransactions, configTransactions]);

  const webhooks = useMemo(() => {
    if (engineWebhooks.length > 0) {
      return engineWebhooks.map(w => ({
        id: w.id,
        url: w.url,
        events: w.events,
        enabled: w.enabled,
        secret: w.secret,
      }));
    }
    return configWebhooks;
  }, [engineWebhooks, configWebhooks]);

  // Get real-time metrics from emulation engine or fallback to config
  const pgMetrics = pgEngine?.getMetrics();
  const totalTransactions = pgMetrics?.transactionsTotal ?? transactions.length;
  const totalAmount = pgMetrics?.totalAmount ?? transactions.reduce((sum, t) => sum + t.amount, 0);
  const successRate = pgMetrics?.successRate ? pgMetrics.successRate * 100 : (transactions.length > 0 ? (transactions.filter((t) => t.status === 'succeeded').length / transactions.length) * 100 : 0);
  const averageAmount = pgMetrics?.averageAmount ?? (transactions.length > 0 ? totalAmount / transactions.length : 0);
  const apiKey = config.apiKey || '';
  const secretKey = config.secretKey || '';
  const supportedCurrencies = config.supportedCurrencies || ['USD', 'EUR', 'GBP', 'JPY'];
  const supportedMethods = config.supportedMethods || ['card', 'bank_transfer', 'paypal', 'apple_pay'];
  const gatewayType = config.gatewayType || 'stripe';
  const enable3DSecure = config.enable3DSecure ?? true;
  const enableFraudDetection = config.enableFraudDetection ?? true;
  const enableRefunds = config.enableRefunds ?? true;
  const enableRecurringPayments = config.enableRecurringPayments ?? true;
  const enableCreditCards = config.enableCreditCards ?? true;
  const enableDebitCards = config.enableDebitCards ?? true;
  const enableACH = config.enableACH ?? false;
  const enableCryptocurrency = config.enableCryptocurrency ?? false;

  // State for dialogs and forms
  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false);
  const [webhookDialogOpen, setWebhookDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<PaymentTransaction | null>(null);
  const [editingWebhook, setEditingWebhook] = useState<PaymentWebhook | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const updateConfig = (updates: Partial<PaymentGatewayConfig>) => {
    const newConfig = { ...config, ...updates };
    updateNode(componentId, {
      data: {
        ...node.data,
        config: newConfig,
      },
    });
    
    // Update emulation engine config
    if (pgEngine) {
      pgEngine.updateConfig(updates);
    }
  };

  const addTransaction = (transaction: Omit<PaymentTransaction, 'id' | 'timestamp'>) => {
    const newTransaction: PaymentTransaction = {
      ...transaction,
      id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };
    
    if (pgEngine) {
      pgEngine.addTransaction(newTransaction);
    }
    
    updateConfig({ 
      transactions: [...transactions, {
        id: newTransaction.id,
        amount: newTransaction.amount,
        currency: newTransaction.currency,
        status: newTransaction.status,
        paymentMethod: newTransaction.paymentMethod,
        customerId: newTransaction.customerId,
        timestamp: new Date(newTransaction.timestamp).toISOString(),
        description: newTransaction.description,
      }] 
    });
    
    toast({
      title: 'Transaction added',
      description: `Transaction ${newTransaction.id} has been created.`,
    });
  };

  const updateTransaction = (id: string, updates: Partial<PaymentTransaction>) => {
    if (pgEngine) {
      pgEngine.updateTransaction(id, updates);
    }
    
    const updatedTransactions = transactions.map(t => 
      t.id === id ? { ...t, ...updates } : t
    );
    
    updateConfig({ transactions: updatedTransactions });
    
    toast({
      title: 'Transaction updated',
      description: `Transaction ${id} has been updated.`,
    });
  };

  const removeTransaction = (id: string) => {
    if (pgEngine) {
      pgEngine.removeTransaction(id);
    }
    
    updateConfig({ transactions: transactions.filter((t) => t.id !== id) });
    
    toast({
      title: 'Transaction removed',
      description: `Transaction ${id} has been deleted.`,
    });
  };

  const addWebhook = (webhook: Omit<PaymentWebhook, 'id'>) => {
    const newWebhook: PaymentWebhook = {
      ...webhook,
      id: `wh_${Date.now()}`,
    };
    
    if (pgEngine) {
      pgEngine.addWebhook(newWebhook);
    }
    
    updateConfig({ webhooks: [...webhooks, {
      id: newWebhook.id,
      url: newWebhook.url,
      events: newWebhook.events,
      enabled: newWebhook.enabled,
      secret: newWebhook.secret,
    }] });
    
    toast({
      title: 'Webhook added',
      description: `Webhook ${newWebhook.id} has been created.`,
    });
  };

  const updateWebhook = (id: string, updates: Partial<PaymentWebhook>) => {
    if (pgEngine) {
      pgEngine.updateWebhook(id, updates);
    }
    
    const updatedWebhooks = webhooks.map(w => 
      w.id === id ? { ...w, ...updates } : w
    );
    
    updateConfig({ webhooks: updatedWebhooks });
    
    toast({
      title: 'Webhook updated',
      description: `Webhook ${id} has been updated.`,
    });
  };

  const removeWebhook = (id: string) => {
    if (pgEngine) {
      pgEngine.removeWebhook(id);
    }
    
    updateConfig({ webhooks: webhooks.filter((w) => w.id !== id) });
    
    toast({
      title: 'Webhook removed',
      description: `Webhook ${id} has been deleted.`,
    });
  };

  const handleRefresh = () => {
    if (pgEngine && node) {
      pgEngine.initializeConfig(node);
    }
    toast({
      title: 'Refreshed',
      description: 'Payment Gateway data has been refreshed.',
    });
  };

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    let filtered = transactions;
    
    if (searchQuery) {
      filtered = filtered.filter(t => 
        t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.customerId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    if (statusFilter !== 'all') {
      filtered = filtered.filter(t => t.status === statusFilter);
    }
    
    return filtered;
  }, [transactions, searchQuery, statusFilter]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'succeeded':
        return 'bg-green-500';
      case 'pending':
      case 'processing':
        return 'bg-yellow-500';
      case 'failed':
        return 'bg-red-500';
      case 'refunded':
        return 'bg-blue-500';
      case 'cancelled':
        return 'bg-gray-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase text-muted-foreground tracking-wide">Payment Gateway</p>
            <h2 className="text-2xl font-bold text-foreground">Payment Processing</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Secure payment processing and transaction management
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCcw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-blue-500 min-w-0">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm font-medium text-muted-foreground truncate">Transactions</CardTitle>
                <Activity className="h-4 w-4 text-blue-500 flex-shrink-0" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2 min-w-0">
                <span className="text-2xl sm:text-3xl font-bold text-blue-600 dark:text-blue-400 truncate">{totalTransactions}</span>
                <span className="text-xs text-muted-foreground flex-shrink-0">total</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500 min-w-0">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm font-medium text-muted-foreground truncate">Total Amount</CardTitle>
                <DollarSign className="h-4 w-4 text-green-500 flex-shrink-0" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2 min-w-0">
                <span className="text-2xl sm:text-3xl font-bold text-green-600 dark:text-green-400 truncate">${totalAmount.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-purple-500 min-w-0">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm font-medium text-muted-foreground truncate">Success Rate</CardTitle>
                <TrendingUp className="h-4 w-4 text-purple-500 flex-shrink-0" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2 min-w-0">
                <span className="text-2xl sm:text-3xl font-bold text-purple-600 dark:text-purple-400 truncate">{successRate.toFixed(1)}%</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-cyan-500 min-w-0">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm font-medium text-muted-foreground truncate">Avg Amount</CardTitle>
                <CreditCard className="h-4 w-4 text-cyan-500 flex-shrink-0" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2 min-w-0">
                <span className="text-2xl sm:text-3xl font-bold text-cyan-600 dark:text-cyan-400 truncate">${averageAmount.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="transactions" className="space-y-4">
          <TabsList className="flex-wrap">
            <TabsTrigger value="transactions" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              <span className="hidden sm:inline">Transactions</span>
              <Badge variant="secondary" className="ml-1">{transactions.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="webhooks" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Webhooks</span>
              <Badge variant="secondary" className="ml-1">{webhooks.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="transactions" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <CardTitle>Transactions</CardTitle>
                    <CardDescription>Payment transaction history</CardDescription>
                  </div>
                  <Button onClick={() => { setEditingTransaction(null); setTransactionDialogOpen(true); }} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Transaction
                  </Button>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 mt-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search transactions..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="succeeded">Succeeded</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="processing">Processing</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                      <SelectItem value="refunded">Refunded</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredTransactions.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No transactions found</p>
                    </div>
                  ) : (
                    filteredTransactions.map((txn) => (
                    <Card key={txn.id} className="border-l-4 border-l-blue-500 hover:shadow-md transition-shadow bg-gradient-to-r from-blue-50/50 to-transparent dark:from-blue-950/10">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg ${getStatusColor(txn.status)}/20`}>
                              {txn.status === 'succeeded' ? (
                                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                              ) : txn.status === 'pending' || txn.status === 'processing' ? (
                                <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                              ) : txn.status === 'refunded' ? (
                                <RefreshCcw className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                              ) : txn.status === 'cancelled' ? (
                                <XCircle className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                              ) : (
                                <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                              )}
                            </div>
                            <div>
                              <CardTitle className="text-lg font-semibold">{txn.id}</CardTitle>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant="outline" className={getStatusColor(txn.status)}>
                                  {txn.status}
                                </Badge>
                                <Badge variant="outline">{txn.paymentMethod}</Badge>
                                <Badge variant="outline">{txn.currency}</Badge>
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <div className="text-2xl font-bold">${txn.amount.toFixed(2)} {txn.currency}</div>
                            <div className="text-xs text-muted-foreground">{new Date(txn.timestamp).toLocaleString()}</div>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => { setEditingTransaction(txn as any); setTransactionDialogOpen(true); }}
                                className="h-8 w-8"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeTransaction(txn.id)}
                                className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {txn.description && (
                          <p className="text-sm text-muted-foreground mb-2">{txn.description}</p>
                        )}
                        {txn.customerId && (
                          <p className="text-xs text-muted-foreground">Customer: {txn.customerId}</p>
                        )}
                        {txn.fee && (
                          <p className="text-xs text-muted-foreground">Fee: ${txn.fee.toFixed(2)}</p>
                        )}
                        {txn.refundedAmount && (
                          <p className="text-xs text-orange-600 dark:text-orange-400">Refunded: ${txn.refundedAmount.toFixed(2)}</p>
                        )}
                      </CardContent>
                    </Card>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="webhooks" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Webhooks</CardTitle>
                    <CardDescription>Configure webhook endpoints</CardDescription>
                  </div>
                  <Button onClick={() => { setEditingWebhook(null); setWebhookDialogOpen(true); }} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Webhook
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {webhooks.map((webhook) => (
                    <Card key={webhook.id} className="border-l-4 border-l-purple-500 hover:shadow-md transition-shadow bg-gradient-to-r from-purple-50/50 to-transparent dark:from-purple-950/10">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                              <Shield className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                            </div>
                            <div>
                              <CardTitle className="text-lg font-semibold">{webhook.id}</CardTitle>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant={webhook.enabled ? 'default' : 'outline'}>
                                  {webhook.enabled ? 'Enabled' : 'Disabled'}
                                </Badge>
                                <Badge variant="outline" className="font-mono text-xs">{webhook.url}</Badge>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => { setEditingWebhook(webhook as any); setWebhookDialogOpen(true); }}
                              className="h-8 w-8"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeWebhook(webhook.id)}
                              className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {webhook.events && webhook.events.length > 0 && (
                          <div className="space-y-2">
                            <Label>Events</Label>
                            <div className="flex flex-wrap gap-2">
                              {webhook.events.map((event, idx) => (
                                <Badge key={idx} variant="outline">{event}</Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Payment Gateway Settings</CardTitle>
                <CardDescription>API credentials and configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>API Key</Label>
                  <Input
                    type="password"
                    value={apiKey}
                    onChange={(e) => updateConfig({ apiKey: e.target.value })}
                    placeholder="pk_live_***"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Secret Key</Label>
                  <Input
                    type="password"
                    value={secretKey}
                    onChange={(e) => updateConfig({ secretKey: e.target.value })}
                    placeholder="sk_live_***"
                  />
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label>Supported Currencies</Label>
                  <div className="flex flex-wrap gap-2">
                    {supportedCurrencies.map((curr) => (
                      <Badge key={curr} variant="outline">{curr}</Badge>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Supported Payment Methods</Label>
                  <div className="flex flex-wrap gap-2">
                    {supportedMethods.map((method) => (
                      <Badge key={method} variant="outline">{method}</Badge>
                    ))}
                  </div>
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label>Gateway Type</Label>
                  <Select value={gatewayType} onValueChange={(value) => updateConfig({ gatewayType: value as any })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="stripe">Stripe</SelectItem>
                      <SelectItem value="paypal">PayPal</SelectItem>
                      <SelectItem value="square">Square</SelectItem>
                      <SelectItem value="adyen">Adyen</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Separator />
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Enable 3D Secure</Label>
                      <p className="text-xs text-muted-foreground">Additional authentication for cards</p>
                    </div>
                    <Switch checked={enable3DSecure} onCheckedChange={(checked) => updateConfig({ enable3DSecure: checked })} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Enable Fraud Detection</Label>
                      <p className="text-xs text-muted-foreground">Automatically detect fraudulent transactions</p>
                    </div>
                    <Switch checked={enableFraudDetection} onCheckedChange={(checked) => updateConfig({ enableFraudDetection: checked })} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Enable Refunds</Label>
                      <p className="text-xs text-muted-foreground">Allow refund processing</p>
                    </div>
                    <Switch checked={enableRefunds} onCheckedChange={(checked) => updateConfig({ enableRefunds: checked })} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Enable Recurring Payments</Label>
                      <p className="text-xs text-muted-foreground">Support subscription payments</p>
                    </div>
                    <Switch checked={enableRecurringPayments} onCheckedChange={(checked) => updateConfig({ enableRecurringPayments: checked })} />
                  </div>
                </div>
                <Separator />
                <div className="space-y-4">
                  <Label>Payment Methods</Label>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="font-normal">Credit Cards</Label>
                      <Switch checked={enableCreditCards} onCheckedChange={(checked) => updateConfig({ enableCreditCards: checked })} />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="font-normal">Debit Cards</Label>
                      <Switch checked={enableDebitCards} onCheckedChange={(checked) => updateConfig({ enableDebitCards: checked })} />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="font-normal">ACH</Label>
                      <Switch checked={enableACH} onCheckedChange={(checked) => updateConfig({ enableACH: checked })} />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="font-normal">Cryptocurrency</Label>
                      <Switch checked={enableCryptocurrency} onCheckedChange={(checked) => updateConfig({ enableCryptocurrency: checked })} />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Transaction Dialog */}
      <Dialog open={transactionDialogOpen} onOpenChange={setTransactionDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTransaction ? 'Edit Transaction' : 'Add Transaction'}</DialogTitle>
            <DialogDescription>
              {editingTransaction ? 'Update transaction details' : 'Create a new payment transaction'}
            </DialogDescription>
          </DialogHeader>
          <TransactionForm
            transaction={editingTransaction}
            supportedCurrencies={supportedCurrencies}
            supportedMethods={supportedMethods}
            onSave={(data) => {
              if (editingTransaction) {
                updateTransaction(editingTransaction.id, data);
              } else {
                addTransaction(data);
              }
              setTransactionDialogOpen(false);
              setEditingTransaction(null);
            }}
            onCancel={() => {
              setTransactionDialogOpen(false);
              setEditingTransaction(null);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Webhook Dialog */}
      <Dialog open={webhookDialogOpen} onOpenChange={setWebhookDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingWebhook ? 'Edit Webhook' : 'Add Webhook'}</DialogTitle>
            <DialogDescription>
              {editingWebhook ? 'Update webhook configuration' : 'Create a new webhook endpoint'}
            </DialogDescription>
          </DialogHeader>
          <WebhookForm
            webhook={editingWebhook}
            onSave={(data) => {
              if (editingWebhook) {
                updateWebhook(editingWebhook.id, data);
              } else {
                addWebhook(data);
              }
              setWebhookDialogOpen(false);
              setEditingWebhook(null);
            }}
            onCancel={() => {
              setWebhookDialogOpen(false);
              setEditingWebhook(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Transaction Form Component
function TransactionForm({
  transaction,
  supportedCurrencies,
  supportedMethods,
  onSave,
  onCancel,
}: {
  transaction: PaymentTransaction | null;
  supportedCurrencies: string[];
  supportedMethods: string[];
  onSave: (data: Omit<PaymentTransaction, 'id' | 'timestamp'>) => void;
  onCancel: () => void;
}) {
  const [amount, setAmount] = useState(transaction?.amount.toString() || '');
  const [currency, setCurrency] = useState(transaction?.currency || supportedCurrencies[0]);
  const [status, setStatus] = useState<TransactionStatus>(transaction?.status || 'pending');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>(transaction?.paymentMethod as PaymentMethodType || supportedMethods[0] as PaymentMethodType);
  const [customerId, setCustomerId] = useState(transaction?.customerId || '');
  const [description, setDescription] = useState(transaction?.description || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      amount: parseFloat(amount) || 0,
      currency,
      status,
      paymentMethod,
      customerId: customerId || undefined,
      description: description || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Amount *</Label>
          <Input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Currency *</Label>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {supportedCurrencies.map((curr) => (
                <SelectItem key={curr} value={curr}>{curr}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Status *</Label>
          <Select value={status} onValueChange={(value) => setStatus(value as TransactionStatus)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="succeeded">Succeeded</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="refunded">Refunded</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Payment Method *</Label>
          <Select value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as PaymentMethodType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {supportedMethods.map((method) => (
                <SelectItem key={method} value={method}>{method}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Customer ID</Label>
        <Input
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          placeholder="cust_..."
        />
      </div>
      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Transaction description"
          rows={3}
        />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          {transaction ? 'Update' : 'Create'}
        </Button>
      </DialogFooter>
    </form>
  );
}

// Webhook Form Component
function WebhookForm({
  webhook,
  onSave,
  onCancel,
}: {
  webhook: PaymentWebhook | null;
  onSave: (data: Omit<PaymentWebhook, 'id'>) => void;
  onCancel: () => void;
}) {
  const [url, setUrl] = useState(webhook?.url || '');
  const [events, setEvents] = useState<string[]>(webhook?.events || []);
  const [enabled, setEnabled] = useState(webhook?.enabled ?? true);
  const [secret, setSecret] = useState(webhook?.secret || '');

  const availableEvents = [
    'payment.succeeded',
    'payment.failed',
    'payment.pending',
    'payment.refunded',
    'payment.cancelled',
    'payment.*',
  ];

  const toggleEvent = (event: string) => {
    if (events.includes(event)) {
      setEvents(events.filter(e => e !== event));
    } else {
      setEvents([...events, event]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      url,
      events,
      enabled,
      secret: secret || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>URL *</Label>
        <Input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://api.example.com/webhooks/payment"
          required
        />
      </div>
      <div className="space-y-2">
        <Label>Events *</Label>
        <div className="flex flex-wrap gap-2 p-3 border rounded-md min-h-[100px]">
          {availableEvents.map((event) => (
            <Badge
              key={event}
              variant={events.includes(event) ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => toggleEvent(event)}
            >
              {event}
            </Badge>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Click events to toggle selection</p>
      </div>
      <div className="space-y-2">
        <Label>Secret</Label>
        <Input
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder="Webhook secret (optional)"
        />
      </div>
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label>Enabled</Label>
          <p className="text-xs text-muted-foreground">Enable or disable this webhook</p>
        </div>
        <Switch checked={enabled} onCheckedChange={setEnabled} />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          {webhook ? 'Update' : 'Create'}
        </Button>
      </DialogFooter>
    </form>
  );
}


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
  CreditCard,
  DollarSign,
  CheckCircle,
  XCircle,
  Clock,
  Shield,
  TrendingUp,
  Users
} from 'lucide-react';

interface PaymentGatewayConfigProps {
  componentId: string;
}

interface Transaction {
  id: string;
  amount: number;
  currency: string;
  status: 'succeeded' | 'pending' | 'failed' | 'refunded';
  paymentMethod: string;
  customerId?: string;
  timestamp: string;
  description?: string;
}

interface Webhook {
  id: string;
  url: string;
  events: string[];
  enabled: boolean;
  secret?: string;
}

interface PaymentGatewayConfig {
  transactions?: Transaction[];
  webhooks?: Webhook[];
  totalTransactions?: number;
  totalAmount?: number;
  successRate?: number;
  averageAmount?: number;
  apiKey?: string;
  secretKey?: string;
  supportedCurrencies?: string[];
  supportedMethods?: string[];
}

export function PaymentGatewayConfigAdvanced({ componentId }: PaymentGatewayConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as PaymentGatewayConfig;
  const transactions = config.transactions || [];
  const webhooks = config.webhooks || [];
  const totalTransactions = config.totalTransactions || transactions.length;
  const totalAmount = config.totalAmount || transactions.reduce((sum, t) => sum + t.amount, 0);
  const successRate = config.successRate || (transactions.length > 0 ? (transactions.filter((t) => t.status === 'succeeded').length / transactions.length) * 100 : 0);
  const averageAmount = config.averageAmount || (transactions.length > 0 ? totalAmount / transactions.length : 0);
  const apiKey = config.apiKey || 'pk_live_***';
  const secretKey = config.secretKey || 'sk_live_***';
  const supportedCurrencies = config.supportedCurrencies || ['USD', 'EUR', 'GBP', 'JPY'];
  const supportedMethods = config.supportedMethods || ['card', 'bank_transfer', 'paypal', 'apple_pay'];

  const [showCreateWebhook, setShowCreateWebhook] = useState(false);

  const updateConfig = (updates: Partial<PaymentGatewayConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  const addWebhook = () => {
    const newWebhook: Webhook = {
      id: `wh_${Date.now()}`,
      url: 'https://api.example.com/webhooks/new',
      events: [],
      enabled: true,
    };
    updateConfig({ webhooks: [...webhooks, newWebhook] });
    setShowCreateWebhook(false);
  };

  const removeWebhook = (id: string) => {
    updateConfig({ webhooks: webhooks.filter((w) => w.id !== id) });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'succeeded':
        return 'bg-green-500';
      case 'pending':
        return 'bg-yellow-500';
      case 'failed':
        return 'bg-red-500';
      case 'refunded':
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
            <p className="text-xs uppercase text-muted-foreground tracking-wide">Payment Gateway</p>
            <h2 className="text-2xl font-bold text-foreground">Payment Processing</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Secure payment processing and transaction management
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
                <CardTitle className="text-sm font-medium text-muted-foreground">Transactions</CardTitle>
                <Activity className="h-4 w-4 text-blue-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">{totalTransactions}</span>
                <span className="text-xs text-muted-foreground">total</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500 bg-gradient-to-br from-green-50 to-white dark:from-green-950/20 dark:to-background">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Amount</CardTitle>
                <DollarSign className="h-4 w-4 text-green-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-green-600 dark:text-green-400">${totalAmount.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-purple-500 bg-gradient-to-br from-purple-50 to-white dark:from-purple-950/20 dark:to-background">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Success Rate</CardTitle>
                <TrendingUp className="h-4 w-4 text-purple-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-purple-600 dark:text-purple-400">{successRate.toFixed(1)}%</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-cyan-500 bg-gradient-to-br from-cyan-50 to-white dark:from-cyan-950/20 dark:to-background">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Avg Amount</CardTitle>
                <CreditCard className="h-4 w-4 text-cyan-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-cyan-600 dark:text-cyan-400">${averageAmount.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="transactions" className="space-y-4">
          <TabsList>
            <TabsTrigger value="transactions">
              <Activity className="h-4 w-4 mr-2" />
              Transactions ({transactions.length})
            </TabsTrigger>
            <TabsTrigger value="webhooks">
              <Shield className="h-4 w-4 mr-2" />
              Webhooks ({webhooks.length})
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="transactions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Transactions</CardTitle>
                <CardDescription>Payment transaction history</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {transactions.map((txn) => (
                    <Card key={txn.id} className="border-l-4 border-l-blue-500 hover:shadow-md transition-shadow bg-gradient-to-r from-blue-50/50 to-transparent dark:from-blue-950/10">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg ${getStatusColor(txn.status)}/20`}>
                              {txn.status === 'succeeded' ? (
                                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                              ) : txn.status === 'pending' ? (
                                <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
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
                          <div className="text-right">
                            <div className="text-2xl font-bold">${txn.amount.toFixed(2)}</div>
                            <div className="text-xs text-muted-foreground">{new Date(txn.timestamp).toLocaleString()}</div>
                          </div>
                        </div>
                      </CardHeader>
                      {txn.description && (
                        <CardContent>
                          <p className="text-sm text-muted-foreground">{txn.description}</p>
                        </CardContent>
                      )}
                    </Card>
                  ))}
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
                  <Button onClick={addWebhook} size="sm">
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
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeWebhook(webhook.id)}
                            className="hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
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
                <div className="flex items-center justify-between">
                  <Label>Enable 3D Secure</Label>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Enable Fraud Detection</Label>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Enable Auto-Refund</Label>
                  <Switch />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}


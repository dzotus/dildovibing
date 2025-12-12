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
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useState } from 'react';
import { 
  Settings, 
  Activity,
  Plus,
  Trash2,
  RefreshCcw,
  Webhook,
  Send,
  CheckCircle,
  XCircle,
  Clock,
  Zap,
  Network,
  Edit,
  X,
  AlertTriangle,
  Copy,
  Shield,
  Code
} from 'lucide-react';

interface WebhookRelayConfigProps {
  componentId: string;
}

interface Relay {
  id: string;
  name: string;
  sourceUrl: string;
  targetUrl: string;
  enabled: boolean;
  events?: string[];
  requests?: number;
  successRate?: number;
  signatureSecret?: string;
  signatureHeader?: string;
  allowedIps?: string[];
  transformTemplate?: string;
  maxRetryAttempts?: number;
  retryDelay?: number;
  timeout?: number;
  retryBackoff?: 'exponential' | 'linear' | 'constant';
}

interface Delivery {
  id: string;
  relayId: string;
  event: string;
  payload: string;
  status: 'pending' | 'success' | 'failed';
  timestamp: string;
  attempts?: number;
  responseCode?: number;
}

interface WebhookRelayConfig {
  relays?: Relay[];
  deliveries?: Delivery[];
  totalRelays?: number;
  totalDeliveries?: number;
  successRate?: number;
  enableRetryOnFailure?: boolean;
  enableSignatureVerification?: boolean;
  enableRequestLogging?: boolean;
  maxRetryAttempts?: number;
  retryDelay?: number;
  timeout?: number;
}

export function WebhookRelayConfigAdvanced({ componentId }: WebhookRelayConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as WebhookRelayConfig;
  const relays = config.relays || [];
  const deliveries = config.deliveries || [];
  const totalRelays = config.totalRelays || relays.length;
  const totalDeliveries = config.totalDeliveries || deliveries.length;
  const successRate = config.successRate || (deliveries.length > 0 ? (deliveries.filter((d) => d.status === 'success').length / deliveries.length) * 100 : 0);

  const [showCreateRelay, setShowCreateRelay] = useState(false);
  const [editingRelayId, setEditingRelayId] = useState<string | null>(null);
  const [expandedRelayId, setExpandedRelayId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<'name' | 'sourceUrl' | 'targetUrl' | null>(null);
  
  // Form state for creating/editing relay
  const [relayForm, setRelayForm] = useState<Partial<Relay>>({
    name: '',
    sourceUrl: '',
    targetUrl: '',
    enabled: true,
    events: [],
    signatureSecret: '',
    signatureHeader: 'X-Signature',
    allowedIps: [],
    transformTemplate: '',
    maxRetryAttempts: config.maxRetryAttempts || 3,
    retryDelay: config.retryDelay || 5,
    timeout: config.timeout || 30,
    retryBackoff: 'exponential',
  });
  
  const [newEvent, setNewEvent] = useState('');
  const [newIp, setNewIp] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const updateConfig = (updates: Partial<WebhookRelayConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  const validateUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const validateIp = (ip: string): boolean => {
    // Simple CIDR validation (basic check)
    const cidrPattern = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
    return cidrPattern.test(ip);
  };

  const openCreateDialog = () => {
    setRelayForm({
      name: '',
      sourceUrl: '',
      targetUrl: '',
      enabled: true,
      events: [],
      signatureSecret: '',
      signatureHeader: 'X-Signature',
      allowedIps: [],
      transformTemplate: '',
      maxRetryAttempts: config.maxRetryAttempts || 3,
      retryDelay: config.retryDelay || 5,
      timeout: config.timeout || 30,
      retryBackoff: 'exponential',
    });
    setFormErrors({});
    setShowCreateRelay(true);
  };

  const openEditDialog = (relay: Relay) => {
    setRelayForm({
      name: relay.name,
      sourceUrl: relay.sourceUrl,
      targetUrl: relay.targetUrl,
      enabled: relay.enabled,
      events: relay.events || [],
      signatureSecret: relay.signatureSecret || '',
      signatureHeader: relay.signatureHeader || 'X-Signature',
      allowedIps: relay.allowedIps || [],
      transformTemplate: relay.transformTemplate || '',
      maxRetryAttempts: relay.maxRetryAttempts || config.maxRetryAttempts || 3,
      retryDelay: relay.retryDelay || config.retryDelay || 5,
      timeout: relay.timeout || config.timeout || 30,
      retryBackoff: relay.retryBackoff || 'exponential',
    });
    setFormErrors({});
    setEditingRelayId(relay.id);
    setShowCreateRelay(true);
  };

  const closeDialog = () => {
    setShowCreateRelay(false);
    setEditingRelayId(null);
    setFormErrors({});
    setNewEvent('');
    setNewIp('');
  };

  const addRelay = () => {
    const errors: Record<string, string> = {};
    
    if (!relayForm.name?.trim()) {
      errors.name = 'Name is required';
    }
    if (!relayForm.sourceUrl?.trim()) {
      errors.sourceUrl = 'Source URL is required';
    } else if (!validateUrl(relayForm.sourceUrl)) {
      errors.sourceUrl = 'Invalid URL format';
    }
    if (!relayForm.targetUrl?.trim()) {
      errors.targetUrl = 'Target URL is required';
    } else if (!validateUrl(relayForm.targetUrl)) {
      errors.targetUrl = 'Invalid URL format';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    if (editingRelayId) {
      // Update existing relay
      const updatedRelays = relays.map((r) =>
        r.id === editingRelayId
          ? {
              ...r,
              ...relayForm,
              events: relayForm.events || [],
              allowedIps: relayForm.allowedIps || [],
            }
          : r
      );
      updateConfig({ relays: updatedRelays });
    } else {
      // Create new relay
      const newRelay: Relay = {
        id: `relay-${Date.now()}`,
        name: relayForm.name!,
        sourceUrl: relayForm.sourceUrl!,
        targetUrl: relayForm.targetUrl!,
        enabled: relayForm.enabled ?? true,
        events: relayForm.events || [],
        signatureSecret: relayForm.signatureSecret,
        signatureHeader: relayForm.signatureHeader || 'X-Signature',
        allowedIps: relayForm.allowedIps || [],
        transformTemplate: relayForm.transformTemplate,
        maxRetryAttempts: relayForm.maxRetryAttempts,
        retryDelay: relayForm.retryDelay,
        timeout: relayForm.timeout,
        retryBackoff: relayForm.retryBackoff || 'exponential',
      };
      updateConfig({ relays: [...relays, newRelay] });
    }
    
    closeDialog();
  };

  const removeRelay = (id: string) => {
    updateConfig({ relays: relays.filter((r) => r.id !== id) });
  };

  const toggleRelay = (id: string) => {
    const newRelays = relays.map((r) =>
      r.id === id ? { ...r, enabled: !r.enabled } : r
    );
    updateConfig({ relays: newRelays });
  };

  const updateRelay = (id: string, field: keyof Relay, value: any) => {
    const updatedRelays = relays.map((r) =>
      r.id === id ? { ...r, [field]: value } : r
    );
    updateConfig({ relays: updatedRelays });
  };

  const addEvent = () => {
    if (newEvent.trim() && !relayForm.events?.includes(newEvent.trim())) {
      setRelayForm({
        ...relayForm,
        events: [...(relayForm.events || []), newEvent.trim()],
      });
      setNewEvent('');
    }
  };

  const removeEvent = (event: string) => {
    setRelayForm({
      ...relayForm,
      events: relayForm.events?.filter((e) => e !== event) || [],
    });
  };

  const addIp = () => {
    if (newIp.trim()) {
      if (!validateIp(newIp.trim())) {
        setFormErrors({ ...formErrors, allowedIps: 'Invalid IP/CIDR format (e.g., 192.168.1.0/24)' });
        return;
      }
      if (!relayForm.allowedIps?.includes(newIp.trim())) {
        setRelayForm({
          ...relayForm,
          allowedIps: [...(relayForm.allowedIps || []), newIp.trim()],
        });
        setNewIp('');
        setFormErrors({ ...formErrors, allowedIps: '' });
      }
    }
  };

  const removeIp = (ip: string) => {
    setRelayForm({
      ...relayForm,
      allowedIps: relayForm.allowedIps?.filter((i) => i !== ip) || [],
    });
  };

  const duplicateRelay = (relay: Relay) => {
    const newRelay: Relay = {
      ...relay,
      id: `relay-${Date.now()}`,
      name: `${relay.name} (Copy)`,
    };
    updateConfig({ relays: [...relays, newRelay] });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-500';
      case 'failed':
        return 'bg-red-500';
      case 'pending':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase text-muted-foreground tracking-wide">Webhook Relay</p>
            <h2 className="text-2xl font-bold text-foreground">Webhook Relay Service</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Relay and forward webhook events between services
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

        <div className="grid grid-cols-3 gap-4">
          <Card className="border-l-4 border-l-blue-500 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Relays</CardTitle>
                <Webhook className="h-4 w-4 text-blue-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">{totalRelays}</span>
                <span className="text-xs text-muted-foreground">configured</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Deliveries</CardTitle>
                <Send className="h-4 w-4 text-green-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-green-600 dark:text-green-400">{totalDeliveries}</span>
                <span className="text-xs text-muted-foreground">total</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-purple-500 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Success Rate</CardTitle>
                <CheckCircle className="h-4 w-4 text-purple-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-purple-600 dark:text-purple-400">{successRate.toFixed(1)}%</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="relays" className="space-y-4">
          <TabsList>
            <TabsTrigger value="relays">
              <Webhook className="h-4 w-4 mr-2" />
              Relays ({relays.length})
            </TabsTrigger>
            <TabsTrigger value="deliveries">
              <Activity className="h-4 w-4 mr-2" />
              Deliveries ({deliveries.length})
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="relays" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Webhook Relays</CardTitle>
                    <CardDescription>Configure webhook relay rules</CardDescription>
                  </div>
                  <Button onClick={openCreateDialog} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Relay
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {relays.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Webhook className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No relays configured</p>
                      <p className="text-sm mt-2">Click "Create Relay" to add your first webhook relay</p>
                    </div>
                  ) : (
                    relays.map((relay) => (
                      <Card key={relay.id} className="border-l-4 border-l-blue-500 hover:shadow-md transition-shadow bg-card">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-start gap-3 flex-1">
                              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                                <Webhook className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                {editingField === 'name' && editingRelayId === relay.id ? (
                                  <Input
                                    value={relay.name}
                                    onChange={(e) => updateRelay(relay.id, 'name', e.target.value)}
                                    onBlur={() => {
                                      setEditingField(null);
                                      setEditingRelayId(null);
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' || e.key === 'Escape') {
                                        setEditingField(null);
                                        setEditingRelayId(null);
                                      }
                                    }}
                                    className="font-semibold text-lg"
                                    autoFocus
                                  />
                                ) : (
                                  <CardTitle 
                                    className="text-lg font-semibold cursor-pointer hover:text-primary transition-colors"
                                    onClick={() => {
                                      setEditingField('name');
                                      setEditingRelayId(relay.id);
                                    }}
                                  >
                                    {relay.name}
                                  </CardTitle>
                                )}
                                <div className="flex items-center gap-2 mt-2 flex-wrap">
                                  <Badge variant={relay.enabled ? 'default' : 'outline'}>
                                    {relay.enabled ? 'Enabled' : 'Disabled'}
                                  </Badge>
                                  {relay.successRate !== undefined && (
                                    <Badge variant="outline" className="bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-300">
                                      {relay.successRate.toFixed(1)}% success
                                    </Badge>
                                  )}
                                  {relay.requests !== undefined && (
                                    <Badge variant="outline">{relay.requests} requests</Badge>
                                  )}
                                  {relay.events && relay.events.length > 0 && (
                                    <Badge variant="outline" className="text-xs">
                                      {relay.events.length} event{relay.events.length !== 1 ? 's' : ''}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={relay.enabled}
                                onCheckedChange={() => toggleRelay(relay.id)}
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditDialog(relay)}
                                className="hover:bg-primary/10"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => duplicateRelay(relay)}
                                className="hover:bg-primary/10"
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeRelay(relay.id)}
                                className="hover:bg-destructive/10 hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Source URL</Label>
                                {editingField === 'sourceUrl' && editingRelayId === relay.id ? (
                                  <Input
                                    value={relay.sourceUrl}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      if (validateUrl(value) || value === '') {
                                        updateRelay(relay.id, 'sourceUrl', value);
                                        setFormErrors({});
                                      } else {
                                        setFormErrors({ sourceUrl: 'Invalid URL format' });
                                      }
                                    }}
                                    onBlur={() => {
                                      setEditingField(null);
                                      setEditingRelayId(null);
                                      setFormErrors({});
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' || e.key === 'Escape') {
                                        setEditingField(null);
                                        setEditingRelayId(null);
                                        setFormErrors({});
                                      }
                                    }}
                                    className="font-mono text-xs"
                                    autoFocus
                                  />
                                ) : (
                                  <div 
                                    className="font-mono text-xs text-foreground cursor-pointer hover:text-primary transition-colors p-1 rounded"
                                    onClick={() => {
                                      setEditingField('sourceUrl');
                                      setEditingRelayId(relay.id);
                                    }}
                                  >
                                    {relay.sourceUrl}
                                  </div>
                                )}
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Target URL</Label>
                                {editingField === 'targetUrl' && editingRelayId === relay.id ? (
                                  <Input
                                    value={relay.targetUrl}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      if (validateUrl(value) || value === '') {
                                        updateRelay(relay.id, 'targetUrl', value);
                                        setFormErrors({});
                                      } else {
                                        setFormErrors({ targetUrl: 'Invalid URL format' });
                                      }
                                    }}
                                    onBlur={() => {
                                      setEditingField(null);
                                      setEditingRelayId(null);
                                      setFormErrors({});
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' || e.key === 'Escape') {
                                        setEditingField(null);
                                        setEditingRelayId(null);
                                        setFormErrors({});
                                      }
                                    }}
                                    className="font-mono text-xs"
                                    autoFocus
                                  />
                                ) : (
                                  <div 
                                    className="font-mono text-xs text-foreground cursor-pointer hover:text-primary transition-colors p-1 rounded"
                                    onClick={() => {
                                      setEditingField('targetUrl');
                                      setEditingRelayId(relay.id);
                                    }}
                                  >
                                    {relay.targetUrl}
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            {relay.events && relay.events.length > 0 && (
                              <div className="space-y-1">
                                <Label className="text-xs">Events</Label>
                                <div className="flex flex-wrap gap-2">
                                  {relay.events.map((event, idx) => (
                                    <Badge key={idx} variant="outline" className="text-xs">
                                      {event}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}

                            {(relay.signatureSecret || relay.allowedIps?.length || relay.transformTemplate) && (
                              <div className="pt-2 border-t">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setExpandedRelayId(expandedRelayId === relay.id ? null : relay.id)}
                                  className="w-full justify-start"
                                >
                                  <Settings className="h-4 w-4 mr-2" />
                                  {expandedRelayId === relay.id ? 'Hide' : 'Show'} Advanced Settings
                                </Button>
                                {expandedRelayId === relay.id && (
                                  <div className="mt-3 space-y-3 pl-6 border-l-2">
                                    {relay.signatureSecret && (
                                      <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">Signature Header</Label>
                                        <div className="text-xs font-mono">{relay.signatureHeader || 'X-Signature'}</div>
                                      </div>
                                    )}
                                    {relay.allowedIps && relay.allowedIps.length > 0 && (
                                      <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">Allowed IPs</Label>
                                        <div className="flex flex-wrap gap-1">
                                          {relay.allowedIps.map((ip, idx) => (
                                            <Badge key={idx} variant="outline" className="text-xs">{ip}</Badge>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    {relay.transformTemplate && (
                                      <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">Transform Template</Label>
                                        <pre className="text-xs font-mono bg-muted p-2 rounded max-h-20 overflow-auto">
                                          {relay.transformTemplate}
                                        </pre>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="deliveries" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Delivery History</CardTitle>
                <CardDescription>Webhook delivery attempts and results</CardDescription>
              </CardHeader>
              <CardContent>
                {deliveries.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Send className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No delivery history</p>
                    <p className="text-sm mt-2">Delivery attempts will appear here during simulation</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {deliveries.map((delivery) => (
                      <Card key={delivery.id} className="border-l-4 border-l-green-500 hover:shadow-md transition-shadow bg-card">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-start gap-3">
                              <div className={`p-2 rounded-lg ${getStatusColor(delivery.status)}/20`}>
                                {delivery.status === 'success' ? (
                                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                                ) : delivery.status === 'failed' ? (
                                  <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                                ) : (
                                  <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                                )}
                              </div>
                              <div>
                                <CardTitle className="text-lg font-semibold">{delivery.event}</CardTitle>
                                <div className="flex items-center gap-2 mt-2">
                                  <Badge variant="outline" className={getStatusColor(delivery.status)}>
                                    {delivery.status}
                                  </Badge>
                                  {delivery.attempts && (
                                    <Badge variant="outline">Attempts: {delivery.attempts}</Badge>
                                  )}
                                  {delivery.responseCode && (
                                    <Badge variant="outline">HTTP {delivery.responseCode}</Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            <Label>Payload</Label>
                            <pre className="p-3 bg-muted rounded text-xs font-mono overflow-x-auto max-h-40 overflow-y-auto">{delivery.payload}</pre>
                          </div>
                          <div className="text-xs text-muted-foreground mt-2">
                            {new Date(delivery.timestamp).toLocaleString()}
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
                <CardTitle>Webhook Relay Settings</CardTitle>
                <CardDescription>Global relay configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Retry on Failure</Label>
                    <p className="text-xs text-muted-foreground">Automatically retry failed deliveries</p>
                  </div>
                  <Switch 
                    checked={config.enableRetryOnFailure ?? true}
                    onCheckedChange={(checked) => updateConfig({ enableRetryOnFailure: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Signature Verification</Label>
                    <p className="text-xs text-muted-foreground">Verify webhook signatures</p>
                  </div>
                  <Switch 
                    checked={config.enableSignatureVerification ?? true}
                    onCheckedChange={(checked) => updateConfig({ enableSignatureVerification: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Request Logging</Label>
                    <p className="text-xs text-muted-foreground">Log all webhook requests</p>
                  </div>
                  <Switch 
                    checked={config.enableRequestLogging ?? true}
                    onCheckedChange={(checked) => updateConfig({ enableRequestLogging: checked })}
                  />
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label>Max Retry Attempts</Label>
                  <Input 
                    type="number" 
                    value={config.maxRetryAttempts ?? 3}
                    onChange={(e) => updateConfig({ maxRetryAttempts: parseInt(e.target.value) || 3 })}
                    min={1} 
                    max={10} 
                  />
                  <p className="text-xs text-muted-foreground">Default number of retry attempts for failed deliveries</p>
                </div>
                <div className="space-y-2">
                  <Label>Retry Delay (seconds)</Label>
                  <Input 
                    type="number" 
                    value={config.retryDelay ?? 5}
                    onChange={(e) => updateConfig({ retryDelay: parseInt(e.target.value) || 5 })}
                    min={1} 
                  />
                  <p className="text-xs text-muted-foreground">Base delay between retry attempts</p>
                </div>
                <div className="space-y-2">
                  <Label>Timeout (seconds)</Label>
                  <Input 
                    type="number" 
                    value={config.timeout ?? 30}
                    onChange={(e) => updateConfig({ timeout: parseInt(e.target.value) || 30 })}
                    min={1} 
                  />
                  <p className="text-xs text-muted-foreground">Request timeout for webhook delivery</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Create/Edit Relay Dialog */}
      <Dialog open={showCreateRelay} onOpenChange={closeDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRelayId ? 'Edit Relay' : 'Create New Relay'}</DialogTitle>
            <DialogDescription>
              Configure webhook relay source, target, and advanced settings
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {Object.keys(formErrors).length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {Object.values(formErrors).filter(Boolean).join(', ')}
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="relay-name">Name *</Label>
              <Input
                id="relay-name"
                value={relayForm.name || ''}
                onChange={(e) => {
                  setRelayForm({ ...relayForm, name: e.target.value });
                  if (formErrors.name) {
                    setFormErrors({ ...formErrors, name: '' });
                  }
                }}
                placeholder="My Webhook Relay"
                className={formErrors.name ? 'border-destructive' : ''}
              />
              {formErrors.name && (
                <p className="text-xs text-destructive">{formErrors.name}</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="source-url">Source URL *</Label>
                <Input
                  id="source-url"
                  type="url"
                  value={relayForm.sourceUrl || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    setRelayForm({ ...relayForm, sourceUrl: value });
                    if (formErrors.sourceUrl) {
                      setFormErrors({ ...formErrors, sourceUrl: '' });
                    }
                  }}
                  placeholder="https://source.example.com/webhooks"
                  className={formErrors.sourceUrl ? 'border-destructive' : ''}
                />
                {formErrors.sourceUrl && (
                  <p className="text-xs text-destructive">{formErrors.sourceUrl}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="target-url">Target URL *</Label>
                <Input
                  id="target-url"
                  type="url"
                  value={relayForm.targetUrl || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    setRelayForm({ ...relayForm, targetUrl: value });
                    if (formErrors.targetUrl) {
                      setFormErrors({ ...formErrors, targetUrl: '' });
                    }
                  }}
                  placeholder="https://target.example.com/webhooks"
                  className={formErrors.targetUrl ? 'border-destructive' : ''}
                />
                {formErrors.targetUrl && (
                  <p className="text-xs text-destructive">{formErrors.targetUrl}</p>
                )}
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Events</Label>
              <div className="flex gap-2">
                <Input
                  value={newEvent}
                  onChange={(e) => setNewEvent(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addEvent();
                    }
                  }}
                  placeholder="event.name"
                />
                <Button type="button" onClick={addEvent} size="sm">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {relayForm.events && relayForm.events.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {relayForm.events.map((event, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      {event}
                      <button
                        type="button"
                        onClick={() => removeEvent(event)}
                        className="ml-2 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">Optional: Filter events by name</p>
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enabled</Label>
                  <p className="text-xs text-muted-foreground">Enable this relay</p>
                </div>
                <Switch
                  checked={relayForm.enabled ?? true}
                  onCheckedChange={(checked) => setRelayForm({ ...relayForm, enabled: checked })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="signature-secret">Signature Secret</Label>
                <Input
                  id="signature-secret"
                  type="password"
                  value={relayForm.signatureSecret || ''}
                  onChange={(e) => setRelayForm({ ...relayForm, signatureSecret: e.target.value })}
                  placeholder="secret-key"
                />
                <p className="text-xs text-muted-foreground">Secret for HMAC signature verification</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="signature-header">Signature Header</Label>
                <Input
                  id="signature-header"
                  value={relayForm.signatureHeader || 'X-Signature'}
                  onChange={(e) => setRelayForm({ ...relayForm, signatureHeader: e.target.value })}
                  placeholder="X-Signature"
                />
              </div>

              <div className="space-y-2">
                <Label>Allowed IPs (CIDR)</Label>
                <div className="flex gap-2">
                  <Input
                    value={newIp}
                    onChange={(e) => {
                      setNewIp(e.target.value);
                      if (formErrors.allowedIps) {
                        setFormErrors({ ...formErrors, allowedIps: '' });
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addIp();
                      }
                    }}
                    placeholder="192.168.1.0/24"
                    className={formErrors.allowedIps ? 'border-destructive' : ''}
                  />
                  <Button type="button" onClick={addIp} size="sm">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {formErrors.allowedIps && (
                  <p className="text-xs text-destructive">{formErrors.allowedIps}</p>
                )}
                {relayForm.allowedIps && relayForm.allowedIps.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {relayForm.allowedIps.map((ip, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {ip}
                        <button
                          type="button"
                          onClick={() => removeIp(ip)}
                          className="ml-2 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">Optional: Restrict access by IP address</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="transform-template">Transform Template</Label>
                <Textarea
                  id="transform-template"
                  value={relayForm.transformTemplate || ''}
                  onChange={(e) => setRelayForm({ ...relayForm, transformTemplate: e.target.value })}
                  placeholder='{ "payload": {{raw}} }'
                  className="font-mono text-xs"
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">Optional: Transform payload before forwarding</p>
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="max-retry">Max Retry Attempts</Label>
                  <Input
                    id="max-retry"
                    type="number"
                    value={relayForm.maxRetryAttempts || 3}
                    onChange={(e) => setRelayForm({ ...relayForm, maxRetryAttempts: parseInt(e.target.value) || 3 })}
                    min={1}
                    max={10}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="retry-delay">Retry Delay (s)</Label>
                  <Input
                    id="retry-delay"
                    type="number"
                    value={relayForm.retryDelay || 5}
                    onChange={(e) => setRelayForm({ ...relayForm, retryDelay: parseInt(e.target.value) || 5 })}
                    min={1}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="timeout">Timeout (s)</Label>
                  <Input
                    id="timeout"
                    type="number"
                    value={relayForm.timeout || 30}
                    onChange={(e) => setRelayForm({ ...relayForm, timeout: parseInt(e.target.value) || 30 })}
                    min={1}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="retry-backoff">Retry Backoff Strategy</Label>
                <Select
                  value={relayForm.retryBackoff || 'exponential'}
                  onValueChange={(value: 'exponential' | 'linear' | 'constant') =>
                    setRelayForm({ ...relayForm, retryBackoff: value })
                  }
                >
                  <SelectTrigger id="retry-backoff">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="exponential">Exponential</SelectItem>
                    <SelectItem value="linear">Linear</SelectItem>
                    <SelectItem value="constant">Constant</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button onClick={addRelay}>
              {editingRelayId ? 'Save Changes' : 'Create Relay'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

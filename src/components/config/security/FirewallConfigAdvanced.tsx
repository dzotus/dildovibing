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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useState, useEffect } from 'react';
import { 
  Settings, 
  Activity,
  Plus,
  Trash2,
  RefreshCcw,
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Network,
  Ban,
  TrendingUp,
  Edit,
  Search,
  Filter
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface FirewallConfigProps {
  componentId: string;
}

interface Rule {
  id: string;
  name: string;
  action: 'allow' | 'deny' | 'reject';
  protocol: 'tcp' | 'udp' | 'icmp' | 'all';
  source?: string;
  destination?: string;
  port?: number;
  sourcePort?: number;
  enabled: boolean;
  priority: number;
  hits?: number;
}

interface Log {
  id: string;
  timestamp: string;
  action: 'allowed' | 'blocked' | 'rejected';
  source: string;
  destination: string;
  protocol: string;
  port?: number;
  sourcePort?: number;
  reason?: string;
}

interface FirewallConfig {
  rules?: Rule[];
  logs?: Log[];
  totalRules?: number;
  activeRules?: number;
  blockedConnections?: number;
  allowedConnections?: number;
  enableFirewall?: boolean;
  enableLogging?: boolean;
  enableIntrusionDetection?: boolean;
  enableStatefulInspection?: boolean;
  defaultPolicy?: 'allow' | 'deny' | 'reject';
  logRetention?: number;
}

export function FirewallConfigAdvanced({ componentId }: FirewallConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const { componentMetrics } = useEmulationStore();
  const { toast } = useToast();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as FirewallConfig;
  const rules = config.rules || [];
  const logs = config.logs || [];

  // State for dialogs and editing
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [showCreateRule, setShowCreateRule] = useState(false);
  const [ruleForm, setRuleForm] = useState<Partial<Rule>>({
    name: '',
    action: 'allow',
    protocol: 'tcp',
    enabled: true,
    priority: 5,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [logFilter, setLogFilter] = useState<'all' | 'allowed' | 'blocked' | 'rejected'>('all');

  // Get real-time metrics from emulation engine
  const metrics = componentMetrics.get(componentId);
  const firewallEngine = emulationEngine.getFirewallEmulationEngine(componentId);
  
  // Real-time stats from engine
  const [realStats, setRealStats] = useState<{
    packetsTotal: number;
    packetsAllowed: number;
    packetsBlocked: number;
    packetsRejected: number;
    activeRules: number;
    totalConnections: number;
    activeConnections: number;
  } | null>(null);

  const [realLogs, setRealLogs] = useState<Log[]>([]);

  // Update real-time stats and logs
  useEffect(() => {
    if (firewallEngine) {
      const stats = firewallEngine.getStats();
      const engineLogs = firewallEngine.getLogs(100); // Get last 100 logs
      
      setRealStats({
        packetsTotal: stats.totalPackets,
        packetsAllowed: stats.allowedPackets,
        packetsBlocked: stats.blockedPackets,
        packetsRejected: stats.rejectedPackets,
        activeRules: stats.activeRules,
        totalConnections: stats.totalConnections,
        activeConnections: stats.activeConnections,
      });

      // Convert engine logs to UI format
      setRealLogs(engineLogs.map(log => ({
        id: log.id,
        timestamp: new Date(log.timestamp).toISOString(),
        action: log.action,
        source: log.source,
        destination: log.destination,
        protocol: log.protocol,
        port: log.port,
        sourcePort: log.sourcePort,
        reason: log.reason || log.ruleName,
      })));
    }
  }, [firewallEngine, metrics]);

  // Use real stats if available, otherwise fallback to config
  const totalRules = realStats?.activeRules ?? rules.length;
  const activeRules = realStats?.activeRules ?? rules.filter((r) => r.enabled).length;
  const blockedConnections = realStats?.packetsBlocked ?? config.blockedConnections ?? 0;
  const allowedConnections = realStats?.packetsAllowed ?? config.allowedConnections ?? 0;
  const totalHits = rules.reduce((sum, r) => sum + (r.hits || 0), 0);

  // Display logs: prefer real logs, fallback to config logs
  const displayLogs = realLogs.length > 0 ? realLogs : logs;
  const filteredLogs = displayLogs.filter(log => {
    if (logFilter !== 'all' && log.action !== logFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        log.source.toLowerCase().includes(query) ||
        log.destination.toLowerCase().includes(query) ||
        log.protocol.toLowerCase().includes(query) ||
        (log.reason && log.reason.toLowerCase().includes(query))
      );
    }
    return true;
  });

  // Filter rules by search
  const filteredRules = rules.filter(rule => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        rule.name.toLowerCase().includes(query) ||
        rule.protocol.toLowerCase().includes(query) ||
        (rule.source && rule.source.toLowerCase().includes(query)) ||
        (rule.destination && rule.destination.toLowerCase().includes(query))
      );
    }
    return true;
  });

  const updateConfig = (updates: Partial<FirewallConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });

    // Reinitialize firewall engine with new config
    if (firewallEngine) {
      firewallEngine.initializeConfig(node);
    }
  };

  const validateRule = (rule: Partial<Rule>): Record<string, string> => {
    const errors: Record<string, string> = {};

    if (!rule.name || rule.name.trim().length === 0) {
      errors.name = 'Rule name is required';
    }

    if (rule.priority !== undefined && (rule.priority < 1 || rule.priority > 1000)) {
      errors.priority = 'Priority must be between 1 and 1000';
    }

    if (rule.protocol === 'tcp' || rule.protocol === 'udp') {
      if (rule.port !== undefined && (rule.port < 1 || rule.port > 65535)) {
        errors.port = 'Port must be between 1 and 65535';
      }
      if (rule.sourcePort !== undefined && (rule.sourcePort < 1 || rule.sourcePort > 65535)) {
        errors.sourcePort = 'Source port must be between 1 and 65535';
      }
    }

    // Validate IP/CIDR format
    if (rule.source && !isValidIPOrCIDR(rule.source)) {
      errors.source = 'Invalid IP address or CIDR notation';
    }
    if (rule.destination && !isValidIPOrCIDR(rule.destination)) {
      errors.destination = 'Invalid IP address or CIDR notation';
    }

    return errors;
  };

  const isValidIPOrCIDR = (ip: string): boolean => {
    // Simple validation - can be enhanced
    const cidrPattern = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
    return cidrPattern.test(ip);
  };

  const handleSaveRule = () => {
    const errors = validateRule(ruleForm);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    if (editingRuleId) {
      // Update existing rule
      const newRules = rules.map((r) =>
        r.id === editingRuleId ? { ...r, ...ruleForm } as Rule : r
      );
      updateConfig({ rules: newRules });
      toast({
        title: 'Rule updated',
        description: `Rule "${ruleForm.name}" has been updated successfully.`,
      });
    } else {
      // Create new rule
      const newRule: Rule = {
        id: `rule-${Date.now()}`,
        name: ruleForm.name || 'New Rule',
        action: ruleForm.action || 'allow',
        protocol: ruleForm.protocol || 'tcp',
        source: ruleForm.source,
        destination: ruleForm.destination,
        port: ruleForm.port,
        sourcePort: ruleForm.sourcePort,
        enabled: ruleForm.enabled ?? true,
        priority: ruleForm.priority || 5,
        hits: 0,
      };
      updateConfig({ rules: [...rules, newRule] });
      toast({
        title: 'Rule created',
        description: `Rule "${newRule.name}" has been created successfully.`,
      });
    }

    // Reset form
    setRuleForm({
      name: '',
      action: 'allow',
      protocol: 'tcp',
      enabled: true,
      priority: 5,
    });
    setFormErrors({});
    setEditingRuleId(null);
    setShowCreateRule(false);
  };

  const handleEditRule = (rule: Rule) => {
    setRuleForm({ ...rule });
    setEditingRuleId(rule.id);
    setFormErrors({});
  };

  const handleDeleteRule = (id: string) => {
    const rule = rules.find(r => r.id === id);
    if (rule && window.confirm(`Are you sure you want to delete rule "${rule.name}"?`)) {
      updateConfig({ rules: rules.filter((r) => r.id !== id) });
      toast({
        title: 'Rule deleted',
        description: `Rule "${rule.name}" has been deleted.`,
      });
    }
  };

  const toggleRule = (id: string) => {
    const newRules = rules.map((r) =>
      r.id === id ? { ...r, enabled: !r.enabled } : r
    );
    updateConfig({ rules: newRules });
  };

  const handleRefresh = () => {
    if (firewallEngine) {
      const stats = firewallEngine.getStats();
      const engineLogs = firewallEngine.getLogs(100);
      setRealStats({
        packetsTotal: stats.totalPackets,
        packetsAllowed: stats.allowedPackets,
        packetsBlocked: stats.blockedPackets,
        packetsRejected: stats.rejectedPackets,
        activeRules: stats.activeRules,
        totalConnections: stats.totalConnections,
        activeConnections: stats.activeConnections,
      });
      setRealLogs(engineLogs.map(log => ({
        id: log.id,
        timestamp: new Date(log.timestamp).toISOString(),
        action: log.action,
        source: log.source,
        destination: log.destination,
        protocol: log.protocol,
        port: log.port,
        sourcePort: log.sourcePort,
        reason: log.reason || log.ruleName,
      })));
      toast({
        title: 'Refreshed',
        description: 'Firewall statistics and logs have been refreshed.',
      });
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'allow':
      case 'allowed':
        return 'bg-green-500';
      case 'deny':
      case 'blocked':
        return 'bg-red-500';
      case 'reject':
      case 'rejected':
        return 'bg-orange-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase text-muted-foreground tracking-wide">Firewall</p>
            <h2 className="text-2xl font-bold text-foreground">Network Firewall</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Network security and traffic filtering
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

        <div className="grid grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-blue-500 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Rules</CardTitle>
                <Shield className="h-4 w-4 text-blue-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">{activeRules}</span>
                <span className="text-xs text-muted-foreground">/ {totalRules} total</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Allowed</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-green-600 dark:text-green-400">{allowedConnections.toLocaleString()}</span>
                <span className="text-xs text-muted-foreground">packets</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-red-500 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Blocked</CardTitle>
                <Ban className="h-4 w-4 text-red-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-red-600 dark:text-red-400">{blockedConnections.toLocaleString()}</span>
                <span className="text-xs text-muted-foreground">packets</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-purple-500 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Hits</CardTitle>
                <TrendingUp className="h-4 w-4 text-purple-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                  {totalHits.toLocaleString()}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="rules" className="space-y-4">
          <TabsList>
            <TabsTrigger value="rules">
              <Shield className="h-4 w-4 mr-2" />
              Rules ({rules.length})
            </TabsTrigger>
            <TabsTrigger value="logs">
              <Activity className="h-4 w-4 mr-2" />
              Logs ({filteredLogs.length})
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="rules" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Firewall Rules</CardTitle>
                    <CardDescription>Network traffic filtering rules</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search rules..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 w-64"
                      />
                    </div>
                    <Dialog open={showCreateRule} onOpenChange={setShowCreateRule}>
                      <DialogTrigger asChild>
                        <Button onClick={() => {
                          setRuleForm({
                            name: '',
                            action: 'allow',
                            protocol: 'tcp',
                            enabled: true,
                            priority: 5,
                          });
                          setFormErrors({});
                          setEditingRuleId(null);
                        }}>
                          <Plus className="h-4 w-4 mr-2" />
                          Create Rule
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>{editingRuleId ? 'Edit Rule' : 'Create New Rule'}</DialogTitle>
                          <DialogDescription>
                            Configure firewall rule for network traffic filtering
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
                            <Label htmlFor="rule-name">Rule Name *</Label>
                            <Input
                              id="rule-name"
                              value={ruleForm.name || ''}
                              onChange={(e) => {
                                setRuleForm({ ...ruleForm, name: e.target.value });
                                if (formErrors.name) {
                                  setFormErrors({ ...formErrors, name: '' });
                                }
                              }}
                              placeholder="Allow HTTP Traffic"
                              className={formErrors.name ? 'border-destructive' : ''}
                            />
                            {formErrors.name && (
                              <p className="text-xs text-destructive">{formErrors.name}</p>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="rule-action">Action *</Label>
                              <Select
                                value={ruleForm.action}
                                onValueChange={(value: 'allow' | 'deny' | 'reject') => {
                                  setRuleForm({ ...ruleForm, action: value });
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="allow">Allow</SelectItem>
                                  <SelectItem value="deny">Deny</SelectItem>
                                  <SelectItem value="reject">Reject</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="rule-protocol">Protocol *</Label>
                              <Select
                                value={ruleForm.protocol}
                                onValueChange={(value: 'tcp' | 'udp' | 'icmp' | 'all') => {
                                  setRuleForm({ ...ruleForm, protocol: value });
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="tcp">TCP</SelectItem>
                                  <SelectItem value="udp">UDP</SelectItem>
                                  <SelectItem value="icmp">ICMP</SelectItem>
                                  <SelectItem value="all">All</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="rule-source">Source IP/CIDR</Label>
                              <Input
                                id="rule-source"
                                value={ruleForm.source || ''}
                                onChange={(e) => {
                                  setRuleForm({ ...ruleForm, source: e.target.value });
                                  if (formErrors.source) {
                                    setFormErrors({ ...formErrors, source: '' });
                                  }
                                }}
                                placeholder="192.168.1.0/24"
                                className={formErrors.source ? 'border-destructive' : ''}
                              />
                              {formErrors.source && (
                                <p className="text-xs text-destructive">{formErrors.source}</p>
                              )}
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="rule-destination">Destination IP/CIDR</Label>
                              <Input
                                id="rule-destination"
                                value={ruleForm.destination || ''}
                                onChange={(e) => {
                                  setRuleForm({ ...ruleForm, destination: e.target.value });
                                  if (formErrors.destination) {
                                    setFormErrors({ ...formErrors, destination: '' });
                                  }
                                }}
                                placeholder="10.0.0.0/8"
                                className={formErrors.destination ? 'border-destructive' : ''}
                              />
                              {formErrors.destination && (
                                <p className="text-xs text-destructive">{formErrors.destination}</p>
                              )}
                            </div>
                          </div>

                          {(ruleForm.protocol === 'tcp' || ruleForm.protocol === 'udp') && (
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label htmlFor="rule-port">Destination Port</Label>
                                <Input
                                  id="rule-port"
                                  type="number"
                                  min="1"
                                  max="65535"
                                  value={ruleForm.port || ''}
                                  onChange={(e) => {
                                    const port = e.target.value ? parseInt(e.target.value) : undefined;
                                    setRuleForm({ ...ruleForm, port });
                                    if (formErrors.port) {
                                      setFormErrors({ ...formErrors, port: '' });
                                    }
                                  }}
                                  placeholder="80"
                                  className={formErrors.port ? 'border-destructive' : ''}
                                />
                                {formErrors.port && (
                                  <p className="text-xs text-destructive">{formErrors.port}</p>
                                )}
                              </div>

                              <div className="space-y-2">
                                <Label htmlFor="rule-source-port">Source Port</Label>
                                <Input
                                  id="rule-source-port"
                                  type="number"
                                  min="1"
                                  max="65535"
                                  value={ruleForm.sourcePort || ''}
                                  onChange={(e) => {
                                    const sourcePort = e.target.value ? parseInt(e.target.value) : undefined;
                                    setRuleForm({ ...ruleForm, sourcePort });
                                    if (formErrors.sourcePort) {
                                      setFormErrors({ ...formErrors, sourcePort: '' });
                                    }
                                  }}
                                  placeholder="1024"
                                  className={formErrors.sourcePort ? 'border-destructive' : ''}
                                />
                                {formErrors.sourcePort && (
                                  <p className="text-xs text-destructive">{formErrors.sourcePort}</p>
                                )}
                              </div>
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="rule-priority">Priority (1-1000) *</Label>
                              <Input
                                id="rule-priority"
                                type="number"
                                min="1"
                                max="1000"
                                value={ruleForm.priority || 5}
                                onChange={(e) => {
                                  const priority = parseInt(e.target.value) || 5;
                                  setRuleForm({ ...ruleForm, priority });
                                  if (formErrors.priority) {
                                    setFormErrors({ ...formErrors, priority: '' });
                                  }
                                }}
                                className={formErrors.priority ? 'border-destructive' : ''}
                              />
                              {formErrors.priority && (
                                <p className="text-xs text-destructive">{formErrors.priority}</p>
                              )}
                              <p className="text-xs text-muted-foreground">Higher priority = evaluated first</p>
                            </div>

                            <div className="flex items-center space-x-2 pt-8">
                              <Switch
                                id="rule-enabled"
                                checked={ruleForm.enabled ?? true}
                                onCheckedChange={(checked) => {
                                  setRuleForm({ ...ruleForm, enabled: checked });
                                }}
                              />
                              <Label htmlFor="rule-enabled">Enabled</Label>
                            </div>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => {
                            setShowCreateRule(false);
                            setRuleForm({
                              name: '',
                              action: 'allow',
                              protocol: 'tcp',
                              enabled: true,
                              priority: 5,
                            });
                            setFormErrors({});
                            setEditingRuleId(null);
                          }}>
                            Cancel
                          </Button>
                          <Button onClick={handleSaveRule}>
                            {editingRuleId ? 'Update Rule' : 'Create Rule'}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredRules.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      {searchQuery ? 'No rules match your search' : 'No rules configured. Create your first rule to get started.'}
                    </div>
                  ) : (
                    filteredRules.map((rule) => (
                      <Card key={rule.id} className="border-l-4 border-l-blue-500 hover:shadow-md transition-shadow bg-card">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-start gap-3 flex-1">
                              <div className={`p-2 rounded-lg ${getActionColor(rule.action)}/20`}>
                                {rule.action === 'allow' ? (
                                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                                ) : (
                                  <Ban className="h-5 w-5 text-red-600 dark:text-red-400" />
                                )}
                              </div>
                              <div className="flex-1">
                                <CardTitle className="text-lg font-semibold">{rule.name}</CardTitle>
                                <div className="flex items-center gap-2 mt-2 flex-wrap">
                                  <Badge variant="outline" className={getActionColor(rule.action)}>
                                    {rule.action.toUpperCase()}
                                  </Badge>
                                  <Badge variant="outline">{rule.protocol.toUpperCase()}</Badge>
                                  {rule.port && (
                                    <Badge variant="outline">Port: {rule.port}</Badge>
                                  )}
                                  {rule.sourcePort && (
                                    <Badge variant="outline">Src Port: {rule.sourcePort}</Badge>
                                  )}
                                  <Badge variant="outline">Priority: {rule.priority}</Badge>
                                  {rule.hits !== undefined && (
                                    <Badge variant="outline" className="bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-300">
                                      {rule.hits} hits
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEditRule(rule)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Switch
                                checked={rule.enabled}
                                onCheckedChange={() => toggleRule(rule.id)}
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteRule(rule.id)}
                                className="hover:bg-destructive/10 hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            {rule.source && (
                              <div>
                                <span className="text-muted-foreground">Source:</span>
                                <span className="ml-2 font-mono font-semibold">{rule.source}</span>
                              </div>
                            )}
                            {rule.destination && (
                              <div>
                                <span className="text-muted-foreground">Destination:</span>
                                <span className="ml-2 font-mono font-semibold">{rule.destination}</span>
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

          <TabsContent value="logs" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Firewall Logs</CardTitle>
                    <CardDescription>Traffic filtering activity logs</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search logs..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 w-64"
                      />
                    </div>
                    <Select value={logFilter} onValueChange={(value: any) => setLogFilter(value)}>
                      <SelectTrigger className="w-40">
                        <Filter className="h-4 w-4 mr-2" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Actions</SelectItem>
                        <SelectItem value="allowed">Allowed</SelectItem>
                        <SelectItem value="blocked">Blocked</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredLogs.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      {searchQuery || logFilter !== 'all' ? 'No logs match your filters' : 'No logs available'}
                    </div>
                  ) : (
                    filteredLogs.map((log) => (
                      <Card key={log.id} className={`border-l-4 ${
                        log.action === 'allowed' ? 'border-l-green-500 bg-card' :
                        'border-l-red-500 bg-card'
                      } hover:shadow-md transition-shadow`}>
                        <CardHeader className="pb-3">
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg ${getActionColor(log.action)}/20`}>
                              {log.action === 'allowed' ? (
                                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                              ) : (
                                <Ban className="h-5 w-5 text-red-600 dark:text-red-400" />
                              )}
                            </div>
                            <div className="flex-1">
                              <CardTitle className="text-lg font-semibold capitalize">{log.action}</CardTitle>
                              <div className="flex items-center gap-2 mt-2 flex-wrap">
                                <Badge variant="outline" className="font-mono text-xs">{log.source}</Badge>
                                <span>→</span>
                                <Badge variant="outline" className="font-mono text-xs">{log.destination}</Badge>
                                <Badge variant="outline">{log.protocol.toUpperCase()}</Badge>
                                {log.port && (
                                  <Badge variant="outline">Port: {log.port}</Badge>
                                )}
                                {log.sourcePort && (
                                  <Badge variant="outline">Src Port: {log.sourcePort}</Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardHeader>
                        {log.reason && (
                          <CardContent>
                            <div className="text-sm text-muted-foreground">
                              <AlertTriangle className="h-4 w-4 inline mr-1" />
                              {log.reason}
                            </div>
                          </CardContent>
                        )}
                        <CardContent>
                          <div className="text-xs text-muted-foreground">
                            {new Date(log.timestamp).toLocaleString()}
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Firewall Settings</CardTitle>
                <CardDescription>Security configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Firewall</Label>
                    <p className="text-xs text-muted-foreground">Enable or disable firewall functionality</p>
                  </div>
                  <Switch 
                    checked={config.enableFirewall ?? true}
                    onCheckedChange={(checked) => updateConfig({ enableFirewall: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Logging</Label>
                    <p className="text-xs text-muted-foreground">Log all firewall events</p>
                  </div>
                  <Switch 
                    checked={config.enableLogging ?? true}
                    onCheckedChange={(checked) => updateConfig({ enableLogging: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Intrusion Detection</Label>
                    <p className="text-xs text-muted-foreground">Detect and prevent intrusion attempts</p>
                  </div>
                  <Switch 
                    checked={config.enableIntrusionDetection ?? false}
                    onCheckedChange={(checked) => updateConfig({ enableIntrusionDetection: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Stateful Inspection</Label>
                    <p className="text-xs text-muted-foreground">Track connection state for better security</p>
                  </div>
                  <Switch 
                    checked={config.enableStatefulInspection ?? true}
                    onCheckedChange={(checked) => updateConfig({ enableStatefulInspection: checked })}
                  />
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label>Default Policy</Label>
                  <Select 
                    value={config.defaultPolicy ?? 'deny'}
                    onValueChange={(value: 'allow' | 'deny' | 'reject') => updateConfig({ defaultPolicy: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="allow">Allow All</SelectItem>
                      <SelectItem value="deny">Deny All</SelectItem>
                      <SelectItem value="reject">Reject All</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Action for packets that don't match any rule</p>
                </div>
                <div className="space-y-2">
                  <Label>Log Retention (days)</Label>
                  <Input 
                    type="number" 
                    value={config.logRetention ?? 30}
                    onChange={(e) => updateConfig({ logRetention: parseInt(e.target.value) || 30 })}
                    min={1} 
                    max={365}
                  />
                  <p className="text-xs text-muted-foreground">How long to keep firewall logs</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}


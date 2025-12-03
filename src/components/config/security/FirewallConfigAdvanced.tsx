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
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Network,
  Ban,
  TrendingUp
} from 'lucide-react';

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
  reason?: string;
}

interface FirewallConfig {
  rules?: Rule[];
  logs?: Log[];
  totalRules?: number;
  activeRules?: number;
  blockedConnections?: number;
  allowedConnections?: number;
}

export function FirewallConfigAdvanced({ componentId }: FirewallConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as FirewallConfig;
  const rules = config.rules || [
    {
      id: 'rule-1',
      name: 'Allow HTTP',
      action: 'allow',
      protocol: 'tcp',
      destination: '0.0.0.0/0',
      port: 80,
      enabled: true,
      priority: 10,
      hits: 12500,
    },
    {
      id: 'rule-2',
      name: 'Allow HTTPS',
      action: 'allow',
      protocol: 'tcp',
      destination: '0.0.0.0/0',
      port: 443,
      enabled: true,
      priority: 10,
      hits: 9800,
    },
    {
      id: 'rule-3',
      name: 'Block SSH from External',
      action: 'deny',
      protocol: 'tcp',
      source: '0.0.0.0/0',
      destination: '10.0.0.0/8',
      port: 22,
      enabled: true,
      priority: 5,
      hits: 45,
    },
    {
      id: 'rule-4',
      name: 'Default Deny',
      action: 'deny',
      protocol: 'all',
      enabled: true,
      priority: 1,
      hits: 125,
    },
  ];
  const logs = config.logs || [
    {
      id: 'log-1',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      action: 'blocked',
      source: '192.168.1.100',
      destination: '10.0.0.5',
      protocol: 'tcp',
      port: 22,
      reason: 'SSH blocked from external',
    },
    {
      id: 'log-2',
      timestamp: new Date(Date.now() - 1800000).toISOString(),
      action: 'allowed',
      source: '10.0.0.10',
      destination: '10.0.0.5',
      protocol: 'tcp',
      port: 80,
    },
  ];
  const totalRules = config.totalRules || rules.length;
  const activeRules = config.activeRules || rules.filter((r) => r.enabled).length;
  const blockedConnections = config.blockedConnections || logs.filter((l) => l.action === 'blocked' || l.action === 'rejected').length;
  const allowedConnections = config.allowedConnections || logs.filter((l) => l.action === 'allowed').length;

  const [showCreateRule, setShowCreateRule] = useState(false);

  const updateConfig = (updates: Partial<FirewallConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  const addRule = () => {
    const newRule: Rule = {
      id: `rule-${Date.now()}`,
      name: 'New Rule',
      action: 'allow',
      protocol: 'tcp',
      enabled: true,
      priority: 5,
    };
    updateConfig({ rules: [...rules, newRule] });
    setShowCreateRule(false);
  };

  const removeRule = (id: string) => {
    updateConfig({ rules: rules.filter((r) => r.id !== id) });
  };

  const toggleRule = (id: string) => {
    const newRules = rules.map((r) =>
      r.id === id ? { ...r, enabled: !r.enabled } : r
    );
    updateConfig({ rules: newRules });
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'allow':
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
          <Card className="border-l-4 border-l-green-500 bg-gradient-to-br from-green-50 to-white dark:from-green-950/20 dark:to-background">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Allowed</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-green-600 dark:text-green-400">{allowedConnections}</span>
                <span className="text-xs text-muted-foreground">connections</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-red-500 bg-gradient-to-br from-red-50 to-white dark:from-red-950/20 dark:to-background">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Blocked</CardTitle>
                <Ban className="h-4 w-4 text-red-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-red-600 dark:text-red-400">{blockedConnections}</span>
                <span className="text-xs text-muted-foreground">connections</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-purple-500 bg-gradient-to-br from-purple-50 to-white dark:from-purple-950/20 dark:to-background">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Hits</CardTitle>
                <TrendingUp className="h-4 w-4 text-purple-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                  {rules.reduce((sum, r) => sum + (r.hits || 0), 0).toLocaleString()}
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
              Logs ({logs.length})
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
                  <Button onClick={addRule} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Rule
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {rules.map((rule) => (
                    <Card key={rule.id} className="border-l-4 border-l-blue-500 hover:shadow-md transition-shadow bg-gradient-to-r from-blue-50/50 to-transparent dark:from-blue-950/10">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg ${getActionColor(rule.action)}/20`}>
                              {rule.action === 'allow' ? (
                                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                              ) : (
                                <Ban className="h-5 w-5 text-red-600 dark:text-red-400" />
                              )}
                            </div>
                            <div>
                              <CardTitle className="text-lg font-semibold">{rule.name}</CardTitle>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant="outline" className={getActionColor(rule.action)}>
                                  {rule.action.toUpperCase()}
                                </Badge>
                                <Badge variant="outline">{rule.protocol.toUpperCase()}</Badge>
                                {rule.port && (
                                  <Badge variant="outline">Port: {rule.port}</Badge>
                                )}
                                <Badge variant="outline">Priority: {rule.priority}</Badge>
                                {rule.hits && (
                                  <Badge variant="outline" className="bg-purple-50 dark:bg-purple-950/20">
                                    {rule.hits} hits
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={rule.enabled}
                              onCheckedChange={() => toggleRule(rule.id)}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeRule(rule.id)}
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
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Firewall Logs</CardTitle>
                <CardDescription>Traffic filtering activity logs</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {logs.map((log) => (
                    <Card key={log.id} className={`border-l-4 ${
                      log.action === 'allowed' ? 'border-l-green-500 bg-gradient-to-r from-green-50/50 to-transparent dark:from-green-950/10' :
                      'border-l-red-500 bg-gradient-to-r from-red-50/50 to-transparent dark:from-red-950/10'
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
                          <div>
                            <CardTitle className="text-lg font-semibold capitalize">{log.action}</CardTitle>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="outline" className="font-mono text-xs">{log.source}</Badge>
                              <span>→</span>
                              <Badge variant="outline" className="font-mono text-xs">{log.destination}</Badge>
                              <Badge variant="outline">{log.protocol.toUpperCase()}</Badge>
                              {log.port && (
                                <Badge variant="outline">Port: {log.port}</Badge>
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
                  ))}
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
                  <Label>Enable Firewall</Label>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Enable Logging</Label>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Enable Intrusion Detection</Label>
                  <Switch />
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label>Default Policy</Label>
                  <Select defaultValue="deny">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="allow">Allow All</SelectItem>
                      <SelectItem value="deny">Deny All</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Log Retention (days)</Label>
                  <Input type="number" defaultValue={30} min={1} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}


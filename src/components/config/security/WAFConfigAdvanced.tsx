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
import { Progress } from '@/components/ui/progress';
import { useState, useEffect } from 'react';
import { 
  Settings, 
  Activity,
  Plus,
  Trash2,
  RefreshCcw,
  Shield,
  AlertTriangle,
  Globe,
  Ban,
  CheckCircle,
  XCircle,
  FileText,
  Search,
  Edit,
  Save,
  X,
  Filter
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

interface WAFConfigProps {
  componentId: string;
}

interface WAFRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  action: 'allow' | 'block' | 'log' | 'challenge';
  priority: number;
  conditions?: Array<{
    type: 'ip' | 'uri' | 'header' | 'body' | 'method' | 'country' | 'user-agent';
    operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'regex' | 'in' | 'not-in';
    value: string;
  }>;
}

interface WAFThreat {
  id: string;
  type: 'sql-injection' | 'xss' | 'csrf' | 'path-traversal' | 'rce' | 'ddos' | 'rate-limit' | 'geo-block' | 'ip-block' | 'custom';
  sourceIP: string;
  target: string;
  timestamp: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  blocked: boolean;
  ruleId?: string;
  ruleName?: string;
  details?: Record<string, unknown>;
}

interface WAFConfig {
  mode?: 'detection' | 'prevention' | 'logging';
  enableOWASP?: boolean;
  owaspRuleset?: string;
  enableRateLimiting?: boolean;
  rateLimitPerMinute?: number;
  enableGeoBlocking?: boolean;
  blockedCountries?: string[];
  enableIPWhitelist?: boolean;
  whitelistedIPs?: string[];
  enableDDoSProtection?: boolean;
  ddosThreshold?: number;
  rules?: WAFRule[];
  threats?: WAFThreat[];
  requestsBlocked?: number;
  requestsAllowed?: number;
  threatsDetected?: number;
}

export function WAFConfigAdvanced({ componentId }: WAFConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const { getComponentMetrics } = useEmulationStore();
  const { toast } = useToast();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as WAFConfig;
  const mode = config.mode || 'detection';
  const enableOWASP = config.enableOWASP ?? true;
  const owaspRuleset = config.owaspRuleset || '3.3';
  const enableRateLimiting = config.enableRateLimiting ?? true;
  const rateLimitPerMinute = config.rateLimitPerMinute || 100;
  const enableGeoBlocking = config.enableGeoBlocking ?? false;
  const blockedCountries = config.blockedCountries || [];
  const enableIPWhitelist = config.enableIPWhitelist ?? false;
  const whitelistedIPs = config.whitelistedIPs || [];
  const enableDDoSProtection = config.enableDDoSProtection ?? true;
  const ddosThreshold = config.ddosThreshold || 1000;
  const rules = config.rules || [
    {
      id: '1',
      name: 'Block SQL Injection',
      description: 'Detect and block SQL injection attempts',
      enabled: true,
      action: 'block',
      priority: 1,
      conditions: [
        { type: 'body', operator: 'contains', value: "'; DROP TABLE" },
      ],
    },
    {
      id: '2',
      name: 'Block XSS',
      description: 'Detect and block cross-site scripting',
      enabled: true,
      action: 'block',
      priority: 2,
      conditions: [
        { type: 'body', operator: 'contains', value: '<script>' },
      ],
    },
  ];

  // Получаем реальные метрики из эмуляции
  const metrics = getComponentMetrics(componentId);
  const wafEngine = emulationEngine.getWAFEmulationEngine(componentId);
  
  // Реальные метрики из эмуляции
  const [realMetrics, setRealMetrics] = useState<{
    requestsBlocked: number;
    requestsAllowed: number;
    threatsDetected: number;
    activeRules: number;
  }>({
    requestsBlocked: 0,
    requestsAllowed: 0,
    threatsDetected: 0,
    activeRules: rules.filter((r) => r.enabled).length,
  });

  // Угрозы из эмуляции
  const [realThreats, setRealThreats] = useState<WAFThreat[]>([]);

  // Обновление метрик из эмуляции
  useEffect(() => {
    const interval = setInterval(() => {
      if (wafEngine) {
        const stats = wafEngine.getStats();
        const threats = wafEngine.getThreats(100);
        
        setRealMetrics({
          requestsBlocked: stats.blockedRequests,
          requestsAllowed: stats.allowedRequests,
          threatsDetected: stats.threatsDetected,
          activeRules: stats.activeRules,
        });

        // Преобразуем угрозы из эмуляции в формат UI
        const formattedThreats: WAFThreat[] = threats.map((threat) => ({
          id: threat.id,
          type: threat.type,
          sourceIP: threat.sourceIP,
          target: threat.target,
          timestamp: new Date(threat.timestamp).toISOString(),
          severity: threat.severity,
          blocked: threat.blocked,
          ruleId: threat.ruleId,
          ruleName: threat.ruleName,
          details: threat.details,
        }));

        setRealThreats(formattedThreats);
      } else {
        // Используем метрики из конфига, если эмуляция не запущена
        setRealMetrics({
          requestsBlocked: config.requestsBlocked || 0,
          requestsAllowed: config.requestsAllowed || 0,
          threatsDetected: config.threatsDetected || 0,
          activeRules: rules.filter((r) => r.enabled).length,
        });
        setRealThreats(config.threats || []);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [wafEngine, config, rules]);

  // Используем реальные метрики, если доступны
  const requestsBlocked = realMetrics.requestsBlocked;
  const requestsAllowed = realMetrics.requestsAllowed;
  const threatsDetected = realMetrics.threatsDetected;
  const threats = realThreats.length > 0 ? realThreats : (config.threats || []);

  const [editingRuleIndex, setEditingRuleIndex] = useState<number | null>(null);
  const [showCreateRule, setShowCreateRule] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [threatFilter, setThreatFilter] = useState<'all' | 'blocked' | 'not-blocked'>('all');
  const [editingConditionIndex, setEditingConditionIndex] = useState<{ ruleId: string; conditionIndex: number } | null>(null);

  const updateConfig = (updates: Partial<WAFConfig>) => {
    const newConfig = { ...config, ...updates };
    updateNode(componentId, {
      data: {
        ...node.data,
        config: newConfig,
      },
    });
    
    // Обновляем конфигурацию WAF engine, если он существует
    if (wafEngine) {
      const updatedNode = { ...node, data: { ...node.data, config: newConfig } };
      wafEngine.initializeConfig(updatedNode);
    }
  };

  const addRule = () => {
    const newRule: WAFRule = {
      id: `rule-${Date.now()}`,
      name: 'New Rule',
      description: '',
      enabled: true,
      action: 'block',
      priority: rules.length + 1,
      conditions: [],
    };
    updateConfig({ rules: [...rules, newRule] });
    setShowCreateRule(false);
  };

  const removeRule = (id: string) => {
    updateConfig({ rules: rules.filter((r) => r.id !== id) });
  };

  const updateRule = (id: string, field: string, value: any) => {
    const newRules = rules.map((r) =>
      r.id === id ? { ...r, [field]: value } : r
    );
    updateConfig({ rules: newRules });
  };

  const addBlockedCountry = (country: string) => {
    if (!blockedCountries.includes(country)) {
      updateConfig({ blockedCountries: [...blockedCountries, country] });
    }
  };

  const removeBlockedCountry = (country: string) => {
    updateConfig({ blockedCountries: blockedCountries.filter((c) => c !== country) });
  };

  const addWhitelistedIP = (ip: string) => {
    if (!whitelistedIPs.includes(ip)) {
      updateConfig({ whitelistedIPs: [...whitelistedIPs, ip] });
    }
  };

  const removeWhitelistedIP = (ip: string) => {
    updateConfig({ whitelistedIPs: whitelistedIPs.filter((ipAddr) => ipAddr !== ip) });
    toast({
      title: 'IP removed',
      description: `IP ${ip} removed from whitelist`,
    });
  };

  const addCondition = (ruleId: string) => {
    const newCondition = {
      type: 'body' as const,
      operator: 'contains' as const,
      value: '',
    };
    const newRules = rules.map((r) =>
      r.id === ruleId
        ? { ...r, conditions: [...(r.conditions || []), newCondition] }
        : r
    );
    updateConfig({ rules: newRules });
    toast({
      title: 'Condition added',
      description: 'New condition added to rule',
    });
  };

  const removeCondition = (ruleId: string, conditionIndex: number) => {
    const newRules = rules.map((r) =>
      r.id === ruleId
        ? {
            ...r,
            conditions: (r.conditions || []).filter((_, i) => i !== conditionIndex),
          }
        : r
    );
    updateConfig({ rules: newRules });
    toast({
      title: 'Condition removed',
      description: 'Condition removed from rule',
    });
  };

  const updateCondition = (
    ruleId: string,
    conditionIndex: number,
    field: 'type' | 'operator' | 'value',
    value: string
  ) => {
    const newRules = rules.map((r) => {
      if (r.id === ruleId && r.conditions) {
        const newConditions = [...r.conditions];
        newConditions[conditionIndex] = {
          ...newConditions[conditionIndex],
          [field]: value,
        };
        return { ...r, conditions: newConditions };
      }
      return r;
    });
    updateConfig({ rules: newRules });
  };

  const handleRefresh = () => {
    if (wafEngine) {
      wafEngine.resetMetrics();
      toast({
        title: 'Metrics reset',
        description: 'WAF metrics have been reset',
      });
    }
  };

  // Фильтрация правил по поисковому запросу
  const filteredRules = rules.filter((rule) =>
    rule.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    rule.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Фильтрация угроз
  const filteredThreats = threats.filter((threat) => {
    if (threatFilter === 'blocked' && !threat.blocked) return false;
    if (threatFilter === 'not-blocked' && threat.blocked) return false;
    return true;
  });

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase text-muted-foreground tracking-wide">Web Application Firewall</p>
            <h2 className="text-2xl font-bold text-foreground">WAF Configuration</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Protect applications from web exploits and attacks
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
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Requests Blocked</CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-bold text-red-500">{requestsBlocked.toLocaleString()}</span>
                {metrics && metrics.customMetrics && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Block Rate: {((metrics.customMetrics.waf_block_rate || 0) * 100).toFixed(2)}%
                  </p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Requests Allowed</CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-bold text-green-500">{requestsAllowed.toLocaleString()}</span>
                {metrics && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Throughput: {Math.round(metrics.throughput || 0)} req/s
                  </p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Threats Detected</CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-bold text-orange-500">{threatsDetected.toLocaleString()}</span>
                {metrics && metrics.customMetrics && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Detection Rate: {((metrics.customMetrics.waf_threat_detection_rate || 0) * 100).toFixed(2)}%
                  </p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Active Rules</CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-bold">{realMetrics.activeRules}</span>
                <p className="text-xs text-muted-foreground mt-1">
                  Total: {rules.length} rules
                </p>
              </CardContent>
            </Card>
        </div>

        <Tabs defaultValue="rules" className="space-y-4">
          <TabsList>
            <TabsTrigger value="rules">
              <Shield className="h-4 w-4 mr-2" />
              Rules ({rules.length})
            </TabsTrigger>
            <TabsTrigger value="threats">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Threats ({threats.length})
            </TabsTrigger>
            <TabsTrigger value="owasp">
              <FileText className="h-4 w-4 mr-2" />
              OWASP Rules
            </TabsTrigger>
            <TabsTrigger value="rate-limiting">
              <Activity className="h-4 w-4 mr-2" />
              Rate Limiting
            </TabsTrigger>
            <TabsTrigger value="geo-blocking">
              <Globe className="h-4 w-4 mr-2" />
              Geo-Blocking
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
                    <CardTitle>Custom Rules</CardTitle>
                    <CardDescription>Configure custom WAF rules</CardDescription>
                  </div>
                  <Button onClick={addRule} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Rule
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search rules..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>
                <div className="space-y-4">
                  {filteredRules.map((rule) => (
                    <Card key={rule.id} className="border-l-4 border-l-blue-500">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-base">{rule.name}</CardTitle>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant={rule.enabled ? 'default' : 'outline'}>
                                {rule.enabled ? 'Enabled' : 'Disabled'}
                              </Badge>
                              <Badge variant="outline">{rule.action}</Badge>
                              <Badge variant="outline">Priority: {rule.priority}</Badge>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={rule.enabled}
                              onCheckedChange={(checked) => updateRule(rule.id, 'enabled', checked)}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeRule(rule.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Rule Name</Label>
                            <Input
                              value={rule.name}
                              onChange={(e) => updateRule(rule.id, 'name', e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Action</Label>
                            <Select
                              value={rule.action}
                              onValueChange={(value: 'allow' | 'block' | 'log' | 'challenge') => updateRule(rule.id, 'action', value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="block">Block</SelectItem>
                                <SelectItem value="allow">Allow</SelectItem>
                                <SelectItem value="log">Log</SelectItem>
                                <SelectItem value="challenge">Challenge</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Priority</Label>
                            <Input
                              type="number"
                              value={rule.priority}
                              onChange={(e) => updateRule(rule.id, 'priority', Number(e.target.value))}
                              min={1}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Description</Label>
                            <Input
                              value={rule.description}
                              onChange={(e) => updateRule(rule.id, 'description', e.target.value)}
                              placeholder="Rule description"
                            />
                          </div>
                        </div>
                        <Separator />
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label>Conditions</Label>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => addCondition(rule.id)}
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Add Condition
                            </Button>
                          </div>
                          {rule.conditions && rule.conditions.length > 0 ? (
                            <div className="space-y-2">
                              {rule.conditions.map((condition, idx) => (
                                <div key={idx} className="flex items-center gap-2 p-2 border rounded">
                                  <Select
                                    value={condition.type}
                                    onValueChange={(value) =>
                                      updateCondition(rule.id, idx, 'type', value)
                                    }
                                  >
                                    <SelectTrigger className="w-32">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="ip">IP</SelectItem>
                                      <SelectItem value="uri">URI</SelectItem>
                                      <SelectItem value="header">Header</SelectItem>
                                      <SelectItem value="body">Body</SelectItem>
                                      <SelectItem value="method">Method</SelectItem>
                                      <SelectItem value="country">Country</SelectItem>
                                      <SelectItem value="user-agent">User-Agent</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <Select
                                    value={condition.operator}
                                    onValueChange={(value) =>
                                      updateCondition(rule.id, idx, 'operator', value)
                                    }
                                  >
                                    <SelectTrigger className="w-40">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="equals">Equals</SelectItem>
                                      <SelectItem value="contains">Contains</SelectItem>
                                      <SelectItem value="startsWith">Starts With</SelectItem>
                                      <SelectItem value="endsWith">Ends With</SelectItem>
                                      <SelectItem value="regex">Regex</SelectItem>
                                      <SelectItem value="in">In</SelectItem>
                                      <SelectItem value="not-in">Not In</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <Input
                                    value={condition.value}
                                    onChange={(e) =>
                                      updateCondition(rule.id, idx, 'value', e.target.value)
                                    }
                                    placeholder="Value"
                                    className="flex-1"
                                  />
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeCondition(rule.id, idx)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">No conditions. Add at least one condition for the rule to work.</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {filteredRules.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      {searchQuery ? 'No rules found matching your search' : 'No rules configured'}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="threats" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Detected Threats</CardTitle>
                    <CardDescription>Recent security threats and attacks</CardDescription>
                  </div>
                  <Select value={threatFilter} onValueChange={(value: 'all' | 'blocked' | 'not-blocked') => setThreatFilter(value)}>
                    <SelectTrigger className="w-40">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Threats</SelectItem>
                      <SelectItem value="blocked">Blocked</SelectItem>
                      <SelectItem value="not-blocked">Not Blocked</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {filteredThreats.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    {threats.length === 0 ? 'No threats detected' : 'No threats match the filter'}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {filteredThreats.map((threat) => (
                      <Card
                        key={threat.id}
                        className={`border-l-4 ${
                          threat.severity === 'critical' ? 'border-l-red-500' :
                          threat.severity === 'high' ? 'border-l-orange-500' :
                          threat.severity === 'medium' ? 'border-l-yellow-500' : 'border-l-blue-500'
                        }`}
                      >
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant={
                                  threat.severity === 'critical' ? 'destructive' :
                                  threat.severity === 'high' ? 'default' : 'outline'
                                }>
                                  {threat.severity}
                                </Badge>
                                <Badge variant="outline">{threat.type}</Badge>
                                {threat.blocked ? (
                                  <Badge variant="default" className="bg-green-500">
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Blocked
                                  </Badge>
                                ) : (
                                  <Badge variant="outline">
                                    <XCircle className="h-3 w-3 mr-1" />
                                    Not Blocked
                                  </Badge>
                                )}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                <p>Source IP: {threat.sourceIP}</p>
                                <p>Target: {threat.target}</p>
                                <p>Time: {new Date(threat.timestamp).toLocaleString()}</p>
                                {threat.ruleName && (
                                  <p className="mt-1">
                                    <Badge variant="outline" className="mr-2">Rule: {threat.ruleName}</Badge>
                                  </p>
                                )}
                                {threat.details && Object.keys(threat.details).length > 0 && (
                                  <details className="mt-2">
                                    <summary className="cursor-pointer text-xs">Details</summary>
                                    <pre className="mt-1 text-xs bg-muted p-2 rounded overflow-auto">
                                      {JSON.stringify(threat.details, null, 2)}
                                    </pre>
                                  </details>
                                )}
                              </div>
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

          <TabsContent value="owasp" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>OWASP ModSecurity Rules</CardTitle>
                <CardDescription>Core Rule Set configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Enable OWASP Rules</Label>
                  <Switch
                    checked={enableOWASP}
                    onCheckedChange={(checked) => updateConfig({ enableOWASP: checked })}
                  />
                </div>
                {enableOWASP && (
                  <div className="space-y-2">
                    <Label>OWASP Rule Set Version</Label>
                    <Select
                      value={owaspRuleset}
                      onValueChange={(value) => updateConfig({ owaspRuleset: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3.3">3.3 (Latest)</SelectItem>
                        <SelectItem value="3.2">3.2</SelectItem>
                        <SelectItem value="3.1">3.1</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rate-limiting" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Rate Limiting</CardTitle>
                <CardDescription>Configure request rate limits</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Enable Rate Limiting</Label>
                  <Switch
                    checked={enableRateLimiting}
                    onCheckedChange={(checked) => updateConfig({ enableRateLimiting: checked })}
                  />
                </div>
                {enableRateLimiting && (
                  <div className="space-y-2">
                    <Label>Rate Limit (requests per minute)</Label>
                    <Input
                      type="number"
                      value={rateLimitPerMinute}
                      onChange={(e) => updateConfig({ rateLimitPerMinute: Number(e.target.value) })}
                      min={1}
                      max={10000}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="geo-blocking" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Geo-Blocking</CardTitle>
                <CardDescription>Block requests from specific countries</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Enable Geo-Blocking</Label>
                  <Switch
                    checked={enableGeoBlocking}
                    onCheckedChange={(checked) => updateConfig({ enableGeoBlocking: checked })}
                  />
                </div>
                {enableGeoBlocking && (
                  <div className="space-y-2">
                    <Label>Blocked Countries (ISO codes)</Label>
                    <div className="flex flex-wrap gap-2">
                      {blockedCountries.map((country) => (
                        <Badge key={country} variant="outline" className="gap-1">
                          {country}
                          <button
                            onClick={() => removeBlockedCountry(country)}
                            className="ml-1 hover:text-destructive"
                          >
                            <XCircle className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                    <Input
                      placeholder="Enter ISO country code (e.g., CN, RU)"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const value = e.currentTarget.value.trim().toUpperCase();
                          if (value) {
                            addBlockedCountry(value);
                            e.currentTarget.value = '';
                          }
                        }
                      }}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>WAF Settings</CardTitle>
                <CardDescription>General WAF configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Operation Mode</Label>
                  <Select
                    value={mode}
                    onValueChange={(value: 'detection' | 'prevention' | 'logging') => updateConfig({ mode: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="prevention">Prevention (Block threats)</SelectItem>
                      <SelectItem value="detection">Detection (Log only)</SelectItem>
                      <SelectItem value="logging">Logging Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <Label>Enable DDoS Protection</Label>
                  <Switch
                    checked={enableDDoSProtection}
                    onCheckedChange={(checked) => updateConfig({ enableDDoSProtection: checked })}
                  />
                </div>
                {enableDDoSProtection && (
                  <div className="space-y-2">
                    <Label>DDoS Threshold (requests per second)</Label>
                    <Input
                      type="number"
                      value={ddosThreshold}
                      onChange={(e) => updateConfig({ ddosThreshold: Number(e.target.value) })}
                      min={100}
                      max={100000}
                    />
                  </div>
                )}
                <Separator />
                <div className="flex items-center justify-between">
                  <Label>Enable IP Whitelist</Label>
                  <Switch
                    checked={enableIPWhitelist}
                    onCheckedChange={(checked) => updateConfig({ enableIPWhitelist: checked })}
                  />
                </div>
                {enableIPWhitelist && (
                  <div className="space-y-2">
                    <Label>Whitelisted IPs</Label>
                    <div className="flex flex-wrap gap-2">
                      {whitelistedIPs.map((ip) => (
                        <Badge key={ip} variant="outline" className="gap-1">
                          {ip}
                          <button
                            onClick={() => removeWhitelistedIP(ip)}
                            className="ml-1 hover:text-destructive"
                          >
                            <XCircle className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                    <Input
                      placeholder="Enter IP or CIDR (e.g., 192.168.1.0/24)"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const value = e.currentTarget.value.trim();
                          if (value) {
                            addWhitelistedIP(value);
                            e.currentTarget.value = '';
                          }
                        }
                      }}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}


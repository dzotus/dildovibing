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
  Filter,
  Key,
  Lock,
  Bot,
  TrendingUp,
  Code,
  Network,
  Download
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
  const ipBlacklist = config.ipBlacklist || [];
  const enableDDoSProtection = config.enableDDoSProtection ?? true;
  const ddosThreshold = config.ddosThreshold || 1000;
  const rateLimitStrategy = config.rateLimitStrategy || 'fixed-window';
  const rateLimitBurst = config.rateLimitBurst || rateLimitPerMinute;
  
  // API Shield functions
  const schemaValidation = config.schemaValidation || { enabled: false, schemaType: 'json-schema', schema: '', validateRequest: true, validateResponse: false };
  const jwtValidation = config.jwtValidation || { enabled: false, algorithm: 'HS256', requireExpiration: true };
  const apiKeyValidation = config.apiKeyValidation || { enabled: false, keys: [], headerName: 'X-API-Key' };
  const graphQLProtection = config.graphQLProtection || { enabled: false, maxDepth: 10, maxComplexity: 100, maxAliases: 10, blockIntrospection: false };
  
  // Real functions
  const botDetection = config.botDetection || { enabled: false, methods: ['user-agent'], blockKnownBots: false, challengeSuspicious: false };
  const anomalyDetection = config.anomalyDetection || { enabled: false, threshold: 3.0, windowSize: 60 };
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

  // Export functions
  const exportThreatsToJSON = () => {
    const dataStr = JSON.stringify(filteredThreats, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `waf-threats-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({
      title: 'Export successful',
      description: `Exported ${filteredThreats.length} threats to JSON`,
    });
  };

  const exportThreatsToCSV = () => {
    if (filteredThreats.length === 0) {
      toast({
        title: 'No data to export',
        description: 'There are no threats to export',
        variant: 'destructive',
      });
      return;
    }

    const headers = ['ID', 'Type', 'Severity', 'Source IP', 'Target', 'Timestamp', 'Blocked', 'Rule ID', 'Rule Name', 'Details'];
    const rows = filteredThreats.map((threat) => [
      threat.id,
      threat.type,
      threat.severity,
      threat.sourceIP,
      threat.target,
      new Date(threat.timestamp).toISOString(),
      threat.blocked ? 'Yes' : 'No',
      threat.ruleId || '',
      threat.ruleName || '',
      threat.details ? JSON.stringify(threat.details) : '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const dataBlob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `waf-threats-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({
      title: 'Export successful',
      description: `Exported ${filteredThreats.length} threats to CSV`,
    });
  };
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

  const addBlacklistedIP = (ip: string) => {
    if (!ipBlacklist.includes(ip)) {
      updateConfig({ ipBlacklist: [...ipBlacklist, ip] });
    }
  };

  const removeBlacklistedIP = (ip: string) => {
    updateConfig({ ipBlacklist: ipBlacklist.filter((ipAddr) => ipAddr !== ip) });
    toast({
      title: 'IP removed',
      description: `IP ${ip} removed from blacklist`,
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
            <TabsTrigger value="schema-validation">
              <Code className="h-4 w-4 mr-2" />
              Schema Validation
            </TabsTrigger>
            <TabsTrigger value="jwt-validation">
              <Lock className="h-4 w-4 mr-2" />
              JWT Validation
            </TabsTrigger>
            <TabsTrigger value="api-keys">
              <Key className="h-4 w-4 mr-2" />
              API Keys
            </TabsTrigger>
            <TabsTrigger value="graphql-protection">
              <Network className="h-4 w-4 mr-2" />
              GraphQL Protection
            </TabsTrigger>
            <TabsTrigger value="bot-detection">
              <Bot className="h-4 w-4 mr-2" />
              Bot Detection
            </TabsTrigger>
            <TabsTrigger value="anomaly-detection">
              <TrendingUp className="h-4 w-4 mr-2" />
              Anomaly Detection
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
                  <div className="flex items-center gap-2">
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
                    {filteredThreats.length > 0 && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={exportThreatsToJSON}
                          className="gap-2"
                        >
                          <Download className="h-4 w-4" />
                          Export JSON
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={exportThreatsToCSV}
                          className="gap-2"
                        >
                          <Download className="h-4 w-4" />
                          Export CSV
                        </Button>
                      </div>
                    )}
                  </div>
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
                  <div className="space-y-4">
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
                    <div className="space-y-2">
                      <Label>Rate Limit Strategy</Label>
                      <Select
                        value={rateLimitStrategy}
                        onValueChange={(value: 'fixed-window' | 'sliding-window' | 'token-bucket') => updateConfig({ rateLimitStrategy: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fixed-window">Fixed Window</SelectItem>
                          <SelectItem value="sliding-window">Sliding Window</SelectItem>
                          <SelectItem value="token-bucket">Token Bucket</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {rateLimitStrategy === 'token-bucket' && (
                      <div className="space-y-2">
                        <Label>Burst Size (tokens)</Label>
                        <Input
                          type="number"
                          value={rateLimitBurst}
                          onChange={(e) => updateConfig({ rateLimitBurst: Number(e.target.value) })}
                          min={1}
                          max={10000}
                        />
                        <p className="text-xs text-muted-foreground">Maximum number of tokens in the bucket</p>
                      </div>
                    )}
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

          <TabsContent value="schema-validation" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Schema Validation</CardTitle>
                <CardDescription>Validate requests and responses against JSON Schema or OpenAPI</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Enable Schema Validation</Label>
                  <Switch
                    checked={schemaValidation.enabled}
                    onCheckedChange={(checked) => updateConfig({ schemaValidation: { ...schemaValidation, enabled: checked } })}
                  />
                </div>
                {schemaValidation.enabled && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Schema Type</Label>
                      <Select
                        value={schemaValidation.schemaType}
                        onValueChange={(value: 'json-schema' | 'openapi') => updateConfig({ schemaValidation: { ...schemaValidation, schemaType: value } })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="json-schema">JSON Schema</SelectItem>
                          <SelectItem value="openapi">OpenAPI</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Schema (JSON)</Label>
                      <Textarea
                        value={schemaValidation.schema}
                        onChange={(e) => updateConfig({ schemaValidation: { ...schemaValidation, schema: e.target.value } })}
                        placeholder='{"type": "object", "properties": {...}}'
                        rows={10}
                        className="font-mono text-sm"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Validate Request</Label>
                      <Switch
                        checked={schemaValidation.validateRequest}
                        onCheckedChange={(checked) => updateConfig({ schemaValidation: { ...schemaValidation, validateRequest: checked } })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Validate Response</Label>
                      <Switch
                        checked={schemaValidation.validateResponse}
                        onCheckedChange={(checked) => updateConfig({ schemaValidation: { ...schemaValidation, validateResponse: checked } })}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="jwt-validation" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>JWT Validation</CardTitle>
                <CardDescription>Validate JWT tokens in requests</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Enable JWT Validation</Label>
                  <Switch
                    checked={jwtValidation.enabled}
                    onCheckedChange={(checked) => updateConfig({ jwtValidation: { ...jwtValidation, enabled: checked } })}
                  />
                </div>
                {jwtValidation.enabled && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Algorithm</Label>
                      <Select
                        value={jwtValidation.algorithm}
                        onValueChange={(value: 'HS256' | 'RS256' | 'ES256') => updateConfig({ jwtValidation: { ...jwtValidation, algorithm: value } })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="HS256">HS256 (HMAC)</SelectItem>
                          <SelectItem value="RS256">RS256 (RSA)</SelectItem>
                          <SelectItem value="ES256">ES256 (ECDSA)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {jwtValidation.algorithm === 'HS256' && (
                      <div className="space-y-2">
                        <Label>Secret Key</Label>
                        <Input
                          type="password"
                          value={jwtValidation.secret || ''}
                          onChange={(e) => updateConfig({ jwtValidation: { ...jwtValidation, secret: e.target.value } })}
                          placeholder="Enter secret key"
                        />
                      </div>
                    )}
                    {(jwtValidation.algorithm === 'RS256' || jwtValidation.algorithm === 'ES256') && (
                      <div className="space-y-2">
                        <Label>Public Key</Label>
                        <Textarea
                          value={jwtValidation.publicKey || ''}
                          onChange={(e) => updateConfig({ jwtValidation: { ...jwtValidation, publicKey: e.target.value } })}
                          placeholder="Enter public key (PEM format)"
                          rows={5}
                          className="font-mono text-sm"
                        />
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label>Issuer (optional)</Label>
                      <Input
                        value={jwtValidation.issuer || ''}
                        onChange={(e) => updateConfig({ jwtValidation: { ...jwtValidation, issuer: e.target.value } })}
                        placeholder="https://example.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Audience (comma-separated, optional)</Label>
                      <Input
                        value={Array.isArray(jwtValidation.audience) ? jwtValidation.audience.join(', ') : (jwtValidation.audience || '')}
                        onChange={(e) => {
                          const audience = e.target.value.split(',').map(a => a.trim()).filter(a => a);
                          updateConfig({ jwtValidation: { ...jwtValidation, audience } });
                        }}
                        placeholder="api1, api2"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Require Expiration</Label>
                      <Switch
                        checked={jwtValidation.requireExpiration}
                        onCheckedChange={(checked) => updateConfig({ jwtValidation: { ...jwtValidation, requireExpiration: checked } })}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="api-keys" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>API Key Validation</CardTitle>
                    <CardDescription>Manage API keys for authentication</CardDescription>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      const newKey = {
                        id: `key-${Date.now()}`,
                        key: `api-key-${Math.random().toString(36).substring(7)}`,
                        enabled: true,
                        allowedPaths: [],
                        rateLimit: undefined,
                      };
                      updateConfig({ apiKeyValidation: { ...apiKeyValidation, keys: [...apiKeyValidation.keys, newKey] } });
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Key
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Enable API Key Validation</Label>
                  <Switch
                    checked={apiKeyValidation.enabled}
                    onCheckedChange={(checked) => updateConfig({ apiKeyValidation: { ...apiKeyValidation, enabled: checked } })}
                  />
                </div>
                {apiKeyValidation.enabled && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Header Name</Label>
                      <Input
                        value={apiKeyValidation.headerName}
                        onChange={(e) => updateConfig({ apiKeyValidation: { ...apiKeyValidation, headerName: e.target.value } })}
                        placeholder="X-API-Key"
                      />
                    </div>
                    <Separator />
                    <div className="space-y-4">
                      {apiKeyValidation.keys.map((key) => (
                        <Card key={key.id} className="border-l-4 border-l-blue-500">
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <CardTitle className="text-base">API Key: {key.key.substring(0, 20)}...</CardTitle>
                                <Badge variant={key.enabled ? 'default' : 'outline'} className="mt-1">
                                  {key.enabled ? 'Enabled' : 'Disabled'}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={key.enabled}
                                  onCheckedChange={(checked) => {
                                    const newKeys = apiKeyValidation.keys.map(k => k.id === key.id ? { ...k, enabled: checked } : k);
                                    updateConfig({ apiKeyValidation: { ...apiKeyValidation, keys: newKeys } });
                                  }}
                                />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    const newKeys = apiKeyValidation.keys.filter(k => k.id !== key.id);
                                    updateConfig({ apiKeyValidation: { ...apiKeyValidation, keys: newKeys } });
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="space-y-2">
                              <Label>API Key</Label>
                              <Input
                                value={key.key}
                                onChange={(e) => {
                                  const newKeys = apiKeyValidation.keys.map(k => k.id === key.id ? { ...k, key: e.target.value } : k);
                                  updateConfig({ apiKeyValidation: { ...apiKeyValidation, keys: newKeys } });
                                }}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Allowed Paths (comma-separated, optional)</Label>
                              <Input
                                value={Array.isArray(key.allowedPaths) ? key.allowedPaths.join(', ') : ''}
                                onChange={(e) => {
                                  const paths = e.target.value.split(',').map(p => p.trim()).filter(p => p);
                                  const newKeys = apiKeyValidation.keys.map(k => k.id === key.id ? { ...k, allowedPaths: paths } : k);
                                  updateConfig({ apiKeyValidation: { ...apiKeyValidation, keys: newKeys } });
                                }}
                                placeholder="/api/v1/*, /api/v2/users"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Rate Limit (per minute, optional)</Label>
                              <Input
                                type="number"
                                value={key.rateLimit || ''}
                                onChange={(e) => {
                                  const newKeys = apiKeyValidation.keys.map(k => k.id === key.id ? { ...k, rateLimit: e.target.value ? Number(e.target.value) : undefined } : k);
                                  updateConfig({ apiKeyValidation: { ...apiKeyValidation, keys: newKeys } });
                                }}
                                placeholder="Leave empty for no limit"
                              />
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                      {apiKeyValidation.keys.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">No API keys configured</p>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="graphql-protection" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>GraphQL Query Protection</CardTitle>
                <CardDescription>Protect against complex and dangerous GraphQL queries</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Enable GraphQL Protection</Label>
                  <Switch
                    checked={graphQLProtection.enabled}
                    onCheckedChange={(checked) => updateConfig({ graphQLProtection: { ...graphQLProtection, enabled: checked } })}
                  />
                </div>
                {graphQLProtection.enabled && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Max Query Depth</Label>
                      <Input
                        type="number"
                        value={graphQLProtection.maxDepth}
                        onChange={(e) => updateConfig({ graphQLProtection: { ...graphQLProtection, maxDepth: Number(e.target.value) } })}
                        min={1}
                        max={50}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Max Query Complexity</Label>
                      <Input
                        type="number"
                        value={graphQLProtection.maxComplexity}
                        onChange={(e) => updateConfig({ graphQLProtection: { ...graphQLProtection, maxComplexity: Number(e.target.value) } })}
                        min={1}
                        max={1000}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Max Aliases</Label>
                      <Input
                        type="number"
                        value={graphQLProtection.maxAliases}
                        onChange={(e) => updateConfig({ graphQLProtection: { ...graphQLProtection, maxAliases: Number(e.target.value) } })}
                        min={1}
                        max={100}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Block Introspection Queries</Label>
                      <Switch
                        checked={graphQLProtection.blockIntrospection}
                        onCheckedChange={(checked) => updateConfig({ graphQLProtection: { ...graphQLProtection, blockIntrospection: checked } })}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bot-detection" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Bot Detection</CardTitle>
                <CardDescription>Detect and block automated requests and bots</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Enable Bot Detection</Label>
                  <Switch
                    checked={botDetection.enabled}
                    onCheckedChange={(checked) => updateConfig({ botDetection: { ...botDetection, enabled: checked } })}
                  />
                </div>
                {botDetection.enabled && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Detection Methods</Label>
                      <div className="space-y-2">
                        {['user-agent', 'behavioral', 'fingerprint'].map((method) => (
                          <div key={method} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={botDetection.methods.includes(method as any)}
                              onChange={(e) => {
                                const methods = e.target.checked
                                  ? [...botDetection.methods, method as any]
                                  : botDetection.methods.filter(m => m !== method);
                                updateConfig({ botDetection: { ...botDetection, methods } });
                              }}
                              className="rounded"
                            />
                            <Label className="font-normal capitalize">{method.replace('-', ' ')}</Label>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Block Known Bots</Label>
                      <Switch
                        checked={botDetection.blockKnownBots}
                        onCheckedChange={(checked) => updateConfig({ botDetection: { ...botDetection, blockKnownBots: checked } })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Challenge Suspicious Requests</Label>
                      <Switch
                        checked={botDetection.challengeSuspicious}
                        onCheckedChange={(checked) => updateConfig({ botDetection: { ...botDetection, challengeSuspicious: checked } })}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="anomaly-detection" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Anomaly Detection</CardTitle>
                <CardDescription>Detect anomalous traffic patterns and potential attacks</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Enable Anomaly Detection</Label>
                  <Switch
                    checked={anomalyDetection.enabled}
                    onCheckedChange={(checked) => updateConfig({ anomalyDetection: { ...anomalyDetection, enabled: checked } })}
                  />
                </div>
                {anomalyDetection.enabled && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Anomaly Threshold (multiplier)</Label>
                      <Input
                        type="number"
                        value={anomalyDetection.threshold}
                        onChange={(e) => updateConfig({ anomalyDetection: { ...anomalyDetection, threshold: Number(e.target.value) } })}
                        min={1}
                        max={10}
                        step={0.1}
                      />
                      <p className="text-xs text-muted-foreground">Traffic above this multiplier of average will be flagged as anomalous</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Window Size (seconds)</Label>
                      <Input
                        type="number"
                        value={anomalyDetection.windowSize}
                        onChange={(e) => updateConfig({ anomalyDetection: { ...anomalyDetection, windowSize: Number(e.target.value) } })}
                        min={10}
                        max={600}
                      />
                      <p className="text-xs text-muted-foreground">Time window for calculating average traffic</p>
                    </div>
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
                <Separator />
                <div className="space-y-2">
                  <Label>IP Blacklist</Label>
                  <div className="flex flex-wrap gap-2">
                    {ipBlacklist.map((ip) => (
                      <Badge key={ip} variant="outline" className="gap-1">
                        {ip}
                        <button
                          onClick={() => removeBlacklistedIP(ip)}
                          className="ml-1 hover:text-destructive"
                        >
                          <XCircle className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <Input
                    placeholder="Enter IP or CIDR to block (e.g., 192.168.1.0/24)"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const value = e.currentTarget.value.trim();
                        if (value) {
                          addBlacklistedIP(value);
                          e.currentTarget.value = '';
                        }
                      }
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}


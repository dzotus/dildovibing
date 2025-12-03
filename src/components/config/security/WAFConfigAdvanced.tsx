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
import { Progress } from '@/components/ui/progress';
import { useState } from 'react';
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
  FileText
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

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
    type: 'ip' | 'uri' | 'header' | 'body' | 'method';
    operator: 'equals' | 'contains' | 'startsWith' | 'regex';
    value: string;
  }>;
}

interface WAFThreat {
  id: string;
  type: 'sql-injection' | 'xss' | 'csrf' | 'path-traversal' | 'rce' | 'ddos';
  sourceIP: string;
  target: string;
  timestamp: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  blocked: boolean;
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
  const threats = config.threats || [
    {
      id: '1',
      type: 'sql-injection',
      sourceIP: '192.168.1.100',
      target: '/api/users',
      timestamp: new Date().toISOString(),
      severity: 'critical',
      blocked: true,
    },
  ];
  const requestsBlocked = config.requestsBlocked || 0;
  const requestsAllowed = config.requestsAllowed || 0;
  const threatsDetected = config.threatsDetected || threats.length;

  const [editingRuleIndex, setEditingRuleIndex] = useState<number | null>(null);
  const [showCreateRule, setShowCreateRule] = useState(false);

  const updateConfig = (updates: Partial<WAFConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
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
  };

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
            <Button variant="outline" size="sm">
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
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Requests Allowed</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold text-green-500">{requestsAllowed.toLocaleString()}</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Threats Detected</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold text-orange-500">{threatsDetected.toLocaleString()}</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Active Rules</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">{rules.filter((r) => r.enabled).length}</span>
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
                <div className="space-y-4">
                  {rules.map((rule) => (
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
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="threats" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Detected Threats</CardTitle>
                <CardDescription>Recent security threats and attacks</CardDescription>
              </CardHeader>
              <CardContent>
                {threats.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No threats detected</p>
                ) : (
                  <div className="space-y-2">
                    {threats.map((threat) => (
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


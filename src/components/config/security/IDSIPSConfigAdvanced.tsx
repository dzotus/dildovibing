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
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  Settings, 
  Activity,
  Plus,
  Trash2,
  RefreshCcw,
  Shield,
  AlertTriangle,
  Ban,
  CheckCircle,
  XCircle,
  FileText,
  Network,
  Search,
  Filter,
  Group,
  BarChart3,
  TrendingUp,
  Calendar,
  Clock,
  Download,
  Upload,
  Copy,
  Eye,
  CheckSquare,
  Square,
  Play
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { validateSignaturePattern, SignatureValidationResult, parseSnortRule } from '@/utils/idsips/signatureParser';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

interface IDSIPSConfigProps {
  componentId: string;
}

interface Alert {
  id: string;
  type: 'signature' | 'anomaly' | 'behavioral';
  sourceIP: string;
  destinationIP: string;
  protocol: string;
  port: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  timestamp: string;
  description: string;
  blocked: boolean;
  signature?: string;
}

interface Signature {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  severity: 'critical' | 'high' | 'medium' | 'low';
  pattern: string;
  action: 'alert' | 'block' | 'log';
}

interface BlockedIP {
  ip: string;
  reason: string;
  blockedAt: string;
  expiresAt?: string;
  duration?: number;
}

interface IDSIPSConfig {
  mode?: 'ids' | 'ips';
  enableSignatureDetection?: boolean;
  enableAnomalyDetection?: boolean;
  enableBehavioralAnalysis?: boolean;
  alertThreshold?: 'low' | 'medium' | 'high' | 'critical';
  enableAutoBlock?: boolean;
  blockDuration?: number;
  enableLogging?: boolean;
  logRetention?: number;
  alerts?: Alert[];
  signatures?: Signature[];
  blockedIPs?: BlockedIP[];
  totalAlerts?: number;
  alertsBlocked?: number;
  signaturesActive?: number;
}

export function IDSIPSConfigAdvanced({ componentId }: IDSIPSConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const { getComponentMetrics } = useEmulationStore();
  const { toast } = useToast();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as IDSIPSConfig;
  const mode = config.mode || 'ids';
  const enableSignatureDetection = config.enableSignatureDetection ?? true;
  const enableAnomalyDetection = config.enableAnomalyDetection ?? true;
  const enableBehavioralAnalysis = config.enableBehavioralAnalysis ?? false;
  const alertThreshold = config.alertThreshold || 'medium';
  const enableAutoBlock = config.enableAutoBlock ?? false;
  const blockDuration = config.blockDuration || 3600;
  const enableLogging = config.enableLogging ?? true;
  const logRetention = config.logRetention || 30;
  
  // Получаем реальные метрики из эмуляции
  const metrics = getComponentMetrics(componentId);
  const idsIpsEngine = emulationEngine.getIDSIPSEmulationEngine(componentId);
  
  // Реальные данные из эмуляции
  const [realAlerts, setRealAlerts] = useState<any[]>([]);
  const [realBlockedIPs, setRealBlockedIPs] = useState<any[]>([]);
  const [realStats, setRealStats] = useState({
    totalAlerts: 0,
    alertsBlocked: 0,
    signaturesActive: 0,
    blockedIPs: 0,
  });

  // Обновляем данные из эмуляции
  useEffect(() => {
    if (!idsIpsEngine) return;
    
    const updateData = () => {
      const alerts = idsIpsEngine.getAlerts(100);
      const blockedIPs = idsIpsEngine.getBlockedIPs();
      const stats = idsIpsEngine.getStats();
      
      setRealAlerts(alerts.map(a => ({
        id: a.id,
        type: a.type,
        sourceIP: a.sourceIP,
        destinationIP: a.destinationIP,
        protocol: a.protocol,
        port: a.port,
        severity: a.severity,
        timestamp: new Date(a.timestamp).toISOString(),
        description: a.description,
        blocked: a.blocked,
        signature: a.signature,
      })));
      
      setRealBlockedIPs(blockedIPs.map(b => ({
        ip: b.ip,
        reason: b.reason,
        blockedAt: new Date(b.blockedAt).toISOString(),
        expiresAt: b.expiresAt ? new Date(b.expiresAt).toISOString() : undefined,
        duration: b.expiresAt ? Math.floor((b.expiresAt - b.blockedAt) / 1000) : undefined,
      })));
      
      setRealStats({
        totalAlerts: stats.alertsGenerated,
        alertsBlocked: stats.alertsBlocked,
        signaturesActive: stats.activeSignatures,
        blockedIPs: stats.blockedIPs,
      });
    };
    
    // Use interval to update data periodically instead of on every metrics change
    const interval = setInterval(updateData, 1000);
    updateData(); // Initial update
    
    return () => clearInterval(interval);
  }, [idsIpsEngine]);

  // Используем только сигнатуры из конфига, без хардкода дефолтных значений
  const signatures = Array.isArray(config.signatures) ? config.signatures : [];
  
  // Memoize signatures string to detect actual changes
  const signaturesKey = useMemo(() => 
    JSON.stringify(signatures.map(s => ({ id: s.id, pattern: s.pattern }))),
    [signatures]
  );

  // Validate all signatures on mount and when signatures change
  useEffect(() => {
    const validationMap = new Map<string, SignatureValidationResult>();
    signatures.forEach(sig => {
      if (sig.pattern) {
        const validation = validateSignaturePattern(sig.pattern);
        validationMap.set(sig.id, validation);
      }
    });
    setSignatureValidation(validationMap);
  }, [signaturesKey]);

  // Используем реальные данные из эмуляции, если доступны
  const alerts = realAlerts.length > 0 ? realAlerts : config.alerts || [];
  const blockedIPs = realBlockedIPs.length > 0 ? realBlockedIPs : config.blockedIPs || [];
  const totalAlerts = realStats.totalAlerts || config.totalAlerts || alerts.length;
  const alertsBlocked = realStats.alertsBlocked || config.alertsBlocked || alerts.filter((a) => a.blocked).length;
  const signaturesActive = realStats.signaturesActive || config.signaturesActive || signatures.filter((s) => s.enabled).length;

  const [editingSignatureIndex, setEditingSignatureIndex] = useState<number | null>(null);
  const [showCreateSignature, setShowCreateSignature] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [alertFilter, setAlertFilter] = useState<'all' | 'signature' | 'anomaly' | 'behavioral'>('all');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'critical' | 'high' | 'medium' | 'low'>('all');
  const [timeFilter, setTimeFilter] = useState<'all' | '1h' | '6h' | '24h' | '7d'>('all');
  const [groupBy, setGroupBy] = useState<'none' | 'type' | 'severity' | 'sourceIP' | 'time'>('none');
  const [signatureValidation, setSignatureValidation] = useState<Map<string, SignatureValidationResult>>(new Map());
  const [selectedSignatures, setSelectedSignatures] = useState<Set<string>>(new Set());
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [previewSignature, setPreviewSignature] = useState<Signature | null>(null);
  const [previewTestPayload, setPreviewTestPayload] = useState('');
  const [previewResult, setPreviewResult] = useState<{ matched: boolean; details: string } | null>(null);

  // Use ref to store latest node to avoid dependency issues
  const nodeRef = useRef(node);
  useEffect(() => {
    nodeRef.current = node;
  }, [node]);

  // Helper to get current signatures from node ref
  const getCurrentSignatures = useCallback((): Signature[] => {
    const currentNode = nodeRef.current;
    if (!currentNode) return [];
    const currentConfig = (currentNode.data.config as any) || {} as IDSIPSConfig;
    return Array.isArray(currentConfig.signatures) ? currentConfig.signatures : [];
  }, []);

  const updateConfig = useCallback((updates: Partial<IDSIPSConfig>) => {
    const currentNode = nodeRef.current;
    if (!currentNode) return;
    
    const currentConfig = (currentNode.data.config as any) || {} as IDSIPSConfig;
    const newConfig = { ...currentConfig, ...updates };
    
    updateNode(componentId, {
      data: {
        ...currentNode.data,
        config: newConfig,
      },
    });
    
    // Обновляем эмуляцию при изменении конфигурации
    try {
      const engine = emulationEngine.getIDSIPSEmulationEngine(componentId);
      if (engine) {
        engine.initializeConfig({
          ...currentNode,
          data: {
            ...currentNode.data,
            config: newConfig,
          },
        });
      }
    } catch (e) {
      // Silently fail - emulation will sync on next updateMetrics call
    }
  }, [componentId, updateNode]);

  const handleRefresh = () => {
    if (idsIpsEngine) {
      const alerts = idsIpsEngine.getAlerts(100);
      const blockedIPs = idsIpsEngine.getBlockedIPs();
      const stats = idsIpsEngine.getStats();
      
      setRealAlerts(alerts.map(a => ({
        id: a.id,
        type: a.type,
        sourceIP: a.sourceIP,
        destinationIP: a.destinationIP,
        protocol: a.protocol,
        port: a.port,
        severity: a.severity,
        timestamp: new Date(a.timestamp).toISOString(),
        description: a.description,
        blocked: a.blocked,
        signature: a.signature,
      })));
      
      setRealBlockedIPs(blockedIPs.map(b => ({
        ip: b.ip,
        reason: b.reason,
        blockedAt: new Date(b.blockedAt).toISOString(),
        expiresAt: b.expiresAt ? new Date(b.expiresAt).toISOString() : undefined,
        duration: b.expiresAt ? Math.floor((b.expiresAt - b.blockedAt) / 1000) : undefined,
      })));
      
      setRealStats({
        totalAlerts: stats.alertsGenerated,
        alertsBlocked: stats.alertsBlocked,
        signaturesActive: stats.activeSignatures,
        blockedIPs: stats.blockedIPs,
      });
      
      toast({
        title: 'Refreshed',
        description: 'IDS/IPS data has been refreshed',
      });
    }
  };

  const addSignature = useCallback(() => {
    const currentSignatures = getCurrentSignatures();
    const newSignature: Signature = {
      id: `sig-${Date.now()}`,
      name: 'New Signature',
      description: '',
      enabled: true,
      severity: 'medium',
      pattern: '',
      action: 'alert',
    };
    updateConfig({ signatures: [...currentSignatures, newSignature] });
    setShowCreateSignature(false);
    toast({
      title: 'Signature created',
      description: 'New signature has been created',
    });
  }, [getCurrentSignatures, updateConfig, toast]);

  const removeSignature = useCallback((id: string) => {
    const currentSignatures = getCurrentSignatures();
    const signature = currentSignatures.find(s => s.id === id);
    updateConfig({ signatures: currentSignatures.filter((s) => s.id !== id) });
    toast({
      title: 'Signature deleted',
      description: signature ? `Signature "${signature.name}" has been deleted` : 'Signature has been deleted',
    });
  }, [getCurrentSignatures, updateConfig, toast]);

  const updateSignature = useCallback((id: string, field: string, value: any) => {
    const currentSignatures = getCurrentSignatures();
    const newSignatures = currentSignatures.map((s) =>
      s.id === id ? { ...s, [field]: value } : s
    );
    updateConfig({ signatures: newSignatures });
    
    // Validate pattern if it was changed
    if (field === 'pattern') {
      const validation = validateSignaturePattern(value);
      setSignatureValidation(prev => {
        const next = new Map(prev);
        next.set(id, validation);
        return next;
      });
      
      // Show warning toast if there are warnings
      if (validation.warnings.length > 0) {
        toast({
          title: 'Pattern validation warning',
          description: validation.warnings.join('; '),
          variant: 'default',
        });
      }
      
      // Show error toast if there are errors
      if (!validation.valid && validation.errors.length > 0) {
        toast({
          title: 'Invalid pattern',
          description: validation.errors.join('; '),
          variant: 'destructive',
        });
      }
    }
  }, [updateConfig, toast]);

  const unblockIP = (ip: string) => {
    if (idsIpsEngine) {
      idsIpsEngine.unblockIP(ip);
    }
    updateConfig({ blockedIPs: blockedIPs.filter((b) => b.ip !== ip) });
    toast({
      title: 'IP unblocked',
      description: `IP address ${ip} has been unblocked`,
    });
  };

  // Импорт/экспорт сигнатур
  const exportSignatures = (format: 'json' | 'snort' = 'json') => {
    if (signatures.length === 0) {
      toast({
        title: 'No signatures',
        description: 'No signatures to export',
        variant: 'destructive',
      });
      return;
    }

    if (format === 'json') {
      const exportData = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        signatures: signatures.map(sig => ({
          name: sig.name,
          description: sig.description,
          enabled: sig.enabled,
          severity: sig.severity,
          pattern: sig.pattern,
          action: sig.action,
        })),
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `idsips-signatures-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({
        title: 'Exported',
        description: `Exported ${signatures.length} signature(s) to JSON`,
      });
    } else if (format === 'snort') {
      // Экспорт в формат Snort rules
      const snortRules = signatures
        .filter(sig => sig.enabled && sig.pattern)
        .map(sig => {
          // Если паттерн уже в формате Snort, используем его
          const validation = validateSignaturePattern(sig.pattern);
          if (validation.valid && validation.parsed) {
            return validation.parsed.raw;
          }
          // Иначе конвертируем в Snort формат
          const protocol = sig.protocol || 'tcp';
          const sourceIP = sig.sourceIP || 'any';
          const sourcePort = sig.sourcePort ? sig.sourcePort.toString() : 'any';
          const destIP = sig.destinationIP || 'any';
          const destPort = sig.port ? sig.port.toString() : 'any';
          const action = sig.action === 'block' ? 'drop' : 'alert';
          const msg = sig.description || sig.name;
          const sid = parseInt(sig.id.replace('sig-', '')) || 1000000 + signatures.indexOf(sig);
          
          return `${action} ${protocol} ${sourceIP} ${sourcePort} -> ${destIP} ${destPort} (msg:"${msg}"; sid:${sid};)`;
        })
        .join('\n');
      
      const blob = new Blob([snortRules], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `idsips-signatures-${Date.now()}.rules`;
      a.click();
      URL.revokeObjectURL(url);
      toast({
        title: 'Exported',
        description: `Exported ${signatures.filter(s => s.enabled).length} signature(s) to Snort rules`,
      });
    }
  };

  const importSignatures = (format: 'json' | 'snort' = 'json') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = format === 'json' ? 'application/json' : '.rules,.txt';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = event.target?.result as string;
          
          if (format === 'json') {
            const data = JSON.parse(content);
            if (!data.signatures || !Array.isArray(data.signatures)) {
              throw new Error('Invalid JSON format: signatures array not found');
            }
            
            const newSignatures = data.signatures.map((sig: any, index: number) => ({
              id: `sig-${Date.now()}-${index}`,
              name: sig.name || `Imported Signature ${index + 1}`,
              description: sig.description || '',
              enabled: sig.enabled !== undefined ? sig.enabled : true,
              severity: sig.severity || 'medium',
              pattern: sig.pattern || '',
              action: sig.action || 'alert',
            }));
            
            const currentSignatures = getCurrentSignatures();
            updateConfig({ signatures: [...currentSignatures, ...newSignatures] });
            toast({
              title: 'Imported',
              description: `Imported ${newSignatures.length} signature(s) from JSON`,
            });
          } else if (format === 'snort') {
            // Парсинг Snort rules из файла
            const lines = content.split('\n').filter(line => line.trim() && !line.trim().startsWith('#'));
            const newSignatures: Signature[] = [];
            
            lines.forEach((line, index) => {
              const validation = parseSnortRule(line.trim());
              if (validation.valid && validation.parsed) {
                const parsed = validation.parsed;
                const name = parsed.options.msg || `Snort Rule ${index + 1}`;
                const severity = parsed.options.priority 
                  ? (parsed.options.priority >= 3 ? 'critical' : parsed.options.priority >= 2 ? 'high' : 'medium')
                  : 'medium';
                const action = parsed.action === 'drop' || parsed.action === 'reject' ? 'block' : 'alert';
                
                newSignatures.push({
                  id: `sig-${Date.now()}-${index}`,
                  name,
                  description: parsed.options.msg || '',
                  enabled: true,
                  severity: severity as 'critical' | 'high' | 'medium' | 'low',
                  pattern: line.trim(),
                  action: action as 'alert' | 'block' | 'log',
                });
              }
            });
            
            if (newSignatures.length > 0) {
              const currentSignatures = getCurrentSignatures();
            updateConfig({ signatures: [...currentSignatures, ...newSignatures] });
              toast({
                title: 'Imported',
                description: `Imported ${newSignatures.length} signature(s) from Snort rules`,
              });
            } else {
              toast({
                title: 'Import failed',
                description: 'No valid Snort rules found in file',
                variant: 'destructive',
              });
            }
          }
        } catch (error) {
          toast({
            title: 'Import failed',
            description: error instanceof Error ? error.message : 'Failed to import signatures',
            variant: 'destructive',
          });
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const importFromURL = async () => {
    const url = prompt('Enter URL to import signatures from:');
    if (!url) return;
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const content = await response.text();
      
      // Пытаемся определить формат по содержимому
      let format: 'json' | 'snort' = 'snort';
      try {
        JSON.parse(content);
        format = 'json';
      } catch {
        format = 'snort';
      }
      
      if (format === 'json') {
        const data = JSON.parse(content);
        if (!data.signatures || !Array.isArray(data.signatures)) {
          throw new Error('Invalid JSON format: signatures array not found');
        }
        
        const newSignatures = data.signatures.map((sig: any, index: number) => ({
          id: `sig-${Date.now()}-${index}`,
          name: sig.name || `Imported Signature ${index + 1}`,
          description: sig.description || '',
          enabled: sig.enabled !== undefined ? sig.enabled : true,
          severity: sig.severity || 'medium',
          pattern: sig.pattern || '',
          action: sig.action || 'alert',
        }));
        
        const currentSignatures = getCurrentSignatures();
        updateConfig({ signatures: [...currentSignatures, ...newSignatures] });
        toast({
          title: 'Imported',
          description: `Imported ${newSignatures.length} signature(s) from URL`,
        });
      } else {
        // Snort rules format
        const lines = content.split('\n').filter(line => line.trim() && !line.trim().startsWith('#'));
        const newSignatures: Signature[] = [];
        
        lines.forEach((line, index) => {
          const validation = parseSnortRule(line.trim());
          if (validation.valid && validation.parsed) {
            const parsed = validation.parsed;
            const name = parsed.options.msg || `Snort Rule ${index + 1}`;
            const severity = parsed.options.priority 
              ? (parsed.options.priority >= 3 ? 'critical' : parsed.options.priority >= 2 ? 'high' : 'medium')
              : 'medium';
            const action = parsed.action === 'drop' || parsed.action === 'reject' ? 'block' : 'alert';
            
            newSignatures.push({
              id: `sig-${Date.now()}-${index}`,
              name,
              description: parsed.options.msg || '',
              enabled: true,
              severity: severity as 'critical' | 'high' | 'medium' | 'low',
              pattern: line.trim(),
              action: action as 'alert' | 'block' | 'log',
            });
          }
        });
        
        if (newSignatures.length > 0) {
          const currentSignatures = getCurrentSignatures();
          updateConfig({ signatures: [...currentSignatures, ...newSignatures] });
          toast({
            title: 'Imported',
            description: `Imported ${newSignatures.length} signature(s) from URL`,
          });
        } else {
          toast({
            title: 'Import failed',
            description: 'No valid Snort rules found at URL',
            variant: 'destructive',
          });
        }
      }
    } catch (error) {
      toast({
        title: 'Import failed',
        description: error instanceof Error ? error.message : 'Failed to import from URL',
        variant: 'destructive',
      });
    }
  };

  // Массовое управление сигнатурами
  const toggleSelectSignature = (id: string) => {
    setSelectedSignatures(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAllSignatures = () => {
    setSelectedSignatures(new Set(signatures.map(s => s.id)));
  };

  const deselectAllSignatures = () => {
    setSelectedSignatures(new Set());
  };

  const bulkEnableSignatures = useCallback(() => {
    if (selectedSignatures.size === 0) {
      toast({
        title: 'No selection',
        description: 'Please select signatures to enable',
        variant: 'destructive',
      });
      return;
    }
    const currentSignatures = getCurrentSignatures();
    const newSignatures = currentSignatures.map(sig =>
      selectedSignatures.has(sig.id) ? { ...sig, enabled: true } : sig
    );
    updateConfig({ signatures: newSignatures });
    toast({
      title: 'Enabled',
      description: `Enabled ${selectedSignatures.size} signature(s)`,
    });
    setSelectedSignatures(new Set());
  }, [selectedSignatures, getCurrentSignatures, updateConfig, toast]);

  const bulkDisableSignatures = useCallback(() => {
    if (selectedSignatures.size === 0) {
      toast({
        title: 'No selection',
        description: 'Please select signatures to disable',
        variant: 'destructive',
      });
      return;
    }
    const currentSignatures = getCurrentSignatures();
    const newSignatures = currentSignatures.map(sig =>
      selectedSignatures.has(sig.id) ? { ...sig, enabled: false } : sig
    );
    updateConfig({ signatures: newSignatures });
    toast({
      title: 'Disabled',
      description: `Disabled ${selectedSignatures.size} signature(s)`,
    });
    setSelectedSignatures(new Set());
  }, [selectedSignatures, getCurrentSignatures, updateConfig, toast]);

  const bulkDeleteSignatures = useCallback(() => {
    if (selectedSignatures.size === 0) {
      toast({
        title: 'No selection',
        description: 'Please select signatures to delete',
        variant: 'destructive',
      });
      return;
    }
    const currentSignatures = getCurrentSignatures();
    const newSignatures = currentSignatures.filter(sig => !selectedSignatures.has(sig.id));
    updateConfig({ signatures: newSignatures });
    toast({
      title: 'Deleted',
      description: `Deleted ${selectedSignatures.size} signature(s)`,
    });
    setSelectedSignatures(new Set());
  }, [selectedSignatures, getCurrentSignatures, updateConfig, toast]);

  // Копирование сигнатуры
  const copySignature = useCallback((id: string) => {
    const currentSignatures = getCurrentSignatures();
    const signature = currentSignatures.find(s => s.id === id);
    if (!signature) return;
    
    const newSignature: Signature = {
      ...signature,
      id: `sig-${Date.now()}`,
      name: `${signature.name} (Copy)`,
    };
    updateConfig({ signatures: [...currentSignatures, newSignature] });
    toast({
      title: 'Copied',
      description: `Signature "${signature.name}" has been copied`,
    });
  }, [getCurrentSignatures, updateConfig, toast]);

  // Предпросмотр сигнатуры
  const testSignature = (sig: Signature, testPayload: string) => {
    if (!testPayload.trim()) {
      setPreviewResult({ matched: false, details: 'Please enter a test payload' });
      return;
    }

    try {
      // Проверяем, является ли паттерн Snort rule
      const validation = validateSignaturePattern(sig.pattern);
      let matched = false;
      let details = '';

      if (validation.valid && validation.parsed) {
        // Snort rule - проверяем content option
        const parsed = validation.parsed;
        if (parsed.options.content) {
          const contentPattern = parsed.options.content;
          // Убираем экранирование и проверяем
          const regex = new RegExp(contentPattern.replace(/\\x[0-9a-fA-F]{2}/g, (match) => {
            return String.fromCharCode(parseInt(match.slice(2), 16));
          }));
          matched = regex.test(testPayload);
          details = matched 
            ? `Pattern "${contentPattern}" matched in payload`
            : `Pattern "${contentPattern}" did not match`;
        } else {
          details = 'Snort rule has no content option to test';
        }
      } else {
        // Regex pattern
        try {
          const regex = new RegExp(sig.pattern);
          matched = regex.test(testPayload);
          details = matched
            ? `Pattern "${sig.pattern}" matched in payload`
            : `Pattern "${sig.pattern}" did not match`;
        } catch (error) {
          details = `Invalid regex pattern: ${error instanceof Error ? error.message : String(error)}`;
        }
      }

      setPreviewResult({ matched, details });
    } catch (error) {
      setPreviewResult({ 
        matched: false, 
        details: `Error testing signature: ${error instanceof Error ? error.message : String(error)}` 
      });
    }
  };

  const openPreviewDialog = (sig: Signature) => {
    setPreviewSignature(sig);
    setPreviewTestPayload('');
    setPreviewResult(null);
    setShowPreviewDialog(true);
  };

  // Фильтрация алертов
  const filteredAlerts = alerts.filter(alert => {
    // Фильтр по типу
    if (alertFilter !== 'all' && alert.type !== alertFilter) return false;
    
    // Фильтр по severity
    if (severityFilter !== 'all' && alert.severity !== severityFilter) return false;
    
    // Фильтр по времени
    if (timeFilter !== 'all') {
      const alertTime = new Date(alert.timestamp).getTime();
      const now = Date.now();
      const timeRanges: Record<string, number> = {
        '1h': 60 * 60 * 1000,
        '6h': 6 * 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
      };
      if (now - alertTime > timeRanges[timeFilter]) return false;
    }
    
    // Поиск
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        alert.sourceIP.toLowerCase().includes(query) ||
        alert.destinationIP.toLowerCase().includes(query) ||
        alert.description.toLowerCase().includes(query) ||
        (alert.signature && alert.signature.toLowerCase().includes(query))
      );
    }
    return true;
  });

  // Группировка алертов
  const groupedAlerts = (() => {
    if (groupBy === 'none') {
      return { 'All Alerts': filteredAlerts };
    }
    
    const groups: Record<string, Alert[]> = {};
    
    filteredAlerts.forEach(alert => {
      let key: string;
      switch (groupBy) {
        case 'type':
          key = alert.type;
          break;
        case 'severity':
          key = alert.severity;
          break;
        case 'sourceIP':
          key = alert.sourceIP;
          break;
        case 'time':
          const alertDate = new Date(alert.timestamp);
          const now = new Date();
          const diffHours = (now.getTime() - alertDate.getTime()) / (1000 * 60 * 60);
          if (diffHours < 1) key = 'Last hour';
          else if (diffHours < 6) key = 'Last 6 hours';
          else if (diffHours < 24) key = 'Last 24 hours';
          else if (diffHours < 168) key = 'Last week';
          else key = 'Older';
          break;
        default:
          key = 'All Alerts';
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(alert);
    });
    
    return groups;
  })();

  // Данные для графиков
  const chartData = (() => {
    const now = Date.now();
    const timeRanges = ['1h', '6h', '24h', '7d'] as const;
    const data: Array<{ time: string; signature: number; anomaly: number; behavioral: number }> = [];
    
    timeRanges.forEach(range => {
      const rangeMs: Record<string, number> = {
        '1h': 60 * 60 * 1000,
        '6h': 6 * 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
      };
      const startTime = now - rangeMs[range];
      const rangeAlerts = alerts.filter(a => {
        const alertTime = new Date(a.timestamp).getTime();
        return alertTime >= startTime && alertTime < now;
      });
      
      data.push({
        time: range,
        signature: rangeAlerts.filter(a => a.type === 'signature').length,
        anomaly: rangeAlerts.filter(a => a.type === 'anomaly').length,
        behavioral: rangeAlerts.filter(a => a.type === 'behavioral').length,
      });
    });
    
    return data;
  })();

  // Данные для графика по типам атак
  const attackTypeData = (() => {
    const typeCounts: Record<string, number> = {};
    filteredAlerts.forEach(alert => {
      // Извлекаем тип атаки из description
      const desc = alert.description.toLowerCase();
      let attackType = 'Other';
      if (desc.includes('sql injection') || desc.includes('sqli')) attackType = 'SQL Injection';
      else if (desc.includes('xss') || desc.includes('cross-site')) attackType = 'XSS';
      else if (desc.includes('brute force') || desc.includes('bruteforce')) attackType = 'Brute Force';
      else if (desc.includes('ddos') || desc.includes('denial')) attackType = 'DDoS';
      else if (desc.includes('port scan') || desc.includes('scanning')) attackType = 'Port Scanning';
      else if (desc.includes('network scan')) attackType = 'Network Scanning';
      else if (desc.includes('malware') || desc.includes('virus')) attackType = 'Malware';
      else if (desc.includes('phishing')) attackType = 'Phishing';
      else if (desc.includes('rce') || desc.includes('remote code')) attackType = 'RCE';
      else if (desc.includes('path traversal') || desc.includes('directory traversal')) attackType = 'Path Traversal';
      
      typeCounts[attackType] = (typeCounts[attackType] || 0) + 1;
    });
    
    return Object.entries(typeCounts).map(([name, value]) => ({ name, value }));
  })();

  // Данные для графика по severity
  const severityData = (() => {
    const severityCounts: Record<string, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };
    filteredAlerts.forEach(alert => {
      severityCounts[alert.severity] = (severityCounts[alert.severity] || 0) + 1;
    });
    
    return Object.entries(severityCounts).map(([name, value]) => ({ name, value }));
  })();

  // Данные для временного графика
  const timeSeriesData = (() => {
    const now = Date.now();
    const hours = 24;
    const data: Array<{ time: string; count: number }> = [];
    
    for (let i = hours - 1; i >= 0; i--) {
      const hourStart = now - (i + 1) * 60 * 60 * 1000;
      const hourEnd = now - i * 60 * 60 * 1000;
      const hourAlerts = alerts.filter(a => {
        const alertTime = new Date(a.timestamp).getTime();
        return alertTime >= hourStart && alertTime < hourEnd;
      });
      
      const date = new Date(hourEnd);
      data.push({
        time: `${date.getHours().toString().padStart(2, '0')}:00`,
        count: hourAlerts.length,
      });
    }
    
    return data;
  })();

  const COLORS = ['#ef4444', '#f97316', '#eab308', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6'];

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <p className="text-xs uppercase text-muted-foreground tracking-wide">IDS / IPS</p>
            <h2 className="text-2xl font-bold text-foreground">Intrusion Detection & Prevention</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Monitor and protect network from security threats
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCcw className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Alerts</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">{totalAlerts}</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Alerts Blocked</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold text-red-500">{alertsBlocked}</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Active Signatures</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">{signaturesActive}</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Blocked IPs</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">{blockedIPs.length}</span>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="alerts" className="space-y-4">
          <TabsList>
            <TabsTrigger value="alerts">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Alerts ({alerts.length})
            </TabsTrigger>
            <TabsTrigger value="signatures">
              <Shield className="h-4 w-4 mr-2" />
              Signatures ({signatures.length})
            </TabsTrigger>
            <TabsTrigger value="blocked">
              <Ban className="h-4 w-4 mr-2" />
              Blocked IPs ({blockedIPs.length})
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="alerts" className="space-y-4">
            {/* Визуализация */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Alerts Over Time</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={timeSeriesData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                      <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="count" stroke="#ef4444" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Alerts by Type</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                      <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="signature" stackId="a" fill="#ef4444" />
                      <Bar dataKey="anomaly" stackId="a" fill="#f97316" />
                      <Bar dataKey="behavioral" stackId="a" fill="#eab308" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              
              {attackTypeData.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Attack Types</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={attackTypeData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {attackTypeData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Alerts by Severity</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={severityData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#ef4444" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Фильтры и группировка */}
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-4">
                  <div>
                    <CardTitle>Security Alerts</CardTitle>
                    <CardDescription>Recent intrusion detection alerts</CardDescription>
                  </div>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-wrap">
                    <div className="relative flex-1 min-w-[200px]">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search alerts..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 w-full"
                      />
                    </div>
                    <Select value={alertFilter} onValueChange={(value: any) => {
                      if (value !== alertFilter) {
                        setAlertFilter(value);
                      }
                    }}>
                      <SelectTrigger className="w-full sm:w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="signature">Signature</SelectItem>
                        <SelectItem value="anomaly">Anomaly</SelectItem>
                        <SelectItem value="behavioral">Behavioral</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={severityFilter} onValueChange={(value: any) => {
                      if (value !== severityFilter) {
                        setSeverityFilter(value);
                      }
                    }}>
                      <SelectTrigger className="w-full sm:w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Severities</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={timeFilter} onValueChange={(value: any) => {
                      if (value !== timeFilter) {
                        setTimeFilter(value);
                      }
                    }}>
                      <SelectTrigger className="w-full sm:w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Time</SelectItem>
                        <SelectItem value="1h">Last Hour</SelectItem>
                        <SelectItem value="6h">Last 6 Hours</SelectItem>
                        <SelectItem value="24h">Last 24 Hours</SelectItem>
                        <SelectItem value="7d">Last 7 Days</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={groupBy} onValueChange={(value: any) => {
                      if (value !== groupBy) {
                        setGroupBy(value);
                      }
                    }}>
                      <SelectTrigger className="w-full sm:w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Grouping</SelectItem>
                        <SelectItem value="type">Group by Type</SelectItem>
                        <SelectItem value="severity">Group by Severity</SelectItem>
                        <SelectItem value="sourceIP">Group by Source IP</SelectItem>
                        <SelectItem value="time">Group by Time</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {filteredAlerts.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    {alerts.length === 0 ? 'No alerts detected' : 'No alerts match the filter'}
                  </p>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(groupedAlerts).map(([groupName, groupAlerts]) => (
                      <div key={groupName} className="space-y-2">
                        {groupBy !== 'none' && (
                          <div className="flex items-center gap-2 mb-2">
                            <Group className="h-4 w-4 text-muted-foreground" />
                            <h3 className="font-semibold text-sm">{groupName}</h3>
                            <Badge variant="outline">{groupAlerts.length} alerts</Badge>
                          </div>
                        )}
                        <div className="space-y-2">
                          {groupAlerts.map((alert) => (
                            <Card
                              key={alert.id}
                              className={`border-l-4 ${
                                alert.severity === 'critical' ? 'border-l-red-500' :
                                alert.severity === 'high' ? 'border-l-orange-500' :
                                alert.severity === 'medium' ? 'border-l-yellow-500' : 'border-l-blue-500'
                              }`}
                            >
                              <CardContent className="pt-4">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                      <Badge variant={
                                        alert.severity === 'critical' ? 'destructive' :
                                        alert.severity === 'high' ? 'default' : 'outline'
                                      }>
                                        {alert.severity}
                                      </Badge>
                                      <Badge variant="outline">{alert.type}</Badge>
                                      {alert.blocked ? (
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
                                    <p className="font-medium mb-1">{alert.description}</p>
                                    <div className="text-sm text-muted-foreground">
                                      <p>Source: {alert.sourceIP} → Destination: {alert.destinationIP}</p>
                                      <p>Protocol: {alert.protocol} Port: {alert.port}</p>
                                      <p>Time: {new Date(alert.timestamp).toLocaleString()}</p>
                                      {alert.signature && (
                                        <p>Signature: {alert.signature}</p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="signatures" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle>Detection Signatures</CardTitle>
                    <CardDescription>Configure detection rules and patterns</CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {selectedSignatures.size > 0 && (
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={bulkEnableSignatures}
                          className="flex-shrink-0"
                        >
                          <CheckSquare className="h-4 w-4 sm:mr-2" />
                          <span className="hidden sm:inline">Enable ({selectedSignatures.size})</span>
                          <span className="sm:hidden">Enable</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={bulkDisableSignatures}
                          className="flex-shrink-0"
                        >
                          <Square className="h-4 w-4 sm:mr-2" />
                          <span className="hidden sm:inline">Disable ({selectedSignatures.size})</span>
                          <span className="sm:hidden">Disable</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={bulkDeleteSignatures}
                          className="flex-shrink-0"
                        >
                          <Trash2 className="h-4 w-4 sm:mr-2" />
                          <span className="hidden sm:inline">Delete ({selectedSignatures.size})</span>
                          <span className="sm:hidden">Delete</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={deselectAllSignatures}
                          className="flex-shrink-0"
                        >
                          Clear
                        </Button>
                      </div>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="flex-shrink-0">
                          <Download className="h-4 w-4 sm:mr-2" />
                          <span className="hidden sm:inline">Export</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => exportSignatures('json')}>
                          <FileText className="h-4 w-4 mr-2" />
                          Export as JSON
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => exportSignatures('snort')}>
                          <FileText className="h-4 w-4 mr-2" />
                          Export as Snort Rules
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="flex-shrink-0">
                          <Upload className="h-4 w-4 sm:mr-2" />
                          <span className="hidden sm:inline">Import</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => importSignatures('json')}>
                          <FileText className="h-4 w-4 mr-2" />
                          Import from JSON
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => importSignatures('snort')}>
                          <FileText className="h-4 w-4 mr-2" />
                          Import from Snort Rules
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={importFromURL}>
                          <Network className="h-4 w-4 mr-2" />
                          Import from URL
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button onClick={addSignature} size="sm" className="flex-shrink-0">
                      <Plus className="h-4 w-4 sm:mr-2" />
                      <span className="hidden sm:inline">Create Signature</span>
                      <span className="sm:hidden">Create</span>
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {signatures.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No signatures configured. Create your first signature or import from file.
                  </p>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b">
                      <Checkbox
                        checked={selectedSignatures.size === signatures.length && signatures.length > 0}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            selectAllSignatures();
                          } else {
                            deselectAllSignatures();
                          }
                        }}
                      />
                      <Label className="text-sm text-muted-foreground">
                        Select all ({selectedSignatures.size} selected)
                      </Label>
                    </div>
                    {signatures.map((signature) => (
                      <Card key={signature.id} className="border-l-4 border-l-blue-500">
                        <CardHeader className="pb-3">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <Checkbox
                                checked={selectedSignatures.has(signature.id)}
                                onCheckedChange={() => toggleSelectSignature(signature.id)}
                                className="flex-shrink-0"
                              />
                              <div className="flex-1 min-w-0">
                                <CardTitle className="text-base truncate">{signature.name}</CardTitle>
                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                  <Badge variant={signature.enabled ? 'default' : 'outline'} className="flex-shrink-0">
                                    {signature.enabled ? 'Enabled' : 'Disabled'}
                                  </Badge>
                                  <Badge variant={
                                    signature.severity === 'critical' ? 'destructive' :
                                    signature.severity === 'high' ? 'default' : 'outline'
                                  } className="flex-shrink-0">
                                    {signature.severity}
                                  </Badge>
                                  <Badge variant="outline" className="flex-shrink-0">{signature.action}</Badge>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openPreviewDialog(signature)}
                                title="Preview/Test signature"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => copySignature(signature.id)}
                                title="Copy signature"
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                              <Switch
                                checked={signature.enabled}
                                onCheckedChange={(checked) => updateSignature(signature.id, 'enabled', checked)}
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeSignature(signature.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Signature Name</Label>
                            <Input
                              value={signature.name}
                              onChange={(e) => updateSignature(signature.id, 'name', e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Severity</Label>
                            <Select
                              value={signature.severity || 'medium'}
                              onValueChange={(value: 'critical' | 'high' | 'medium' | 'low') => {
                                if (value !== signature.severity) {
                                  updateSignature(signature.id, 'severity', value);
                                }
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="critical">Critical</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="low">Low</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Action</Label>
                            <Select
                              value={signature.action || 'alert'}
                              onValueChange={(value: 'alert' | 'block' | 'log') => {
                                if (value !== signature.action) {
                                  updateSignature(signature.id, 'action', value);
                                }
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="block">Block</SelectItem>
                                <SelectItem value="alert">Alert</SelectItem>
                                <SelectItem value="log">Log</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Description</Label>
                            <Input
                              value={signature.description}
                              onChange={(e) => updateSignature(signature.id, 'description', e.target.value)}
                              placeholder="Signature description"
                            />
                          </div>
                          <div className="space-y-2 sm:col-span-2">
                            <Label>Pattern</Label>
                            <Input
                              value={signature.pattern}
                              onChange={(e) => updateSignature(signature.id, 'pattern', e.target.value)}
                              placeholder="Detection pattern (regex or Snort rule)"
                              className={`font-mono text-sm ${
                                signatureValidation.get(signature.id)?.valid === false
                                  ? 'border-red-500'
                                  : signatureValidation.get(signature.id)?.warnings.length
                                  ? 'border-yellow-500'
                                  : ''
                              }`}
                            />
                            {signatureValidation.get(signature.id) && (
                              <div className="space-y-1">
                                {signatureValidation.get(signature.id)?.errors.map((error, idx) => (
                                  <p key={idx} className="text-xs text-red-500 flex items-center gap-1">
                                    <XCircle className="h-3 w-3" />
                                    {error}
                                  </p>
                                ))}
                                {signatureValidation.get(signature.id)?.warnings.map((warning, idx) => (
                                  <p key={idx} className="text-xs text-yellow-500 flex items-center gap-1">
                                    <AlertTriangle className="h-3 w-3" />
                                    {warning}
                                  </p>
                                ))}
                                {signatureValidation.get(signature.id)?.valid && 
                                 signatureValidation.get(signature.id)?.errors.length === 0 &&
                                 signatureValidation.get(signature.id)?.warnings.length === 0 && (
                                  <p className="text-xs text-green-500 flex items-center gap-1">
                                    <CheckCircle className="h-3 w-3" />
                                    Pattern is valid
                                  </p>
                                )}
                              </div>
                            )}
                            <p className="text-xs text-muted-foreground">
                              Enter a regex pattern or Snort rule format (e.g., alert tcp any any -&gt; any 22 (msg:"SSH"; sid:1000001;))
                            </p>
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

          <TabsContent value="blocked" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Blocked IP Addresses</CardTitle>
                <CardDescription>IPs currently blocked by the system</CardDescription>
              </CardHeader>
              <CardContent>
                {blockedIPs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No IPs blocked</p>
                ) : (
                  <div className="space-y-2">
                    {blockedIPs.map((blocked, index) => (
                      <Card key={index} className="border-l-4 border-l-red-500">
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant="destructive">{blocked.ip}</Badge>
                                <Badge variant="outline">{blocked.reason}</Badge>
                              </div>
                              <div className="text-sm text-muted-foreground">
                                <p>Blocked at: {new Date(blocked.blockedAt).toLocaleString()}</p>
                                {blocked.duration && (
                                  <p>Duration: {blocked.duration} seconds</p>
                                )}
                                {blocked.expiresAt && (
                                  <p>Expires: {new Date(blocked.expiresAt).toLocaleString()}</p>
                                )}
                              </div>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => unblockIP(blocked.ip)}
                            >
                              Unblock
                            </Button>
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
                <CardTitle>IDS/IPS Settings</CardTitle>
                <CardDescription>Configure detection and prevention settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Operation Mode</Label>
                  <Select
                    value={mode}
                    onValueChange={(value: 'ids' | 'ips') => {
                      if (value !== mode) {
                        updateConfig({ mode: value });
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ips">IPS (Prevention - Active blocking)</SelectItem>
                      <SelectItem value="ids">IDS (Detection - Monitoring only)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Separator />
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Signature Detection</Label>
                    <Switch
                      checked={enableSignatureDetection}
                      onCheckedChange={(checked) => updateConfig({ enableSignatureDetection: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Anomaly Detection</Label>
                    <Switch
                      checked={enableAnomalyDetection}
                      onCheckedChange={(checked) => updateConfig({ enableAnomalyDetection: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Behavioral Analysis</Label>
                    <Switch
                      checked={enableBehavioralAnalysis}
                      onCheckedChange={(checked) => updateConfig({ enableBehavioralAnalysis: checked })}
                    />
                  </div>
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label>Alert Threshold</Label>
                  <Select
                    value={alertThreshold}
                    onValueChange={(value: 'low' | 'medium' | 'high' | 'critical') => {
                      if (value !== alertThreshold) {
                        updateConfig({ alertThreshold: value });
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="critical">Critical</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <Label>Auto Block</Label>
                  <Switch
                    checked={enableAutoBlock}
                    onCheckedChange={(checked) => updateConfig({ enableAutoBlock: checked })}
                  />
                </div>
                {enableAutoBlock && (
                  <div className="space-y-2">
                    <Label>Block Duration (seconds)</Label>
                    <Input
                      type="number"
                      value={blockDuration}
                      onChange={(e) => updateConfig({ blockDuration: Number(e.target.value) })}
                      min={60}
                      max={86400}
                    />
                  </div>
                )}
                <Separator />
                <div className="flex items-center justify-between">
                  <Label>Enable Logging</Label>
                  <Switch
                    checked={enableLogging}
                    onCheckedChange={(checked) => updateConfig({ enableLogging: checked })}
                  />
                </div>
                {enableLogging && (
                  <div className="space-y-2">
                    <Label>Log Retention (days)</Label>
                    <Input
                      type="number"
                      value={logRetention}
                      onChange={(e) => updateConfig({ logRetention: Number(e.target.value) })}
                      min={1}
                      max={365}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Preview/Test Dialog */}
        <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Preview & Test Signature</DialogTitle>
              <DialogDescription>
                Test how this signature will match against sample payloads
              </DialogDescription>
            </DialogHeader>
            {previewSignature && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Signature: {previewSignature.name}</Label>
                  <div className="p-3 bg-muted rounded-md font-mono text-sm">
                    {previewSignature.pattern}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Test Payload</Label>
                  <Textarea
                    value={previewTestPayload}
                    onChange={(e) => setPreviewTestPayload(e.target.value)}
                    placeholder="Enter a sample payload to test against the signature pattern..."
                    className="font-mono text-sm"
                    rows={6}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => testSignature(previewSignature, previewTestPayload)}
                    disabled={!previewTestPayload.trim()}
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Test Signature
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setPreviewTestPayload('SELECT * FROM users WHERE id = 1 OR 1=1');
                    }}
                  >
                    Load SQL Injection Example
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setPreviewTestPayload('<script>alert("XSS")</script>');
                    }}
                  >
                    Load XSS Example
                  </Button>
                </div>
                {previewResult && (
                  <div className={`p-4 rounded-md border ${
                    previewResult.matched 
                      ? 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800' 
                      : 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800'
                  }`}>
                    <div className="flex items-center gap-2 mb-2">
                      {previewResult.matched ? (
                        <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                      ) : (
                        <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                      )}
                      <span className={`font-semibold ${
                        previewResult.matched 
                          ? 'text-red-600 dark:text-red-400' 
                          : 'text-green-600 dark:text-green-400'
                      }`}>
                        {previewResult.matched ? 'MATCHED - Alert would be triggered!' : 'No Match - Payload is safe'}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{previewResult.details}</p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}


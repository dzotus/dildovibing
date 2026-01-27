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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Settings, 
  Activity,
  Plus,
  Trash2,
  RefreshCcw,
  Webhook,
  CheckCircle,
  XCircle,
  Clock,
  Zap,
  Shield,
  Send,
  Edit,
  Search,
  Filter,
  X,
  Copy,
  Play,
  RotateCcw,
  Download,
  Upload,
  ChevronDown,
  ChevronUp,
  TestTube,
  FileJson,
  Loader2
} from 'lucide-react';
import { showSuccess, showError } from '@/utils/toast';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';

interface WebhookConfigProps {
  componentId: string;
}

interface WebhookEndpoint {
  id: string;
  name: string;
  url: string;
  method: 'POST' | 'PUT' | 'PATCH';
  secret?: string;
  enabled: boolean;
  events: string[];
  headers?: Record<string, string>;
  allowedIPs?: string[];
  timeoutDuration?: number;
  errorRate?: number;
  payloadTransformation?: {
    enabled: boolean;
    template?: string;
    addFields?: Record<string, string>;
    removeFields?: string[];
    transformFields?: Record<string, string>;
  };
}

interface Delivery {
  id: string;
  endpointId: string;
  event: string;
  payload: string;
  status: 'pending' | 'success' | 'failed';
  timestamp: string;
  attempts?: number;
  responseCode?: number;
  responseBody?: string;
  error?: string;
  latency?: number;
  retryHistory?: Array<{ attempt: number; timestamp: string; status: number; error?: string }>;
}

interface WebhookConfig {
  endpoints?: WebhookEndpoint[];
  deliveries?: Delivery[];
  totalEndpoints?: number;
  totalDeliveries?: number;
  successRate?: number;
  enableRetryOnFailure?: boolean;
  enableSignatureVerification?: boolean;
  maxRetryAttempts?: number;
  retryDelay?: number;
  timeout?: number;
  retryBackoff?: 'exponential' | 'linear' | 'constant';
  enableRateLimiting?: boolean;
  rateLimitPerMinute?: number;
}

interface EndpointFormData {
  name: string;
  url: string;
  method: 'POST' | 'PUT' | 'PATCH';
  secret: string;
  enabled: boolean;
  events: string;
  headers: string;
  allowedIPs?: string;
  timeoutDuration?: number;
  errorRate?: number;
}

interface TestWebhookFormData {
  eventType: string;
  payload: string;
  headers: string;
}

interface RetryFormData {
  payload?: string;
  headers?: string;
}

export function WebhookConfigAdvanced({ componentId }: WebhookConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const { componentMetrics } = useEmulationStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as WebhookConfig;
  const endpoints = config.endpoints || [];
  
  // Get deliveries from emulation engine
  const webhookEngine = emulationEngine.getWebhookEmulationEngine(componentId);
  const emulationDeliveries = webhookEngine ? webhookEngine.getDeliveries() : [];
  // Use emulation deliveries if available, otherwise fall back to config
  const deliveries = emulationDeliveries.length > 0 ? emulationDeliveries : (config.deliveries || []);
  
  // Get metrics from emulation - update in real-time
  const metrics = componentMetrics.get(componentId);
  const customMetrics = metrics?.customMetrics || {};
  
  // Calculate metrics with fallbacks
  const totalEndpoints = useMemo(() => {
    return customMetrics.endpoints_total ?? endpoints.length;
  }, [customMetrics.endpoints_total, endpoints.length]);
  
  const totalDeliveries = useMemo(() => {
    return customMetrics.deliveries_total ?? deliveries.length;
  }, [customMetrics.deliveries_total, deliveries.length]);
  
  const successRate = useMemo(() => {
    if (customMetrics.success_rate !== undefined) {
      return customMetrics.success_rate;
    }
    if (deliveries.length > 0) {
      const successful = deliveries.filter((d) => d.status === 'success').length;
      return (successful / deliveries.length) * 100;
    }
    return 0;
  }, [customMetrics.success_rate, deliveries]);

  const [showCreateEndpoint, setShowCreateEndpoint] = useState(false);
  const [editingEndpoint, setEditingEndpoint] = useState<WebhookEndpoint | null>(null);
  const [deleteEndpointId, setDeleteEndpointId] = useState<string | null>(null);
  const [endpointSearch, setEndpointSearch] = useState('');
  const [deliverySearch, setDeliverySearch] = useState('');
  const [deliveryFilter, setDeliveryFilter] = useState<'all' | 'success' | 'failed' | 'pending'>('all');
  const [deliveryEndpointFilter, setDeliveryEndpointFilter] = useState<string>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [endpointForm, setEndpointForm] = useState<EndpointFormData>({
    name: '',
    url: '',
    method: 'POST',
    secret: '',
    enabled: true,
    events: '',
    headers: '',
    allowedIPs: '',
    timeoutDuration: 30,
    errorRate: 10,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  
  // New states for high-priority features
  const [testWebhookEndpointId, setTestWebhookEndpointId] = useState<string | null>(null);
  const [testWebhookForm, setTestWebhookForm] = useState<TestWebhookFormData>({
    eventType: '',
    payload: '{}',
    headers: '{}',
  });
  const [testWebhookResult, setTestWebhookResult] = useState<{ status: number; body: string; latency: number } | null>(null);
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);
  const [retryDeliveryId, setRetryDeliveryId] = useState<string | null>(null);
  const [retryForm, setRetryForm] = useState<RetryFormData>({});
  const [isRetrying, setIsRetrying] = useState(false);
  const [selectedEndpoints, setSelectedEndpoints] = useState<Set<string>>(new Set());
  const [expandedDeliveries, setExpandedDeliveries] = useState<Set<string>>(new Set());
  const [copiedItem, setCopiedItem] = useState<string | null>(null);
  const [deliveryPage, setDeliveryPage] = useState(1);
  const [deliveryPageSize, setDeliveryPageSize] = useState(20);
  const [dateRangeFilter, setDateRangeFilter] = useState<'all' | '1h' | '24h' | '7d' | '30d'>('all');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Sync with emulation engine - use useMemo to prevent unnecessary updates
  const configString = useMemo(() => JSON.stringify(config), [config]);
  useEffect(() => {
    if (webhookEngine && configString) {
      try {
        const parsedConfig = JSON.parse(configString) as WebhookConfig;
        webhookEngine.updateConfig(parsedConfig);
      } catch (error) {
        console.error('Error updating webhook config:', error);
      }
    }
  }, [configString, webhookEngine]);

  // Filtered endpoints
  const filteredEndpoints = useMemo(() => {
    if (!endpointSearch) return endpoints;
    const searchLower = endpointSearch.toLowerCase();
    return endpoints.filter(e => 
      e.name.toLowerCase().includes(searchLower) ||
      e.url.toLowerCase().includes(searchLower) ||
      e.events.some(ev => ev.toLowerCase().includes(searchLower))
    );
  }, [endpoints, endpointSearch]);

  // Filtered deliveries
  const filteredDeliveries = useMemo(() => {
    let filtered = deliveries;
    
    // Filter by status
    if (deliveryFilter !== 'all') {
      filtered = filtered.filter(d => d.status === deliveryFilter);
    }
    
    // Filter by endpoint
    if (deliveryEndpointFilter !== 'all') {
      filtered = filtered.filter(d => d.endpointId === deliveryEndpointFilter);
    }
    
    // Filter by search
    if (deliverySearch) {
      const searchLower = deliverySearch.toLowerCase();
      filtered = filtered.filter(d =>
        d.event.toLowerCase().includes(searchLower) ||
        d.endpointId.toLowerCase().includes(searchLower) ||
        d.payload.toLowerCase().includes(searchLower)
      );
    }
    
    return filtered.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [deliveries, deliveryFilter, deliverySearch, deliveryEndpointFilter]);

  const updateConfig = (updates: Partial<WebhookConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  // Validate IP address or CIDR
  const validateIP = (ip: string): boolean => {
    // Exact IP validation
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (ipRegex.test(ip)) {
      const parts = ip.split('.').map(Number);
      return parts.every(part => part >= 0 && part <= 255);
    }
    
    // CIDR validation
    const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;
    if (cidrRegex.test(ip)) {
      const [ipPart, prefixPart] = ip.split('/');
      const prefix = parseInt(prefixPart, 10);
      if (prefix < 0 || prefix > 32) {
        return false;
      }
      const parts = ipPart.split('.').map(Number);
      return parts.every(part => part >= 0 && part <= 255);
    }
    
    return false;
  };

  const validateEndpointForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!endpointForm.name.trim()) {
      errors.name = 'Name is required';
    }
    
    if (!endpointForm.url.trim()) {
      errors.url = 'URL is required';
    } else {
      const url = endpointForm.url.trim();
      // Support both absolute URLs and relative paths
      // Absolute URL must start with http:// or https://
      // Relative path must start with /
      const isAbsoluteUrl = /^https?:\/\//i.test(url);
      const isRelativePath = url.startsWith('/');
      
      if (!isAbsoluteUrl && !isRelativePath) {
        // Try to validate as absolute URL
        try {
          new URL(url);
        } catch {
          errors.url = 'URL must be absolute (http:// or https://) or relative path (starting with /)';
        }
      } else if (isAbsoluteUrl) {
        // Validate absolute URL
        try {
          new URL(url);
        } catch {
          errors.url = 'Invalid URL format';
        }
      }
      // Relative paths are always valid
    }
    
    if (endpointForm.events) {
      const events = endpointForm.events.split(',').map(e => e.trim()).filter(e => e);
      // Validate event names (alphanumeric, dash, underscore)
      for (const event of events) {
        if (!/^[a-zA-Z0-9_-]+$/.test(event)) {
          errors.events = `Invalid event name: ${event}. Use alphanumeric characters, dashes, and underscores.`;
          break;
        }
      }
    }
    
    if (endpointForm.headers) {
      try {
        const headers = JSON.parse(endpointForm.headers);
        if (typeof headers !== 'object' || Array.isArray(headers)) {
          errors.headers = 'Headers must be a valid JSON object';
        }
      } catch {
        errors.headers = 'Invalid JSON format for headers';
      }
    }
    
    // Validate IP addresses
    if (endpointForm.allowedIPs) {
      const ips = endpointForm.allowedIPs.split(',').map(ip => ip.trim()).filter(ip => ip);
      for (const ip of ips) {
        if (!validateIP(ip)) {
          errors.allowedIPs = `Invalid IP address or CIDR: ${ip}. Use format like 192.168.1.1 or 10.0.0.0/8`;
          break;
        }
      }
    }
    
    // Validate timeout
    if (endpointForm.timeoutDuration !== undefined) {
      const timeout = endpointForm.timeoutDuration;
      if (isNaN(timeout) || timeout < 1 || timeout > 300) {
        errors.timeoutDuration = 'Timeout must be between 1 and 300 seconds';
      }
    }
    
    // Validate error rate
    if (endpointForm.errorRate !== undefined) {
      const errorRate = endpointForm.errorRate;
      if (isNaN(errorRate) || errorRate < 0 || errorRate > 100) {
        errors.errorRate = 'Error rate must be between 0 and 100 percent';
      }
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const openCreateDialog = () => {
    setEndpointForm({
      name: '',
      url: '',
      method: 'POST',
      secret: '',
      enabled: true,
      events: '',
      headers: '',
      allowedIPs: '',
      timeoutDuration: 30,
      errorRate: 10,
    });
    setFormErrors({});
    setEditingEndpoint(null);
    setShowCreateEndpoint(true);
  };

  const openEditDialog = (endpoint: WebhookEndpoint) => {
    setEndpointForm({
      name: endpoint.name,
      url: endpoint.url,
      method: endpoint.method,
      secret: endpoint.secret || '',
      enabled: endpoint.enabled,
      events: endpoint.events.join(', '),
      headers: endpoint.headers ? JSON.stringify(endpoint.headers, null, 2) : '',
      allowedIPs: endpoint.allowedIPs?.join(', ') || '',
      timeoutDuration: endpoint.timeoutDuration || 30,
      errorRate: endpoint.errorRate || 10,
    });
    setFormErrors({});
    setEditingEndpoint(endpoint);
    setShowCreateEndpoint(true);
  };

  const saveEndpoint = () => {
    if (!validateEndpointForm()) {
      showError('Please fix validation errors');
      return;
    }

    try {
      const events = endpointForm.events
        ? endpointForm.events.split(',').map(e => e.trim()).filter(e => e)
        : [];
      
      let headers = {};
      if (endpointForm.headers) {
        try {
          headers = JSON.parse(endpointForm.headers);
          if (typeof headers !== 'object' || Array.isArray(headers)) {
            showError('Headers must be a valid JSON object');
            return;
          }
        } catch (error) {
          showError('Invalid JSON format for headers');
          return;
        }
      }

      const allowedIPs = endpointForm.allowedIPs
        ? endpointForm.allowedIPs.split(',').map(ip => ip.trim()).filter(ip => ip)
        : undefined;

      const endpointData: WebhookEndpoint = {
        id: editingEndpoint?.id || `wh-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: endpointForm.name.trim(),
        url: endpointForm.url.trim(),
        method: endpointForm.method,
        secret: endpointForm.secret.trim() || undefined,
        enabled: endpointForm.enabled,
        events,
        headers: Object.keys(headers).length > 0 ? headers : undefined,
        allowedIPs,
        timeoutDuration: endpointForm.timeoutDuration || 30,
        errorRate: endpointForm.errorRate || 10,
      };

      if (editingEndpoint) {
        // Update existing endpoint
        const updatedEndpoints = endpoints.map(e => 
          e.id === editingEndpoint.id ? endpointData : e
        );
        updateConfig({ endpoints: updatedEndpoints });
        showSuccess('Endpoint updated successfully');
      } else {
        // Create new endpoint
        updateConfig({ endpoints: [...endpoints, endpointData] });
        showSuccess('Endpoint created successfully');
      }

      setShowCreateEndpoint(false);
      setEditingEndpoint(null);
    } catch (error) {
      console.error('Error saving endpoint:', error);
      showError('Failed to save endpoint. Please try again.');
    }
  };

  const handleDeleteEndpoint = (id: string) => {
    updateConfig({ endpoints: endpoints.filter((e) => e.id !== id) });
    showSuccess('Endpoint deleted successfully');
    setDeleteEndpointId(null);
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

  const refreshData = async () => {
    setIsRefreshing(true);
    try {
      // Trigger emulation update
      if (webhookEngine) {
        webhookEngine.updateConfig(config);
      }
      // Force re-render by updating a dummy state
      await new Promise(resolve => setTimeout(resolve, 100));
      showSuccess('Data refreshed');
    } catch (error) {
      console.error('Error refreshing data:', error);
      showError('Failed to refresh data');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Copy to clipboard helper
  const copyToClipboard = (text: string, itemId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedItem(itemId);
    setTimeout(() => setCopiedItem(null), 2000);
    showSuccess('Copied to clipboard');
  };

  // Test webhook function
  const handleTestWebhook = async (endpointId: string) => {
    const endpoint = endpoints.find(e => e.id === endpointId);
    if (!endpoint) return;
    
    setTestWebhookEndpointId(endpointId);
    setTestWebhookForm({
      eventType: endpoint.events[0] || 'test.event',
      payload: '{"test": "data"}',
      headers: '{}',
    });
    setTestWebhookResult(null);
  };

  const sendTestWebhook = async () => {
    if (!testWebhookEndpointId) return;
    
    const endpoint = endpoints.find(e => e.id === testWebhookEndpointId);
    if (!endpoint) return;

    setIsTestingWebhook(true);
    setTestWebhookResult(null);

    try {
      let headers: Record<string, string> = {};
      try {
        headers = JSON.parse(testWebhookForm.headers || '{}');
      } catch {
        showError('Invalid JSON in headers');
        setIsTestingWebhook(false);
        return;
      }

      let payload: any = {};
      try {
        payload = JSON.parse(testWebhookForm.payload || '{}');
      } catch {
        showError('Invalid JSON in payload');
        setIsTestingWebhook(false);
        return;
      }

      // Use webhook engine to simulate request
      if (webhookEngine) {
        const startTime = Date.now();
        const response = webhookEngine.processWebhookRequest({
          url: endpoint.url,
          method: endpoint.method,
          headers: {
            ...headers,
            'x-event': testWebhookForm.eventType,
          },
          body: payload,
          event: testWebhookForm.eventType,
        });
        const latency = Date.now() - startTime;

        setTestWebhookResult({
          status: response.status,
          body: response.error || 'Success',
          latency,
        });
      } else {
        // Fallback simulation
        const latency = 50 + Math.random() * 150;
        await new Promise(resolve => setTimeout(resolve, latency));
        setTestWebhookResult({
          status: 200,
          body: JSON.stringify({ received: true, timestamp: Date.now() }),
          latency: Math.round(latency),
        });
      }
    } catch (error) {
      console.error('Error testing webhook:', error);
      showError('Failed to test webhook');
      setTestWebhookResult({
        status: 500,
        body: String(error),
        latency: 0,
      });
    } finally {
      setIsTestingWebhook(false);
    }
  };

  // Retry failed delivery
  const handleRetryDelivery = (deliveryId: string) => {
    const delivery = deliveries.find(d => d.id === deliveryId);
    if (!delivery) return;
    
    setRetryDeliveryId(deliveryId);
    setRetryForm({
      payload: delivery.payload,
      headers: '{}',
    });
  };

  const retryDelivery = async () => {
    if (!retryDeliveryId) return;
    
    const delivery = deliveries.find(d => d.id === retryDeliveryId);
    if (!delivery) return;

    const endpoint = endpoints.find(e => e.id === delivery.endpointId);
    if (!endpoint) {
      showError('Endpoint not found');
      return;
    }

    setIsRetrying(true);

    try {
      let payload: any = {};
      try {
        payload = JSON.parse(retryForm.payload || delivery.payload);
      } catch {
        showError('Invalid JSON in payload');
        setIsRetrying(false);
        return;
      }

      // Use webhook engine to retry
      if (webhookEngine) {
        const response = webhookEngine.processWebhookRequest({
          url: endpoint.url,
          method: endpoint.method,
          body: payload,
          event: delivery.event,
        });

        if (response.success) {
          showSuccess('Delivery retried successfully');
        } else {
          showError(`Retry failed: ${response.error || 'Unknown error'}`);
        }
      } else {
        showSuccess('Delivery retry initiated');
      }

      setRetryDeliveryId(null);
      setRetryForm({});
    } catch (error) {
      console.error('Error retrying delivery:', error);
      showError('Failed to retry delivery');
    } finally {
      setIsRetrying(false);
    }
  };

  // Bulk operations
  const toggleEndpointSelection = (endpointId: string) => {
    const newSelected = new Set(selectedEndpoints);
    if (newSelected.has(endpointId)) {
      newSelected.delete(endpointId);
    } else {
      newSelected.add(endpointId);
    }
    setSelectedEndpoints(newSelected);
  };

  const selectAllEndpoints = () => {
    setSelectedEndpoints(new Set(filteredEndpoints.map(e => e.id)));
  };

  const deselectAllEndpoints = () => {
    setSelectedEndpoints(new Set());
  };

  const bulkEnableEndpoints = () => {
    const updatedEndpoints = endpoints.map(e =>
      selectedEndpoints.has(e.id) ? { ...e, enabled: true } : e
    );
    updateConfig({ endpoints: updatedEndpoints });
    showSuccess(`${selectedEndpoints.size} endpoint(s) enabled`);
    setSelectedEndpoints(new Set());
  };

  const bulkDisableEndpoints = () => {
    const updatedEndpoints = endpoints.map(e =>
      selectedEndpoints.has(e.id) ? { ...e, enabled: false } : e
    );
    updateConfig({ endpoints: updatedEndpoints });
    showSuccess(`${selectedEndpoints.size} endpoint(s) disabled`);
    setSelectedEndpoints(new Set());
  };

  const bulkDeleteEndpoints = () => {
    const updatedEndpoints = endpoints.filter(e => !selectedEndpoints.has(e.id));
    updateConfig({ endpoints: updatedEndpoints });
    showSuccess(`${selectedEndpoints.size} endpoint(s) deleted`);
    setSelectedEndpoints(new Set());
  };

  // Duplicate endpoint
  const duplicateEndpoint = (endpoint: WebhookEndpoint) => {
    const newEndpoint: WebhookEndpoint = {
      ...endpoint,
      id: `wh-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: `${endpoint.name} (Copy)`,
    };
    updateConfig({ endpoints: [...endpoints, newEndpoint] });
    showSuccess('Endpoint duplicated');
  };

  // Export/Import
  const exportConfig = () => {
    const exportData = {
      endpoints,
      config: {
        enableRetryOnFailure: config.enableRetryOnFailure,
        enableSignatureVerification: config.enableSignatureVerification,
        maxRetryAttempts: config.maxRetryAttempts,
        retryDelay: config.retryDelay,
        timeout: config.timeout,
        retryBackoff: config.retryBackoff,
        enableRateLimiting: config.enableRateLimiting,
        rateLimitPerMinute: config.rateLimitPerMinute,
      },
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `webhook-config-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showSuccess('Configuration exported');
  };

  const importConfig = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          if (data.endpoints && Array.isArray(data.endpoints)) {
            updateConfig({
              endpoints: data.endpoints,
              ...data.config,
            });
            showSuccess('Configuration imported');
          } else {
            showError('Invalid configuration file');
          }
        } catch (error) {
          console.error('Error importing config:', error);
          showError('Failed to import configuration');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  // Toggle delivery expansion
  const toggleDeliveryExpansion = (deliveryId: string) => {
    const newExpanded = new Set(expandedDeliveries);
    if (newExpanded.has(deliveryId)) {
      newExpanded.delete(deliveryId);
    } else {
      newExpanded.add(deliveryId);
    }
    setExpandedDeliveries(newExpanded);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      
      // Ctrl/Cmd + N - create endpoint
      if (isCtrlOrCmd && e.key === 'n') {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
        e.preventDefault();
        openCreateDialog();
        return;
      }
      
      // Ctrl/Cmd + F - focus search
      if (isCtrlOrCmd && e.key === 'f') {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
      
      // Escape - close dialogs
      if (e.key === 'Escape') {
        if (showCreateEndpoint) {
          setShowCreateEndpoint(false);
        }
        if (testWebhookEndpointId) {
          setTestWebhookEndpointId(null);
        }
        if (retryDeliveryId) {
          setRetryDeliveryId(null);
        }
        if (deleteEndpointId) {
          setDeleteEndpointId(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showCreateEndpoint, testWebhookEndpointId, retryDeliveryId, deleteEndpointId]);

  // Filter deliveries by date range
  const getDateFilteredDeliveries = useMemo(() => {
    let filtered = filteredDeliveries;
    
    if (dateRangeFilter !== 'all') {
      const now = Date.now();
      let cutoffTime = 0;
      
      switch (dateRangeFilter) {
        case '1h':
          cutoffTime = now - 60 * 60 * 1000;
          break;
        case '24h':
          cutoffTime = now - 24 * 60 * 60 * 1000;
          break;
        case '7d':
          cutoffTime = now - 7 * 24 * 60 * 60 * 1000;
          break;
        case '30d':
          cutoffTime = now - 30 * 24 * 60 * 60 * 1000;
          break;
      }
      
      filtered = filtered.filter(d => {
        const deliveryTime = new Date(d.timestamp).getTime();
        return deliveryTime >= cutoffTime;
      });
    }
    
    return filtered;
  }, [filteredDeliveries, dateRangeFilter]);

  // Paginated deliveries
  const paginatedDeliveries = useMemo(() => {
    const start = (deliveryPage - 1) * deliveryPageSize;
    const end = start + deliveryPageSize;
    return getDateFilteredDeliveries.slice(start, end);
  }, [getDateFilteredDeliveries, deliveryPage, deliveryPageSize]);

  const totalDeliveryPages = Math.ceil(getDateFilteredDeliveries.length / deliveryPageSize);

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase text-muted-foreground tracking-wide">Webhook</p>
            <h2 className="text-2xl font-bold text-foreground">Webhook Endpoint</h2>
            <p className="text-sm text-muted-foreground mt-1">
              HTTP callback endpoint for event notifications
            </p>
          </div>
          <div className="flex gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={exportConfig}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Export</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Export configuration (Ctrl/Cmd + E)</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={importConfig}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Import</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Import configuration from JSON file</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={refreshData}
                    disabled={isRefreshing}
                  >
                    <RefreshCcw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                    {isRefreshing ? 'Refreshing...' : 'Refresh'}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Refresh data and metrics</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card className="border-l-4 border-l-blue-500 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Endpoints</CardTitle>
                <Webhook className="h-4 w-4 text-blue-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">{totalEndpoints}</span>
                <span className="text-xs text-muted-foreground">configured</span>
              </div>
              {customMetrics.endpoints_enabled !== undefined && (
                <p className="text-xs text-muted-foreground mt-1">
                  {customMetrics.endpoints_enabled} enabled
                </p>
              )}
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
              {customMetrics.deliveries_success !== undefined && customMetrics.deliveries_failed !== undefined && (
                <div className="flex gap-2 mt-1 text-xs text-muted-foreground">
                  <span className="text-green-600 dark:text-green-400">{customMetrics.deliveries_success} success</span>
                  <span className="text-red-600 dark:text-red-400">{customMetrics.deliveries_failed} failed</span>
                </div>
              )}
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
              {customMetrics.rps !== undefined && (
                <p className="text-xs text-muted-foreground mt-1">
                  {customMetrics.rps.toFixed(1)} req/s
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Compact Metrics Charts */}
        {deliveries.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Success Rate Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={150}>
                  <AreaChart data={(() => {
                    const now = Date.now();
                    const data = [];
                    for (let i = 6; i >= 0; i--) {
                      const time = now - (i * 24 * 60 * 60 * 1000);
                      const dayDeliveries = deliveries.filter(d => {
                        const deliveryTime = new Date(d.timestamp).getTime();
                        return deliveryTime >= time - 24 * 60 * 60 * 1000 && deliveryTime < time;
                      });
                      const successCount = dayDeliveries.filter(d => d.status === 'success').length;
                      const totalCount = dayDeliveries.length;
                      data.push({
                        date: new Date(time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                        rate: totalCount > 0 ? (successCount / totalCount) * 100 : 0,
                      });
                    }
                    return data;
                  })()}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                    <RechartsTooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                    <Area type="monotone" dataKey="rate" stroke="#22c55e" fill="#22c55e" fillOpacity={0.2} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Average Latency</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={150}>
                  <LineChart data={(() => {
                    const now = Date.now();
                    const data = [];
                    for (let i = 6; i >= 0; i--) {
                      const time = now - (i * 24 * 60 * 60 * 1000);
                      const dayDeliveries = deliveries.filter(d => {
                        const deliveryTime = new Date(d.timestamp).getTime();
                        return deliveryTime >= time - 24 * 60 * 60 * 1000 && deliveryTime < time;
                      }).filter(d => d.latency !== undefined);
                      const avgLatency = dayDeliveries.length > 0
                        ? dayDeliveries.reduce((sum, d) => sum + (d.latency || 0), 0) / dayDeliveries.length
                        : 0;
                      data.push({
                        date: new Date(time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                        latency: Math.round(avgLatency),
                      });
                    }
                    return data;
                  })()}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <RechartsTooltip formatter={(value: number) => `${value}ms`} />
                    <Line type="monotone" dataKey="latency" stroke="#3b82f6" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs defaultValue="endpoints" className="space-y-4">
          <TabsList className="flex-wrap w-full justify-start">
            <TabsTrigger value="endpoints" className="flex-shrink-0">
              <Webhook className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Endpoints</span>
              <span className="sm:hidden">Endpoints</span>
              <span className="ml-1">({endpoints.length})</span>
            </TabsTrigger>
            <TabsTrigger value="deliveries" className="flex-shrink-0">
              <Activity className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Deliveries</span>
              <span className="sm:hidden">Deliveries</span>
              <span className="ml-1">({deliveries.length})</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex-shrink-0">
              <Settings className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Settings</span>
              <span className="sm:hidden">Settings</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="endpoints" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle>Webhook Endpoints</CardTitle>
                    <CardDescription>Configure webhook endpoints</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    {selectedEndpoints.size > 0 && (
                      <>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={bulkEnableEndpoints}
                              >
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Enable ({selectedEndpoints.size})
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Enable selected endpoints</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={bulkDisableEndpoints}
                              >
                                <XCircle className="h-4 w-4 mr-2" />
                                Disable ({selectedEndpoints.size})
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Disable selected endpoints</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => {
                                  if (selectedEndpoints.size > 0) {
                                    setDeleteEndpointId('bulk');
                                  }
                                }}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete ({selectedEndpoints.size})
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete selected endpoints</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </>
                    )}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button onClick={openCreateDialog} size="sm">
                            <Plus className="h-4 w-4 mr-2" />
                            Create Endpoint
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Create new endpoint (Ctrl/Cmd + N)</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Search and Bulk Selection */}
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      ref={searchInputRef}
                      placeholder="Search endpoints... (Ctrl/Cmd + F)"
                      value={endpointSearch}
                      onChange={(e) => setEndpointSearch(e.target.value)}
                      className="pl-10"
                    />
                    {endpointSearch && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6"
                        onClick={() => setEndpointSearch('')}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={selectedEndpoints.size === filteredEndpoints.length ? deselectAllEndpoints : selectAllEndpoints}
                          >
                            {selectedEndpoints.size === filteredEndpoints.length ? 'Deselect All' : 'Select All'}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Select or deselect all endpoints</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>

                {/* Endpoints List */}
                <div className="space-y-4">
                  {filteredEndpoints.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Webhook className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="text-lg font-medium mb-2">
                        {endpointSearch ? 'No endpoints match your search' : 'No endpoints configured'}
                      </p>
                      {!endpointSearch && (
                        <Button onClick={openCreateDialog} size="sm" className="mt-4">
                          <Plus className="h-4 w-4 mr-2" />
                          Create your first endpoint
                        </Button>
                      )}
                    </div>
                  ) : (
                    filteredEndpoints.map((endpoint) => (
                      <Card key={endpoint.id} className="border-l-4 border-l-blue-500 hover:shadow-md transition-all duration-200 bg-card animate-in fade-in slide-in-from-top-2">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-start gap-3 flex-1">
                              <div className="pt-2">
                                <Checkbox
                                  checked={selectedEndpoints.has(endpoint.id)}
                                  onCheckedChange={() => toggleEndpointSelection(endpoint.id)}
                                />
                              </div>
                              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                                <Webhook className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <CardTitle className="text-lg font-semibold">{endpoint.name}</CardTitle>
                                <div className="flex items-center gap-2 mt-2 flex-wrap">
                                  <Badge variant={endpoint.enabled ? 'default' : 'outline'}>
                                    {endpoint.enabled ? 'Enabled' : 'Disabled'}
                                  </Badge>
                                  <Badge variant="outline" className="font-mono text-xs">{endpoint.method}</Badge>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Badge variant="outline" className="font-mono text-xs truncate max-w-xs cursor-help">
                                          {endpoint.url}
                                        </Badge>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <div className="max-w-md break-all">{endpoint.url}</div>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6"
                                          onClick={() => copyToClipboard(endpoint.url, `url-${endpoint.id}`)}
                                        >
                                          <Copy className={`h-3 w-3 ${copiedItem === `url-${endpoint.id}` ? 'text-green-600' : ''}`} />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Copy URL to clipboard</TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-1">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Switch
                                      checked={endpoint.enabled}
                                      onCheckedChange={(checked) => {
                                        const updatedEndpoints = endpoints.map(e =>
                                          e.id === endpoint.id ? { ...e, enabled: checked } : e
                                        );
                                        updateConfig({ endpoints: updatedEndpoints });
                                        showSuccess(checked ? 'Endpoint enabled' : 'Endpoint disabled');
                                      }}
                                    />
                                  </TooltipTrigger>
                                  <TooltipContent>{endpoint.enabled ? 'Disable endpoint' : 'Enable endpoint'}</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleTestWebhook(endpoint.id)}
                                      className="hover:bg-green-50 dark:hover:bg-green-900/20"
                                    >
                                      <TestTube className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Test webhook</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => duplicateEndpoint(endpoint)}
                                      className="hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                    >
                                      <Copy className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Duplicate endpoint</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => openEditDialog(endpoint)}
                                      className="hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Edit endpoint</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => setDeleteEndpointId(endpoint.id)}
                                      className="hover:bg-destructive/10 hover:text-destructive"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Delete endpoint</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          {endpoint.events && endpoint.events.length > 0 && (
                            <div className="space-y-2">
                              <Label className="text-xs">Events</Label>
                              <div className="flex flex-wrap gap-2">
                                {endpoint.events.map((event, idx) => (
                                  <Badge key={`${endpoint.id}-event-${idx}`} variant="outline" className="text-xs">
                                    {event}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          {endpoint.secret && (
                            <div className="mt-2">
                              <Label className="text-xs">Secret</Label>
                              <div className="flex items-center gap-2">
                                <div className="text-xs font-mono text-muted-foreground">••••••••</div>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-5 w-5"
                                        onClick={() => {
                                          if (endpoint.secret) {
                                            copyToClipboard(endpoint.secret, `secret-${endpoint.id}`);
                                          }
                                        }}
                                      >
                                        <Copy className={`h-3 w-3 ${copiedItem === `secret-${endpoint.id}` ? 'text-green-600' : ''}`} />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Copy secret to clipboard</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                            </div>
                          )}
                          {endpoint.headers && Object.keys(endpoint.headers).length > 0 && (
                            <div className="mt-2">
                              <Label className="text-xs">Custom Headers</Label>
                              <div className="text-xs text-muted-foreground">
                                {Object.keys(endpoint.headers).length} header(s)
                              </div>
                            </div>
                          )}
                          {endpoint.allowedIPs && endpoint.allowedIPs.length > 0 && (
                            <div className="mt-2">
                              <Label className="text-xs">Allowed IPs</Label>
                              <div className="text-xs text-muted-foreground">
                                {endpoint.allowedIPs.length} IP range(s)
                              </div>
                            </div>
                          )}
                          {/* Endpoint Metrics */}
                          {(() => {
                            const endpointMetrics = webhookEngine?.getEndpointMetrics(endpoint.id);
                            if (endpointMetrics && endpointMetrics.totalDeliveries > 0) {
                              return (
                                <div className="mt-4 pt-4 border-t space-y-2">
                                  <Label className="text-xs font-semibold">Metrics</Label>
                                  <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div>
                                      <span className="text-muted-foreground">Deliveries:</span>
                                      <span className="ml-1 font-medium">{endpointMetrics.totalDeliveries}</span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Success Rate:</span>
                                      <span className={`ml-1 font-medium ${endpointMetrics.successRate >= 95 ? 'text-green-600' : endpointMetrics.successRate >= 80 ? 'text-yellow-600' : 'text-red-600'}`}>
                                        {endpointMetrics.successRate.toFixed(1)}%
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Avg Latency:</span>
                                      <span className="ml-1 font-medium">{endpointMetrics.averageLatency}ms</span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">RPS:</span>
                                      <span className="ml-1 font-medium">{endpointMetrics.requestsPerSecond.toFixed(2)}</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="deliveries" className="space-y-4">
            {/* Delivery Metrics Summary */}
            {deliveries.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Success vs Failed (Last 7 Days)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={120}>
                      <AreaChart data={(() => {
                        const now = Date.now();
                        const data = [];
                        for (let i = 6; i >= 0; i--) {
                          const time = now - (i * 24 * 60 * 60 * 1000);
                          const dayDeliveries = deliveries.filter(d => {
                            const deliveryTime = new Date(d.timestamp).getTime();
                            return deliveryTime >= time - 24 * 60 * 60 * 1000 && deliveryTime < time;
                          });
                          data.push({
                            date: new Date(time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                            success: dayDeliveries.filter(d => d.status === 'success').length,
                            failed: dayDeliveries.filter(d => d.status === 'failed').length,
                          });
                        }
                        return data;
                      })()}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <RechartsTooltip />
                        <Area type="monotone" dataKey="success" stackId="1" stroke="#22c55e" fill="#22c55e" fillOpacity={0.6} />
                        <Area type="monotone" dataKey="failed" stackId="1" stroke="#ef4444" fill="#ef4444" fillOpacity={0.6} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Error Rate Trend</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={120}>
                      <LineChart data={(() => {
                        const now = Date.now();
                        const data = [];
                        for (let i = 6; i >= 0; i--) {
                          const time = now - (i * 24 * 60 * 60 * 1000);
                          const dayDeliveries = deliveries.filter(d => {
                            const deliveryTime = new Date(d.timestamp).getTime();
                            return deliveryTime >= time - 24 * 60 * 60 * 1000 && deliveryTime < time;
                          });
                          const errorCount = dayDeliveries.filter(d => d.status === 'failed').length;
                          const totalCount = dayDeliveries.length;
                          data.push({
                            date: new Date(time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                            errorRate: totalCount > 0 ? (errorCount / totalCount) * 100 : 0,
                          });
                        }
                        return data;
                      })()}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                        <RechartsTooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                        <Line type="monotone" dataKey="errorRate" stroke="#ef4444" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            )}
            <Card>
              <CardHeader>
                <CardTitle>Delivery History</CardTitle>
                <CardDescription>Webhook delivery attempts and results</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Search and Filter */}
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search deliveries..."
                        value={deliverySearch}
                        onChange={(e) => setDeliverySearch(e.target.value)}
                        className="pl-10"
                      />
                      {deliverySearch && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6"
                          onClick={() => setDeliverySearch('')}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    <Select value={deliveryFilter} onValueChange={(value: any) => setDeliveryFilter(value)}>
                      <SelectTrigger className="w-full sm:w-[180px]">
                        <Filter className="h-4 w-4 mr-2" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="success">Success</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={dateRangeFilter} onValueChange={(value: any) => {
                      setDateRangeFilter(value);
                      setDeliveryPage(1);
                    }}>
                      <SelectTrigger className="w-full sm:w-[180px]">
                        <Clock className="h-4 w-4 mr-2" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Time</SelectItem>
                        <SelectItem value="1h">Last Hour</SelectItem>
                        <SelectItem value="24h">Last 24 Hours</SelectItem>
                        <SelectItem value="7d">Last 7 Days</SelectItem>
                        <SelectItem value="30d">Last 30 Days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-4">
                    {endpoints.length > 0 && (
                      <Select value={deliveryEndpointFilter} onValueChange={(value: string) => {
                        setDeliveryEndpointFilter(value);
                        setDeliveryPage(1);
                      }}>
                        <SelectTrigger className="w-full sm:w-[200px]">
                          <Webhook className="h-4 w-4 mr-2" />
                          <SelectValue placeholder="Filter by endpoint" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Endpoints</SelectItem>
                          {endpoints.map((endpoint) => (
                            <SelectItem key={endpoint.id} value={endpoint.id}>
                              {endpoint.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <div className="flex items-center gap-2">
                      <Label className="text-sm">Page size:</Label>
                      <Select value={String(deliveryPageSize)} onValueChange={(value) => {
                        setDeliveryPageSize(Number(value));
                        setDeliveryPage(1);
                      }}>
                        <SelectTrigger className="w-[100px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="20">20</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                          <SelectItem value="100">100</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Deliveries List */}
                <div className="space-y-4">
                  {isRefreshing && paginatedDeliveries.length === 0 ? (
                    <>
                      {[1, 2, 3].map((i) => (
                        <Card key={i} className="border-l-4 border-l-gray-300">
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-start gap-3 flex-1">
                                <Skeleton className="h-9 w-9 rounded-lg" />
                                <div className="flex-1 space-y-2">
                                  <Skeleton className="h-5 w-32" />
                                  <div className="flex gap-2">
                                    <Skeleton className="h-5 w-16" />
                                    <Skeleton className="h-5 w-20" />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <Skeleton className="h-4 w-24" />
                          </CardContent>
                        </Card>
                      ))}
                    </>
                  ) : paginatedDeliveries.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Send className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="text-lg font-medium mb-2">
                        {deliverySearch || deliveryFilter !== 'all' || dateRangeFilter !== 'all' 
                          ? 'No deliveries match your filters' 
                          : 'No deliveries yet'}
                      </p>
                      <p className="text-sm">Deliveries will appear here when webhooks are sent</p>
                    </div>
                  ) : (
                    <>
                      {paginatedDeliveries.map((delivery) => {
                        const isExpanded = expandedDeliveries.has(delivery.id);
                        const endpoint = endpoints.find(e => e.id === delivery.endpointId);
                        return (
                          <Card key={delivery.id} className={`border-l-4 ${delivery.status === 'success' ? 'border-l-green-500' : delivery.status === 'failed' ? 'border-l-red-500' : 'border-l-yellow-500'} hover:shadow-md transition-all duration-200 bg-card animate-in fade-in slide-in-from-top-2`}>
                            <CardHeader className="pb-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-start gap-3 flex-1">
                                  <div className={`p-2 rounded-lg ${getStatusColor(delivery.status)}/20`}>
                                    {delivery.status === 'success' ? (
                                      <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                                    ) : delivery.status === 'failed' ? (
                                      <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                                    ) : (
                                      <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <CardTitle className="text-lg font-semibold">{delivery.event}</CardTitle>
                                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                                      <Badge variant="outline" className={getStatusColor(delivery.status)}>
                                        {delivery.status}
                                      </Badge>
                                      {delivery.attempts && (
                                        <Badge variant="outline">Attempts: {delivery.attempts}</Badge>
                                      )}
                                      {delivery.responseCode && (
                                        <Badge variant="outline">HTTP {delivery.responseCode}</Badge>
                                      )}
                                      {delivery.latency && (
                                        <Badge variant="outline">{delivery.latency}ms</Badge>
                                      )}
                                      {endpoint && (
                                        <Badge variant="outline" className="font-normal">
                                          {endpoint.name}
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex gap-1">
                                  {delivery.status === 'failed' && (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleRetryDelivery(delivery.id)}
                                            className="hover:bg-green-50 dark:hover:bg-green-900/20"
                                          >
                                            <RotateCcw className="h-4 w-4" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Retry delivery</TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  )}
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => toggleDeliveryExpansion(delivery.id)}
                                        >
                                          {isExpanded ? (
                                            <ChevronUp className="h-4 w-4" />
                                          ) : (
                                            <ChevronDown className="h-4 w-4" />
                                          )}
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>{isExpanded ? 'Collapse' : 'Expand'} details</TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </div>
                              </div>
                            </CardHeader>
                            {isExpanded && (
                              <CardContent className="space-y-4">
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <Label>Payload</Label>
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6"
                                            onClick={() => copyToClipboard(delivery.payload, `payload-${delivery.id}`)}
                                          >
                                            <Copy className={`h-3 w-3 ${copiedItem === `payload-${delivery.id}` ? 'text-green-600' : ''}`} />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Copy payload to clipboard</TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  </div>
                                  <pre className="p-3 bg-muted rounded text-xs font-mono overflow-x-auto max-h-60 overflow-y-auto">
                                    {(() => {
                                      try {
                                        return JSON.stringify(JSON.parse(delivery.payload), null, 2);
                                      } catch {
                                        return delivery.payload;
                                      }
                                    })()}
                                  </pre>
                                </div>
                                {delivery.responseBody && (
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                      <Label>Response</Label>
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-6 w-6"
                                              onClick={() => copyToClipboard(delivery.responseBody || '', `response-${delivery.id}`)}
                                            >
                                              <Copy className={`h-3 w-3 ${copiedItem === `response-${delivery.id}` ? 'text-green-600' : ''}`} />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>Copy response to clipboard</TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    </div>
                                    <pre className="p-3 bg-muted rounded text-xs font-mono overflow-x-auto max-h-60 overflow-y-auto">
                                      {(() => {
                                        try {
                                          return JSON.stringify(JSON.parse(delivery.responseBody), null, 2);
                                        } catch {
                                          return delivery.responseBody;
                                        }
                                      })()}
                                    </pre>
                                  </div>
                                )}
                                {delivery.error && (
                                  <div className="space-y-2">
                                    <Label className="text-destructive">Error</Label>
                                    <div className="p-3 bg-destructive/10 rounded text-sm text-destructive">{delivery.error}</div>
                                  </div>
                                )}
                                {delivery.retryHistory && delivery.retryHistory.length > 0 && (
                                  <div className="space-y-2">
                                    <Label>Retry History</Label>
                                    <div className="space-y-2">
                                      {delivery.retryHistory.map((retry, idx) => (
                                        <div key={idx} className="p-2 bg-muted rounded text-xs">
                                          <div className="flex items-center gap-2">
                                            <span className="font-medium">Attempt {retry.attempt}:</span>
                                            <Badge variant="outline">HTTP {retry.status}</Badge>
                                            <span className="text-muted-foreground">{retry.timestamp}</span>
                                          </div>
                                          {retry.error && (
                                            <div className="mt-1 text-destructive text-xs">{retry.error}</div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                <div className="text-xs text-muted-foreground pt-2 border-t">
                                  <div>Timestamp: {new Date(delivery.timestamp).toLocaleString()}</div>
                                  {delivery.latency && <div>Latency: {delivery.latency}ms</div>}
                                </div>
                              </CardContent>
                            )}
                            {!isExpanded && (
                              <CardContent>
                                <div className="text-xs text-muted-foreground">
                                  {new Date(delivery.timestamp).toLocaleString()}
                                  {delivery.latency && ` • ${delivery.latency}ms`}
                                </div>
                              </CardContent>
                            )}
                          </Card>
                        );
                      })}
                      {/* Pagination */}
                      {totalDeliveryPages > 1 && (
                        <div className="flex items-center justify-between pt-4 border-t">
                          <div className="text-sm text-muted-foreground">
                            Showing {((deliveryPage - 1) * deliveryPageSize) + 1} to {Math.min(deliveryPage * deliveryPageSize, getDateFilteredDeliveries.length)} of {getDateFilteredDeliveries.length} deliveries
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setDeliveryPage(p => Math.max(1, p - 1))}
                              disabled={deliveryPage === 1}
                            >
                              Previous
                            </Button>
                            <div className="flex items-center gap-1">
                              {Array.from({ length: Math.min(5, totalDeliveryPages) }, (_, i) => {
                                let pageNum;
                                if (totalDeliveryPages <= 5) {
                                  pageNum = i + 1;
                                } else if (deliveryPage <= 3) {
                                  pageNum = i + 1;
                                } else if (deliveryPage >= totalDeliveryPages - 2) {
                                  pageNum = totalDeliveryPages - 4 + i;
                                } else {
                                  pageNum = deliveryPage - 2 + i;
                                }
                                return (
                                  <Button
                                    key={pageNum}
                                    variant={deliveryPage === pageNum ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setDeliveryPage(pageNum)}
                                    className="w-8"
                                  >
                                    {pageNum}
                                  </Button>
                                );
                              })}
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setDeliveryPage(p => Math.min(totalDeliveryPages, p + 1))}
                              disabled={deliveryPage === totalDeliveryPages}
                            >
                              Next
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Webhook Settings</CardTitle>
                <CardDescription>Global configuration</CardDescription>
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
                    <p className="text-xs text-muted-foreground">Verify webhook signatures for security</p>
                  </div>
                  <Switch 
                    checked={config.enableSignatureVerification ?? true}
                    onCheckedChange={(checked) => updateConfig({ enableSignatureVerification: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Rate Limiting</Label>
                    <p className="text-xs text-muted-foreground">Limit requests per minute</p>
                  </div>
                  <Switch 
                    checked={config.enableRateLimiting ?? false}
                    onCheckedChange={(checked) => updateConfig({ enableRateLimiting: checked })}
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
                  <p className="text-xs text-muted-foreground">Maximum number of retry attempts for failed deliveries</p>
                </div>
                <div className="space-y-2">
                  <Label>Retry Delay (seconds)</Label>
                  <Input 
                    type="number" 
                    value={config.retryDelay ?? 5}
                    onChange={(e) => updateConfig({ retryDelay: parseInt(e.target.value) || 5 })}
                    min={1} 
                  />
                  <p className="text-xs text-muted-foreground">Delay between retry attempts</p>
                </div>
                <div className="space-y-2">
                  <Label>Retry Backoff Strategy</Label>
                  <Select 
                    value={config.retryBackoff || 'exponential'} 
                    onValueChange={(value: 'exponential' | 'linear' | 'constant') => updateConfig({ retryBackoff: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="exponential">Exponential</SelectItem>
                      <SelectItem value="linear">Linear</SelectItem>
                      <SelectItem value="constant">Constant</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Timeout (seconds)</Label>
                  <Input 
                    type="number" 
                    value={config.timeout ?? 30}
                    onChange={(e) => updateConfig({ timeout: parseInt(e.target.value) || 30 })}
                    min={1} 
                  />
                  <p className="text-xs text-muted-foreground">Request timeout duration</p>
                </div>
                {config.enableRateLimiting && (
                  <div className="space-y-2">
                    <Label>Rate Limit (per minute)</Label>
                    <Input 
                      type="number" 
                      value={config.rateLimitPerMinute ?? 100}
                      onChange={(e) => updateConfig({ rateLimitPerMinute: parseInt(e.target.value) || 100 })}
                      min={1} 
                    />
                    <p className="text-xs text-muted-foreground">Maximum requests per minute</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Create/Edit Endpoint Dialog */}
      <Dialog open={showCreateEndpoint} onOpenChange={setShowCreateEndpoint}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingEndpoint ? 'Edit Endpoint' : 'Create Endpoint'}</DialogTitle>
            <DialogDescription>
              {editingEndpoint 
                ? 'Update webhook endpoint configuration'
                : 'Create a new webhook endpoint to receive event notifications'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="endpoint-name">Name *</Label>
              <Input
                id="endpoint-name"
                value={endpointForm.name}
                onChange={(e) => setEndpointForm({ ...endpointForm, name: e.target.value })}
                placeholder="My Webhook Endpoint"
              />
              {formErrors.name && (
                <p className="text-xs text-destructive">{formErrors.name}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="endpoint-url">URL *</Label>
              <Input
                id="endpoint-url"
                value={endpointForm.url}
                onChange={(e) => setEndpointForm({ ...endpointForm, url: e.target.value })}
                placeholder="https://api.example.com/webhooks"
              />
              {formErrors.url && (
                <p className="text-xs text-destructive">{formErrors.url}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="endpoint-method">HTTP Method</Label>
              <Select 
                value={endpointForm.method} 
                onValueChange={(value: 'POST' | 'PUT' | 'PATCH') => setEndpointForm({ ...endpointForm, method: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="POST">POST</SelectItem>
                  <SelectItem value="PUT">PUT</SelectItem>
                  <SelectItem value="PATCH">PATCH</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="endpoint-secret">Secret (optional)</Label>
              <Input
                id="endpoint-secret"
                type="password"
                value={endpointForm.secret}
                onChange={(e) => setEndpointForm({ ...endpointForm, secret: e.target.value })}
                placeholder="webhook-secret-key"
              />
              <p className="text-xs text-muted-foreground">Secret key for signature verification</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="endpoint-events">Events (comma-separated)</Label>
              <Input
                id="endpoint-events"
                value={endpointForm.events}
                onChange={(e) => setEndpointForm({ ...endpointForm, events: e.target.value })}
                placeholder="user.created, order.updated, *"
              />
              {formErrors.events && (
                <p className="text-xs text-destructive">{formErrors.events}</p>
              )}
              <p className="text-xs text-muted-foreground">Leave empty to receive all events. Use * for wildcard.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="endpoint-headers">Custom Headers (JSON, optional)</Label>
              <Textarea
                id="endpoint-headers"
                value={endpointForm.headers}
                onChange={(e) => setEndpointForm({ ...endpointForm, headers: e.target.value })}
                placeholder='{ "X-Custom-Header": "value" }'
                rows={4}
              />
              {formErrors.headers && (
                <p className="text-xs text-destructive">{formErrors.headers}</p>
              )}
            </div>
            <Separator />
            <div className="space-y-2">
              <Label htmlFor="endpoint-allowed-ips">Allowed IPs (comma-separated, optional)</Label>
              <Input
                id="endpoint-allowed-ips"
                value={endpointForm.allowedIPs || ''}
                onChange={(e) => setEndpointForm({ ...endpointForm, allowedIPs: e.target.value })}
                placeholder="192.168.1.1, 10.0.0.0/8, 172.16.0.0/12"
                className={formErrors.allowedIPs ? 'border-destructive' : ''}
              />
              {formErrors.allowedIPs && (
                <p className="text-xs text-destructive">{formErrors.allowedIPs}</p>
              )}
              <p className="text-xs text-muted-foreground">
                IP addresses or CIDR ranges allowed to send webhooks. Leave empty to allow all.
                <br />
                Examples: 192.168.1.1, 10.0.0.0/8, 172.16.0.0/12
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="endpoint-timeout">Timeout Duration (seconds)</Label>
              <Input
                id="endpoint-timeout"
                type="number"
                value={endpointForm.timeoutDuration || 30}
                onChange={(e) => setEndpointForm({ ...endpointForm, timeoutDuration: parseInt(e.target.value) || 30 })}
                min={1}
                max={300}
                className={formErrors.timeoutDuration ? 'border-destructive' : ''}
              />
              {formErrors.timeoutDuration && (
                <p className="text-xs text-destructive">{formErrors.timeoutDuration}</p>
              )}
              <p className="text-xs text-muted-foreground">Request timeout duration for this endpoint (1-300 seconds)</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="endpoint-error-rate">Error Rate (%)</Label>
              <Input
                id="endpoint-error-rate"
                type="number"
                value={endpointForm.errorRate || 10}
                onChange={(e) => setEndpointForm({ ...endpointForm, errorRate: parseInt(e.target.value) || 10 })}
                min={0}
                max={100}
                className={formErrors.errorRate ? 'border-destructive' : ''}
              />
              {formErrors.errorRate && (
                <p className="text-xs text-destructive">{formErrors.errorRate}</p>
              )}
              <p className="text-xs text-muted-foreground">Simulated error rate for testing (0-100%)</p>
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enabled</Label>
                <p className="text-xs text-muted-foreground">Enable this endpoint to receive webhooks</p>
              </div>
              <Switch 
                checked={endpointForm.enabled}
                onCheckedChange={(checked) => setEndpointForm({ ...endpointForm, enabled: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateEndpoint(false)}>
              Cancel
            </Button>
            <Button onClick={saveEndpoint}>
              {editingEndpoint ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteEndpointId} onOpenChange={(open) => !open && setDeleteEndpointId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteEndpointId === 'bulk' ? 'Delete Endpoints' : 'Delete Endpoint'}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              {deleteEndpointId === 'bulk' ? (
                <>
                  <p>Are you sure you want to delete {selectedEndpoints.size} endpoint(s)?</p>
                  <div className="mt-2 p-2 bg-muted rounded text-sm">
                    <p className="font-medium mb-1">Endpoints to be deleted:</p>
                    <ul className="list-disc list-inside space-y-1">
                      {Array.from(selectedEndpoints).slice(0, 5).map(id => {
                        const endpoint = endpoints.find(e => e.id === id);
                        return endpoint ? <li key={id}>{endpoint.name}</li> : null;
                      })}
                      {selectedEndpoints.size > 5 && (
                        <li className="text-muted-foreground">...and {selectedEndpoints.size - 5} more</li>
                      )}
                    </ul>
                  </div>
                  <p className="text-destructive font-medium mt-2">This action cannot be undone.</p>
                </>
              ) : (() => {
                const endpoint = endpoints.find(e => e.id === deleteEndpointId);
                const endpointDeliveries = deliveries.filter(d => d.endpointId === deleteEndpointId);
                return (
                  <>
                    <p>Are you sure you want to delete the endpoint &quot;{endpoint?.name}&quot;?</p>
                    {endpointDeliveries.length > 0 && (
                      <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded text-sm">
                        <p className="font-medium text-yellow-800 dark:text-yellow-200">
                          Warning: This endpoint has {endpointDeliveries.length} delivery record(s) that will be affected.
                        </p>
                      </div>
                    )}
                    <p className="text-destructive font-medium mt-2">This action cannot be undone.</p>
                  </>
                );
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteEndpointId === 'bulk') {
                  bulkDeleteEndpoints();
                } else if (deleteEndpointId) {
                  handleDeleteEndpoint(deleteEndpointId);
                }
                setDeleteEndpointId(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Test Webhook Dialog */}
      <Dialog open={!!testWebhookEndpointId} onOpenChange={(open) => !open && setTestWebhookEndpointId(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Test Webhook</DialogTitle>
            <DialogDescription>
              Send a test webhook to {endpoints.find(e => e.id === testWebhookEndpointId)?.name || 'endpoint'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="test-event-type">Event Type *</Label>
              <Input
                id="test-event-type"
                value={testWebhookForm.eventType}
                onChange={(e) => setTestWebhookForm({ ...testWebhookForm, eventType: e.target.value })}
                placeholder="user.created"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="test-payload">Payload (JSON) *</Label>
              <Textarea
                id="test-payload"
                value={testWebhookForm.payload}
                onChange={(e) => setTestWebhookForm({ ...testWebhookForm, payload: e.target.value })}
                placeholder='{"key": "value"}'
                rows={8}
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="test-headers">Headers (JSON, optional)</Label>
              <Textarea
                id="test-headers"
                value={testWebhookForm.headers}
                onChange={(e) => setTestWebhookForm({ ...testWebhookForm, headers: e.target.value })}
                placeholder='{"X-Custom-Header": "value"}'
                rows={4}
                className="font-mono text-sm"
              />
            </div>
            {testWebhookResult && (
              <div className="space-y-2 p-4 bg-muted rounded-lg">
                <div className="flex items-center justify-between">
                  <Label>Test Result</Label>
                  <Badge variant={testWebhookResult.status >= 200 && testWebhookResult.status < 300 ? 'default' : 'destructive'}>
                    HTTP {testWebhookResult.status}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground">Latency: {testWebhookResult.latency}ms</div>
                <pre className="p-3 bg-background rounded text-xs font-mono overflow-x-auto max-h-40 overflow-y-auto">
                  {testWebhookResult.body}
                </pre>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setTestWebhookEndpointId(null);
              setTestWebhookResult(null);
            }}>
              Close
            </Button>
            <Button onClick={sendTestWebhook} disabled={isTestingWebhook || !testWebhookForm.eventType || !testWebhookForm.payload}>
              {isTestingWebhook ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Test
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Retry Delivery Dialog */}
      <Dialog open={!!retryDeliveryId} onOpenChange={(open) => !open && setRetryDeliveryId(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Retry Delivery</DialogTitle>
            <DialogDescription>
              Retry a failed webhook delivery
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {(() => {
              const delivery = deliveries.find(d => d.id === retryDeliveryId);
              if (!delivery) return null;
              return (
                <>
                  <div className="space-y-2">
                    <Label>Original Event</Label>
                    <div className="p-2 bg-muted rounded text-sm">{delivery.event}</div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="retry-payload">Payload (JSON) *</Label>
                    <Textarea
                      id="retry-payload"
                      value={retryForm.payload || delivery.payload}
                      onChange={(e) => setRetryForm({ ...retryForm, payload: e.target.value })}
                      rows={8}
                      className="font-mono text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="retry-headers">Headers (JSON, optional)</Label>
                    <Textarea
                      id="retry-headers"
                      value={retryForm.headers || '{}'}
                      onChange={(e) => setRetryForm({ ...retryForm, headers: e.target.value })}
                      rows={4}
                      className="font-mono text-sm"
                    />
                  </div>
                  {delivery.error && (
                    <div className="p-3 bg-destructive/10 rounded text-sm text-destructive">
                      <Label className="text-destructive">Previous Error:</Label>
                      <div>{delivery.error}</div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setRetryDeliveryId(null);
              setRetryForm({});
            }}>
              Cancel
            </Button>
            <Button onClick={retryDelivery} disabled={isRetrying}>
              {isRetrying ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Retrying...
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Retry
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

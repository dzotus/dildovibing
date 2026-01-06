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
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { 
  Globe, 
  Code, 
  Settings, 
  Activity,
  Plus,
  Trash2,
  Play,
  TrendingUp,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Search,
  X,
  Filter
} from 'lucide-react';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { showSuccess, showError, showValidationError } from '@/utils/toast';

interface RestApiConfigProps {
  componentId: string;
}

interface Endpoint {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  description: string;
  summary?: string;
  tags?: string[];
  requestBody?: string;
  responseExample?: string;
  parameters?: Array<{
    name: string;
    in: 'query' | 'path' | 'header';
    type: string;
    required: boolean;
    defaultValue?: string;
    // For object type - nested properties
    properties?: Array<{
      name: string;
      type: string;
      required: boolean;
    }>;
    // For array type - items type
    itemsType?: string;
  }>;
  requests?: number;
  avgResponseTime?: number;
  statusCode?: number;
  enabled?: boolean;
  timeout?: number;
  rateLimit?: number;
  targetService?: string;
}

interface RestApiConfig {
  baseUrl?: string;
  version?: string;
  title?: string;
  description?: string;
  endpoints?: Endpoint[];
  authentication?: {
    type: 'none' | 'bearer' | 'apiKey' | 'oauth2' | 'basic';
    token?: string;
    apiKey?: string;
    apiKeyHeader?: string;
    username?: string;
    password?: string;
    oauth2Config?: {
      tokenEndpoint?: string;
      clientId?: string;
      clientSecret?: string;
      scopes?: string[];
    };
  };
  rateLimit?: {
    enabled: boolean;
    requestsPerSecond?: number;
    burst?: number;
  };
  cors?: {
    enabled: boolean;
    allowedOrigins?: string[];
    allowedMethods?: string[];
    allowedHeaders?: string[];
  };
  openApiSpec?: string;
}

export function RestApiConfigAdvanced({ componentId }: RestApiConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const { nodes: allNodes } = useCanvasStore();
  const componentMetrics = useEmulationStore((state) => state.componentMetrics.get(componentId));
  const [endpointStats, setEndpointStats] = useState<Record<string, any>>({});
  const [openParams, setOpenParams] = useState<Map<string, boolean>>(new Map());
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMethod, setFilterMethod] = useState<string>('all');
  const [filterTags, setFilterTags] = useState<string>('all');
  
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as RestApiConfig;
  const baseUrl = config.baseUrl || 'https://api.example.com';
  const version = config.version || 'v1';
  const title = config.title || 'REST API';
  const description = config.description || 'RESTful API service';
  const endpoints = config.endpoints || [];
  const authentication = config.authentication || { type: 'none' };
  const cors = config.cors || { enabled: false, allowedOrigins: [], allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'], allowedHeaders: ['Content-Type', 'Authorization'] };
  const rateLimit = config.rateLimit || { enabled: false, requestsPerSecond: 1000, burst: 100 };
  const openApiSpec = config.openApiSpec || `openapi: 3.0.0
info:
  title: ${title}
  version: ${version}
  description: ${description}
servers:
  - url: ${baseUrl}
paths:
  /users:
    get:
      summary: List users
      tags: [users]
      responses:
        '200':
          description: Successful response`;

  // Get routing engine and endpoint stats
  useEffect(() => {
    const routingEngine = emulationEngine.getRestApiRoutingEngine(componentId);
    if (routingEngine) {
      const stats = routingEngine.getAllEndpointStats();
      setEndpointStats(stats);
    }
  }, [componentId, componentMetrics]);

  // Get available target services (nodes that can receive connections)
  const availableServices = allNodes.filter(n => n.id !== componentId && n.type !== 'rest');

  // Get all unique tags from endpoints
  const allTags = useMemo(() => {
    const tagsSet = new Set<string>();
    endpoints.forEach(endpoint => {
      if (endpoint.tags) {
        endpoint.tags.forEach(tag => tagsSet.add(tag));
      }
    });
    return Array.from(tagsSet).sort();
  }, [endpoints]);

  // Filter endpoints based on search and filters
  const filteredEndpoints = useMemo(() => {
    let filtered = [...endpoints];
    
    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(endpoint => 
        endpoint.path.toLowerCase().includes(query) ||
        endpoint.description.toLowerCase().includes(query) ||
        endpoint.summary?.toLowerCase().includes(query) ||
        endpoint.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    }
    
    // Method filter
    if (filterMethod !== 'all') {
      filtered = filtered.filter(endpoint => endpoint.method === filterMethod);
    }
    
    // Tags filter
    if (filterTags !== 'all') {
      filtered = filtered.filter(endpoint => 
        endpoint.tags?.includes(filterTags)
      );
    }
    
    return filtered;
  }, [endpoints, searchQuery, filterMethod, filterTags]);

  // Validation functions
  const validatePath = (path: string): string | null => {
    if (!path) {
      return 'Path is required';
    }
    if (!path.startsWith('/')) {
      return 'Path must start with /';
    }
    return null;
  };

  const validateJSON = (jsonString: string): string | null => {
    if (!jsonString.trim()) {
      return null; // Empty is valid (optional field)
    }
    try {
      JSON.parse(jsonString);
      return null;
    } catch (e) {
      return 'Invalid JSON format';
    }
  };

  const validateEndpoint = (endpoint: Endpoint, index: number, allEndpoints: Endpoint[]): string | null => {
    // Check path
    const pathError = validatePath(endpoint.path);
    if (pathError) {
      return pathError;
    }
    
    // Check for duplicates
    const duplicate = allEndpoints.findIndex((e, i) => 
      i !== index && e.method === endpoint.method && e.path === endpoint.path
    );
    if (duplicate !== -1) {
      return `Duplicate endpoint: ${endpoint.method} ${endpoint.path} already exists`;
    }
    
    // Check requestBody JSON
    if (endpoint.requestBody) {
      const jsonError = validateJSON(endpoint.requestBody);
      if (jsonError) {
        return `Request Body: ${jsonError}`;
      }
    }
    
    // Check responseExample JSON
    if (endpoint.responseExample) {
      const jsonError = validateJSON(endpoint.responseExample);
      if (jsonError) {
        return `Response Example: ${jsonError}`;
      }
    }
    
    return null;
  };

  // Update config with synchronization to emulation engine
  const updateConfig = useCallback((updates: Partial<RestApiConfig>) => {
    const newConfig = { ...config, ...updates };
    
    // Update node config first
    updateNode(componentId, {
      data: {
        ...node.data,
        config: newConfig,
      },
    });
    
    // Immediately update emulation engine to reflect changes in simulation
    const routingEngine = emulationEngine.getRestApiRoutingEngine(componentId);
    if (routingEngine) {
      // Reinitialize routing engine with new config
      const updatedNode = { ...node, data: { ...node.data, config: newConfig } };
      emulationEngine.updateNodesAndConnections([updatedNode], []);
    } else {
      // If engine doesn't exist yet, trigger initialization
      emulationEngine.updateNodesAndConnections([{ ...node, data: { ...node.data, config: newConfig } }], []);
    }
  }, [componentId, node, config, updateNode]);

  const addEndpoint = () => {
    const newEndpoint: Endpoint = { 
      path: '/new-endpoint', 
      method: 'GET', 
      description: 'New endpoint', 
      requests: 0, 
      avgResponseTime: 0, 
      statusCode: 200 
    };
    
    // Validate before adding
    const error = validateEndpoint(newEndpoint, endpoints.length, [...endpoints, newEndpoint]);
    if (error) {
      showValidationError(error);
      return;
    }
    
    updateConfig({
      endpoints: [...endpoints, newEndpoint],
    });
    showSuccess('Endpoint added successfully');
  };

  const removeEndpoint = (index: number) => {
    const endpoint = endpoints[index];
    updateConfig({ endpoints: endpoints.filter((_, i) => i !== index) });
    showSuccess(`Endpoint ${endpoint.method} ${endpoint.path} removed`);
  };
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<number | null>(null);
  const [openApiError, setOpenApiError] = useState<string | null>(null);

  const updateEndpoint = (index: number, field: string, value: string | number | boolean | undefined) => {
    const newEndpoints = [...endpoints];
    const oldEndpoint = { ...newEndpoints[index] };
    newEndpoints[index] = { ...newEndpoints[index], [field]: value };
    
    // Validate before updating
    const error = validateEndpoint(newEndpoints[index], index, newEndpoints);
    if (error) {
      showValidationError(error);
      // Revert change
      newEndpoints[index] = oldEndpoint;
      return;
    }
    
    updateConfig({ endpoints: newEndpoints });
    
    // Show toast only for significant changes
    if (field === 'path' || field === 'method') {
      showSuccess('Endpoint updated');
    }
  };

  /**
   * Validate YAML/JSON OpenAPI spec
   */
  const validateOpenAPISpec = (spec: string): string | null => {
    if (!spec.trim()) {
      return null; // Empty is valid
    }
    
    try {
      // Try to parse as JSON first
      JSON.parse(spec);
      return null;
    } catch {
      // If not JSON, try to validate YAML structure (basic check)
      // Check for required OpenAPI fields
      if (!spec.includes('openapi:') && !spec.includes('"openapi"')) {
        return 'Invalid OpenAPI spec: missing "openapi" field';
      }
      if (!spec.includes('info:') && !spec.includes('"info"')) {
        return 'Invalid OpenAPI spec: missing "info" field';
      }
      // Basic YAML validation - check for common syntax errors
      const lines = spec.split('\n');
      let openBraces = 0;
      for (const line of lines) {
        if (line.includes('{')) openBraces++;
        if (line.includes('}')) openBraces--;
        if (openBraces < 0) {
          return 'Invalid YAML/JSON: unmatched closing brace';
        }
      }
      return null;
    }
  };

  /**
   * Export OpenAPI spec to JSON
   */
  const exportToJSON = () => {
    try {
      // Try to parse as YAML first, then convert to JSON
      // For simplicity, if it's already JSON, just format it
      let jsonSpec;
      try {
        jsonSpec = JSON.parse(openApiSpec);
      } catch {
        // If not JSON, assume YAML and show message
        showError('Please convert YAML to JSON manually or use a YAML-to-JSON converter');
        return;
      }
      
      const jsonString = JSON.stringify(jsonSpec, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title || 'api'}-openapi.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showSuccess('OpenAPI spec exported to JSON');
    } catch (error) {
      showError('Failed to export OpenAPI spec');
    }
  };

  /**
   * Import OpenAPI spec from file
   */
  const importOpenAPISpec = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (!content) return;
      
      const error = validateOpenAPISpec(content);
      if (error) {
        setOpenApiError(error);
        showValidationError(error);
        return;
      }
      
      setOpenApiError(null);
      updateConfig({ openApiSpec: content });
      showSuccess('OpenAPI spec imported successfully');
    };
    reader.readAsText(file);
    
    // Reset input
    event.target.value = '';
  };

  /**
   * Generate OpenAPI specification from endpoints
   */
  const generateOpenAPISpec = () => {
    // Validate all endpoints before generating
    for (let i = 0; i < endpoints.length; i++) {
      const error = validateEndpoint(endpoints[i], i, endpoints);
      if (error) {
        showValidationError(`Endpoint ${i + 1}: ${error}`);
        return;
      }
    }
    const paths: Record<string, any> = {};
    
    // Group endpoints by path
    endpoints.forEach((endpoint) => {
      if (endpoint.enabled === false) return; // Skip disabled endpoints
      
      if (!paths[endpoint.path]) {
        paths[endpoint.path] = {};
      }
      
      const method = endpoint.method.toLowerCase();
      const operation: any = {
        summary: endpoint.summary || endpoint.description,
        description: endpoint.description,
        tags: endpoint.tags || [],
        responses: {
          '200': {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                },
              },
            },
          },
        },
      };
      
      // Add parameters
      if (endpoint.parameters && endpoint.parameters.length > 0) {
        operation.parameters = endpoint.parameters.map((param) => {
          const schema: any = {
            type: param.type || 'string',
          };
          
          // Handle array type with items
          if (param.type === 'array' && param.itemsType) {
            schema.items = {
              type: param.itemsType,
            };
          }
          
          // Handle object type with properties
          if (param.type === 'object' && param.properties && param.properties.length > 0) {
            schema.properties = {};
            schema.required = [];
            param.properties.forEach((prop) => {
              schema.properties[prop.name] = {
                type: prop.type || 'string',
              };
              if (prop.required) {
                schema.required.push(prop.name);
              }
            });
            if (schema.required.length === 0) {
              delete schema.required;
            }
          }
          
          return {
            name: param.name,
            in: param.in,
            required: param.required,
            schema,
            description: param.defaultValue ? `Default: ${param.defaultValue}` : undefined,
          };
        });
      }
      
      // Add request body for POST, PUT, PATCH
      if (['POST', 'PUT', 'PATCH'].includes(endpoint.method) && endpoint.requestBody) {
        try {
          const bodyJson = JSON.parse(endpoint.requestBody);
          operation.requestBody = {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                },
                example: bodyJson,
              },
            },
          };
        } catch {
          operation.requestBody = {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                },
                example: endpoint.requestBody,
              },
            },
          };
        }
      }
      
      // Add response example
      if (endpoint.responseExample) {
        try {
          const responseJson = JSON.parse(endpoint.responseExample);
          operation.responses['200'].content['application/json'].example = responseJson;
        } catch {
          operation.responses['200'].content['application/json'].example = endpoint.responseExample;
        }
      }
      
      paths[endpoint.path][method] = operation;
    });
    
    // Helper function to escape YAML strings
    const escapeYaml = (str: string): string => {
      if (str.includes('\n') || str.includes(':') || str.includes('"') || str.includes("'")) {
        return `"${str.replace(/"/g, '\\"')}"`;
      }
      return str;
    };
    
    // Convert to YAML
    let yaml = `openapi: 3.0.0
info:
  title: ${escapeYaml(title)}
  version: ${escapeYaml(version)}
  description: ${escapeYaml(description)}
servers:
  - url: ${escapeYaml(baseUrl)}
    description: API Server
paths:
`;
    
    // Generate paths
    for (const [path, methods] of Object.entries(paths)) {
      yaml += `  ${path}:
`;
      for (const [method, operation] of Object.entries(methods)) {
        const op = operation as any;
        yaml += `    ${method}:
      summary: ${escapeYaml(op.summary || '')}
      description: ${escapeYaml(op.description || '')}
`;
        
        if (op.tags && op.tags.length > 0) {
          yaml += `      tags:
`;
          op.tags.forEach((tag: string) => {
            yaml += `        - ${escapeYaml(tag)}
`;
          });
        }
        
        if (op.parameters && op.parameters.length > 0) {
          yaml += `      parameters:
`;
          op.parameters.forEach((param: any) => {
            yaml += `        - name: ${escapeYaml(param.name)}
          in: ${param.in}
          required: ${param.required}
          schema:
            type: ${param.schema.type || 'string'}
`;
            // Handle array items
            if (param.schema.type === 'array' && param.schema.items) {
              yaml += `            items:
              type: ${param.schema.items.type}
`;
            }
            // Handle object properties
            if (param.schema.type === 'object' && param.schema.properties) {
              yaml += `            properties:
`;
              Object.entries(param.schema.properties).forEach(([propName, propSchema]: [string, any]) => {
                yaml += `              ${escapeYaml(propName)}:
                type: ${propSchema.type || 'string'}
`;
              });
              if (param.schema.required && param.schema.required.length > 0) {
                yaml += `            required:
`;
                param.schema.required.forEach((req: string) => {
                  yaml += `              - ${escapeYaml(req)}
`;
                });
              }
            }
            if (param.description) {
              yaml += `          description: ${escapeYaml(param.description)}
`;
            }
          });
        }
        
        if (op.requestBody) {
          yaml += `      requestBody:
        required: ${op.requestBody.required}
        content:
          application/json:
            schema:
              type: object
`;
          if (op.requestBody.content['application/json'].example) {
            const example = op.requestBody.content['application/json'].example;
            const exampleStr = typeof example === 'string' ? example : JSON.stringify(example, null, 2);
            yaml += `            example: |
${exampleStr.split('\n').map(line => `              ${line}`).join('\n')}
`;
          }
        }
        
        yaml += `      responses:
        '200':
          description: Successful response
          content:
            application/json:
              schema:
                type: object
`;
        if (op.responses['200'].content['application/json'].example) {
          const example = op.responses['200'].content['application/json'].example;
          const exampleStr = typeof example === 'string' ? example : JSON.stringify(example, null, 2);
          yaml += `              example: |
${exampleStr.split('\n').map(line => `                ${line}`).join('\n')}
`;
        }
      }
    }
    
    const error = validateOpenAPISpec(yaml);
    if (error) {
      setOpenApiError(error);
      showValidationError(error);
      return;
    }
    
    setOpenApiError(null);
    updateConfig({ openApiSpec: yaml });
    showSuccess('OpenAPI specification generated successfully');
  };

  /**
   * Copy endpoint
   */
  const copyEndpoint = (index: number) => {
    const endpoint = endpoints[index];
    const newEndpoint: Endpoint = {
      ...endpoint,
      path: `${endpoint.path}-copy`,
      description: `${endpoint.description} (Copy)`,
    };
    
    // Validate before adding
    const error = validateEndpoint(newEndpoint, endpoints.length, [...endpoints, newEndpoint]);
    if (error) {
      showValidationError(error);
      return;
    }
    
    updateConfig({
      endpoints: [...endpoints, newEndpoint],
    });
    showSuccess(`Endpoint ${endpoint.method} ${endpoint.path} copied`);
  };

  const getMethodColor = (method: string) => {
    switch (method) {
      case 'GET':
        return 'bg-blue-500';
      case 'POST':
        return 'bg-green-500';
      case 'PUT':
        return 'bg-yellow-500';
      case 'DELETE':
        return 'bg-red-500';
      case 'PATCH':
        return 'bg-purple-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Globe className="h-6 w-6 text-blue-500" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">REST API</h2>
              <p className="text-sm text-muted-foreground mt-1">
                RESTful API Service
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-2">
              <div className={`h-2 w-2 rounded-full ${componentMetrics && componentMetrics.throughput > 0 ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
              {componentMetrics && componentMetrics.throughput > 0 ? 'Active' : 'Idle'}
            </Badge>
            {componentMetrics && (
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <TrendingUp className="h-4 w-4 text-blue-500" />
                  <span className="text-muted-foreground">{Math.round(componentMetrics.throughput)} req/s</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4 text-yellow-500" />
                  <span className="text-muted-foreground">{Math.round(componentMetrics.latency)}ms</span>
                </div>
                {componentMetrics.errorRate > 0 && (
                  <div className="flex items-center gap-1">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    <span className="text-muted-foreground">{(componentMetrics.errorRate * 100).toFixed(1)}%</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* API Info */}
        <Card>
          <CardHeader>
            <CardTitle>API Information</CardTitle>
            <CardDescription>{baseUrl}/{version}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Base URL</Label>
                <Input value={baseUrl} onChange={(e) => updateConfig({ baseUrl: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Version</Label>
                <Input value={version} onChange={(e) => updateConfig({ version: e.target.value })} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Configuration Tabs */}
        <Tabs defaultValue="endpoints" className="w-full">
          <TabsList className="flex flex-wrap w-full justify-start gap-1">
            <TabsTrigger value="endpoints" className="gap-2">
              <Code className="h-4 w-4" />
              Endpoints
            </TabsTrigger>
            <TabsTrigger value="auth" className="gap-2">
              <Settings className="h-4 w-4" />
              Authentication
            </TabsTrigger>
            <TabsTrigger value="metrics" className="gap-2">
              <Activity className="h-4 w-4" />
              Metrics
            </TabsTrigger>
            <TabsTrigger value="openapi" className="gap-2">
              <Globe className="h-4 w-4" />
              OpenAPI Spec
            </TabsTrigger>
            <TabsTrigger value="cors" className="gap-2">
              <Settings className="h-4 w-4" />
              CORS
            </TabsTrigger>
            <TabsTrigger value="rate-limit" className="gap-2">
              <Activity className="h-4 w-4" />
              Rate Limit
            </TabsTrigger>
          </TabsList>

          {/* Endpoints Tab */}
          <TabsContent value="endpoints" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>API Endpoints</CardTitle>
                    <CardDescription>REST API endpoint configuration</CardDescription>
                  </div>
                  <Button size="sm" onClick={addEndpoint} variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Endpoint
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Search and Filter */}
                {endpoints.length > 0 && (
                  <div className="mb-4 space-y-3">
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search endpoints by path, description, tags..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-9"
                        />
                        {searchQuery && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6"
                            onClick={() => setSearchQuery('')}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4 text-muted-foreground" />
                        <Select value={filterMethod} onValueChange={setFilterMethod}>
                          <SelectTrigger className="w-[140px]">
                            <SelectValue placeholder="All methods" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Methods</SelectItem>
                            <SelectItem value="GET">GET</SelectItem>
                            <SelectItem value="POST">POST</SelectItem>
                            <SelectItem value="PUT">PUT</SelectItem>
                            <SelectItem value="DELETE">DELETE</SelectItem>
                            <SelectItem value="PATCH">PATCH</SelectItem>
                          </SelectContent>
                        </Select>
                        {allTags.length > 0 && (
                          <Select value={filterTags} onValueChange={setFilterTags}>
                            <SelectTrigger className="w-[140px]">
                              <SelectValue placeholder="All tags" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Tags</SelectItem>
                              {allTags.map(tag => (
                                <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </div>
                    {filteredEndpoints.length !== endpoints.length && (
                      <p className="text-xs text-muted-foreground">
                        Showing {filteredEndpoints.length} of {endpoints.length} endpoints
                      </p>
                    )}
                  </div>
                )}
                
                {endpoints.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Code className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No endpoints configured</p>
                    <p className="text-xs mt-2">Click "Add Endpoint" to create a new endpoint</p>
                  </div>
                ) : filteredEndpoints.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Search className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No endpoints match your search criteria</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4"
                      onClick={() => {
                        setSearchQuery('');
                        setFilterMethod('all');
                        setFilterTags('all');
                      }}
                    >
                      Clear filters
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredEndpoints.map((endpoint, index) => {
                      // Find original index for updates
                      const originalIndex = endpoints.findIndex(e => 
                        e.method === endpoint.method && e.path === endpoint.path
                      );
                      const pathError = validatePath(endpoint.path);
                      const requestBodyError = endpoint.requestBody ? validateJSON(endpoint.requestBody) : null;
                      const responseExampleError = endpoint.responseExample ? validateJSON(endpoint.responseExample) : null;
                      
                      return (
                    <Card key={`${endpoint.method}-${endpoint.path}-${originalIndex}`} className="border-border">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Badge className={getMethodColor(endpoint.method)}>
                              {endpoint.method}
                            </Badge>
                            <div className="flex-1">
                              <CardTitle className="text-lg">{endpoint.path}</CardTitle>
                              <CardDescription className="text-xs mt-1">
                                {endpoint.description}
                              </CardDescription>
                              {/* Real-time metrics from routing engine */}
                              {(() => {
                                const endpointId = `${endpoint.method}:${endpoint.path}`;
                                const stats = endpointStats[endpointId];
                                if (stats) {
                                  return (
                                    <div className="flex items-center gap-4 mt-2 text-xs">
                                      <div className="flex items-center gap-1 text-blue-500">
                                        <TrendingUp className="h-3 w-3" />
                                        <span>{stats.requestCount.toLocaleString()} requests</span>
                                      </div>
                                      <div className="flex items-center gap-1 text-yellow-500">
                                        <Clock className="h-3 w-3" />
                                        <span>{Math.round(stats.averageLatency)}ms avg</span>
                                      </div>
                                      {stats.errorCount > 0 && (
                                        <div className="flex items-center gap-1 text-red-500">
                                          <AlertCircle className="h-3 w-3" />
                                          <span>{stats.errorCount} errors</span>
                                        </div>
                                      )}
                                    </div>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                            <div className="flex items-center gap-2">
                              <Label htmlFor={`enabled-${originalIndex}`} className="text-xs">Enabled</Label>
                              <Switch
                                id={`enabled-${originalIndex}`}
                                checked={endpoint.enabled !== false}
                                onCheckedChange={(checked) => updateEndpoint(originalIndex, 'enabled', checked)}
                              />
                              <div className="flex items-center gap-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="hover:bg-blue-500/10 hover:text-blue-500"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    copyEndpoint(originalIndex);
                                  }}
                                  title="Copy endpoint"
                                >
                                  <Code className="h-4 w-4" />
                                </Button>
                                <AlertDialog open={deleteDialogOpen === originalIndex} onOpenChange={(open) => setDeleteDialogOpen(open ? originalIndex : null)}>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="hover:bg-destructive/10 hover:text-destructive"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setDeleteDialogOpen(originalIndex);
                                      }}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Endpoint</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete the endpoint <strong>{endpoint.method} {endpoint.path}</strong>? This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => {
                                        removeEndpoint(originalIndex);
                                        setDeleteDialogOpen(null);
                                      }}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Method</Label>
                            <Select
                              value={endpoint.method}
                              onValueChange={(value) => updateEndpoint(originalIndex, 'method', value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="GET">GET</SelectItem>
                                <SelectItem value="POST">POST</SelectItem>
                                <SelectItem value="PUT">PUT</SelectItem>
                                <SelectItem value="DELETE">DELETE</SelectItem>
                                <SelectItem value="PATCH">PATCH</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Path</Label>
                            <Input
                              value={endpoint.path}
                              onChange={(e) => updateEndpoint(originalIndex, 'path', e.target.value)}
                              placeholder="/users"
                              className={pathError ? "border-red-500" : ""}
                            />
                            {pathError && (
                              <p className="text-xs text-red-500 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                {pathError}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Description</Label>
                          <Textarea
                            value={endpoint.description}
                            onChange={(e) => updateEndpoint(originalIndex, 'description', e.target.value)}
                            placeholder="Describe what this endpoint does"
                            rows={2}
                          />
                          <p className="text-xs text-muted-foreground">
                            Brief description of the endpoint functionality
                          </p>
                        </div>
                        
                        {/* Tags */}
                        <div className="space-y-2">
                          <Label>Tags</Label>
                          <div className="flex flex-wrap gap-2 mb-2">
                            {endpoint.tags && endpoint.tags.length > 0 ? (
                              endpoint.tags.map((tag, tagIndex) => (
                                <Badge key={tagIndex} variant="secondary" className="gap-1">
                                  {tag}
                                  <button
                                    onClick={() => {
                                      const newEndpoints = [...endpoints];
                                      newEndpoints[originalIndex].tags = newEndpoints[originalIndex].tags?.filter((_, i) => i !== tagIndex);
                                      updateConfig({ endpoints: newEndpoints });
                                    }}
                                    className="ml-1 hover:text-destructive"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </Badge>
                              ))
                            ) : (
                              <p className="text-xs text-muted-foreground">No tags</p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Input
                              placeholder="Add tag..."
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                                  e.preventDefault();
                                  const newTag = e.currentTarget.value.trim();
                                  const newEndpoints = [...endpoints];
                                  if (!newEndpoints[originalIndex].tags) {
                                    newEndpoints[originalIndex].tags = [];
                                  }
                                  if (!newEndpoints[originalIndex].tags.includes(newTag)) {
                                    newEndpoints[originalIndex].tags.push(newTag);
                                    updateConfig({ endpoints: newEndpoints });
                                  }
                                  e.currentTarget.value = '';
                                }
                              }}
                              list={`tags-list-${originalIndex}`}
                            />
                            <datalist id={`tags-list-${originalIndex}`}>
                              {allTags.filter(tag => !endpoint.tags?.includes(tag)).map(tag => (
                                <option key={tag} value={tag} />
                              ))}
                            </datalist>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                                if (input && input.value.trim()) {
                                  const newTag = input.value.trim();
                                  const newEndpoints = [...endpoints];
                                  if (!newEndpoints[originalIndex].tags) {
                                    newEndpoints[originalIndex].tags = [];
                                  }
                                  if (!newEndpoints[originalIndex].tags.includes(newTag)) {
                                    newEndpoints[originalIndex].tags.push(newTag);
                                    updateConfig({ endpoints: newEndpoints });
                                  }
                                  input.value = '';
                                }
                              }}
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Add
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Tags for grouping endpoints in OpenAPI documentation. Press Enter or click Add to add a tag.
                          </p>
                        </div>
                        
                        {/* Advanced Settings - Collapsible */}
                        <div className="space-y-4 pt-2 border-t">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm font-semibold">Advanced Settings</Label>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="text-xs">Target Service (optional)</Label>
                              <Select
                                value={endpoint.targetService || 'none'}
                                onValueChange={(value) => updateEndpoint(originalIndex, 'targetService', value === 'none' ? undefined : value)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select target service" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">None (direct response)</SelectItem>
                                  {availableServices.map((service) => (
                                    <SelectItem key={service.id} value={service.id}>
                                      {service.data.label || service.type}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <p className="text-xs text-muted-foreground">
                                Route requests to a connected service
                              </p>
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs">Rate Limit (req/s)</Label>
                              <Input
                                type="number"
                                value={endpoint.rateLimit || ''}
                                onChange={(e) => updateEndpoint(originalIndex, 'rateLimit', e.target.value ? parseInt(e.target.value) : undefined)}
                                placeholder="Unlimited"
                              />
                              <p className="text-xs text-muted-foreground">
                                Requests per second limit for this endpoint
                              </p>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Summary (for OpenAPI)</Label>
                            <Input
                              value={endpoint.summary || ''}
                              onChange={(e) => updateEndpoint(originalIndex, 'summary', e.target.value)}
                              placeholder="Brief summary for API documentation"
                            />
                            <p className="text-xs text-muted-foreground">
                              Short summary used in OpenAPI specification
                            </p>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Timeout (ms)</Label>
                            <Input
                              type="number"
                              value={endpoint.timeout || ''}
                              onChange={(e) => updateEndpoint(originalIndex, 'timeout', e.target.value ? parseInt(e.target.value) : undefined)}
                              placeholder="No timeout"
                              min="0"
                            />
                            <p className="text-xs text-muted-foreground">
                              Request timeout in milliseconds (optional)
                            </p>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label>Parameters</Label>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const newEndpoints = [...endpoints];
                                if (!newEndpoints[originalIndex].parameters) {
                                  newEndpoints[originalIndex].parameters = [];
                                }
                                newEndpoints[originalIndex].parameters!.push({
                                  name: 'param',
                                  in: 'query',
                                  type: 'string',
                                  required: false,
                                  defaultValue: undefined,
                                });
                                updateConfig({ endpoints: newEndpoints });
                              }}
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Add Parameter
                            </Button>
                          </div>
                          {endpoint.parameters && endpoint.parameters.length > 0 ? (
                            <div className="space-y-2">
                              {endpoint.parameters.map((param, pIndex) => {
                                const paramKey = `param-${originalIndex}-${pIndex}`;
                                const isOpen = openParams.get(paramKey) || false;
                                return (
                                  <div key={pIndex} className="border border-border rounded-lg bg-card shadow-sm">
                                    <div className="flex items-center gap-2 p-3 bg-background/50">
                                      <Select
                                        value={param.in}
                                        onValueChange={(value) => {
                                          const newEndpoints = [...endpoints];
                                          newEndpoints[originalIndex].parameters![pIndex].in = value as any;
                                          updateConfig({ endpoints: newEndpoints });
                                        }}
                                      >
                                        <SelectTrigger className="w-24">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="query">Query</SelectItem>
                                          <SelectItem value="path">Path</SelectItem>
                                          <SelectItem value="header">Header</SelectItem>
                                        </SelectContent>
                                      </Select>
                                      <Input
                                        value={param.name}
                                        onChange={(e) => {
                                          const newEndpoints = [...endpoints];
                                          newEndpoints[originalIndex].parameters![pIndex].name = e.target.value;
                                          updateConfig({ endpoints: newEndpoints });
                                        }}
                                        placeholder="Parameter name"
                                        className="flex-1"
                                      />
                                      <Select
                                        value={param.type || 'string'}
                                        onValueChange={(value) => {
                                          const newEndpoints = [...endpoints];
                                          newEndpoints[originalIndex].parameters![pIndex].type = value;
                                          // Clear properties/itemsType when changing type
                                          if (value !== 'object') {
                                            delete newEndpoints[originalIndex].parameters![pIndex].properties;
                                          }
                                          if (value !== 'array') {
                                            delete newEndpoints[originalIndex].parameters![pIndex].itemsType;
                                          }
                                          updateConfig({ endpoints: newEndpoints });
                                        }}
                                      >
                                        <SelectTrigger className="w-32">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="string">string</SelectItem>
                                          <SelectItem value="number">number</SelectItem>
                                          <SelectItem value="integer">integer</SelectItem>
                                          <SelectItem value="boolean">boolean</SelectItem>
                                          <SelectItem value="array">array</SelectItem>
                                          <SelectItem value="object">object</SelectItem>
                                        </SelectContent>
                                      </Select>
                                      <div className="flex items-center gap-2">
                                        <Label className="text-xs">Required</Label>
                                        <Switch
                                          checked={param.required}
                                          onCheckedChange={(checked) => {
                                            const newEndpoints = [...endpoints];
                                            newEndpoints[originalIndex].parameters![pIndex].required = checked;
                                            updateConfig({ endpoints: newEndpoints });
                                          }}
                                        />
                                      </div>
                                      {(param.type === 'object' || param.type === 'array') && (
                                        <Collapsible 
                                          open={isOpen} 
                                          onOpenChange={(open) => {
                                            const newMap = new Map(openParams);
                                            newMap.set(paramKey, open);
                                            setOpenParams(newMap);
                                          }}
                                        >
                                          <CollapsibleTrigger asChild>
                                            <Button size="icon" variant="ghost">
                                              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                            </Button>
                                          </CollapsibleTrigger>
                                        </Collapsible>
                                      )}
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        onClick={() => {
                                          const newEndpoints = [...endpoints];
                                          newEndpoints[originalIndex].parameters = newEndpoints[originalIndex].parameters!.filter((_, i) => i !== pIndex);
                                          updateConfig({ endpoints: newEndpoints });
                                          // Clean up state
                                          const newMap = new Map(openParams);
                                          newMap.delete(paramKey);
                                          setOpenParams(newMap);
                                        }}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                    
                                    {/* Object Properties */}
                                    {param.type === 'object' && (
                                      <Collapsible 
                                        open={isOpen} 
                                        onOpenChange={(open) => {
                                          const newMap = new Map(openParams);
                                          newMap.set(paramKey, open);
                                          setOpenParams(newMap);
                                        }}
                                      >
                                        <CollapsibleContent className="px-2 pb-2">
                                          <div className="space-y-2 pt-2 border-t">
                                            <div className="flex items-center justify-between">
                                              <Label className="text-xs font-semibold">Object Properties</Label>
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => {
                                                  const newEndpoints = [...endpoints];
                                                  if (!newEndpoints[originalIndex].parameters![pIndex].properties) {
                                                    newEndpoints[originalIndex].parameters![pIndex].properties = [];
                                                  }
                                                  newEndpoints[originalIndex].parameters![pIndex].properties!.push({
                                                    name: 'property',
                                                    type: 'string',
                                                    required: false,
                                                  });
                                                  updateConfig({ endpoints: newEndpoints });
                                                }}
                                              >
                                                <Plus className="h-3 w-3 mr-1" />
                                                Add Property
                                              </Button>
                                            </div>
                                            {param.properties && param.properties.length > 0 ? (
                                              <div className="space-y-2">
                                                {param.properties.map((prop, propIndex) => (
                                                  <div key={propIndex} className="flex items-center gap-2 p-3 bg-card border border-border rounded-md shadow-sm">
                                                    <Input
                                                      value={prop.name}
                                                      onChange={(e) => {
                                                        const newEndpoints = [...endpoints];
                                                        newEndpoints[originalIndex].parameters![pIndex].properties![propIndex].name = e.target.value;
                                                        updateConfig({ endpoints: newEndpoints });
                                                      }}
                                                      placeholder="Property name"
                                                      className="flex-1 bg-background"
                                                    />
                                                    <Select
                                                      value={prop.type || 'string'}
                                                      onValueChange={(value) => {
                                                        const newEndpoints = [...endpoints];
                                                        newEndpoints[originalIndex].parameters![pIndex].properties![propIndex].type = value;
                                                        updateConfig({ endpoints: newEndpoints });
                                                      }}
                                                    >
                                                      <SelectTrigger className="w-28 bg-background">
                                                        <SelectValue />
                                                      </SelectTrigger>
                                                      <SelectContent>
                                                        <SelectItem value="string">string</SelectItem>
                                                        <SelectItem value="number">number</SelectItem>
                                                        <SelectItem value="integer">integer</SelectItem>
                                                        <SelectItem value="boolean">boolean</SelectItem>
                                                        <SelectItem value="array">array</SelectItem>
                                                        <SelectItem value="object">object</SelectItem>
                                                      </SelectContent>
                                                    </Select>
                                                    <div className="flex items-center gap-2 px-2">
                                                      <Label className="text-xs font-medium text-foreground">Required</Label>
                                                      <Switch
                                                        checked={prop.required}
                                                        onCheckedChange={(checked) => {
                                                          const newEndpoints = [...endpoints];
                                                          newEndpoints[originalIndex].parameters![pIndex].properties![propIndex].required = checked;
                                                          updateConfig({ endpoints: newEndpoints });
                                                        }}
                                                      />
                                                    </div>
                                                    <Button
                                                      size="icon"
                                                      variant="ghost"
                                                      className="hover:bg-destructive/10 hover:text-destructive"
                                                      onClick={() => {
                                                        const newEndpoints = [...endpoints];
                                                        newEndpoints[originalIndex].parameters![pIndex].properties = 
                                                          newEndpoints[originalIndex].parameters![pIndex].properties!.filter((_, i) => i !== propIndex);
                                                        updateConfig({ endpoints: newEndpoints });
                                                      }}
                                                    >
                                                      <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                  </div>
                                                ))}
                                              </div>
                                            ) : (
                                              <p className="text-xs text-muted-foreground">No properties defined</p>
                                            )}
                                          </div>
                                        </CollapsibleContent>
                                      </Collapsible>
                                    )}
                                    
                                    {/* Array Items Type */}
                                    {param.type === 'array' && (
                                      <Collapsible 
                                        open={isOpen} 
                                        onOpenChange={(open) => {
                                          const newMap = new Map(openParams);
                                          newMap.set(paramKey, open);
                                          setOpenParams(newMap);
                                        }}
                                      >
                                        <CollapsibleContent className="px-2 pb-2">
                                          <div className="space-y-2 pt-2 border-t">
                                            <Label className="text-xs font-semibold">Array Items Type</Label>
                                            <Select
                                              value={param.itemsType || 'string'}
                                              onValueChange={(value) => {
                                                const newEndpoints = [...endpoints];
                                                newEndpoints[originalIndex].parameters![pIndex].itemsType = value;
                                                updateConfig({ endpoints: newEndpoints });
                                              }}
                                            >
                                              <SelectTrigger>
                                                <SelectValue />
                                              </SelectTrigger>
                                              <SelectContent>
                                                <SelectItem value="string">string</SelectItem>
                                                <SelectItem value="number">number</SelectItem>
                                                <SelectItem value="integer">integer</SelectItem>
                                                <SelectItem value="boolean">boolean</SelectItem>
                                                <SelectItem value="object">object</SelectItem>
                                              </SelectContent>
                                            </Select>
                                            <p className="text-xs text-muted-foreground">
                                              Type of elements in the array
                                            </p>
                                          </div>
                                        </CollapsibleContent>
                                      </Collapsible>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">No parameters configured</p>
                          )}
                        </div>
                        {/* Request Body - only for POST, PUT, PATCH */}
                        {['POST', 'PUT', 'PATCH'].includes(endpoint.method) && (
                          <div className="space-y-2">
                            <Label>Request Body Example</Label>
                            <Textarea
                              value={endpoint.requestBody || ''}
                              onChange={(e) => updateEndpoint(originalIndex, 'requestBody', e.target.value)}
                              className={`font-mono text-sm ${requestBodyError ? "border-red-500" : ""}`}
                              rows={6}
                              placeholder='{"key": "value"}'
                            />
                            {requestBodyError && (
                              <p className="text-xs text-red-500 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                {requestBodyError}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              JSON example for request body (used in OpenAPI spec)
                            </p>
                          </div>
                        )}
                        
                        {/* Response Example */}
                        <div className="space-y-2">
                          <Label>Response Example</Label>
                          <Textarea
                            value={endpoint.responseExample || ''}
                            onChange={(e) => updateEndpoint(originalIndex, 'responseExample', e.target.value)}
                            className={`font-mono text-sm ${responseExampleError ? "border-red-500" : ""}`}
                            rows={6}
                            placeholder='{"data": [], "count": 0}'
                          />
                          {responseExampleError && (
                            <p className="text-xs text-red-500 flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" />
                              {responseExampleError}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            JSON example for successful response (used in OpenAPI spec)
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                    );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Authentication Tab */}
          <TabsContent value="auth" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Authentication</CardTitle>
                <CardDescription>API authentication configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Authentication Type</Label>
                  <Select
                    value={authentication.type}
                    onValueChange={(value) => updateConfig({ authentication: { ...authentication, type: value as any } })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="bearer">Bearer Token</SelectItem>
                      <SelectItem value="apiKey">API Key</SelectItem>
                      <SelectItem value="basic">Basic Auth</SelectItem>
                      <SelectItem value="oauth2">OAuth 2.0</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {authentication.type === 'bearer' && (
                  <div className="space-y-2">
                    <Label>Bearer Token</Label>
                    <Input
                      type="password"
                      value={authentication.token || ''}
                      onChange={(e) => updateConfig({ authentication: { ...authentication, token: e.target.value } })}
                      placeholder="Enter bearer token"
                    />
                    <p className="text-xs text-muted-foreground">
                      Token to validate in Authorization: Bearer header
                    </p>
                  </div>
                )}
                
                {authentication.type === 'apiKey' && (
                  <>
                    <div className="space-y-2">
                      <Label>API Key</Label>
                      <Input
                        type="password"
                        value={authentication.apiKey || authentication.token || ''}
                        onChange={(e) => updateConfig({ authentication: { ...authentication, apiKey: e.target.value, token: e.target.value } })}
                        placeholder="Enter API key"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>API Key Header Name</Label>
                      <Input
                        value={authentication.apiKeyHeader || 'X-API-Key'}
                        onChange={(e) => updateConfig({ authentication: { ...authentication, apiKeyHeader: e.target.value } })}
                        placeholder="X-API-Key"
                      />
                      <p className="text-xs text-muted-foreground">
                        Header name where API key should be provided (default: X-API-Key)
                      </p>
                    </div>
                  </>
                )}
                
                {authentication.type === 'basic' && (
                  <>
                    <div className="space-y-2">
                      <Label>Username</Label>
                      <Input
                        value={authentication.username || ''}
                        onChange={(e) => updateConfig({ authentication: { ...authentication, username: e.target.value } })}
                        placeholder="Enter username"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Password</Label>
                      <Input
                        type="password"
                        value={authentication.password || ''}
                        onChange={(e) => updateConfig({ authentication: { ...authentication, password: e.target.value } })}
                        placeholder="Enter password"
                      />
                    </div>
                  </>
                )}
                
                {authentication.type === 'oauth2' && (
                  <>
                    <div className="space-y-2">
                      <Label>Token Endpoint</Label>
                      <Input
                        value={authentication.oauth2Config?.tokenEndpoint || ''}
                        onChange={(e) => updateConfig({ 
                          authentication: { 
                            ...authentication, 
                            oauth2Config: { 
                              ...authentication.oauth2Config, 
                              tokenEndpoint: e.target.value 
                            } 
                          } 
                        })}
                        placeholder="https://oauth.example.com/token"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Client ID</Label>
                        <Input
                          value={authentication.oauth2Config?.clientId || ''}
                          onChange={(e) => updateConfig({ 
                            authentication: { 
                              ...authentication, 
                              oauth2Config: { 
                                ...authentication.oauth2Config, 
                                clientId: e.target.value 
                              } 
                            } 
                          })}
                          placeholder="Client ID"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Client Secret</Label>
                        <Input
                          type="password"
                          value={authentication.oauth2Config?.clientSecret || ''}
                          onChange={(e) => updateConfig({ 
                            authentication: { 
                              ...authentication, 
                              oauth2Config: { 
                                ...authentication.oauth2Config, 
                                clientSecret: e.target.value 
                              } 
                            } 
                          })}
                          placeholder="Client Secret"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Scopes (comma-separated)</Label>
                      <Input
                        value={authentication.oauth2Config?.scopes?.join(', ') || ''}
                        onChange={(e) => updateConfig({ 
                          authentication: { 
                            ...authentication, 
                            oauth2Config: { 
                              ...authentication.oauth2Config, 
                              scopes: e.target.value.split(',').map(s => s.trim()).filter(s => s) 
                            } 
                          } 
                        })}
                        placeholder="read, write, admin"
                      />
                      <p className="text-xs text-muted-foreground">
                        OAuth2 scopes required for access (comma-separated)
                      </p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Metrics Tab */}
          <TabsContent value="metrics" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>API Metrics</CardTitle>
                <CardDescription>Real-time performance metrics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {componentMetrics ? (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Throughput</Label>
                        <div className="flex items-center gap-2">
                          <Progress value={Math.min(100, (componentMetrics.throughput / (componentMetrics.customMetrics?.rps || 100)) * 100)} className="flex-1" />
                          <span className="text-sm font-medium">{Math.round(componentMetrics.throughput)} req/s</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Average Latency</Label>
                        <div className="flex items-center gap-2">
                          <Progress value={Math.min(100, (componentMetrics.latency / 200) * 100)} className="flex-1" />
                          <span className="text-sm font-medium">{Math.round(componentMetrics.latency)}ms</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Error Rate</Label>
                        <div className="flex items-center gap-2">
                          <Progress value={componentMetrics.errorRate * 100} className="flex-1" />
                          <span className="text-sm font-medium">{(componentMetrics.errorRate * 100).toFixed(2)}%</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Utilization</Label>
                        <div className="flex items-center gap-2">
                          <Progress value={componentMetrics.utilization * 100} className="flex-1" />
                          <span className="text-sm font-medium">{Math.round(componentMetrics.utilization * 100)}%</span>
                        </div>
                      </div>
                    </div>
                    {/* Latency Percentiles */}
                    {(componentMetrics.latencyP50 || componentMetrics.latencyP99) && (
                      <div className="mt-4 pt-4 border-t">
                        <Label className="mb-2">Latency Percentiles</Label>
                        <div className="grid grid-cols-3 gap-4">
                          {componentMetrics.latencyP50 && (
                            <div className="space-y-1">
                              <div className="text-xs text-muted-foreground">P50 (Median)</div>
                              <div className="text-lg font-semibold">{Math.round(componentMetrics.latencyP50)}ms</div>
                            </div>
                          )}
                          {componentMetrics.latencyP95 && (
                            <div className="space-y-1">
                              <div className="text-xs text-muted-foreground">P95</div>
                              <div className="text-lg font-semibold">{Math.round(componentMetrics.latencyP95)}ms</div>
                            </div>
                          )}
                          {componentMetrics.latencyP99 && (
                            <div className="space-y-1">
                              <div className="text-xs text-muted-foreground">P99</div>
                              <div className="text-lg font-semibold">{Math.round(componentMetrics.latencyP99)}ms</div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Endpoint Statistics with Status Codes */}
                    {Object.keys(endpointStats).length > 0 && (
                      <div className="mt-4 pt-4 border-t">
                        <Label className="mb-3">Endpoint Statistics</Label>
                        <div className="space-y-4">
                          {Object.entries(endpointStats).map(([endpointId, stats]: [string, any]) => {
                            if (!stats) return null;
                            const statusCodes = stats.statusCodeCounts || {};
                            const statusCodeEntries = Object.entries(statusCodes).sort(([a], [b]) => parseInt(a) - parseInt(b));
                            
                            return (
                              <Card key={endpointId} className="border-border">
                                <CardHeader className="pb-3">
                                  <CardTitle className="text-sm">{endpointId}</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                  <div className="grid grid-cols-3 gap-4 text-sm">
                                    <div>
                                      <div className="text-xs text-muted-foreground">Requests</div>
                                      <div className="font-semibold">{stats.requestCount.toLocaleString()}</div>
                                    </div>
                                    <div>
                                      <div className="text-xs text-muted-foreground">Errors</div>
                                      <div className="font-semibold text-red-500">{stats.errorCount.toLocaleString()}</div>
                                    </div>
                                    <div>
                                      <div className="text-xs text-muted-foreground">Avg Latency</div>
                                      <div className="font-semibold">{Math.round(stats.averageLatency)}ms</div>
                                    </div>
                                  </div>
                                  
                                  {statusCodeEntries.length > 0 && (
                                    <div className="pt-2 border-t">
                                      <div className="text-xs text-muted-foreground mb-2">Status Codes</div>
                                      <div className="flex flex-wrap gap-2">
                                        {statusCodeEntries.map(([code, count]: [string, any]) => {
                                          const codeNum = parseInt(code);
                                          const color = codeNum >= 500 ? 'bg-red-500' : codeNum >= 400 ? 'bg-orange-500' : codeNum >= 300 ? 'bg-yellow-500' : 'bg-green-500';
                                          return (
                                            <Badge key={code} className={`${color} text-white`}>
                                              {code}: {count}
                                            </Badge>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    
                    {/* Legacy Endpoint Statistics */}
                    {componentMetrics.customMetrics && Object.keys(endpointStats).length === 0 && (
                      <div className="mt-4 pt-4 border-t">
                        <Label className="mb-2">Endpoint Statistics</Label>
                        <div className="space-y-2">
                          {Object.entries(componentMetrics.customMetrics)
                            .filter(([key]) => key.startsWith('endpoint_'))
                            .map(([key, value]) => {
                              const parts = key.split('_');
                              const endpointId = parts.slice(1, -1).join('_');
                              const metricType = parts[parts.length - 1];
                              return (
                                <div key={key} className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">{endpointId} ({metricType})</span>
                                  <span className="font-medium">{typeof value === 'number' ? value.toLocaleString() : value}</span>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No metrics available</p>
                    <p className="text-xs mt-2">Start simulation to see real-time metrics</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* CORS Tab */}
          <TabsContent value="cors" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>CORS Configuration</CardTitle>
                <CardDescription>Cross-Origin Resource Sharing settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable CORS</Label>
                    <p className="text-xs text-muted-foreground">
                      Allow cross-origin requests from web browsers
                    </p>
                  </div>
                  <Switch
                    checked={cors.enabled}
                    onCheckedChange={(checked) => updateConfig({ cors: { ...cors, enabled: checked } })}
                  />
                </div>
                
                {cors.enabled && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <Label>Allowed Origins</Label>
                      <Textarea
                        value={cors.allowedOrigins?.join('\n') || ''}
                        onChange={(e) => updateConfig({ 
                          cors: { 
                            ...cors, 
                            allowedOrigins: e.target.value.split('\n').filter(o => o.trim()) 
                          } 
                        })}
                        placeholder="https://example.com&#10;https://app.example.com&#10;* (for all origins)"
                        rows={4}
                      />
                      <p className="text-xs text-muted-foreground">
                        One origin per line. Use * to allow all origins (not recommended for production)
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Allowed Methods</Label>
                      <div className="flex flex-wrap gap-2">
                        {['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'].map((method) => (
                          <div key={method} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id={`cors-method-${method}`}
                              checked={cors.allowedMethods?.includes(method) || false}
                              onChange={(e) => {
                                const current = cors.allowedMethods || [];
                                const updated = e.target.checked
                                  ? [...current, method]
                                  : current.filter(m => m !== method);
                                updateConfig({ cors: { ...cors, allowedMethods: updated } });
                              }}
                              className="rounded border-gray-300"
                            />
                            <Label htmlFor={`cors-method-${method}`} className="text-sm font-normal cursor-pointer">
                              {method}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Allowed Headers</Label>
                      <Textarea
                        value={cors.allowedHeaders?.join(', ') || ''}
                        onChange={(e) => updateConfig({ 
                          cors: { 
                            ...cors, 
                            allowedHeaders: e.target.value.split(',').map(h => h.trim()).filter(h => h) 
                          } 
                        })}
                        placeholder="Content-Type, Authorization, X-Requested-With"
                        rows={3}
                      />
                      <p className="text-xs text-muted-foreground">
                        Comma-separated list of allowed headers
                      </p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Rate Limit Tab */}
          <TabsContent value="rate-limit" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Global Rate Limiting</CardTitle>
                <CardDescription>Configure global rate limits for the API</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Global Rate Limit</Label>
                    <p className="text-xs text-muted-foreground">
                      Limit requests per second across all endpoints
                    </p>
                  </div>
                  <Switch
                    checked={rateLimit.enabled}
                    onCheckedChange={(checked) => updateConfig({ rateLimit: { ...rateLimit, enabled: checked } })}
                  />
                </div>
                
                {rateLimit.enabled && (
                  <>
                    <Separator />
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Requests Per Second</Label>
                        <Input
                          type="number"
                          value={rateLimit.requestsPerSecond || 1000}
                          onChange={(e) => updateConfig({ 
                            rateLimit: { 
                              ...rateLimit, 
                              requestsPerSecond: parseInt(e.target.value) || 1000 
                            } 
                          })}
                          placeholder="1000"
                          min="1"
                        />
                        <p className="text-xs text-muted-foreground">
                          Maximum requests per second allowed
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label>Burst Size</Label>
                        <Input
                          type="number"
                          value={rateLimit.burst || 100}
                          onChange={(e) => updateConfig({ 
                            rateLimit: { 
                              ...rateLimit, 
                              burst: parseInt(e.target.value) || 100 
                            } 
                          })}
                          placeholder="100"
                          min="1"
                        />
                        <p className="text-xs text-muted-foreground">
                          Maximum burst requests allowed
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* OpenAPI Spec Tab */}
          <TabsContent value="openapi" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>OpenAPI Specification</CardTitle>
                    <CardDescription>OpenAPI 3.0 specification document</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={generateOpenAPISpec}
                      disabled={endpoints.length === 0}
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Generate from Endpoints
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={exportToJSON}
                      disabled={!openApiSpec}
                    >
                      <Code className="h-4 w-4 mr-2" />
                      Export JSON
                    </Button>
                    <label>
                      <Button
                        size="sm"
                        variant="outline"
                        asChild
                        className="cursor-pointer"
                      >
                        <span>
                          <Plus className="h-4 w-4 mr-2" />
                          Import
                        </span>
                      </Button>
                      <input
                        type="file"
                        accept=".json,.yaml,.yml"
                        onChange={importOpenAPISpec}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>OpenAPI YAML</Label>
                    {endpoints.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {endpoints.filter(e => e.enabled !== false).length} endpoint(s) configured
                      </p>
                    )}
                  </div>
                  <Textarea
                    value={openApiSpec}
                    onChange={(e) => {
                      const spec = e.target.value;
                      const error = validateOpenAPISpec(spec);
                      setOpenApiError(error);
                      updateConfig({ openApiSpec: spec });
                    }}
                    className={`font-mono text-sm h-96 ${openApiError ? "border-red-500" : ""}`}
                    placeholder="openapi: 3.0.0..."
                  />
                  {openApiError && (
                    <p className="text-xs text-red-500 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {openApiError}
                    </p>
                  )}
                  {endpoints.length === 0 && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Configure endpoints first, then click "Generate from Endpoints" to create OpenAPI spec
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}


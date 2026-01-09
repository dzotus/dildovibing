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
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { 
  Settings, 
  Activity,
  Plus,
  Trash2,
  RefreshCcw,
  Play,
  Code,
  FileText,
  CheckCircle,
  XCircle,
  Database,
  Zap,
  Search,
  Network,
  BarChart3,
  AlertTriangle,
  Link2,
  TrendingUp,
  Clock,
  Users,
  Radio,
  Edit,
  Pencil
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface GraphQLConfigProps {
  componentId: string;
}

interface Query {
  id: string;
  name: string;
  query: string;
  variables?: string;
  timestamp: string;
  duration?: number;
  success?: boolean;
}

interface Type {
  name: string;
  kind: 'OBJECT' | 'SCALAR' | 'INTERFACE' | 'UNION' | 'ENUM' | 'INPUT_OBJECT';
  fields?: Array<{
    name: string;
    type: string;
    description?: string;
  }>;
  description?: string;
}

interface GraphQLConfig {
  queries?: Query[];
  schema?: {
    types?: Type[];
    queries?: Type[];
    mutations?: Type[];
  };
  endpoint?: string;
  subscriptionsEnabled?: boolean;
  introspectionEnabled?: boolean;
  enableQueryComplexityAnalysis?: boolean;
  enableQueryDepthLimiting?: boolean;
  maxQueryDepth?: number;
  maxQueryComplexity?: number;
  totalQueries?: number;
  averageResponseTime?: number;
}

export function GraphQLConfigAdvanced({ componentId }: GraphQLConfigProps) {
  const { nodes, updateNode, connections } = useCanvasStore();
  const { getComponentMetrics } = useEmulationStore();
  const { toast } = useToast();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  // Get GraphQL emulation engine for real-time metrics
  const graphQLEngine = emulationEngine.getGraphQLEmulationEngine(componentId);
  const componentMetrics = getComponentMetrics(componentId);
  const customMetrics = componentMetrics?.customMetrics || {};

  const config = (node.data.config as any) || {} as GraphQLConfig;
  const queries = config.queries || [];
  const schema = config.schema || {};
  const endpoint = config.endpoint || '/graphql';
  const subscriptionsEnabled = config.subscriptionsEnabled ?? true;
  const introspectionEnabled = config.introspectionEnabled ?? true;
  
  // Get real-time metrics from emulation engine or fallback to config
  const graphQLMetrics = graphQLEngine?.getGraphQLMetrics();
  const totalQueries = graphQLMetrics?.totalQueries ?? config.totalQueries ?? queries.length;
  const averageResponseTime = graphQLMetrics?.averageResponseTime ?? config.averageResponseTime ?? (queries.length > 0 ? queries.reduce((sum, q) => sum + (q.duration || 0), 0) / queries.length : 0);
  const queriesPerSecond = graphQLMetrics?.queriesPerSecond ?? customMetrics.queries_per_second ?? 0;
  const mutationsPerSecond = graphQLMetrics?.mutationsPerSecond ?? customMetrics.mutations_per_second ?? 0;
  const subscriptionsActive = graphQLMetrics?.subscriptionsActive ?? customMetrics.subscriptions_active ?? 0;
  const averageComplexity = graphQLMetrics?.averageComplexity ?? customMetrics.average_complexity ?? 0;
  const averageDepth = graphQLMetrics?.averageDepth ?? customMetrics.average_depth ?? 0;

  const [selectedQuery, setSelectedQuery] = useState<string>('');
  const [queryText, setQueryText] = useState('');
  const [variablesText, setVariablesText] = useState('');
  const [responseText, setResponseText] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  // Schema editor state
  const [showCreateType, setShowCreateType] = useState(false);
  const [showEditType, setShowEditType] = useState(false);
  const [showCreateField, setShowCreateField] = useState(false);
  const [showEditField, setShowEditField] = useState(false);
  const [editingType, setEditingType] = useState<Type | null>(null);
  const [editingField, setEditingField] = useState<{ type: Type; field: { name: string; type: string; description?: string } } | null>(null);
  const [deleteTypeConfirm, setDeleteTypeConfirm] = useState<string | null>(null);
  const [deleteFieldConfirm, setDeleteFieldConfirm] = useState<{ typeName: string; fieldName: string } | null>(null);
  
  // Form state for type
  const [typeForm, setTypeForm] = useState({
    name: '',
    kind: 'OBJECT' as 'OBJECT' | 'SCALAR' | 'INTERFACE' | 'UNION' | 'ENUM' | 'INPUT_OBJECT',
    description: '',
  });
  
  // Form state for field
  const [fieldForm, setFieldForm] = useState({
    name: '',
    type: '',
    description: '',
  });
  
  // GraphQL scalar types and common types
  const graphQLScalarTypes = [
    'String',
    'Int',
    'Float',
    'Boolean',
    'ID',
  ];
  
  const graphQLTypeModifiers = [
    { label: 'Optional', value: '' },
    { label: 'Required (!)', value: '!' },
    { label: 'List ([Type])', value: '[]' },
    { label: 'Required List ([Type!]!)', value: '[!]!' },
  ];
  
  // Get available custom types from schema
  const getAvailableCustomTypes = (): string[] => {
    const customTypes: string[] = [];
    if (schema?.types) {
      schema.types.forEach(type => {
        if (type.kind === 'OBJECT' || type.kind === 'INTERFACE' || type.kind === 'ENUM' || type.kind === 'INPUT_OBJECT') {
          customTypes.push(type.name);
        }
      });
    }
    return customTypes.sort();
  };
  
  const availableCustomTypes = getAvailableCustomTypes();
  
  // State for type selection
  const [fieldTypeBase, setFieldTypeBase] = useState<string>('');
  const [fieldTypeModifier, setFieldTypeModifier] = useState<string>('');
  const [fieldTypeCustom, setFieldTypeCustom] = useState<string>('');
  const [fieldTypeMode, setFieldTypeMode] = useState<'scalar' | 'custom' | 'manual'>('scalar');

  // Auto-refresh metrics every 2 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshKey(prev => prev + 1);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const updateConfig = (updates: Partial<GraphQLConfig>) => {
    const newConfig = { ...config, ...updates };
    updateNode(componentId, {
      data: {
        ...node.data,
        config: newConfig,
      },
    });
    
    // Update emulation engine config if engine exists
    if (graphQLEngine) {
      graphQLEngine.updateConfig(updates);
    }
    
    toast({
      title: "Configuration updated",
      description: "GraphQL settings have been saved.",
    });
  };

  // Schema management functions
  const handleCreateType = () => {
    if (!typeForm.name.trim()) {
      toast({
        title: "Validation error",
        description: "Type name is required",
        variant: "destructive",
      });
      return;
    }

    const currentSchema = schema || { types: [], queries: [], mutations: [], subscriptions: [] };
    
    // Prevent creating Query, Mutation, or Subscription as regular types
    const rootTypeNames = ['Query', 'Mutation', 'Subscription'];
    if (rootTypeNames.includes(typeForm.name)) {
      toast({
        title: "Invalid type name",
        description: `"${typeForm.name}" is a reserved root type. Use "Create Query Type" button or manage it through Root Types section.`,
        variant: "destructive",
      });
      return;
    }
    
    const existingTypes = currentSchema.types || [];
    
    // Check if type already exists
    if (existingTypes.find(t => t.name === typeForm.name)) {
      toast({
        title: "Validation error",
        description: `Type "${typeForm.name}" already exists`,
        variant: "destructive",
      });
      return;
    }
    
    // Check if root type with this name already exists
    const existingQuery = currentSchema.queries?.find(t => t.name === typeForm.name);
    const existingMutation = currentSchema.mutations?.find(t => t.name === typeForm.name);
    const existingSubscription = currentSchema.subscriptions?.find(t => t.name === typeForm.name);
    
    if (existingQuery || existingMutation || existingSubscription) {
      toast({
        title: "Validation error",
        description: `Type "${typeForm.name}" already exists as a root type`,
        variant: "destructive",
      });
      return;
    }

    const newType: Type = {
      name: typeForm.name,
      kind: typeForm.kind,
      description: typeForm.description || undefined,
      fields: typeForm.kind === 'SCALAR' ? undefined : [],
    };

    const updatedSchema = {
      ...currentSchema,
      types: [...existingTypes, newType],
    };

    updateConfig({ schema: updatedSchema });
    setShowCreateType(false);
    setTypeForm({ name: '', kind: 'OBJECT', description: '' });
    
    toast({
      title: "Type created",
      description: `Type "${typeForm.name}" has been added to schema`,
    });
  };

  const handleEditType = () => {
    if (!editingType || !typeForm.name.trim()) {
      return;
    }

    const currentSchema = schema || { types: [], queries: [], mutations: [], subscriptions: [] };
    
    // Prevent renaming to reserved root type names
    const rootTypeNames = ['Query', 'Mutation', 'Subscription'];
    if (rootTypeNames.includes(typeForm.name) && !rootTypeNames.includes(editingType.name)) {
      toast({
        title: "Invalid type name",
        description: `"${typeForm.name}" is a reserved root type name. Cannot rename to this name.`,
        variant: "destructive",
      });
      return;
    }
    
    // Check if this is a root type (Query, Mutation, Subscription)
    const isQueryType = currentSchema.queries?.some(t => t.name === editingType.name);
    const isMutationType = currentSchema.mutations?.some(t => t.name === editingType.name);
    const isSubscriptionType = currentSchema.subscriptions?.some(t => t.name === editingType.name);
    
    if (isQueryType || isMutationType || isSubscriptionType) {
      // Update root type
      const updatedType = {
        ...editingType,
        name: typeForm.name,
        kind: typeForm.kind,
        description: typeForm.description || undefined,
      };

      let updatedSchema;
      if (isQueryType) {
        updatedSchema = {
          ...currentSchema,
          queries: [updatedType],
        };
      } else if (isMutationType) {
        updatedSchema = {
          ...currentSchema,
          mutations: [updatedType],
        };
      } else {
        updatedSchema = {
          ...currentSchema,
          subscriptions: [updatedType],
        };
      }

      updateConfig({ schema: updatedSchema });
      setShowEditType(false);
      setEditingType(null);
      setTypeForm({ name: '', kind: 'OBJECT', description: '' });
      
      toast({
        title: "Type updated",
        description: `Type "${typeForm.name}" has been updated`,
      });
      return;
    }

    // Update regular type
    const existingTypes = currentSchema.types || [];
    
    // Check if new name conflicts with another type
    if (typeForm.name !== editingType.name && existingTypes.find(t => t.name === typeForm.name)) {
      toast({
        title: "Validation error",
        description: `Type "${typeForm.name}" already exists`,
        variant: "destructive",
      });
      return;
    }

    const updatedTypes = existingTypes.map(t => 
      t.name === editingType.name 
        ? { ...t, name: typeForm.name, kind: typeForm.kind, description: typeForm.description || undefined }
        : t
    );

    const updatedSchema = {
      ...currentSchema,
      types: updatedTypes,
    };

    updateConfig({ schema: updatedSchema });
    setShowEditType(false);
    setEditingType(null);
    setTypeForm({ name: '', kind: 'OBJECT', description: '' });
    
    toast({
      title: "Type updated",
      description: `Type "${typeForm.name}" has been updated`,
    });
  };

  const handleDeleteType = (typeName: string) => {
    const currentSchema = schema || { types: [], queries: [], mutations: [], subscriptions: [] };
    const existingTypes = currentSchema.types || [];
    
    const updatedTypes = existingTypes.filter(t => t.name !== typeName);
    const updatedSchema = {
      ...currentSchema,
      types: updatedTypes,
    };

    updateConfig({ schema: updatedSchema });
    setDeleteTypeConfirm(null);
    
    toast({
      title: "Type deleted",
      description: `Type "${typeName}" has been removed from schema`,
    });
  };

  const handleCreateField = () => {
    if (!editingType || !fieldForm.name.trim() || !fieldForm.type.trim()) {
      toast({
        title: "Validation error",
        description: "Field name and type are required",
        variant: "destructive",
      });
      return;
    }

    const currentSchema = schema || { types: [], queries: [], mutations: [], subscriptions: [] };
    
    // Check if this is a root type
    const isQueryType = currentSchema.queries?.some(t => t.name === editingType.name);
    const isMutationType = currentSchema.mutations?.some(t => t.name === editingType.name);
    const isSubscriptionType = currentSchema.subscriptions?.some(t => t.name === editingType.name);
    
    if (isQueryType || isMutationType || isSubscriptionType) {
      // Update root type
      const rootType = isQueryType 
        ? currentSchema.queries![0]
        : isMutationType 
        ? currentSchema.mutations![0]
        : currentSchema.subscriptions![0];
      
      const existingFields = rootType.fields || [];
      
      // Check if field already exists
      if (existingFields.find(f => f.name === fieldForm.name)) {
        toast({
          title: "Validation error",
          description: `Field "${fieldForm.name}" already exists in type "${editingType.name}"`,
          variant: "destructive",
        });
        return;
      }

      const newField = {
        name: fieldForm.name,
        type: fieldForm.type,
        description: fieldForm.description || undefined,
      };

      const updatedType = {
        ...rootType,
        fields: [...existingFields, newField],
      };

      let updatedSchema;
      if (isQueryType) {
        updatedSchema = {
          ...currentSchema,
          queries: [updatedType],
        };
      } else if (isMutationType) {
        updatedSchema = {
          ...currentSchema,
          mutations: [updatedType],
        };
      } else {
        updatedSchema = {
          ...currentSchema,
          subscriptions: [updatedType],
        };
      }

      updateConfig({ schema: updatedSchema });
      setShowCreateField(false);
      setFieldForm({ name: '', type: '', description: '' });
      
      toast({
        title: "Field created",
        description: `Field "${fieldForm.name}" has been added to type "${editingType.name}"`,
      });
      return;
    }

    // Update regular type
    const existingTypes = currentSchema.types || [];
    const typeIndex = existingTypes.findIndex(t => t.name === editingType.name);
    
    if (typeIndex === -1) {
      toast({
        title: "Error",
        description: "Type not found",
        variant: "destructive",
      });
      return;
    }

    const type = existingTypes[typeIndex];
    const existingFields = type.fields || [];
    
    // Check if field already exists
    if (existingFields.find(f => f.name === fieldForm.name)) {
      toast({
        title: "Validation error",
        description: `Field "${fieldForm.name}" already exists in type "${editingType.name}"`,
        variant: "destructive",
      });
      return;
    }

    const newField = {
      name: fieldForm.name,
      type: fieldForm.type,
      description: fieldForm.description || undefined,
    };

    const updatedTypes = [...existingTypes];
    updatedTypes[typeIndex] = {
      ...type,
      fields: [...existingFields, newField],
    };

    const updatedSchema = {
      ...currentSchema,
      types: updatedTypes,
    };

    updateConfig({ schema: updatedSchema });
    setShowCreateField(false);
    setFieldForm({ name: '', type: '', description: '' });
    
    toast({
      title: "Field created",
      description: `Field "${fieldForm.name}" has been added to type "${editingType.name}"`,
    });
  };

  const handleEditField = () => {
    if (!editingField || !fieldForm.name.trim() || !fieldForm.type.trim()) {
      return;
    }

    const currentSchema = schema || { types: [], queries: [], mutations: [], subscriptions: [] };
    
    // Check if this is a root type
    const isQueryType = currentSchema.queries?.some(t => t.name === editingField.type.name);
    const isMutationType = currentSchema.mutations?.some(t => t.name === editingField.type.name);
    const isSubscriptionType = currentSchema.subscriptions?.some(t => t.name === editingField.type.name);
    
    if (isQueryType || isMutationType || isSubscriptionType) {
      // Update root type
      const rootType = isQueryType 
        ? currentSchema.queries![0]
        : isMutationType 
        ? currentSchema.mutations![0]
        : currentSchema.subscriptions![0];
      
      const existingFields = rootType.fields || [];
      
      // Check if new name conflicts with another field
      if (fieldForm.name !== editingField.field.name && existingFields.find(f => f.name === fieldForm.name)) {
        toast({
          title: "Validation error",
          description: `Field "${fieldForm.name}" already exists in type "${editingField.type.name}"`,
          variant: "destructive",
        });
        return;
      }

      const updatedFields = existingFields.map(f => 
        f.name === editingField.field.name
          ? { ...f, name: fieldForm.name, type: fieldForm.type, description: fieldForm.description || undefined }
          : f
      );

      const updatedType = {
        ...rootType,
        fields: updatedFields,
      };

      let updatedSchema;
      if (isQueryType) {
        updatedSchema = {
          ...currentSchema,
          queries: [updatedType],
        };
      } else if (isMutationType) {
        updatedSchema = {
          ...currentSchema,
          mutations: [updatedType],
        };
      } else {
        updatedSchema = {
          ...currentSchema,
          subscriptions: [updatedType],
        };
      }

      updateConfig({ schema: updatedSchema });
      setShowEditField(false);
      setEditingField(null);
      setFieldForm({ name: '', type: '', description: '' });
      
      toast({
        title: "Field updated",
        description: `Field "${fieldForm.name}" has been updated`,
      });
      return;
    }

    // Update regular type
    const existingTypes = currentSchema.types || [];
    const typeIndex = existingTypes.findIndex(t => t.name === editingField.type.name);
    
    if (typeIndex === -1) {
      toast({
        title: "Error",
        description: "Type not found",
        variant: "destructive",
      });
      return;
    }

    const type = existingTypes[typeIndex];
    const existingFields = type.fields || [];
    
    // Check if new name conflicts with another field
    if (fieldForm.name !== editingField.field.name && existingFields.find(f => f.name === fieldForm.name)) {
      toast({
        title: "Validation error",
        description: `Field "${fieldForm.name}" already exists in type "${editingField.type.name}"`,
        variant: "destructive",
      });
      return;
    }

    const updatedFields = existingFields.map(f => 
      f.name === editingField.field.name
        ? { ...f, name: fieldForm.name, type: fieldForm.type, description: fieldForm.description || undefined }
        : f
    );

    const updatedTypes = [...existingTypes];
    updatedTypes[typeIndex] = {
      ...type,
      fields: updatedFields,
    };

    const updatedSchema = {
      ...currentSchema,
      types: updatedTypes,
    };

    updateConfig({ schema: updatedSchema });
    setShowEditField(false);
    setEditingField(null);
    setFieldForm({ name: '', type: '', description: '' });
    
    toast({
      title: "Field updated",
      description: `Field "${fieldForm.name}" has been updated`,
    });
  };

  const handleDeleteField = (typeName: string, fieldName: string) => {
    const currentSchema = schema || { types: [], queries: [], mutations: [], subscriptions: [] };
    
    // Check if this is a root type
    const isQueryType = currentSchema.queries?.some(t => t.name === typeName);
    const isMutationType = currentSchema.mutations?.some(t => t.name === typeName);
    const isSubscriptionType = currentSchema.subscriptions?.some(t => t.name === typeName);
    
    if (isQueryType || isMutationType || isSubscriptionType) {
      // Update root type
      const rootType = isQueryType 
        ? currentSchema.queries![0]
        : isMutationType 
        ? currentSchema.mutations![0]
        : currentSchema.subscriptions![0];
      
      const existingFields = rootType.fields || [];
      const updatedFields = existingFields.filter(f => f.name !== fieldName);

      const updatedType = {
        ...rootType,
        fields: updatedFields,
      };

      let updatedSchema;
      if (isQueryType) {
        updatedSchema = {
          ...currentSchema,
          queries: [updatedType],
        };
      } else if (isMutationType) {
        updatedSchema = {
          ...currentSchema,
          mutations: [updatedType],
        };
      } else {
        updatedSchema = {
          ...currentSchema,
          subscriptions: [updatedType],
        };
      }

      updateConfig({ schema: updatedSchema });
      setDeleteFieldConfirm(null);
      
      toast({
        title: "Field deleted",
        description: `Field "${fieldName}" has been removed from type "${typeName}"`,
      });
      return;
    }

    // Update regular type
    const existingTypes = currentSchema.types || [];
    const typeIndex = existingTypes.findIndex(t => t.name === typeName);
    
    if (typeIndex === -1) {
      return;
    }

    const type = existingTypes[typeIndex];
    const existingFields = type.fields || [];
    const updatedFields = existingFields.filter(f => f.name !== fieldName);

    const updatedTypes = [...existingTypes];
    updatedTypes[typeIndex] = {
      ...type,
      fields: updatedFields,
    };

    const updatedSchema = {
      ...currentSchema,
      types: updatedTypes,
    };

    updateConfig({ schema: updatedSchema });
    setDeleteFieldConfirm(null);
    
    toast({
      title: "Field deleted",
      description: `Field "${fieldName}" has been removed from type "${typeName}"`,
    });
  };

  const openCreateTypeDialog = () => {
    setTypeForm({ name: '', kind: 'OBJECT', description: '' });
    setShowCreateType(true);
  };

  const openEditTypeDialog = (type: Type) => {
    setEditingType(type);
    setTypeForm({ name: type.name, kind: type.kind, description: type.description || '' });
    setShowEditType(true);
  };

  // Parse GraphQL type string to extract base type and modifier
  const parseGraphQLType = (typeString: string): { base: string; modifier: string; mode: 'scalar' | 'custom' | 'manual' } => {
    if (!typeString) {
      return { base: '', modifier: '', mode: 'scalar' };
    }
    
    const customTypes = getAvailableCustomTypes();
    
    // Check if it's a required list type [Type!]!
    if (typeString.startsWith('[') && typeString.endsWith(']!')) {
      const inner = typeString.slice(1, -2); // Remove [ and ]!
      if (inner.endsWith('!')) {
        const base = inner.slice(0, -1);
        const isScalar = graphQLScalarTypes.includes(base);
        const isCustom = customTypes.includes(base);
        return { 
          base, 
          modifier: '[!]!', 
          mode: isScalar ? 'scalar' : (isCustom ? 'custom' : 'manual') 
        };
      } else {
        return { 
          base: inner, 
          modifier: '[]', 
          mode: graphQLScalarTypes.includes(inner) ? 'scalar' : (customTypes.includes(inner) ? 'custom' : 'manual') 
        };
      }
    } else if (typeString.startsWith('[') && typeString.endsWith(']')) {
      const inner = typeString.slice(1, -1);
      return { 
        base: inner, 
        modifier: '[]', 
        mode: graphQLScalarTypes.includes(inner) ? 'scalar' : (customTypes.includes(inner) ? 'custom' : 'manual') 
      };
    } else if (typeString.endsWith('!')) {
      const base = typeString.slice(0, -1);
      return { 
        base, 
        modifier: '!', 
        mode: graphQLScalarTypes.includes(base) ? 'scalar' : (customTypes.includes(base) ? 'custom' : 'manual') 
      };
    } else {
      return { 
        base: typeString, 
        modifier: '', 
        mode: graphQLScalarTypes.includes(typeString) ? 'scalar' : (customTypes.includes(typeString) ? 'custom' : 'manual') 
      };
    }
  };

  const openCreateFieldDialog = (type: Type) => {
    setEditingType(type);
    setFieldForm({ name: '', type: '', description: '' });
    setFieldTypeMode('scalar');
    setFieldTypeBase('');
    setFieldTypeModifier('');
    setFieldTypeCustom('');
    setShowCreateField(true);
  };

  const openEditFieldDialog = (type: Type, field: { name: string; type: string; description?: string }) => {
    setEditingField({ type, field });
    setFieldForm({ name: field.name, type: field.type, description: field.description || '' });
    
    // Parse existing type
    const parsed = parseGraphQLType(field.type);
    setFieldTypeMode(parsed.mode);
    setFieldTypeBase(parsed.mode === 'scalar' ? parsed.base : '');
    setFieldTypeModifier(parsed.modifier);
    setFieldTypeCustom(parsed.mode === 'custom' ? parsed.base : '');
    
    setShowEditField(true);
  };

  const createRootType = (typeName: 'Query' | 'Mutation' | 'Subscription') => {
    const currentSchema = schema || { types: [], queries: [], mutations: [], subscriptions: [] };
    
    // Check if root type already exists
    if (typeName === 'Query' && currentSchema.queries && currentSchema.queries.length > 0) {
      toast({
        title: "Query type already exists",
        description: "Query type can only be created once. Use 'Manage Query Operations' to add fields.",
        variant: "destructive",
      });
      return;
    }
    
    if (typeName === 'Mutation' && currentSchema.mutations && currentSchema.mutations.length > 0) {
      toast({
        title: "Mutation type already exists",
        description: "Mutation type can only be created once. Use 'Manage Mutation Operations' to add fields.",
        variant: "destructive",
      });
      return;
    }
    
    if (typeName === 'Subscription' && currentSchema.subscriptions && currentSchema.subscriptions.length > 0) {
      toast({
        title: "Subscription type already exists",
        description: "Subscription type can only be created once. Use 'Manage Subscription Operations' to add fields.",
        variant: "destructive",
      });
      return;
    }
    
    const rootType: Type = {
      name: typeName,
      kind: 'OBJECT',
      fields: [],
    };

    let updatedSchema;
    if (typeName === 'Query') {
      updatedSchema = {
        ...currentSchema,
        queries: [rootType],
      };
    } else if (typeName === 'Mutation') {
      updatedSchema = {
        ...currentSchema,
        mutations: [rootType],
      };
    } else {
      updatedSchema = {
        ...currentSchema,
        subscriptions: [rootType],
      };
    }

    updateConfig({ schema: updatedSchema });
    
    toast({
      title: `${typeName} type created`,
      description: `You can now add ${typeName.toLowerCase()} operations`,
    });
  };

  const executeQuery = () => {
    if (!queryText.trim()) {
      toast({
        title: "Error",
        description: "Query cannot be empty",
        variant: "destructive",
      });
      return;
    }
    
    try {
      // Parse variables if provided
      let variables: Record<string, any> | undefined;
      if (variablesText.trim()) {
        try {
          variables = JSON.parse(variablesText);
        } catch (e) {
          toast({
            title: "Invalid JSON",
            description: "Variables must be valid JSON",
            variant: "destructive",
          });
          return;
        }
      }
      
      // Process query through emulation engine if available
      if (graphQLEngine) {
        const result = graphQLEngine.processQuery({
          query: queryText,
          variables,
        });
        
        if (result.success) {
          setResponseText(JSON.stringify(result.data, null, 2));
          
          // Add to query history
          const newQuery: Query = {
            id: `query-${Date.now()}`,
            name: 'Executed Query',
            query: queryText,
            variables: variablesText || undefined,
            timestamp: new Date().toISOString(),
            duration: result.latency,
            success: true,
          };
          updateConfig({ queries: [...queries, newQuery] });
        } else {
          setResponseText(JSON.stringify({ errors: result.errors }, null, 2));
          
          const newQuery: Query = {
            id: `query-${Date.now()}`,
            name: 'Failed Query',
            query: queryText,
            variables: variablesText || undefined,
            timestamp: new Date().toISOString(),
            duration: result.latency,
            success: false,
          };
          updateConfig({ queries: [...queries, newQuery] });
        }
      } else {
        // Fallback to mock response
        const newQuery: Query = {
          id: `query-${Date.now()}`,
          name: 'New Query',
          query: queryText,
          variables: variablesText || undefined,
          timestamp: new Date().toISOString(),
          duration: Math.floor(Math.random() * 100) + 20,
          success: true,
        };
        setResponseText(JSON.stringify({ data: { users: [{ id: '1', name: 'John Doe' }] } }, null, 2));
        updateConfig({ queries: [...queries, newQuery] });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to execute query",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase text-muted-foreground tracking-wide">GraphQL</p>
            <h2 className="text-2xl font-bold text-foreground">GraphQL API</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Query language and runtime for APIs
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-blue-500 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Queries</CardTitle>
                <Activity className="h-3 w-3 sm:h-4 sm:w-4 text-blue-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-bold text-blue-600 dark:text-blue-400">{totalQueries}</span>
                <span className="text-xs text-muted-foreground">executed</span>
              </div>
              {queriesPerSecond > 0 && (
                <div className="text-xs text-muted-foreground mt-1">
                  {queriesPerSecond.toFixed(1)}/s
                </div>
              )}
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Avg Response</CardTitle>
                <Zap className="h-3 w-3 sm:h-4 sm:w-4 text-green-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-bold text-green-600 dark:text-green-400">{averageResponseTime.toFixed(0)}</span>
                <span className="text-xs text-muted-foreground">ms</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-purple-500 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Types</CardTitle>
                <Database className="h-3 w-3 sm:h-4 sm:w-4 text-purple-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-bold text-purple-600 dark:text-purple-400">{schema.types?.length || 0}</span>
                <span className="text-xs text-muted-foreground">defined</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-cyan-500 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Subscriptions</CardTitle>
                <Activity className="h-3 w-3 sm:h-4 sm:w-4 text-cyan-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-bold text-cyan-600 dark:text-cyan-400">{subscriptionsActive}</span>
                <span className="text-xs text-muted-foreground">active</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="playground" className="space-y-4">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="playground">
              <Play className="h-4 w-4 mr-2" />
              Playground
            </TabsTrigger>
            <TabsTrigger value="schema">
              <FileText className="h-4 w-4 mr-2" />
              Schema Explorer
            </TabsTrigger>
            <TabsTrigger value="resolvers">
              <Network className="h-4 w-4 mr-2" />
              Resolvers
            </TabsTrigger>
            <TabsTrigger value="subscriptions">
              <Radio className="h-4 w-4 mr-2" />
              Subscriptions
            </TabsTrigger>
            <TabsTrigger value="analysis">
              <BarChart3 className="h-4 w-4 mr-2" />
              Query Analysis
            </TabsTrigger>
            <TabsTrigger value="metrics">
              <TrendingUp className="h-4 w-4 mr-2" />
              Advanced Metrics
            </TabsTrigger>
            <TabsTrigger value="history">
              <Activity className="h-4 w-4 mr-2" />
              Query History ({queries.length})
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="playground" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>GraphQL Playground</CardTitle>
                <CardDescription>Execute queries and mutations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Query</Label>
                    <Textarea
                      value={queryText}
                      onChange={(e) => setQueryText(e.target.value)}
                      className="font-mono text-sm min-h-[300px]"
                      placeholder="query { ... }"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Variables (JSON)</Label>
                    <Textarea
                      value={variablesText}
                      onChange={(e) => setVariablesText(e.target.value)}
                      className="font-mono text-sm min-h-[150px]"
                      placeholder='{ "id": "1" }'
                    />
                    <Label>Response</Label>
                    <Textarea
                      value={responseText}
                      readOnly
                      className="font-mono text-sm min-h-[150px] bg-muted"
                      placeholder="Response will appear here..."
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={executeQuery}>
                    <Play className="h-4 w-4 mr-2" />
                    Execute Query
                  </Button>
                  <Button variant="outline" onClick={() => { setQueryText(''); setVariablesText(''); setResponseText(''); }}>
                    Clear
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="schema" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Schema Explorer</CardTitle>
                    <CardDescription>Create and manage GraphQL schema types and fields</CardDescription>
                  </div>
                  <Button onClick={openCreateTypeDialog} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Type
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Root Types Section */}
                {(schema.queries && schema.queries.length > 0) || 
                 (schema.mutations && schema.mutations.length > 0) || 
                 (schema.subscriptions && schema.subscriptions.length > 0) ? (
                  <div className="space-y-4 mb-6">
                    <div className="flex items-center gap-2">
                      <Zap className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      <Label className="text-base font-semibold">Root Types</Label>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {schema.queries && schema.queries.length > 0 && (
                        <Card className="border-l-4 border-l-green-500">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-semibold">Query</CardTitle>
                            <CardDescription className="text-xs">
                              {schema.queries[0].fields?.length || 0} operations
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full text-xs sm:text-sm"
                              onClick={() => schema.queries && schema.queries[0] && openEditTypeDialog(schema.queries[0])}
                            >
                              <Edit className="h-3 w-3 mr-1 sm:mr-2" />
                              <span className="hidden sm:inline">Manage Query Operations</span>
                              <span className="sm:hidden">Manage Query</span>
                            </Button>
                          </CardContent>
                        </Card>
                      )}
                      {schema.mutations && schema.mutations.length > 0 && (
                        <Card className="border-l-4 border-l-orange-500">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-semibold">Mutation</CardTitle>
                            <CardDescription className="text-xs">
                              {schema.mutations[0].fields?.length || 0} operations
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full text-xs sm:text-sm"
                              onClick={() => schema.mutations && schema.mutations[0] && openEditTypeDialog(schema.mutations[0])}
                            >
                              <Edit className="h-3 w-3 mr-1 sm:mr-2" />
                              <span className="hidden sm:inline">Manage Mutation Operations</span>
                              <span className="sm:hidden">Manage Mutation</span>
                            </Button>
                          </CardContent>
                        </Card>
                      )}
                      {schema.subscriptions && schema.subscriptions.length > 0 && (
                        <Card className="border-l-4 border-l-purple-500">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-semibold">Subscription</CardTitle>
                            <CardDescription className="text-xs">
                              {schema.subscriptions[0].fields?.length || 0} operations
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full text-xs sm:text-sm"
                              onClick={() => schema.subscriptions && schema.subscriptions[0] && openEditTypeDialog(schema.subscriptions[0])}
                            >
                              <Edit className="h-3 w-3 mr-1 sm:mr-2" />
                              <span className="hidden sm:inline">Manage Subscription Operations</span>
                              <span className="sm:hidden">Manage Subscription</span>
                            </Button>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                    {(!schema.queries || schema.queries.length === 0) && 
                     (!schema.mutations || schema.mutations.length === 0) && 
                     (!schema.subscriptions || schema.subscriptions.length === 0) && (
                      <div className="text-center py-4 text-muted-foreground border rounded-lg">
                        <p className="text-sm mb-2">No root types configured</p>
                        <p className="text-xs">Create Query, Mutation, or Subscription types to enable operations</p>
                      </div>
                    )}
                  </div>
                ) : null}

                {/* Custom Types Section */}
                {!schema || !schema.types || schema.types.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Database className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <p className="text-base sm:text-lg font-semibold mb-2">No schema configured</p>
                    <p className="text-sm mb-4">Create schema types to enable GraphQL operations</p>
                    <div className="flex flex-col sm:flex-row gap-2 justify-center">
                      <Button onClick={openCreateTypeDialog} variant="default">
                        <Plus className="h-4 w-4 mr-2" />
                        Create First Type
                      </Button>
                      {(!schema.queries || schema.queries.length === 0) && (
                        <Button 
                          onClick={() => createRootType('Query')}
                          variant="outline"
                        >
                          <Zap className="h-4 w-4 mr-2" />
                          Create Query Type
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Database className="h-5 w-5 text-muted-foreground" />
                      <Label className="text-base font-semibold">Custom Types</Label>
                    </div>
                    {schema.types.map((type) => (
                      <Card key={type.name} className="border-l-4 border-l-blue-500 hover:shadow-md transition-shadow bg-card">
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3 flex-1">
                              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                                <Database className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                              </div>
                              <div className="flex-1">
                                <CardTitle className="text-base sm:text-lg font-semibold">{type.name}</CardTitle>
                                <div className="flex items-center gap-2 mt-2">
                                  <Badge variant="outline">{type.kind}</Badge>
                                  {type.description && (
                                    <span className="text-sm text-muted-foreground">{type.description}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                              {type.kind !== 'SCALAR' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openCreateFieldDialog(type)}
                                  title="Add field"
                                  className="h-8 w-8 sm:h-9 sm:w-9 p-0"
                                >
                                  <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditTypeDialog(type)}
                                title="Edit type"
                                className="h-8 w-8 sm:h-9 sm:w-9 p-0"
                              >
                                <Edit className="h-3 w-3 sm:h-4 sm:w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeleteTypeConfirm(type.name)}
                                title="Delete type"
                                className="h-8 w-8 sm:h-9 sm:w-9 p-0 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                              >
                                <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        {type.fields && type.fields.length > 0 && (
                          <CardContent>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <Label>Fields</Label>
                                {type.kind !== 'SCALAR' && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openCreateFieldDialog(type)}
                                  >
                                    <Plus className="h-3 w-3 mr-1" />
                                    Add Field
                                  </Button>
                                )}
                              </div>
                              {type.fields.map((field) => (
                                <div key={field.name} className="p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        <span className="font-mono font-semibold">{field.name}</span>
                                        <Badge variant="outline" className="text-xs">{field.type}</Badge>
                                      </div>
                                      {field.description && (
                                        <p className="text-xs text-muted-foreground mt-1">{field.description}</p>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1 ml-2">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => openEditFieldDialog(type, field)}
                                        title="Edit field"
                                        className="h-7 w-7 p-0"
                                      >
                                        <Pencil className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setDeleteFieldConfirm({ typeName: type.name, fieldName: field.name })}
                                        title="Delete field"
                                        className="h-7 w-7 p-0 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        )}
                        {type.kind !== 'SCALAR' && (!type.fields || type.fields.length === 0) && (
                          <CardContent>
                            <div className="text-center py-4 text-muted-foreground border rounded-lg">
                              <p className="text-sm mb-2">No fields defined</p>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openCreateFieldDialog(type)}
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                Add First Field
                              </Button>
                            </div>
                          </CardContent>
                        )}
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="resolvers" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Resolvers Management</CardTitle>
                    <CardDescription>Manage GraphQL resolvers and their connections to components</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setRefreshKey(prev => prev + 1)}>
                    <RefreshCcw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {(() => {
                  const resolvers = config.resolvers || [];
                  const resolverMetrics = graphQLEngine?.getResolverMetrics() || [];
                  
                  if (resolvers.length === 0) {
                    return (
                      <div className="text-center py-8 text-muted-foreground">
                        <Network className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No resolvers configured</p>
                        <p className="text-sm mt-2">Add resolvers in the schema to connect fields to components</p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-4">
                      {resolvers.map((resolver: any) => {
                        const metrics = resolverMetrics.find(m => m.id === resolver.id);
                        const targetNode = resolver.targetService ? nodes.find(n => n.id === resolver.targetService) : null;
                        const targetConnection = resolver.targetService ? connections.find(c => 
                          (c.source === componentId && c.target === resolver.targetService) ||
                          (c.target === componentId && c.source === resolver.targetService)
                        ) : null;

                        return (
                          <Card key={resolver.id} className="border-l-4 border-l-blue-500">
                            <CardHeader className="pb-3">
                              <div className="flex items-start justify-between">
                                <div className="flex items-start gap-3">
                                  <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                                    <Link2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                  </div>
                                  <div>
                                    <CardTitle className="text-base sm:text-lg font-semibold">
                                      {resolver.type}.{resolver.field}
                                    </CardTitle>
                                    <div className="flex items-center gap-2 mt-2">
                                      <Badge variant="outline">{resolver.type}</Badge>
                                      {resolver.enabled !== false && (
                                        <Badge variant="default">Active</Badge>
                                      )}
                                      {resolver.enabled === false && (
                                        <Badge variant="secondary">Disabled</Badge>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div>
                                  <Label className="text-xs text-muted-foreground">Total Calls</Label>
                                  <p className="text-base sm:text-lg font-semibold">{metrics?.totalCalls || 0}</p>
                                </div>
                                <div>
                                  <Label className="text-xs text-muted-foreground">Avg Latency</Label>
                                  <p className="text-base sm:text-lg font-semibold">{metrics?.averageLatency?.toFixed(0) || resolver.latency || 0}ms</p>
                                </div>
                                <div>
                                  <Label className="text-xs text-muted-foreground">Error Rate</Label>
                                  <p className="text-base sm:text-lg font-semibold">
                                    {metrics?.errorRate ? `${(metrics.errorRate * 100).toFixed(1)}%` : '0%'}
                                  </p>
                                </div>
                                <div>
                                  <Label className="text-xs text-muted-foreground">Errors</Label>
                                  <p className="text-lg font-semibold text-red-600 dark:text-red-400">
                                    {metrics?.totalErrors || 0}
                                  </p>
                                </div>
                              </div>
                              
                              {targetNode && (
                                <div className="border rounded p-3 bg-muted/50">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Database className="h-4 w-4 text-muted-foreground" />
                                    <Label className="text-sm font-semibold">Target Component</Label>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline">{targetNode.type}</Badge>
                                    <span className="text-sm">{targetNode.data.name || targetNode.id}</span>
                                    {targetConnection && (
                                      <Badge variant="default" className="ml-auto">
                                        <Link2 className="h-3 w-3 mr-1" />
                                        Connected
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              )}

                              {!targetNode && resolver.targetService && (
                                <div className="border rounded p-3 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
                                  <div className="flex items-center gap-2">
                                    <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                                    <span className="text-sm text-yellow-800 dark:text-yellow-200">
                                      Target component not found: {resolver.targetService}
                                    </span>
                                  </div>
                                </div>
                              )}

                              {resolver.instances && resolver.instances.length > 0 && (
                                <div className="border rounded p-3 bg-muted/50">
                                  <Label className="text-sm font-semibold mb-2 block">Load Balanced Instances</Label>
                                  <div className="space-y-2">
                                    {resolver.instances.map((instanceId: string) => {
                                      const instanceNode = nodes.find(n => n.id === instanceId);
                                      return (
                                        <div key={instanceId} className="flex items-center gap-2">
                                          <Badge variant="outline">{instanceNode?.type || 'Unknown'}</Badge>
                                          <span className="text-sm">{instanceNode?.data.name || instanceId}</span>
                                        </div>
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
                  );
                })()}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="subscriptions" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Subscriptions Monitoring</CardTitle>
                    <CardDescription>Monitor active GraphQL subscriptions and events</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setRefreshKey(prev => prev + 1)}>
                    <RefreshCcw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {(() => {
                  const activeSubscriptions = graphQLEngine?.getActiveSubscriptions() || [];
                  const subscriptionMetrics = graphQLEngine?.getSubscriptionMetrics();

                  return (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card className="border-l-4 border-l-cyan-500">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Active</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-3xl font-bold">{activeSubscriptions.length}</p>
                          </CardContent>
                        </Card>
                        <Card className="border-l-4 border-l-green-500">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Events/sec</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-3xl font-bold">{subscriptionMetrics?.eventsPerSecond?.toFixed(1) || 0}</p>
                          </CardContent>
                        </Card>
                        <Card className="border-l-4 border-l-blue-500">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Total Events</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-3xl font-bold">{subscriptionMetrics?.totalEvents || 0}</p>
                          </CardContent>
                        </Card>
                        <Card className="border-l-4 border-l-purple-500">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Latency</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-3xl font-bold">{subscriptionMetrics?.averageDeliveryLatency?.toFixed(0) || 0}ms</p>
                          </CardContent>
                        </Card>
                      </div>

                      {activeSubscriptions.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <Radio className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>No active subscriptions</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {activeSubscriptions.map((subscription) => (
                            <Card key={subscription.id} className="border-l-4 border-l-cyan-500">
                              <CardHeader className="pb-3">
                                <div className="flex items-start justify-between">
                                  <div className="flex items-start gap-3">
                                    <div className="p-2 rounded-lg bg-cyan-100 dark:bg-cyan-900/30">
                                      <Radio className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                                    </div>
                                    <div>
                                      <CardTitle className="text-base sm:text-lg font-semibold">Subscription {subscription.id.slice(0, 8)}</CardTitle>
                                      <div className="flex items-center gap-2 mt-2">
                                        <Badge variant="default">Active</Badge>
                                        {subscription.clientId && (
                                          <Badge variant="outline">Client: {subscription.clientId.slice(0, 8)}</Badge>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </CardHeader>
                              <CardContent className="space-y-3">
                                <div>
                                  <Label className="text-xs text-muted-foreground">Query</Label>
                                  <pre className="p-2 bg-muted rounded text-xs font-mono overflow-x-auto mt-1">
                                    {subscription.query}
                                  </pre>
                                </div>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                  <div>
                                    <Label className="text-xs text-muted-foreground">Events</Label>
                                    <p className="text-base sm:text-lg font-semibold">{subscription.eventCount || 0}</p>
                                  </div>
                                  <div>
                                    <Label className="text-xs text-muted-foreground">Last Event</Label>
                                    <p className="text-sm">
                                      {subscription.lastEventTime 
                                        ? new Date(subscription.lastEventTime).toLocaleTimeString()
                                        : 'Never'}
                                    </p>
                                  </div>
                                  <div>
                                    <Label className="text-xs text-muted-foreground">Created</Label>
                                    <p className="text-sm">
                                      {new Date(subscription.timestamp).toLocaleString()}
                                    </p>
                                  </div>
                                  <div>
                                    <Label className="text-xs text-muted-foreground">Status</Label>
                                    <Badge variant={subscription.active ? 'default' : 'secondary'}>
                                      {subscription.active ? 'Active' : 'Inactive'}
                                    </Badge>
                                  </div>
                                </div>

                                {subscription.filter && (
                                  <div className="border rounded p-3 bg-muted/50">
                                    <Label className="text-sm font-semibold mb-2 block">Filters</Label>
                                    <div className="space-y-1 text-sm">
                                      {subscription.filter.field && (
                                        <div>Field: <Badge variant="outline">{subscription.filter.field}</Badge></div>
                                      )}
                                      {subscription.filter.type && subscription.filter.type.length > 0 && (
                                        <div>Types: {subscription.filter.type.map(t => (
                                          <Badge key={t} variant="outline" className="ml-1">{t}</Badge>
                                        ))}</div>
                                      )}
                                      {subscription.filter.sourceComponentId && (
                                        <div>Source: <Badge variant="outline">{subscription.filter.sourceComponentId}</Badge></div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analysis" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Query Analysis</CardTitle>
                    <CardDescription>Analyze query performance and detect N+1 problems</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setRefreshKey(prev => prev + 1)}>
                    <RefreshCcw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {(() => {
                  const nPlusOneProblems = graphQLEngine?.getNPlusOneProblems() || [];
                  const dataLoaderMetrics = graphQLEngine?.getDataLoaderMetrics();

                  return (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card className="border-l-4 border-l-blue-500">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium text-muted-foreground">N+1 Problems</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-3xl font-bold">{nPlusOneProblems.length}</p>
                          </CardContent>
                        </Card>
                        <Card className="border-l-4 border-l-green-500">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Batches</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-3xl font-bold">{dataLoaderMetrics?.totalBatches || 0}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {dataLoaderMetrics?.averageBatchSize ? `Avg: ${dataLoaderMetrics.averageBatchSize.toFixed(1)}` : ''}
                            </p>
                          </CardContent>
                        </Card>
                        <Card className="border-l-4 border-l-purple-500">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Cache Hit Rate</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-3xl font-bold">
                              {dataLoaderMetrics?.cacheHitRate ? `${(dataLoaderMetrics.cacheHitRate * 100).toFixed(1)}%` : '0%'}
                            </p>
                          </CardContent>
                        </Card>
                        <Card className="border-l-4 border-l-orange-500">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Deduplication</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-3xl font-bold">
                              {dataLoaderMetrics?.deduplicationRate ? `${(dataLoaderMetrics.deduplicationRate * 100).toFixed(1)}%` : '0%'}
                            </p>
                          </CardContent>
                        </Card>
                      </div>

                      {nPlusOneProblems.length > 0 && (
                        <Card className="border-l-4 border-l-red-500">
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                              Detected N+1 Problems
                            </CardTitle>
                            <CardDescription>These queries may cause performance issues</CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-4">
                              {nPlusOneProblems.map((problem, index) => (
                                <div key={index} className="border rounded p-4 bg-red-50 dark:bg-red-900/20">
                                  <div className="flex items-start justify-between mb-2">
                                    <div>
                                      <p className="font-semibold">N+1 Problem Detected</p>
                                      <p className="text-sm text-muted-foreground mt-1">
                                        Field: <span className="font-mono">{problem.field}</span> in type <span className="font-mono">{problem.parentType}</span>
                                      </p>
                                    </div>
                                    <Badge variant={problem.severity === 'high' ? 'destructive' : problem.severity === 'medium' ? 'default' : 'secondary'}>
                                      {problem.severity.toUpperCase()}
                                    </Badge>
                                  </div>
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
                                    <div>
                                      <Label className="text-xs text-muted-foreground">Estimated Calls</Label>
                                      <p className="text-base sm:text-lg font-semibold">{problem.estimatedCalls}</p>
                                    </div>
                                    <div>
                                      <Label className="text-xs text-muted-foreground">Field</Label>
                                      <p className="text-sm font-mono">{problem.field}</p>
                                    </div>
                                    <div>
                                      <Label className="text-xs text-muted-foreground">Parent Type</Label>
                                      <p className="text-sm font-mono">{problem.parentType}</p>
                                    </div>
                                    <div>
                                      <Label className="text-xs text-muted-foreground">Detected</Label>
                                      <p className="text-sm">
                                        {new Date(problem.detectedAt).toLocaleString()}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {dataLoaderMetrics && (
                        <Card>
                          <CardHeader>
                            <CardTitle>DataLoader Metrics</CardTitle>
                            <CardDescription>Query optimization through batching and caching</CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                              <div>
                                <Label className="text-xs text-muted-foreground">Total Requests</Label>
                                <p className="text-2xl font-bold">{dataLoaderMetrics.totalRequests || 0}</p>
                              </div>
                              <div>
                                <Label className="text-xs text-muted-foreground">Batched Requests</Label>
                                <p className="text-2xl font-bold">{dataLoaderMetrics.totalBatchedRequests || 0}</p>
                              </div>
                              <div>
                                <Label className="text-xs text-muted-foreground">Avg Batch Size</Label>
                                <p className="text-2xl font-bold">{dataLoaderMetrics.averageBatchSize?.toFixed(1) || 0}</p>
                              </div>
                              <div>
                                <Label className="text-xs text-muted-foreground">Latency Reduction</Label>
                                <p className="text-2xl font-bold">
                                  {dataLoaderMetrics.averageLatencyReduction ? `${dataLoaderMetrics.averageLatencyReduction.toFixed(0)}ms` : '0ms'}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="metrics" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Advanced Metrics</CardTitle>
                    <CardDescription>Detailed performance metrics by field, type, and operation</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setRefreshKey(prev => prev + 1)}>
                    <RefreshCcw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {(() => {
                  const fieldMetrics = graphQLEngine?.getFieldMetrics() || [];
                  const typeMetrics = graphQLEngine?.getTypeMetrics() || [];
                  const operationMetrics = graphQLEngine?.getOperationMetrics() || [];
                  const errorMetrics = graphQLEngine?.getErrorMetrics() || [];

                  return (
                    <div className="space-y-6">
                      {typeMetrics.length > 0 && (
                        <div>
                          <h3 className="text-base sm:text-lg font-semibold mb-4">Type Metrics</h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {typeMetrics.map((type) => (
                              <Card key={type.typeName} className="border-l-4 border-l-blue-500">
                                <CardHeader className="pb-3">
                                  <CardTitle className="text-base">{type.typeName}</CardTitle>
                                </CardHeader>
                                <CardContent>
                                  <div className="space-y-2">
                                    <div className="flex justify-between">
                                      <span className="text-sm text-muted-foreground">Operations</span>
                                      <span className="font-semibold">{type.totalOperations}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-sm text-muted-foreground">Ops/sec</span>
                                      <span className="font-semibold">{type.operationsPerSecond.toFixed(1)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-sm text-muted-foreground">Avg Latency</span>
                                      <span className="font-semibold">{type.averageLatency.toFixed(0)}ms</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-sm text-muted-foreground">Error Rate</span>
                                      <span className="font-semibold text-red-600 dark:text-red-400">
                                        {(type.errorRate * 100).toFixed(1)}%
                                      </span>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </div>
                      )}

                      {operationMetrics.length > 0 && (
                        <div>
                          <h3 className="text-base sm:text-lg font-semibold mb-4">Operation Metrics</h3>
                          <div className="space-y-2">
                            {operationMetrics.slice(0, 10).map((op) => (
                              <Card key={`${op.operationType}-${op.operationName}`} className="border-l-4 border-l-green-500">
                                <CardContent className="pt-4">
                                  <div className="flex items-center justify-between mb-3">
                                    <div>
                                      <p className="font-semibold">{op.operationName}</p>
                                      <Badge variant="outline" className="mt-1">{op.operationType}</Badge>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-2xl font-bold">{op.callsPerSecond.toFixed(1)}</p>
                                      <p className="text-xs text-muted-foreground">calls/sec</p>
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                                    <div>
                                      <span className="text-muted-foreground">Calls: </span>
                                      <span className="font-semibold">{op.totalCalls}</span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Latency: </span>
                                      <span className="font-semibold">{op.averageLatency.toFixed(0)}ms</span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Errors: </span>
                                      <span className="font-semibold text-red-600 dark:text-red-400">{op.totalErrors}</span>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </div>
                      )}

                      {errorMetrics.length > 0 && (
                        <div>
                          <h3 className="text-base sm:text-lg font-semibold mb-4">Error Metrics</h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {errorMetrics.map((error) => (
                              <Card key={error.category} className="border-l-4 border-l-red-500">
                                <CardHeader className="pb-3">
                                  <CardTitle className="text-sm capitalize">{error.category.replace('_', ' ')}</CardTitle>
                                </CardHeader>
                                <CardContent>
                                  <p className="text-3xl font-bold text-red-600 dark:text-red-400">
                                    {error.totalErrors}
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {error.errorsPerSecond.toFixed(1)}/sec
                                  </p>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </div>
                      )}

                      {fieldMetrics.length > 0 && (
                        <div>
                          <h3 className="text-base sm:text-lg font-semibold mb-4">Top Fields by Calls</h3>
                          <div className="space-y-2">
                            {fieldMetrics
                              .sort((a, b) => b.totalCalls - a.totalCalls)
                              .slice(0, 10)
                              .map((field) => (
                                <Card key={`${field.typeName}-${field.fieldName}`} className="border-l-4 border-l-purple-500">
                                  <CardContent className="pt-4">
                                    <div className="flex items-center justify-between">
                                      <div>
                                        <p className="font-semibold">{field.fieldName}</p>
                                        <p className="text-xs text-muted-foreground">{field.typeName}</p>
                                      </div>
                                      <div className="text-right">
                                        <p className="text-lg font-bold">{field.totalCalls}</p>
                                        <p className="text-xs text-muted-foreground">
                                          {field.callsPerSecond.toFixed(1)}/sec
                                        </p>
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-4 mt-3 text-sm">
                                      <div>
                                        <span className="text-muted-foreground">Latency: </span>
                                        <span className="font-semibold">{field.averageLatency.toFixed(0)}ms</span>
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground">Errors: </span>
                                        <span className="font-semibold text-red-600 dark:text-red-400">
                                          {field.totalErrors}
                                        </span>
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground">Error Rate: </span>
                                        <span className="font-semibold">
                                          {(field.errorRate * 100).toFixed(1)}%
                                        </span>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              ))}
                          </div>
                        </div>
                      )}

                      {fieldMetrics.length === 0 && typeMetrics.length === 0 && operationMetrics.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                          <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>No metrics available yet</p>
                          <p className="text-sm mt-2">Execute some queries to see metrics</p>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Query History</CardTitle>
                <CardDescription>Previously executed queries</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {queries.map((query) => (
                    <Card key={query.id} className="border-l-4 border-l-green-500 hover:shadow-md transition-shadow bg-card">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg ${query.success ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                              {query.success ? (
                                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                              ) : (
                                <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                              )}
                            </div>
                            <div>
                              <CardTitle className="text-base sm:text-lg font-semibold">{query.name}</CardTitle>
                              <div className="flex items-center gap-2 mt-2">
                                {query.duration && (
                                  <Badge variant="outline">{query.duration}ms</Badge>
                                )}
                                <Badge variant={query.success ? 'default' : 'destructive'}>
                                  {query.success ? 'Success' : 'Failed'}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <Label>Query</Label>
                          <pre className="p-3 bg-muted rounded text-xs font-mono overflow-x-auto">{query.query}</pre>
                          {query.variables && (
                            <>
                              <Label>Variables</Label>
                              <pre className="p-3 bg-muted rounded text-xs font-mono overflow-x-auto">{query.variables}</pre>
                            </>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-2">
                          {new Date(query.timestamp).toLocaleString()}
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
                <CardTitle>GraphQL Settings</CardTitle>
                <CardDescription>API configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Endpoint URL</Label>
                  <Input
                    value={endpoint}
                    onChange={(e) => updateConfig({ endpoint: e.target.value })}
                    placeholder="/graphql"
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <Label>Enable Subscriptions</Label>
                  <Switch
                    checked={subscriptionsEnabled}
                    onCheckedChange={(checked) => updateConfig({ subscriptionsEnabled: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Enable Introspection</Label>
                  <Switch
                    checked={introspectionEnabled}
                    onCheckedChange={(checked) => updateConfig({ introspectionEnabled: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Enable Query Complexity Analysis</Label>
                  <Switch 
                    checked={config.enableQueryComplexityAnalysis ?? true}
                    onCheckedChange={(checked) => updateConfig({ enableQueryComplexityAnalysis: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Enable Query Depth Limiting</Label>
                  <Switch 
                    checked={config.enableQueryDepthLimiting ?? true}
                    onCheckedChange={(checked) => updateConfig({ enableQueryDepthLimiting: checked })}
                  />
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label>Max Query Depth</Label>
                  <Input 
                    type="number" 
                    value={config.maxQueryDepth ?? 15}
                    onChange={(e) => updateConfig({ maxQueryDepth: parseInt(e.target.value) || 15 })}
                    min={1} 
                    max={50} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Query Complexity</Label>
                  <Input 
                    type="number" 
                    value={config.maxQueryComplexity ?? 1000}
                    onChange={(e) => updateConfig({ maxQueryComplexity: parseInt(e.target.value) || 1000 })}
                    min={1} 
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Caching</Label>
                    <p className="text-xs text-muted-foreground">Cache query results to improve performance</p>
                  </div>
                  <Switch 
                    checked={config.enableCaching ?? false}
                    onCheckedChange={(checked) => updateConfig({ enableCaching: checked })}
                  />
                </div>
                {config.enableCaching && (
                  <div className="space-y-2">
                    <Label>Cache TTL (seconds)</Label>
                    <Input 
                      type="number" 
                      value={config.cacheTTL ?? 300}
                      onChange={(e) => updateConfig({ cacheTTL: parseInt(e.target.value) || 300 })}
                      min={1} 
                      max={3600}
                    />
                  </div>
                )}
                <Separator />
                <div className="space-y-2">
                  <Label>Requests Per Second</Label>
                  <Input 
                    type="number" 
                    value={config.requestsPerSecond || 100}
                    onChange={(e) => updateConfig({ requestsPerSecond: parseInt(e.target.value) || 100 })}
                    min={1}
                    placeholder="100"
                  />
                  <p className="text-xs text-muted-foreground">Expected request rate for capacity planning</p>
                </div>
                <div className="space-y-2">
                  <Label>Response Latency (ms)</Label>
                  <Input 
                    type="number" 
                    value={config.responseLatency || 50}
                    onChange={(e) => updateConfig({ responseLatency: parseInt(e.target.value) || 50 })}
                    min={1}
                    placeholder="50"
                  />
                  <p className="text-xs text-muted-foreground">Base response latency in milliseconds</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Create Type Dialog */}
        <Dialog open={showCreateType} onOpenChange={setShowCreateType}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Type</DialogTitle>
              <DialogDescription>
                Add a new type to your GraphQL schema
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="type-name">Type Name</Label>
                <Input
                  id="type-name"
                  value={typeForm.name}
                  onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })}
                  placeholder="User"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type-kind">Kind</Label>
                <Select
                  value={typeForm.kind}
                  onValueChange={(value: any) => setTypeForm({ ...typeForm, kind: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OBJECT">OBJECT</SelectItem>
                    <SelectItem value="SCALAR">SCALAR</SelectItem>
                    <SelectItem value="INTERFACE">INTERFACE</SelectItem>
                    <SelectItem value="UNION">UNION</SelectItem>
                    <SelectItem value="ENUM">ENUM</SelectItem>
                    <SelectItem value="INPUT_OBJECT">INPUT_OBJECT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="type-description">Description (optional)</Label>
                <Textarea
                  id="type-description"
                  value={typeForm.description}
                  onChange={(e) => setTypeForm({ ...typeForm, description: e.target.value })}
                  placeholder="Type description"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateType(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateType}>
                Create Type
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Type Dialog */}
        <Dialog open={showEditType} onOpenChange={setShowEditType}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Type</DialogTitle>
              <DialogDescription>
                Update type information
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-type-name">Type Name</Label>
                <Input
                  id="edit-type-name"
                  value={typeForm.name}
                  onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })}
                  placeholder="User"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-type-kind">Kind</Label>
                <Select
                  value={typeForm.kind}
                  onValueChange={(value: any) => setTypeForm({ ...typeForm, kind: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OBJECT">OBJECT</SelectItem>
                    <SelectItem value="SCALAR">SCALAR</SelectItem>
                    <SelectItem value="INTERFACE">INTERFACE</SelectItem>
                    <SelectItem value="UNION">UNION</SelectItem>
                    <SelectItem value="ENUM">ENUM</SelectItem>
                    <SelectItem value="INPUT_OBJECT">INPUT_OBJECT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-type-description">Description (optional)</Label>
                <Textarea
                  id="edit-type-description"
                  value={typeForm.description}
                  onChange={(e) => setTypeForm({ ...typeForm, description: e.target.value })}
                  placeholder="Type description"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setShowEditType(false);
                setEditingType(null);
                setTypeForm({ name: '', kind: 'OBJECT', description: '' });
              }}>
                Cancel
              </Button>
              <Button onClick={handleEditType}>
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create Field Dialog */}
        <Dialog open={showCreateField} onOpenChange={setShowCreateField}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Field to {editingType?.name}</DialogTitle>
              <DialogDescription>
                Add a new field to this type
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="field-name">Field Name</Label>
                <Input
                  id="field-name"
                  value={fieldForm.name}
                  onChange={(e) => setFieldForm({ ...fieldForm, name: e.target.value })}
                  placeholder="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="field-type">Field Type</Label>
                <div className="space-y-2">
                  <Select
                    value={fieldTypeMode}
                    onValueChange={(value: 'scalar' | 'custom' | 'manual') => {
                      setFieldTypeMode(value);
                      if (value === 'scalar') {
                        setFieldTypeBase('');
                        setFieldTypeModifier('');
                        setFieldTypeCustom('');
                      } else if (value === 'custom') {
                        setFieldTypeBase('');
                        setFieldTypeModifier('');
                        setFieldTypeCustom(availableCustomTypes[0] || '');
                      } else {
                        setFieldTypeBase('');
                        setFieldTypeModifier('');
                        setFieldTypeCustom('');
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="scalar">Scalar Type (String, Int, etc.)</SelectItem>
                      {availableCustomTypes.length > 0 && (
                        <SelectItem value="custom">Custom Type (from schema)</SelectItem>
                      )}
                      <SelectItem value="manual">Manual Input</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  {fieldTypeMode === 'scalar' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Select
                        value={fieldTypeBase}
                        onValueChange={(value) => {
                          setFieldTypeBase(value);
                          const modifier = fieldTypeModifier || '';
                          let finalType = value;
                          if (modifier === '[]') {
                            finalType = `[${value}]`;
                          } else if (modifier === '[!]!') {
                            finalType = `[${value}!]!`;
                          } else {
                            finalType = value + modifier;
                          }
                          setFieldForm({ ...fieldForm, type: finalType });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Base type" />
                        </SelectTrigger>
                        <SelectContent>
                          {graphQLScalarTypes.map(type => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={fieldTypeModifier}
                        onValueChange={(value) => {
                          setFieldTypeModifier(value);
                          const base = fieldTypeBase || '';
                          if (base) {
                            if (value === '[]') {
                              setFieldForm({ ...fieldForm, type: `[${base}]` });
                            } else if (value === '[!]!') {
                              setFieldForm({ ...fieldForm, type: `[${base}!]!` });
                            } else {
                              setFieldForm({ ...fieldForm, type: base + value });
                            }
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Modifier" />
                        </SelectTrigger>
                        <SelectContent>
                          {graphQLTypeModifiers.map(mod => (
                            <SelectItem key={mod.value} value={mod.value}>{mod.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  
                  {fieldTypeMode === 'custom' && availableCustomTypes.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Select
                        value={fieldTypeCustom}
                        onValueChange={(value) => {
                          setFieldTypeCustom(value);
                          const modifier = fieldTypeModifier || '';
                          let finalType = value;
                          if (modifier === '[]') {
                            finalType = `[${value}]`;
                          } else if (modifier === '[!]!') {
                            finalType = `[${value}!]!`;
                          } else {
                            finalType = value + modifier;
                          }
                          setFieldForm({ ...fieldForm, type: finalType });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Custom type" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableCustomTypes.map(type => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={fieldTypeModifier}
                        onValueChange={(value) => {
                          setFieldTypeModifier(value);
                          const custom = fieldTypeCustom || '';
                          if (custom) {
                            if (value === '[]') {
                              setFieldForm({ ...fieldForm, type: `[${custom}]` });
                            } else if (value === '[!]!') {
                              setFieldForm({ ...fieldForm, type: `[${custom}!]!` });
                            } else {
                              setFieldForm({ ...fieldForm, type: custom + value });
                            }
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Modifier" />
                        </SelectTrigger>
                        <SelectContent>
                          {graphQLTypeModifiers.map(mod => (
                            <SelectItem key={mod.value} value={mod.value}>{mod.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  
                  {fieldTypeMode === 'manual' && (
                    <Input
                      id="field-type"
                      value={fieldForm.type}
                      onChange={(e) => setFieldForm({ ...fieldForm, type: e.target.value })}
                      placeholder="String!, [User!]!, etc."
                    />
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {fieldTypeMode === 'scalar' && 'Select a scalar type and optional modifier'}
                  {fieldTypeMode === 'custom' && 'Select a custom type from your schema and optional modifier'}
                  {fieldTypeMode === 'manual' && 'Enter type manually (e.g., String!, [User!]!, ID)'}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="field-description">Description (optional)</Label>
                <Textarea
                  id="field-description"
                  value={fieldForm.description}
                  onChange={(e) => setFieldForm({ ...fieldForm, description: e.target.value })}
                  placeholder="Field description"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setShowCreateField(false);
                setFieldForm({ name: '', type: '', description: '' });
                setFieldTypeMode('scalar');
                setFieldTypeBase('');
                setFieldTypeModifier('');
                setFieldTypeCustom('');
              }}>
                Cancel
              </Button>
              <Button onClick={handleCreateField}>
                Add Field
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Field Dialog */}
        <Dialog open={showEditField} onOpenChange={setShowEditField}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Field</DialogTitle>
              <DialogDescription>
                Update field information in {editingField?.type.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-field-name">Field Name</Label>
                <Input
                  id="edit-field-name"
                  value={fieldForm.name}
                  onChange={(e) => setFieldForm({ ...fieldForm, name: e.target.value })}
                  placeholder="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-field-type">Field Type</Label>
                <div className="space-y-2">
                  <Select
                    value={fieldTypeMode}
                    onValueChange={(value: 'scalar' | 'custom' | 'manual') => {
                      setFieldTypeMode(value);
                      if (value === 'scalar') {
                        setFieldTypeBase('');
                        setFieldTypeModifier('');
                        setFieldTypeCustom('');
                      } else if (value === 'custom') {
                        setFieldTypeBase('');
                        setFieldTypeModifier('');
                        setFieldTypeCustom(availableCustomTypes[0] || '');
                      } else {
                        setFieldTypeBase('');
                        setFieldTypeModifier('');
                        setFieldTypeCustom('');
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="scalar">Scalar Type (String, Int, etc.)</SelectItem>
                      {availableCustomTypes.length > 0 && (
                        <SelectItem value="custom">Custom Type (from schema)</SelectItem>
                      )}
                      <SelectItem value="manual">Manual Input</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  {fieldTypeMode === 'scalar' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Select
                        value={fieldTypeBase}
                        onValueChange={(value) => {
                          setFieldTypeBase(value);
                          const modifier = fieldTypeModifier || '';
                          let finalType = value;
                          if (modifier === '[]') {
                            finalType = `[${value}]`;
                          } else if (modifier === '[!]!') {
                            finalType = `[${value}!]!`;
                          } else {
                            finalType = value + modifier;
                          }
                          setFieldForm({ ...fieldForm, type: finalType });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Base type" />
                        </SelectTrigger>
                        <SelectContent>
                          {graphQLScalarTypes.map(type => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={fieldTypeModifier}
                        onValueChange={(value) => {
                          setFieldTypeModifier(value);
                          const base = fieldTypeBase || '';
                          if (base) {
                            if (value === '[]') {
                              setFieldForm({ ...fieldForm, type: `[${base}]` });
                            } else if (value === '[!]!') {
                              setFieldForm({ ...fieldForm, type: `[${base}!]!` });
                            } else {
                              setFieldForm({ ...fieldForm, type: base + value });
                            }
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Modifier" />
                        </SelectTrigger>
                        <SelectContent>
                          {graphQLTypeModifiers.map(mod => (
                            <SelectItem key={mod.value} value={mod.value}>{mod.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  
                  {fieldTypeMode === 'custom' && availableCustomTypes.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Select
                        value={fieldTypeCustom}
                        onValueChange={(value) => {
                          setFieldTypeCustom(value);
                          const modifier = fieldTypeModifier || '';
                          let finalType = value;
                          if (modifier === '[]') {
                            finalType = `[${value}]`;
                          } else if (modifier === '[!]!') {
                            finalType = `[${value}!]!`;
                          } else {
                            finalType = value + modifier;
                          }
                          setFieldForm({ ...fieldForm, type: finalType });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Custom type" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableCustomTypes.map(type => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={fieldTypeModifier}
                        onValueChange={(value) => {
                          setFieldTypeModifier(value);
                          const custom = fieldTypeCustom || '';
                          if (custom) {
                            if (value === '[]') {
                              setFieldForm({ ...fieldForm, type: `[${custom}]` });
                            } else if (value === '[!]!') {
                              setFieldForm({ ...fieldForm, type: `[${custom}!]!` });
                            } else {
                              setFieldForm({ ...fieldForm, type: custom + value });
                            }
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Modifier" />
                        </SelectTrigger>
                        <SelectContent>
                          {graphQLTypeModifiers.map(mod => (
                            <SelectItem key={mod.value} value={mod.value}>{mod.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  
                  {fieldTypeMode === 'manual' && (
                    <Input
                      id="edit-field-type"
                      value={fieldForm.type}
                      onChange={(e) => setFieldForm({ ...fieldForm, type: e.target.value })}
                      placeholder="String!, [User!]!, etc."
                    />
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {fieldTypeMode === 'scalar' && 'Select a scalar type and optional modifier'}
                  {fieldTypeMode === 'custom' && 'Select a custom type from your schema and optional modifier'}
                  {fieldTypeMode === 'manual' && 'Enter type manually (e.g., String!, [User!]!, ID)'}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-field-description">Description (optional)</Label>
                <Textarea
                  id="edit-field-description"
                  value={fieldForm.description}
                  onChange={(e) => setFieldForm({ ...fieldForm, description: e.target.value })}
                  placeholder="Field description"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setShowEditField(false);
                setEditingField(null);
                setFieldForm({ name: '', type: '', description: '' });
                setFieldTypeMode('scalar');
                setFieldTypeBase('');
                setFieldTypeModifier('');
                setFieldTypeCustom('');
              }}>
                Cancel
              </Button>
              <Button onClick={handleEditField}>
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Type Confirmation */}
        <AlertDialog open={!!deleteTypeConfirm} onOpenChange={(open) => !open && setDeleteTypeConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete type "{deleteTypeConfirm}"? This action cannot be undone and will remove all fields associated with this type.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteTypeConfirm && handleDeleteType(deleteTypeConfirm)}
                className="bg-red-600 hover:bg-red-700"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Field Confirmation */}
        <AlertDialog open={!!deleteFieldConfirm} onOpenChange={(open) => !open && setDeleteFieldConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete field "{deleteFieldConfirm?.fieldName}" from type "{deleteFieldConfirm?.typeName}"? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteFieldConfirm && handleDeleteField(deleteFieldConfirm.typeName, deleteFieldConfirm.fieldName)}
                className="bg-red-600 hover:bg-red-700"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}


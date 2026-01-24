import { useState, useEffect } from 'react';
import { useCanvasStore } from '@/store/useCanvasStore';
import { CanvasNode } from '@/types';
import { PostgreSQLQueryEngine } from '@/core/postgresql/QueryEngine';
import { PostgreSQLTable, PostgreSQLIndex } from '@/core/postgresql/types';
import { emulationEngine } from '@/core/EmulationEngine';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { usePortValidation } from '@/hooks/usePortValidation';
import { showSuccess, showError } from '@/utils/toast';
import { validateRequiredFields, type RequiredField } from '@/utils/requiredFields';
import { PageTitle, Description } from '@/components/ui/typography';
import { 
  Database, 
  Table, 
  Settings, 
  FileCode,
  Users,
  Key,
  Eye,
  Plus,
  Trash2,
  Search,
  Play,
  FolderTree,
  Activity,
  Edit2,
  Network,
  Download,
  FileText,
  Copy,
  Check,
  Upload,
  AlertCircle,
  CheckCircle2,
  LayoutGrid
} from 'lucide-react';
import { SchemaDiagram } from './SchemaDiagram';
import { DrawDBRelationship } from '@/utils/schemaDiagramConverter';
import {
  exportPostgreSQLSchema,
  exportMermaidSchema,
  exportDBMLSchema,
  exportDocumentationSchema,
} from '@/utils/schemaExport';
import { importPostgreSQLSchema } from '@/utils/schemaImport';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { validateSchema, ValidationResult } from '@/utils/schemaValidation';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface PostgreSQLConfigProps {
  componentId: string;
}

interface Column {
  name: string;
  type: string;
  nullable: boolean;
  default?: string;
  primaryKey?: boolean;
}

interface TableRow {
  [key: string]: any;
}

interface TableInfo {
  name: string;
  schema: string;
  columns: Column[];
  indexes: string[];
  constraints: string[];
  data?: TableRow[];
}

interface View {
  name: string;
  schema: string;
  definition: string;
}

interface Schema {
  name: string;
  owner: string;
}

interface Role {
  name: string;
  login: boolean;
  superuser: boolean;
}

interface PostgreSQLConfig {
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  schemas?: Schema[];
  tables?: TableInfo[];
  views?: View[];
  roles?: Role[];
  currentSchema?: string;
  sqlQuery?: string;
  queryResults?: any[];
  metrics?: {
    enabled?: boolean;
    port?: number;
    path?: string;
  };
  diagramPositions?: Record<string, { x: number; y: number }>; // Table positions for diagram: "schema.table" -> {x, y}
}

export function PostgreSQLConfigAdvanced({ componentId }: PostgreSQLConfigProps) {
  const { nodes, updateNode, connections } = useCanvasStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;
  
  // Check if component has real connections
  const hasConnections = connections.some(conn => conn.source === componentId || conn.target === componentId);

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as PostgreSQLConfig;
  const host = config.host || 'localhost';
  const port = config.port || 5432;
  const database = config.database || 'postgres';
  const username = config.username || 'postgres';
  const password = config.password || '';
  const currentSchema = config.currentSchema || 'public';
  // System schemas are configuration, not data
  const schemas = config.schemas || [
    { name: 'public', owner: 'postgres' },
    { name: 'information_schema', owner: 'postgres' },
  ];
  const tables = config.tables || [];
  const views = config.views || [];
  // Standard PostgreSQL system roles (configuration, not data)
  const roles = config.roles || [
    { name: 'postgres', login: true, superuser: true },
    { name: 'app_user', login: true, superuser: false },
    { name: 'readonly', login: true, superuser: false },
  ];
  const sqlQuery = config.sqlQuery || '';
  const queryResults = config.queryResults || [];
  const [queryEngine] = useState(() => new PostgreSQLQueryEngine());

  const updateConfig = (updates: Partial<PostgreSQLConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
    // Очистка ошибок валидации при успешном обновлении
    if (Object.keys(updates).some(key => ['host', 'port', 'database', 'username'].includes(key))) {
      const newErrors = { ...fieldErrors };
      Object.keys(updates).forEach(key => {
        if (newErrors[key]) delete newErrors[key];
      });
      setFieldErrors(newErrors);
    }
  };

  const [editingTable, setEditingTable] = useState<string | null>(null);
  const [newTableName, setNewTableName] = useState('');
  const [showCreateTable, setShowCreateTable] = useState(false);
  const [newTableColumns, setNewTableColumns] = useState<Column[]>([
    { name: 'id', type: 'SERIAL', nullable: false, primaryKey: true },
  ]);
  const [selectedTableForData, setSelectedTableForData] = useState<string>('');
  const [pgMetrics, setPgMetrics] = useState<any>(null);
  const [relationships, setRelationships] = useState<DrawDBRelationship[]>([]);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportContent, setExportContent] = useState('');
  const [exportType, setExportType] = useState<'sql' | 'mermaid' | 'dbml' | 'docs'>('sql');
  const [copied, setCopied] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importSQL, setImportSQL] = useState('');
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [showValidation, setShowValidation] = useState(false);
  
  // Синхронизация конфигурации с emulationEngine
  useEffect(() => {
    const pgEngine = emulationEngine.getPostgreSQLEmulationEngine(componentId);
    if (pgEngine) {
      // Обновить конфигурацию движка при изменении конфига
      pgEngine.updateConfig(config);
    }
  }, [componentId, config.host, config.port, config.database, config.username, config.tables, config.views, config.schemas]);
  
  // Синхронизация метрик из симуляции
  useEffect(() => {
    const interval = setInterval(() => {
      const pgEngine = emulationEngine.getPostgreSQLEmulationEngine(componentId);
      if (pgEngine) {
        const metrics = pgEngine.getMetrics();
        setPgMetrics(metrics);
      }
    }, 1000); // Обновлять каждую секунду
    
    return () => clearInterval(interval);
  }, [componentId]);
  
  // Валидация портов и хостов
  const { portError, hostError, portConflict } = usePortValidation(nodes, componentId, host, port);
  
  // Валидация обязательных полей
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  
  const requiredFields: RequiredField[] = [
    { field: 'host', label: 'Host' },
    { field: 'port', label: 'Port', validator: (v) => typeof v === 'number' && v > 0 && v <= 65535 },
    { field: 'database', label: 'Database' },
    { field: 'username', label: 'Username' },
  ];
  
  const validateConnectionFields = () => {
    const result = validateRequiredFields(
      { host, port, database, username },
      requiredFields
    );
    setFieldErrors(result.errors);
    return result.isValid;
  };

  const handleImportSQL = () => {
    if (!importSQL || !importSQL.trim()) {
      showError('SQL string is empty');
      return;
    }
    
    try {
      const result = importPostgreSQLSchema(importSQL);
      
      if (result.errors.length > 0) {
        setImportErrors(result.errors);
        // Still show errors but continue if we have tables
        if (result.tables.length === 0) {
          showError(`Import failed: ${result.errors.join(', ')}`);
          return;
        }
      } else {
        setImportErrors([]);
      }
      
      if (result.tables.length === 0) {
        showError('No tables found in SQL');
        return;
      }
      
      // Get current tables
      const currentTables = config.tables || tables;
      
      // Merge imported tables with existing ones
      // If table already exists, skip it (or could update it)
      const newTables = [...currentTables];
      let importedCount = 0;
      
      result.tables.forEach((importedTable) => {
        const exists = newTables.some(
          t => t.name === importedTable.name && t.schema === importedTable.schema
        );
        
        if (!exists) {
          newTables.push(importedTable);
          importedCount++;
        }
      });
      
      // Update config with new tables
      updateConfig({
        tables: newTables,
      });
      
      // Update relationships if any
      if (result.relationships.length > 0) {
        // Relationships will be automatically extracted by SchemaDiagram
        // But we can store them if needed
        setRelationships([...relationships, ...result.relationships]);
      }
      
      // Close dialog and show success
      setImportDialogOpen(false);
      setImportSQL('');
      setImportErrors([]);
      
      if (importedCount > 0) {
        showSuccess(`Successfully imported ${importedCount} table(s)`);
      } else {
        showError('All tables already exist');
      }
    } catch (error) {
      showError(`Import failed: ${error instanceof Error ? error.message : String(error)}`);
      setImportErrors([error instanceof Error ? error.message : String(error)]);
    }
  };

  const addTable = () => {
    if (newTableName && newTableName.trim()) {
      // Get current tables from config, fallback to default
      const currentTables = config.tables || tables;
      
      // Check if table with same name already exists
      const tableExists = currentTables.some(
        t => t.name === newTableName.trim() && t.schema === currentSchema
      );
      
      if (tableExists) {
        showError(`Таблица "${newTableName.trim()}" уже существует в схеме "${currentSchema}"`);
        return;
      }
      
      // Create new table
      const newTable = {
        name: newTableName.trim(),
        schema: currentSchema,
        columns: newTableColumns.map(col => ({ ...col })), // Deep copy
        indexes: [],
        constraints: [],
        data: [],
      };
      
      updateConfig({
        tables: [...currentTables, newTable],
      });
      
      // Reset form
      setNewTableName('');
      setNewTableColumns([{ name: 'id', type: 'SERIAL', nullable: false, primaryKey: true }]);
      setShowCreateTable(false);
      showSuccess(`Таблица "${newTableName.trim()}" успешно создана`);
    }
  };

  const addColumnToTable = (tableName: string) => {
    const newTables = [...tables];
    const tableIndex = newTables.findIndex(t => t.name === tableName && t.schema === currentSchema);
    if (tableIndex >= 0) {
      newTables[tableIndex].columns.push({
        name: 'new_column',
        type: 'VARCHAR(255)',
        nullable: true,
        primaryKey: false,
      });
      updateConfig({ tables: newTables });
      showSuccess(`Колонка добавлена в таблицу "${tableName}"`);
    }
  };

  const removeColumnFromTable = (tableName: string, columnIndex: number) => {
    const newTables = [...tables];
    const tableIndex = newTables.findIndex(t => t.name === tableName && t.schema === currentSchema);
    if (tableIndex >= 0 && newTables[tableIndex].columns.length > 1) {
      const columnName = newTables[tableIndex].columns[columnIndex]?.name || 'колонка';
      newTables[tableIndex].columns = newTables[tableIndex].columns.filter((_, i) => i !== columnIndex);
      updateConfig({ tables: newTables });
      showSuccess(`Колонка "${columnName}" удалена из таблицы "${tableName}"`);
    } else if (newTables[tableIndex]?.columns.length === 1) {
      showError('Нельзя удалить последнюю колонку в таблице');
    }
  };

  const updateColumnInTable = (tableName: string, columnIndex: number, field: string, value: any) => {
    const newTables = [...tables];
    const tableIndex = newTables.findIndex(t => t.name === tableName && t.schema === currentSchema);
    if (tableIndex >= 0) {
      newTables[tableIndex].columns[columnIndex] = {
        ...newTables[tableIndex].columns[columnIndex],
        [field]: value,
      };
      updateConfig({ tables: newTables });
    }
  };

  const removeConstraintFromTable = (tableName: string, constraintIndex: number) => {
    const newTables = [...tables];
    const tableIndex = newTables.findIndex(t => t.name === tableName && t.schema === currentSchema);
    if (tableIndex >= 0 && newTables[tableIndex].constraints) {
      newTables[tableIndex].constraints = newTables[tableIndex].constraints.filter((_, i) => i !== constraintIndex);
      updateConfig({ tables: newTables });
      showSuccess(`Constraint удален из таблицы "${tableName}"`);
    }
  };

  const [editingSchema, setEditingSchema] = useState<string | null>(null);
  const [newSchemaName, setNewSchemaName] = useState('');
  const [showCreateSchema, setShowCreateSchema] = useState(false);

  const addSchema = () => {
    if (newSchemaName && newSchemaName.trim()) {
      // Check if schema with same name already exists
      const schemaExists = schemas.some(s => s.name === newSchemaName.trim());
      
      if (schemaExists) {
        showError(`Схема "${newSchemaName.trim()}" уже существует`);
        return;
      }
      
      updateConfig({
        schemas: [...schemas, { name: newSchemaName.trim(), owner: username }],
      });
      
      // Reset form
      setNewSchemaName('');
      setShowCreateSchema(false);
      showSuccess(`Схема "${newSchemaName.trim()}" успешно создана`);
    }
  };

  const updateSchema = (oldName: string, field: 'name' | 'owner', value: string) => {
    const newSchemas = schemas.map(s => {
      if (s.name === oldName) {
        return { ...s, [field]: value };
      }
      return s;
    });
    
    // If schema name changed, update all tables and views that use this schema
    if (field === 'name' && value !== oldName) {
      // Check if new name already exists
      if (schemas.some(s => s.name === value && s.name !== oldName)) {
        showError(`Схема "${value}" уже существует`);
        return;
      }
      
      // Update tables
      const newTables = tables.map(t => {
        if (t.schema === oldName) {
          return { ...t, schema: value };
        }
        return t;
      });
      
      // Update views
      const newViews = views.map(v => {
        if (v.schema === oldName) {
          return { ...v, schema: value };
        }
        return v;
      });
      
      // Update currentSchema if it was the old name
      const newCurrentSchema = oldName === currentSchema ? value : currentSchema;
      
      updateConfig({
        schemas: newSchemas,
        tables: newTables,
        views: newViews,
        currentSchema: newCurrentSchema,
      });
      
      showSuccess(`Схема "${oldName}" переименована в "${value}"`);
    } else {
      updateConfig({ schemas: newSchemas });
      if (field === 'owner') {
        showSuccess(`Владелец схемы "${oldName}" изменен на "${value}"`);
      }
    }
  };

  const removeSchema = (schemaName: string) => {
    // Don't allow deleting current schema
    if (schemaName === currentSchema) {
      showError('Нельзя удалить текущую схему. Сначала выберите другую схему.');
      return;
    }
    
    // Check if schema has tables or views
    const hasTables = tables.some(t => t.schema === schemaName);
    const hasViews = views.some(v => v.schema === schemaName);
    
    if (hasTables || hasViews) {
      showError(`Нельзя удалить схему "${schemaName}" - в ней есть таблицы или представления. Сначала удалите их.`);
      return;
    }
    
    const newSchemas = schemas.filter(s => s.name !== schemaName);
    updateConfig({ schemas: newSchemas });
    showSuccess(`Схема "${schemaName}" успешно удалена`);
  };

  const [editingView, setEditingView] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<string | null>(null);

  const addView = () => {
    const newViewName = 'new_view';
    // Check if view with same name already exists in current schema
    const viewExists = views.some(v => v.name === newViewName && v.schema === currentSchema);
    
    if (viewExists) {
      showError(`Представление "${newViewName}" уже существует в схеме "${currentSchema}"`);
      return;
    }
    
    updateConfig({
      views: [...views, {
        name: newViewName,
        schema: currentSchema,
        definition: 'SELECT * FROM table_name',
      }],
    });
    showSuccess('Представление успешно создано');
  };

  const updateView = (oldName: string, schema: string, field: 'name' | 'schema' | 'definition', value: string) => {
    const newViews = views.map(v => {
      if (v.name === oldName && v.schema === schema) {
        return { ...v, [field]: value };
      }
      return v;
    });
    
    // If view name or schema changed, check for duplicates
    if (field === 'name' || field === 'schema') {
      const newName = field === 'name' ? value : oldName;
      const newSchema = field === 'schema' ? value : schema;
      const duplicate = newViews.some(v => v.name === newName && v.schema === newSchema && !(v.name === oldName && v.schema === schema));
      if (duplicate) {
        showError(`Представление "${newName}" уже существует в схеме "${newSchema}"`);
        return;
      }
    }
    
    updateConfig({ views: newViews });
    if (field === 'name') {
      showSuccess(`Представление "${oldName}" переименовано в "${value}"`);
    } else if (field === 'definition') {
      showSuccess(`Определение представления "${oldName}" обновлено`);
    }
  };

  const removeView = (viewName: string, viewSchema: string) => {
    const newViews = views.filter(v => !(v.name === viewName && v.schema === viewSchema));
    updateConfig({ views: newViews });
    showSuccess(`Представление "${viewName}" успешно удалено`);
  };

  const addRole = () => {
    const newRoleName = 'new_role';
    // Check if role with same name already exists
    const roleExists = roles.some(r => r.name === newRoleName);
    
    if (roleExists) {
      showError(`Роль "${newRoleName}" уже существует`);
      return;
    }
    
    updateConfig({
      roles: [...roles, { name: newRoleName, login: false, superuser: false }],
    });
    showSuccess('Роль успешно создана');
  };

  const updateRole = (oldName: string, field: 'name' | 'login' | 'superuser', value: string | boolean) => {
    const newRoles = roles.map(r => {
      if (r.name === oldName) {
        return { ...r, [field]: value };
      }
      return r;
    });
    
    // If role name changed, check for duplicates
    if (field === 'name' && typeof value === 'string') {
      if (roles.some(r => r.name === value && r.name !== oldName)) {
        showError(`Роль "${value}" уже существует`);
        return;
      }
    }
    
    updateConfig({ roles: newRoles });
    if (field === 'name') {
      showSuccess(`Роль "${oldName}" переименована в "${value}"`);
    } else {
      showSuccess(`Роль "${oldName}" обновлена`);
    }
  };

  const removeRole = (roleName: string) => {
    // Don't allow deleting system roles
    if (roleName === 'postgres') {
      showError('Нельзя удалить системную роль "postgres"');
      return;
    }
    
    const newRoles = roles.filter(r => r.name !== roleName);
    updateConfig({ roles: newRoles });
    showSuccess(`Роль "${roleName}" успешно удалена`);
  };

  const filteredTables = tables.filter(t => t.schema === currentSchema);
  const filteredViews = views.filter(v => v.schema === currentSchema);
  
  // Initialize selected table if not set
  if (!selectedTableForData && filteredTables.length > 0) {
    setSelectedTableForData(filteredTables[0].name);
  }
  
  // Update selected table when schema changes
  if (selectedTableForData && !filteredTables.find(t => t.name === selectedTableForData)) {
    setSelectedTableForData(filteredTables[0]?.name || '');
  }

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Database className="h-6 w-6 text-blue-500" />
            </div>
            <div>
              <PageTitle>PostgreSQL</PageTitle>
              <Description>
                Database: {database} @ {host}:{port}
              </Description>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-2">
              <div className={`h-2 w-2 rounded-full ${hasConnections ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
              {hasConnections ? 'Connected' : 'Not Connected'}
            </Badge>
            <Button size="sm" variant="outline">
              <FileCode className="h-4 w-4 mr-2" />
              Query Tool
            </Button>
          </div>
        </div>

        <Separator />

        {/* Main Configuration Tabs */}
        <Tabs defaultValue="schemas" className="w-full">
          <TabsList className="flex flex-wrap w-full gap-1">
            <TabsTrigger value="schemas" className="gap-2">
              <FolderTree className="h-4 w-4" />
              Schemas
            </TabsTrigger>
            <TabsTrigger value="tables" className="gap-2">
              <Table className="h-4 w-4" />
              Tables
            </TabsTrigger>
            <TabsTrigger value="diagram" className="gap-2">
              <Network className="h-4 w-4" />
              Schema Diagram
            </TabsTrigger>
            <TabsTrigger value="data" className="gap-2">
              <Search className="h-4 w-4" />
              Data Editor
            </TabsTrigger>
            <TabsTrigger value="query" className="gap-2">
              <FileCode className="h-4 w-4" />
              Query Tool
            </TabsTrigger>
            <TabsTrigger value="views" className="gap-2">
              <Eye className="h-4 w-4" />
              Views
            </TabsTrigger>
            <TabsTrigger value="roles" className="gap-2">
              <Users className="h-4 w-4" />
              Roles
            </TabsTrigger>
            <TabsTrigger value="metrics" className="gap-2">
              <Activity className="h-4 w-4" />
              Metrics
            </TabsTrigger>
            <TabsTrigger value="connection" className="gap-2">
              <Settings className="h-4 w-4" />
              Connection
            </TabsTrigger>
          </TabsList>

          {/* Schemas Tab */}
          <TabsContent value="schemas" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Database Schemas</CardTitle>
                    <CardDescription>Schema organization and management</CardDescription>
                  </div>
                  <Button size="sm" onClick={() => setShowCreateSchema(true)} variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Schema
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {showCreateSchema && (
                    <Card className="border-dashed border-2">
                      <CardContent className="pt-6">
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label>Schema Name</Label>
                            <Input
                              value={newSchemaName}
                              onChange={(e) => setNewSchemaName(e.target.value)}
                              placeholder="Enter schema name"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  addSchema();
                                } else if (e.key === 'Escape') {
                                  setShowCreateSchema(false);
                                  setNewSchemaName('');
                                }
                              }}
                              autoFocus
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" onClick={addSchema}>
                              Create
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setShowCreateSchema(false);
                                setNewSchemaName('');
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  {schemas.map((schema, index) => (
                    <Card key={index} className="border-border">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            <div className="p-2 rounded bg-primary/10">
                              <FolderTree className="h-4 w-4 text-primary" />
                            </div>
                            {editingSchema === schema.name ? (
                              <div className="flex-1 space-y-2">
                                <Input
                                  value={schema.name}
                                  onChange={(e) => updateSchema(schema.name, 'name', e.target.value)}
                                  className="font-semibold"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      setEditingSchema(null);
                                    } else if (e.key === 'Escape') {
                                      setEditingSchema(null);
                                    }
                                  }}
                                  autoFocus
                                />
                                <Input
                                  value={schema.owner}
                                  onChange={(e) => updateSchema(schema.name, 'owner', e.target.value)}
                                  className="text-sm"
                                  placeholder="Owner"
                                />
                              </div>
                            ) : (
                              <div className="flex-1">
                                <CardTitle className="text-lg">{schema.name}</CardTitle>
                                <CardDescription className="text-xs mt-1">
                                  Owner: {schema.owner}
                                </CardDescription>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {schema.name === currentSchema && (
                              <Badge variant="default">Current</Badge>
                            )}
                            {editingSchema === schema.name ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setEditingSchema(null)}
                                >
                                  Save
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setEditingSchema(null)}
                                >
                                  Cancel
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => updateConfig({ currentSchema: schema.name })}
                                >
                                  Use
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setEditingSchema(schema.name)}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => removeSchema(schema.name)}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tables Tab */}
          <TabsContent value="tables" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Tables in Schema: {currentSchema}</CardTitle>
                    <CardDescription>Table structure and columns</CardDescription>
                  </div>
                  <Button size="sm" onClick={() => setShowCreateTable(true)} variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Table
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Create Table Dialog */}
                {showCreateTable && (
                  <Card className="mb-4 border-primary">
                    <CardHeader>
                      <CardTitle>Create New Table</CardTitle>
                      <CardDescription>Define table structure</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label>Table Name</Label>
                        <Input
                          value={newTableName}
                          onChange={(e) => setNewTableName(e.target.value)}
                          placeholder="table_name"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <Label>Columns</Label>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setNewTableColumns([...newTableColumns, { name: 'new_column', type: 'VARCHAR(255)', nullable: true }])}
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Add Column
                          </Button>
                        </div>
                        <div className="border rounded-lg overflow-hidden">
                          <table className="w-full text-sm">
                            <thead className="bg-muted">
                              <tr>
                                <th className="text-left p-2 font-medium">Name</th>
                                <th className="text-left p-2 font-medium">Type</th>
                                <th className="text-left p-2 font-medium">Nullable</th>
                                <th className="text-left p-2 font-medium">Default</th>
                                <th className="text-left p-2 font-medium">Primary Key</th>
                                <th className="text-left p-2 font-medium"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {newTableColumns.map((col, colIndex) => (
                                <tr key={colIndex} className="border-t">
                                  <td className="p-2">
                                    <Input
                                      value={col.name}
                                      onChange={(e) => {
                                        const newCols = [...newTableColumns];
                                        newCols[colIndex].name = e.target.value;
                                        setNewTableColumns(newCols);
                                      }}
                                      className="h-8"
                                      placeholder="column_name"
                                    />
                                  </td>
                                  <td className="p-2">
                                    <Select
                                      value={col.type}
                                      onValueChange={(value) => {
                                        const newCols = [...newTableColumns];
                                        newCols[colIndex].type = value;
                                        setNewTableColumns(newCols);
                                      }}
                                    >
                                      <SelectTrigger className="h-8">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="SERIAL">SERIAL</SelectItem>
                                        <SelectItem value="INTEGER">INTEGER</SelectItem>
                                        <SelectItem value="BIGINT">BIGINT</SelectItem>
                                        <SelectItem value="VARCHAR(255)">VARCHAR(255)</SelectItem>
                                        <SelectItem value="TEXT">TEXT</SelectItem>
                                        <SelectItem value="DECIMAL(10,2)">DECIMAL(10,2)</SelectItem>
                                        <SelectItem value="BOOLEAN">BOOLEAN</SelectItem>
                                        <SelectItem value="TIMESTAMP">TIMESTAMP</SelectItem>
                                        <SelectItem value="DATE">DATE</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </td>
                                  <td className="p-2">
                                    <Select
                                      value={col.nullable ? 'true' : 'false'}
                                      onValueChange={(value) => {
                                        const newCols = [...newTableColumns];
                                        newCols[colIndex].nullable = value === 'true';
                                        setNewTableColumns(newCols);
                                      }}
                                    >
                                      <SelectTrigger className="h-8">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="true">NULL</SelectItem>
                                        <SelectItem value="false">NOT NULL</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </td>
                                  <td className="p-2">
                                    <Input
                                      value={col.default || ''}
                                      onChange={(e) => {
                                        const newCols = [...newTableColumns];
                                        newCols[colIndex].default = e.target.value;
                                        setNewTableColumns(newCols);
                                      }}
                                      className="h-8"
                                      placeholder="default value"
                                    />
                                  </td>
                                  <td className="p-2">
                                    <input
                                      type="checkbox"
                                      checked={col.primaryKey || false}
                                      onChange={(e) => {
                                        const newCols = [...newTableColumns];
                                        newCols[colIndex].primaryKey = e.target.checked;
                                        setNewTableColumns(newCols);
                                      }}
                                      className="h-4 w-4"
                                    />
                                  </td>
                                  <td className="p-2">
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => setNewTableColumns(newTableColumns.filter((_, i) => i !== colIndex))}
                                      disabled={newTableColumns.length <= 1}
                                      title={newTableColumns.length <= 1 ? 'Нельзя удалить последнюю колонку' : 'Удалить колонку'}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          onClick={addTable}
                          disabled={!newTableName || !newTableName.trim()}
                        >
                          Create Table
                        </Button>
                        <Button 
                          variant="outline" 
                          onClick={() => {
                            setShowCreateTable(false);
                            setNewTableName('');
                            setNewTableColumns([{ name: 'id', type: 'SERIAL', nullable: false, primaryKey: true }]);
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                      {!newTableName && (
                        <p className="text-sm text-muted-foreground">Please enter a table name</p>
                      )}
                    </CardContent>
                  </Card>
                )}

                <div className="space-y-4">
                  {filteredTables.map((table, index) => (
                    <Card key={index} className="border-border">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded bg-primary/10">
                              <Table className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <CardTitle className="text-lg">{table.name}</CardTitle>
                              <CardDescription className="text-xs mt-1">
                                Schema: {table.schema} • {table.columns.length} columns • {table.indexes.length} indexes
                              </CardDescription>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingTable(editingTable === table.name ? null : table.name)}
                            >
                              {editingTable === table.name ? 'Done' : 'Edit Structure'}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                const tableName = table.name;
                                updateConfig({ tables: tables.filter((_, i) => {
                                  const t = tables[i];
                                  return !(t.name === table.name && t.schema === currentSchema);
                                })});
                                showSuccess(`Таблица "${tableName}" удалена`);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Columns - Editable */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <Label className="text-sm font-semibold">Columns</Label>
                            {editingTable === table.name && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => addColumnToTable(table.name)}
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                Add Column
                              </Button>
                            )}
                          </div>
                          <div className="border rounded-lg overflow-hidden">
                            <table className="w-full text-sm">
                              <thead className="bg-muted">
                                <tr>
                                  <th className="text-left p-2 font-medium">Name</th>
                                  <th className="text-left p-2 font-medium">Type</th>
                                  <th className="text-left p-2 font-medium">Nullable</th>
                                  <th className="text-left p-2 font-medium">Default</th>
                                  <th className="text-left p-2 font-medium">Key</th>
                                  {editingTable === table.name && (
                                    <th className="text-left p-2 font-medium"></th>
                                  )}
                                </tr>
                              </thead>
                              <tbody>
                                {table.columns.map((col, colIndex) => (
                                  <tr key={colIndex} className="border-t">
                                    <td className="p-2">
                                      {editingTable === table.name ? (
                                        <Input
                                          value={col.name}
                                          onChange={(e) => updateColumnInTable(table.name, colIndex, 'name', e.target.value)}
                                          className="h-8 font-mono"
                                        />
                                      ) : (
                                        <span className="font-mono">{col.name}</span>
                                      )}
                                    </td>
                                    <td className="p-2">
                                      {editingTable === table.name ? (
                                        <Select
                                          value={col.type}
                                          onValueChange={(value) => updateColumnInTable(table.name, colIndex, 'type', value)}
                                        >
                                          <SelectTrigger className="h-8">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="SERIAL">SERIAL</SelectItem>
                                            <SelectItem value="INTEGER">INTEGER</SelectItem>
                                            <SelectItem value="BIGINT">BIGINT</SelectItem>
                                            <SelectItem value="VARCHAR(255)">VARCHAR(255)</SelectItem>
                                            <SelectItem value="TEXT">TEXT</SelectItem>
                                            <SelectItem value="DECIMAL(10,2)">DECIMAL(10,2)</SelectItem>
                                            <SelectItem value="BOOLEAN">BOOLEAN</SelectItem>
                                            <SelectItem value="TIMESTAMP">TIMESTAMP</SelectItem>
                                            <SelectItem value="DATE">DATE</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      ) : (
                                        <span className="text-muted-foreground">{col.type}</span>
                                      )}
                                    </td>
                                    <td className="p-2">
                                      {editingTable === table.name ? (
                                        <Select
                                          value={col.nullable ? 'true' : 'false'}
                                          onValueChange={(value) => updateColumnInTable(table.name, colIndex, 'nullable', value === 'true')}
                                        >
                                          <SelectTrigger className="h-8">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="true">NULL</SelectItem>
                                            <SelectItem value="false">NOT NULL</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      ) : (
                                        col.nullable ? (
                                          <Badge variant="outline">NULL</Badge>
                                        ) : (
                                          <Badge variant="secondary">NOT NULL</Badge>
                                        )
                                      )}
                                    </td>
                                    <td className="p-2">
                                      {editingTable === table.name ? (
                                        <Input
                                          value={col.default || ''}
                                          onChange={(e) => updateColumnInTable(table.name, colIndex, 'default', e.target.value)}
                                          className="h-8"
                                          placeholder="default"
                                        />
                                      ) : (
                                        <span className="text-muted-foreground">{col.default || '-'}</span>
                                      )}
                                    </td>
                                    <td className="p-2">
                                      {editingTable === table.name ? (
                                        <input
                                          type="checkbox"
                                          checked={col.primaryKey || false}
                                          onChange={(e) => updateColumnInTable(table.name, colIndex, 'primaryKey', e.target.checked)}
                                          className="h-4 w-4"
                                        />
                                      ) : (
                                        col.primaryKey && (
                                          <Badge variant="default" className="gap-1">
                                            <Key className="h-3 w-3" />
                                            PK
                                          </Badge>
                                        )
                                      )}
                                    </td>
                                    {editingTable === table.name && (
                                      <td className="p-2">
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          onClick={() => removeColumnFromTable(table.name, colIndex)}
                                          disabled={table.columns.length <= 1}
                                          title={table.columns.length <= 1 ? 'Нельзя удалить последнюю колонку' : 'Удалить колонку'}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </td>
                                    )}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Indexes */}
                        {table.indexes.length > 0 && (
                          <div>
                            <Label className="text-sm font-semibold mb-2 block">Indexes</Label>
                            <div className="space-y-1">
                              {table.indexes.map((idx, idxIndex) => (
                                <div key={idxIndex} className="flex items-center gap-2 p-2 border rounded text-sm">
                                  <Key className="h-3 w-3 text-muted-foreground" />
                                  <span className="font-mono">{idx}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Constraints */}
                        {table.constraints.length > 0 && (
                          <div>
                            <Label className="text-sm font-semibold mb-2 block">Constraints</Label>
                            <div className="space-y-1">
                              {table.constraints.map((constraint, constIndex) => (
                                <div key={constIndex} className="flex items-center justify-between p-2 border rounded text-sm">
                                  <span className="font-mono text-muted-foreground">{constraint}</span>
                                  {editingTable === table.name && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => removeConstraintFromTable(table.name, constIndex)}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Schema Diagram Tab */}
          <TabsContent value="diagram" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Schema Diagram</CardTitle>
                    <CardDescription>
                      Visual representation of database schema with tables and relationships.
                      <br />
                      <span className="text-xs text-muted-foreground mt-2 block">
                        💡 <strong>Как создать связь:</strong> Кликните на поле в одной таблице, затем кликните на поле в другой таблице. 
                        Связь создастся автоматически. Для удаления связи кликните на неё.
                      </span>
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const result = validateSchema(tables, relationships);
                        setValidationResult(result);
                        setShowValidation(true);
                      }}
                    >
                      <AlertCircle className="h-4 w-4 mr-2" />
                      Validate Schema
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setImportSQL('');
                        setImportErrors([]);
                        setImportDialogOpen(true);
                      }}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Import SQL
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Upload className="h-4 w-4 mr-2" />
                          Export
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            const sql = exportPostgreSQLSchema(tables, relationships);
                            setExportContent(sql);
                            setExportType('sql');
                            setExportDialogOpen(true);
                          }}
                        >
                          <FileCode className="h-4 w-4 mr-2" />
                          Export SQL
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            const mermaid = exportMermaidSchema(tables, relationships);
                            setExportContent(mermaid);
                            setExportType('mermaid');
                            setExportDialogOpen(true);
                          }}
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          Export Mermaid
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            const dbml = exportDBMLSchema(tables, relationships);
                            setExportContent(dbml);
                            setExportType('dbml');
                            setExportDialogOpen(true);
                          }}
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          Export DBML
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            const docs = exportDocumentationSchema(tables, relationships, database);
                            setExportContent(docs);
                            setExportType('docs');
                            setExportDialogOpen(true);
                          }}
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          Export Documentation
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={async () => {
                            try {
                              // Find the schema diagram container
                              const container = document.querySelector('.schema-diagram-container > div') as HTMLElement;
                              if (!container) {
                                showError('Schema diagram not found');
                                return;
                              }
                              
                              const { toPng } = await import('html-to-image');
                              const dataUrl = await toPng(container, {
                                quality: 1.0,
                                pixelRatio: 2,
                                backgroundColor: 'white',
                              });
                              
                              const link = document.createElement('a');
                              link.download = 'schema-diagram.png';
                              link.href = dataUrl;
                              link.click();
                              showSuccess('PNG exported successfully');
                            } catch (error) {
                              showError('Failed to export PNG');
                              console.error(error);
                            }
                          }}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Export PNG
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={async () => {
                            try {
                              // Find the schema diagram container
                              const container = document.querySelector('.schema-diagram-container > div') as HTMLElement;
                              if (!container) {
                                showError('Schema diagram not found');
                                return;
                              }
                              
                              const { toJpeg } = await import('html-to-image');
                              const dataUrl = await toJpeg(container, {
                                quality: 0.95,
                                pixelRatio: 2,
                                backgroundColor: 'white',
                              });
                              
                              const link = document.createElement('a');
                              link.download = 'schema-diagram.jpg';
                              link.href = dataUrl;
                              link.click();
                              showSuccess('JPEG exported successfully');
                            } catch (error) {
                              showError('Failed to export JPEG');
                              console.error(error);
                            }
                          }}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Export JPEG
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-[600px] min-h-[400px] schema-diagram-container">
                  <SchemaDiagram
                    tables={tables}
                    tablePositions={config.diagramPositions || {}}
                    onTableUpdate={(tableId, updates) => {
                      // Update table position in config
                      if (updates.x !== undefined || updates.y !== undefined) {
                        const tableKey = tableId.replace(/^table_/, ''); // Remove "table_" prefix
                        const newPositions = {
                          ...(config.diagramPositions || {}),
                          [tableKey]: {
                            x: updates.x ?? config.diagramPositions?.[tableKey]?.x ?? 100,
                            y: updates.y ?? config.diagramPositions?.[tableKey]?.y ?? 100,
                          },
                        };
                        updateConfig({ diagramPositions: newPositions });
                      }
                    }}
                    onRelationshipAdd={(relationship) => {
                      // Create foreign key constraint from relationship
                      const startTableKey = relationship.startTableId.replace(/^table_/, '').replace(/_/g, '.');
                      const endTableKey = relationship.endTableId.replace(/^table_/, '').replace(/_/g, '.');
                      
                      const startTable = tables.find(t => {
                        const tableKey = `${t.schema}.${t.name}`;
                        return relationship.startTableId === `table_${t.schema}_${t.name}` || startTableKey === tableKey;
                      });
                      const endTable = tables.find(t => {
                        const tableKey = `${t.schema}.${t.name}`;
                        return relationship.endTableId === `table_${t.schema}_${t.name}` || endTableKey === tableKey;
                      });
                      
                      if (!startTable || !endTable) return;
                      
                      const startField = startTable.columns.find((col, idx) => {
                        const fieldId = `field_${startTable.name}_${col.name}_${idx}`;
                        return relationship.startFieldId === fieldId || relationship.startFieldId.includes(col.name);
                      });
                      const endField = endTable.columns.find((col, idx) => {
                        const fieldId = `field_${endTable.name}_${col.name}_${idx}`;
                        return relationship.endFieldId === fieldId || relationship.endFieldId.includes(col.name);
                      });
                      
                      if (!startField || !endField) return;
                      
                      const constraint = `FOREIGN KEY (${startField.name}) REFERENCES ${endTable.name}(${endField.name}) ON DELETE ${relationship.constraint === 'Cascade' ? 'CASCADE' : relationship.constraint === 'Restrict' ? 'RESTRICT' : relationship.constraint === 'Set null' ? 'SET NULL' : 'NO ACTION'}`;
                      
                      const newTables = [...tables];
                      const tableIndex = newTables.findIndex(t => t.name === startTable.name && t.schema === startTable.schema);
                      if (tableIndex >= 0) {
                        if (!newTables[tableIndex].constraints) {
                          newTables[tableIndex].constraints = [];
                        }
                        newTables[tableIndex].constraints.push(constraint);
                        updateConfig({ tables: newTables });
                        showSuccess(`Foreign key constraint добавлен: ${startTable.name}.${startField.name} → ${endTable.name}.${endField.name}`);
                      }
                    }}
                    onRelationshipDelete={(relationshipId) => {
                      // Find and remove constraint
                      const relationship = relationships.find(r => r.id === relationshipId);
                      if (!relationship) return;
                      
                      const startTableKey = relationship.startTableId.replace(/^table_/, '').replace(/_/g, '.');
                      const startTable = tables.find(t => {
                        const tableKey = `${t.schema}.${t.name}`;
                        return relationship.startTableId === `table_${t.schema}_${t.name}` || startTableKey === tableKey;
                      });
                      
                      if (!startTable) return;
                      
                      // Find field name from field ID
                      const fieldNameMatch = relationship.startFieldId.match(/field_\w+_(\w+)_\d+/);
                      const fieldName = fieldNameMatch ? fieldNameMatch[1] : '';
                      
                      const newTables = [...tables];
                      const tableIndex = newTables.findIndex(t => t.name === startTable.name && t.schema === startTable.schema);
                      if (tableIndex >= 0 && newTables[tableIndex].constraints) {
                        newTables[tableIndex].constraints = newTables[tableIndex].constraints.filter(c => {
                          // Remove constraint that matches this field
                          if (c.includes('FOREIGN KEY') && fieldName && c.includes(`(${fieldName})`)) {
                            return false;
                          }
                          return true;
                        });
                        updateConfig({ tables: newTables });
                        showSuccess('Foreign key constraint удален');
                      }
                    }}
                    onRelationshipsChange={(rels) => {
                      setRelationships(rels);
                    }}
                    onAutoArrange={(positions) => {
                      updateConfig({ diagramPositions: positions });
                    }}
                  />
                </div>
                
                {/* Export Dialog */}
                <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
                  <DialogContent className="max-w-4xl max-h-[80vh]">
                    <DialogHeader>
                      <DialogTitle>
                        Export {exportType === 'sql' ? 'SQL' : exportType === 'mermaid' ? 'Mermaid' : exportType === 'dbml' ? 'DBML' : 'Documentation'}
                      </DialogTitle>
                      <DialogDescription>
                        {exportType === 'sql' && 'PostgreSQL SQL schema definition'}
                        {exportType === 'mermaid' && 'Mermaid ER diagram format'}
                        {exportType === 'dbml' && 'DBML format for dbdiagram.io'}
                        {exportType === 'docs' && 'Markdown documentation'}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(exportContent);
                              setCopied(true);
                              setTimeout(() => setCopied(false), 2000);
                              showSuccess('Copied to clipboard');
                            } catch (err) {
                              showError('Failed to copy to clipboard');
                            }
                          }}
                        >
                          {copied ? (
                            <>
                              <Check className="h-4 w-4 mr-2" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="h-4 w-4 mr-2" />
                              Copy
                            </>
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const blob = new Blob([exportContent], {
                              type: exportType === 'sql' ? 'text/sql' :
                                    exportType === 'mermaid' ? 'text/plain' :
                                    exportType === 'dbml' ? 'text/plain' :
                                    'text/markdown',
                            });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `schema.${exportType === 'sql' ? 'sql' : exportType === 'mermaid' ? 'mmd' : exportType === 'dbml' ? 'dbml' : 'md'}`;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            URL.revokeObjectURL(url);
                            showSuccess('File downloaded');
                          }}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </Button>
                      </div>
                      <Textarea
                        value={exportContent}
                        readOnly
                        className="font-mono text-sm h-[400px] resize-none"
                      />
                    </div>
                  </DialogContent>
                </Dialog>
                
                {/* Import Dialog */}
                <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
                  <DialogContent className="max-w-4xl max-h-[80vh]">
                    <DialogHeader>
                      <DialogTitle>Import SQL Schema</DialogTitle>
                      <DialogDescription>
                        Paste PostgreSQL CREATE TABLE and ALTER TABLE statements to import tables and relationships
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setImportSQL('');
                            setImportErrors([]);
                          }}
                        >
                          Clear
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={handleImportSQL}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Import
                        </Button>
                      </div>
                      {importErrors.length > 0 && (
                        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                          <div className="text-sm font-medium text-destructive mb-2">Import Errors:</div>
                          <ul className="text-sm text-destructive/80 list-disc list-inside space-y-1">
                            {importErrors.map((error, idx) => (
                              <li key={idx}>{error}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <Textarea
                        value={importSQL}
                        onChange={(e) => setImportSQL(e.target.value)}
                        placeholder="Paste SQL here, e.g.&#10;&#10;CREATE TABLE users (&#10;  id SERIAL PRIMARY KEY,&#10;  username VARCHAR(255) NOT NULL&#10;);&#10;&#10;CREATE TABLE orders (&#10;  id SERIAL PRIMARY KEY,&#10;  user_id INTEGER NOT NULL&#10;);&#10;&#10;ALTER TABLE orders&#10;ADD FOREIGN KEY (user_id) REFERENCES users(id)&#10;ON DELETE CASCADE;"
                        className="font-mono text-sm h-[400px] resize-none"
                      />
                    </div>
                  </DialogContent>
                </Dialog>
                
                {/* Validation Dialog */}
                <Dialog open={showValidation} onOpenChange={setShowValidation}>
                  <DialogContent className="max-w-4xl max-h-[80vh]">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        {validationResult?.valid ? (
                          <>
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                            Schema Validation - Valid
                          </>
                        ) : (
                          <>
                            <AlertCircle className="h-5 w-5 text-destructive" />
                            Schema Validation - Errors Found
                          </>
                        )}
                      </DialogTitle>
                      <DialogDescription>
                        {validationResult?.valid
                          ? 'Schema is valid with no errors'
                          : `${validationResult?.errors.length || 0} error(s) and ${validationResult?.warnings.length || 0} warning(s) found`}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      {validationResult && (
                        <>
                          {validationResult.errors.length > 0 && (
                            <Alert variant="destructive">
                              <AlertCircle className="h-4 w-4" />
                              <AlertTitle>Errors ({validationResult.errors.length})</AlertTitle>
                              <AlertDescription>
                                <ul className="list-disc list-inside space-y-1 mt-2">
                                  {validationResult.errors.map((error, idx) => (
                                    <li key={idx}>
                                      {error.table && <strong>{error.table}</strong>}
                                      {error.column && ` → ${error.column}`}
                                      {error.relationship && ` (${error.relationship})`}
                                      : {error.message}
                                    </li>
                                  ))}
                                </ul>
                              </AlertDescription>
                            </Alert>
                          )}
                          {validationResult.warnings.length > 0 && (
                            <Alert>
                              <AlertCircle className="h-4 w-4" />
                              <AlertTitle>Warnings ({validationResult.warnings.length})</AlertTitle>
                              <AlertDescription>
                                <ul className="list-disc list-inside space-y-1 mt-2">
                                  {validationResult.warnings.map((warning, idx) => (
                                    <li key={idx}>
                                      {warning.table && <strong>{warning.table}</strong>}
                                      {warning.column && ` → ${warning.column}`}
                                      {warning.relationship && ` (${warning.relationship})`}
                                      : {warning.message}
                                    </li>
                                  ))}
                                </ul>
                              </AlertDescription>
                            </Alert>
                          )}
                          {validationResult.errors.length === 0 && validationResult.warnings.length === 0 && (
                            <Alert>
                              <CheckCircle2 className="h-4 w-4" />
                              <AlertTitle>Schema is Valid</AlertTitle>
                              <AlertDescription>
                                No errors or warnings found in the schema.
                              </AlertDescription>
                            </Alert>
                          )}
                        </>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Data Editor Tab */}
          <TabsContent value="data" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Data Editor</CardTitle>
                    <CardDescription>View and edit table data</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={currentSchema}
                      onValueChange={(value) => updateConfig({ currentSchema: value })}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {schemas.map((s) => (
                          <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={filteredTables[0]?.name || ''}
                      onValueChange={() => {}}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Select table" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredTables.map((t) => (
                          <SelectItem key={t.name} value={t.name}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (filteredTables.length > 0) {
                          const newTables = [...tables];
                          const tableIndex = newTables.findIndex(t => t.name === filteredTables[0].name && t.schema === currentSchema);
                          if (tableIndex >= 0) {
                            const newRow: TableRow = {};
                            newTables[tableIndex].columns.forEach(col => {
                              if (col.default) {
                                newRow[col.name] = col.default;
                              } else if (col.type.includes('SERIAL')) {
                                newRow[col.name] = 'AUTO';
                              } else {
                                newRow[col.name] = '';
                              }
                            });
                            if (!newTables[tableIndex].data) {
                              newTables[tableIndex].data = [];
                            }
                            newTables[tableIndex].data!.push(newRow);
                            updateConfig({ tables: newTables });
                          }
                        }
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Insert Row
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {(() => {
                  const tableName = selectedTableForData || filteredTables[0]?.name;
                  const selectedTable = filteredTables.find(t => t.name === tableName);
                  
                  if (!selectedTable) {
                    return (
                      <div className="text-center py-8 text-muted-foreground">
                        <Table className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>Select a table to view and edit data</p>
                      </div>
                    );
                  }

                  if (!selectedTable.data || selectedTable.data.length === 0) {
                    return (
                      <div className="text-center py-8 text-muted-foreground">
                        <Table className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>No data in table. Click "Insert Row" to add data.</p>
                      </div>
                    );
                  }

                  return (
                    <div className="border rounded-lg overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted">
                          <tr>
                            {selectedTable.columns.map((col) => (
                              <th key={col.name} className="text-left p-2 font-medium border-r">
                                {col.name}
                                {col.primaryKey && (
                                  <Key className="h-3 w-3 inline ml-1 text-primary" />
                                )}
                              </th>
                            ))}
                            <th className="text-left p-2 font-medium">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedTable.data.map((row, rowIndex) => (
                            <tr key={rowIndex} className="border-t hover:bg-muted/50">
                              {selectedTable.columns.map((col) => (
                                <td key={col.name} className="p-1 border-r">
                                  <Input
                                    value={row[col.name] !== undefined ? String(row[col.name]) : ''}
                                    onChange={(e) => {
                                      const newTables = [...tables];
                                      const tableIndex = newTables.findIndex(t => t.name === tableName && t.schema === currentSchema);
                                      if (tableIndex >= 0 && newTables[tableIndex].data) {
                                        newTables[tableIndex].data![rowIndex] = {
                                          ...newTables[tableIndex].data![rowIndex],
                                          [col.name]: e.target.value,
                                        };
                                        updateConfig({ tables: newTables });
                                      }
                                    }}
                                    className="border-0 p-1 h-8 bg-transparent hover:bg-muted/50 focus:bg-background focus:border focus:border-primary"
                                    placeholder={col.default || (col.nullable ? 'NULL' : 'required')}
                                    disabled={col.type.includes('SERIAL') && String(row[col.name]) === 'AUTO'}
                                  />
                                </td>
                              ))}
                              <td className="p-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-destructive"
                                  onClick={() => {
                                    const newTables = [...tables];
                                    const tableIndex = newTables.findIndex(t => t.name === tableName && t.schema === currentSchema);
                                    if (tableIndex >= 0 && newTables[tableIndex].data) {
                                      newTables[tableIndex].data = newTables[tableIndex].data!.filter((_, i) => i !== rowIndex);
                                      updateConfig({ tables: newTables });
                                    }
                                  }}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Query Tool Tab */}
          <TabsContent value="query" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Query Tool</CardTitle>
                    <CardDescription>Execute SQL queries and commands</CardDescription>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      if (!sqlQuery || !sqlQuery.trim()) {
                        showError('Please enter a SQL query');
                        return;
                      }

                      try {
                        // Extract indexes from tables
                        const indexes: PostgreSQLIndex[] = [];
                        for (const table of tables) {
                          for (const indexName of table.indexes || []) {
                            const match = indexName.match(/CREATE\s+(?:UNIQUE\s+)?INDEX\s+(\w+)\s+ON\s+\w+\s*\(([^)]+)\)/i);
                            if (match) {
                              indexes.push({
                                name: match[1],
                                table: table.name,
                                schema: table.schema,
                                columns: match[2].split(',').map((c) => c.trim()),
                                unique: indexName.toUpperCase().includes('UNIQUE'),
                              });
                            }
                          }
                        }

                        // Convert tables to PostgreSQLTable format
                        const pgTables: PostgreSQLTable[] = tables.map(t => ({
                          name: t.name,
                          schema: t.schema,
                          columns: t.columns.map(col => ({
                            name: col.name,
                            type: col.type,
                            nullable: col.nullable,
                            default: col.default,
                            primaryKey: col.primaryKey,
                          })),
                          indexes: t.indexes,
                          constraints: t.constraints,
                          data: t.data,
                        }));

                        // Execute query using PostgreSQL Emulation Engine
                        const pgEngine = emulationEngine.getPostgreSQLEmulationEngine(componentId);
                        let result;
                        if (pgEngine) {
                          // Use emulation engine for execution
                          result = pgEngine.executeQuery(sqlQuery);
                          
                          // Sync tables from engine after execution
                          const engineTables = pgEngine.getTables();
                          if (Array.isArray(engineTables) && engineTables.length > 0) {
                            const updatedTables = tables.map(t => {
                              const engineTable = engineTables.find(et => 
                                et.name === t.name && et.schema === t.schema
                              );
                              if (engineTable && Array.isArray(engineTable.data)) {
                                return { ...t, data: engineTable.data };
                              }
                              return t;
                            });
                            updateConfig({ tables: updatedTables });
                          }
                        } else {
                          // Fallback to query engine if emulation engine not available
                          result = queryEngine.execute(sqlQuery, pgTables, indexes, views);
                        }

                          if (result.success) {
                          // Update tables if INSERT/UPDATE/DELETE
                          const operation = result.queryPlan?.operation || '';
                          if (result.queryPlan && (operation.includes('INSERT') || operation.includes('UPDATE') || operation.includes('DELETE'))) {
                            // Find and update the affected table
                            const updatedTables = [...tables];
                            const affectedTable = updatedTables.find(t => 
                              t.name === result.queryPlan?.table || 
                              sqlQuery.toLowerCase().includes(t.name.toLowerCase())
                            );
                            
                            if (affectedTable) {
                              // Refresh table data from pgTables
                              const pgTable = pgTables.find(pt => 
                                pt.name === affectedTable.name && pt.schema === affectedTable.schema
                              );
                              if (pgTable && pgTable.data) {
                                affectedTable.data = pgTable.data;
                              }
                            }

                            updateConfig({ 
                              tables: updatedTables,
                              queryResults: [{
                                message: `${result.queryPlan.operation} executed: ${result.rowCount || 0} row(s) affected`,
                                queryPlan: result.queryPlan,
                                rowCount: result.rowCount,
                                indexesUsed: result.indexesUsed,
                              }]
                            });
                          } else {
                            // SELECT query - show results with query plan
                            const results = result.rows || [];
                            updateConfig({ 
                              queryResults: results.length > 0 
                                ? [{ queryPlan: result.queryPlan, rowCount: result.rowCount, indexesUsed: result.indexesUsed }, ...results]
                                : [{ queryPlan: result.queryPlan, rowCount: 0, indexesUsed: result.indexesUsed }]
                            });
                          }

                          if (result.queryPlan) {
                            showSuccess(
                              `Query executed successfully. ${result.rowCount || 0} row(s) returned. ` +
                              (result.indexesUsed && result.indexesUsed.length > 0 
                                ? `Index used: ${result.indexesUsed.join(', ')}` 
                                : '')
                            );
                          } else {
                            showSuccess(`Query executed successfully. ${result.rowCount || 0} row(s) returned.`);
                          }
                        } else {
                          showError(result.error || 'Query execution failed');
                          updateConfig({ queryResults: [{ error: result.error || 'Query execution failed' }] });
                        }
                      } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                        showError(`Query execution error: ${errorMessage}`);
                        updateConfig({ queryResults: [{ error: errorMessage }] });
                      }
                    }}
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Execute
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>SQL Query</Label>
                  <Textarea
                    value={sqlQuery}
                    onChange={(e) => updateConfig({ sqlQuery: e.target.value })}
                    className="font-mono text-sm h-32"
                    placeholder="SELECT * FROM users;"
                  />
                </div>
                {queryResults.length > 0 && (
                  <div className="space-y-2">
                    <Label>Results</Label>
                    <div className="border rounded-lg overflow-x-auto">
                      {queryResults[0]?.error ? (
                        <div className="p-4 text-sm text-destructive bg-destructive/10 rounded">
                          <strong>Error:</strong> {queryResults[0].error}
                        </div>
                      ) : queryResults[0]?.message ? (
                        <div className="p-4 text-sm text-muted-foreground">
                          {queryResults[0].message}
                        </div>
                      ) : queryResults[0]?.queryPlan ? (
                        <div className="space-y-3 p-4">
                          <div className="text-sm">
                            <div className="font-semibold mb-2">Query Plan:</div>
                            <div className="bg-muted/50 p-2 rounded font-mono text-xs">
                              <div><strong>Operation:</strong> {queryResults[0].queryPlan.operation}</div>
                              <div><strong>Table:</strong> {queryResults[0].queryPlan.table}</div>
                              {queryResults[0].queryPlan.indexUsed && (
                                <div><strong>Index Used:</strong> {queryResults[0].queryPlan.indexUsed}</div>
                              )}
                              <div><strong>Estimated Rows:</strong> {queryResults[0].queryPlan.estimatedRows}</div>
                              <div><strong>Estimated Cost:</strong> {queryResults[0].queryPlan.estimatedCost}</div>
                            </div>
                          </div>
                          {queryResults[0].rowCount !== undefined && (
                            <div className="text-sm text-muted-foreground">
                              Rows returned: {queryResults[0].rowCount}
                            </div>
                          )}
                          {queryResults.length > 1 && (
                            <div className="mt-2">
                              <div className="text-xs font-semibold mb-1">Data:</div>
                              <table className="w-full text-sm border rounded">
                                <thead className="bg-muted">
                                  <tr>
                                    {Object.keys(queryResults[1] || {}).map((key) => (
                                      <th key={key} className="text-left p-2 font-medium border-r">
                                        {key}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {queryResults.slice(1).map((row, index) => (
                                    <tr key={index} className="border-t hover:bg-muted/50">
                                      {Object.values(row).map((value, colIndex) => (
                                        <td key={colIndex} className="p-2 border-r">
                                          {String(value)}
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      ) : (
                        <table className="w-full text-sm">
                          <thead className="bg-muted">
                            <tr>
                              {Object.keys(queryResults[0] || {}).filter(key => key !== 'queryPlan' && key !== 'indexesUsed' && key !== 'rowCount').map((key) => (
                                <th key={key} className="text-left p-2 font-medium border-r">
                                  {key}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {queryResults.map((row, index) => (
                              <tr key={index} className="border-t hover:bg-muted/50">
                                {Object.keys(row).filter(key => key !== 'queryPlan' && key !== 'indexesUsed' && key !== 'rowCount').map((key) => (
                                  <td key={key} className="p-2 border-r">
                                    {String(row[key])}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                )}
                <div className="text-xs text-muted-foreground space-y-1 p-3 bg-muted/50 rounded-lg">
                  <p className="font-semibold mb-2">💡 Example queries:</p>
                  <div className="space-y-2">
                    <div>
                      <p className="font-semibold text-xs mb-1">Basic queries:</p>
                      <p className="font-mono text-xs">SELECT * FROM users;</p>
                      <p className="font-mono text-xs">INSERT INTO users (username, email) VALUES ('new_user', 'user@example.com');</p>
                      <p className="font-mono text-xs">UPDATE users SET email = 'updated@example.com' WHERE id = 1;</p>
                      <p className="font-mono text-xs">DELETE FROM users WHERE id = 2;</p>
                    </div>
                    <div>
                      <p className="font-semibold text-xs mb-1 mt-2">Transactions:</p>
                      <p className="font-mono text-xs">BEGIN;</p>
                      <p className="font-mono text-xs">INSERT INTO users (username, email) VALUES ('user1', 'user1@example.com');</p>
                      <p className="font-mono text-xs">INSERT INTO users (username, email) VALUES ('user2', 'user2@example.com');</p>
                      <p className="font-mono text-xs">COMMIT;</p>
                      <p className="font-mono text-xs">-- or ROLLBACK; to cancel</p>
                    </div>
                    <div>
                      <p className="font-semibold text-xs mb-1 mt-2">With WHERE clause:</p>
                      <p className="font-mono text-xs">SELECT * FROM users WHERE id &gt; 10;</p>
                      <p className="font-mono text-xs">SELECT * FROM users WHERE email LIKE '%@example.com';</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Views Tab */}
          <TabsContent value="views" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Views in Schema: {currentSchema}</CardTitle>
                    <CardDescription>Database views and their definitions</CardDescription>
                  </div>
                  <Button size="sm" onClick={addView} variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Create View
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {filteredViews.map((view, index) => (
                    <Card key={index} className="border-border">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            <div className="p-2 rounded bg-primary/10">
                              <Eye className="h-4 w-4 text-primary" />
                            </div>
                            {editingView === `${view.schema}.${view.name}` ? (
                              <div className="flex-1 space-y-2">
                                <Input
                                  value={view.name}
                                  onChange={(e) => updateView(view.name, view.schema, 'name', e.target.value)}
                                  className="font-semibold"
                                  placeholder="View name"
                                />
                                <Select
                                  value={view.schema}
                                  onValueChange={(value) => updateView(view.name, view.schema, 'schema', value)}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {schemas.map((s) => (
                                      <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            ) : (
                              <div className="flex-1">
                                <CardTitle className="text-lg">{view.name}</CardTitle>
                                <CardDescription className="text-xs mt-1">
                                  Schema: {view.schema}
                                </CardDescription>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {editingView === `${view.schema}.${view.name}` ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setEditingView(null)}
                                >
                                  Save
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setEditingView(null)}
                                >
                                  Cancel
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setEditingView(`${view.schema}.${view.name}`)}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => removeView(view.name, view.schema)}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <Label>Definition</Label>
                          <Textarea
                            value={view.definition}
                            onChange={(e) => updateView(view.name, view.schema, 'definition', e.target.value)}
                            readOnly={editingView !== `${view.schema}.${view.name}`}
                            className="font-mono text-sm"
                            rows={3}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Roles Tab */}
          <TabsContent value="roles" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Database Roles</CardTitle>
                    <CardDescription>User roles and permissions</CardDescription>
                  </div>
                  <Button size="sm" onClick={addRole} variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Role
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {roles.map((role, index) => (
                    <Card key={index} className="border-border">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            <div className="p-2 rounded bg-primary/10">
                              <Users className="h-4 w-4 text-primary" />
                            </div>
                            {editingRole === role.name ? (
                              <div className="flex-1 space-y-2">
                                <Input
                                  value={role.name}
                                  onChange={(e) => updateRole(role.name, 'name', e.target.value)}
                                  className="font-semibold"
                                  placeholder="Role name"
                                />
                                <div className="flex items-center gap-4">
                                  <div className="flex items-center gap-2">
                                    <Switch
                                      checked={role.login}
                                      onCheckedChange={(checked) => updateRole(role.name, 'login', checked)}
                                    />
                                    <Label className="text-sm">LOGIN</Label>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Switch
                                      checked={role.superuser}
                                      onCheckedChange={(checked) => updateRole(role.name, 'superuser', checked)}
                                    />
                                    <Label className="text-sm">SUPERUSER</Label>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="flex-1">
                                <CardTitle className="text-lg">{role.name}</CardTitle>
                                <CardDescription className="text-xs mt-1 flex gap-1">
                                  {role.login && <Badge variant="outline">LOGIN</Badge>}
                                  {role.superuser && <Badge variant="destructive">SUPERUSER</Badge>}
                                  {!role.login && !role.superuser && <span className="text-muted-foreground">No special privileges</span>}
                                </CardDescription>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {editingRole === role.name ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setEditingRole(null)}
                                >
                                  Save
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setEditingRole(null)}
                                >
                                  Cancel
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setEditingRole(role.name)}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => removeRole(role.name)}
                                  className="text-destructive hover:text-destructive"
                                  disabled={role.name === 'postgres'}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Metrics Tab */}
          <TabsContent value="metrics" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>PostgreSQL Metrics</CardTitle>
                <CardDescription>Real-time metrics from PostgreSQL emulation engine</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {pgMetrics ? (
                  <>
                    {/* Connection Metrics */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Connection Metrics</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-4 border rounded-lg">
                          <div className="text-sm text-muted-foreground">Active Connections</div>
                          <div className="text-2xl font-bold">{pgMetrics.activeConnections}</div>
                          <div className="text-xs text-muted-foreground">/ {pgMetrics.maxConnections}</div>
                        </div>
                        <div className="p-4 border rounded-lg">
                          <div className="text-sm text-muted-foreground">Idle Connections</div>
                          <div className="text-2xl font-bold">{pgMetrics.idleConnections}</div>
                        </div>
                        <div className="p-4 border rounded-lg">
                          <div className="text-sm text-muted-foreground">Waiting Connections</div>
                          <div className="text-2xl font-bold">{pgMetrics.waitingConnections}</div>
                        </div>
                        <div className="p-4 border rounded-lg">
                          <div className="text-sm text-muted-foreground">Utilization</div>
                          <div className="text-2xl font-bold">{(pgMetrics.connectionUtilization * 100).toFixed(1)}%</div>
                        </div>
                      </div>
                    </div>

                    {/* Query Metrics */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Query Metrics</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-4 border rounded-lg">
                          <div className="text-sm text-muted-foreground">Queries/sec</div>
                          <div className="text-2xl font-bold">{pgMetrics.queriesPerSecond.toFixed(1)}</div>
                        </div>
                        <div className="p-4 border rounded-lg">
                          <div className="text-sm text-muted-foreground">Avg Query Time</div>
                          <div className="text-2xl font-bold">{pgMetrics.averageQueryTime.toFixed(1)}ms</div>
                        </div>
                        <div className="p-4 border rounded-lg">
                          <div className="text-sm text-muted-foreground">P95 Query Time</div>
                          <div className="text-2xl font-bold">{pgMetrics.p95QueryTime.toFixed(1)}ms</div>
                        </div>
                        <div className="p-4 border rounded-lg">
                          <div className="text-sm text-muted-foreground">Slow Queries</div>
                          <div className="text-2xl font-bold">{pgMetrics.slowQueries}</div>
                        </div>
                      </div>
                    </div>

                    {/* Database Metrics */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Database Metrics</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-4 border rounded-lg">
                          <div className="text-sm text-muted-foreground">Transactions/sec</div>
                          <div className="text-2xl font-bold">{pgMetrics.transactionsPerSecond.toFixed(1)}</div>
                        </div>
                        <div className="p-4 border rounded-lg">
                          <div className="text-sm text-muted-foreground">Commits/sec</div>
                          <div className="text-2xl font-bold">{pgMetrics.commitsPerSecond.toFixed(1)}</div>
                        </div>
                        <div className="p-4 border rounded-lg">
                          <div className="text-sm text-muted-foreground">Database Size</div>
                          <div className="text-2xl font-bold">{(pgMetrics.databaseSize / 1024 / 1024).toFixed(2)}MB</div>
                        </div>
                        <div className="p-4 border rounded-lg">
                          <div className="text-sm text-muted-foreground">Bloat Ratio</div>
                          <div className="text-2xl font-bold">{(pgMetrics.bloatRatio * 100).toFixed(1)}%</div>
                        </div>
                      </div>
                    </div>

                    {/* Table Metrics */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Table Metrics</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-4 border rounded-lg">
                          <div className="text-sm text-muted-foreground">Total Tables</div>
                          <div className="text-2xl font-bold">{pgMetrics.totalTables}</div>
                        </div>
                        <div className="p-4 border rounded-lg">
                          <div className="text-sm text-muted-foreground">Total Rows</div>
                          <div className="text-2xl font-bold">{pgMetrics.totalRows.toLocaleString()}</div>
                        </div>
                        <div className="p-4 border rounded-lg">
                          <div className="text-sm text-muted-foreground">Dead Tuples</div>
                          <div className="text-2xl font-bold">{pgMetrics.deadTuples.toLocaleString()}</div>
                        </div>
                        <div className="p-4 border rounded-lg">
                          <div className="text-sm text-muted-foreground">Live Tuples</div>
                          <div className="text-2xl font-bold">{pgMetrics.liveTuples.toLocaleString()}</div>
                        </div>
                      </div>
                    </div>

                    {/* Cache Metrics */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Cache Metrics</h3>
                      <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
                        <div className="p-4 border rounded-lg">
                          <div className="text-sm text-muted-foreground">Cache Hit Ratio</div>
                          <div className="text-2xl font-bold">{(pgMetrics.cacheHitRatio * 100).toFixed(1)}%</div>
                        </div>
                        <div className="p-4 border rounded-lg">
                          <div className="text-sm text-muted-foreground">Index Cache Hit Ratio</div>
                          <div className="text-2xl font-bold">{(pgMetrics.indexCacheHitRatio * 100).toFixed(1)}%</div>
                        </div>
                      </div>
                    </div>

                    {/* WAL & Vacuum Metrics */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">WAL & Vacuum Metrics</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-4 border rounded-lg">
                          <div className="text-sm text-muted-foreground">WAL Written/sec</div>
                          <div className="text-2xl font-bold">{(pgMetrics.walWritten / 1024).toFixed(1)}KB</div>
                        </div>
                        <div className="p-4 border rounded-lg">
                          <div className="text-sm text-muted-foreground">Checkpoints/hour</div>
                          <div className="text-2xl font-bold">{pgMetrics.checkpointFrequency.toFixed(1)}</div>
                        </div>
                        <div className="p-4 border rounded-lg">
                          <div className="text-sm text-muted-foreground">Autovacuum Running</div>
                          <div className="text-2xl font-bold">{pgMetrics.autovacuumRunning}</div>
                        </div>
                        <div className="p-4 border rounded-lg">
                          <div className="text-sm text-muted-foreground">Vacuum Ops/hour</div>
                          <div className="text-2xl font-bold">{pgMetrics.vacuumOperationsPerHour}</div>
                        </div>
                      </div>
                    </div>

                    {/* Lock Metrics */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Lock Metrics</h3>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div className="p-4 border rounded-lg">
                          <div className="text-sm text-muted-foreground">Active Locks</div>
                          <div className="text-2xl font-bold">{pgMetrics.activeLocks}</div>
                        </div>
                        <div className="p-4 border rounded-lg">
                          <div className="text-sm text-muted-foreground">Blocked Queries</div>
                          <div className="text-2xl font-bold">{pgMetrics.blockedQueries}</div>
                        </div>
                        <div className="p-4 border rounded-lg">
                          <div className="text-sm text-muted-foreground">Lock Wait Time</div>
                          <div className="text-2xl font-bold">{pgMetrics.lockWaitTime.toFixed(1)}ms</div>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Metrics will appear here when simulation is running
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Connection Tab */}
          <TabsContent value="connection" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Connection Settings</CardTitle>
                <CardDescription>PostgreSQL server connection details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="host">
                      Host <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="host"
                      value={host}
                      onChange={(e) => {
                        updateConfig({ host: e.target.value });
                        if (fieldErrors.host) {
                          validateConnectionFields();
                        }
                      }}
                      onBlur={validateConnectionFields}
                      placeholder="localhost"
                      className={hostError || fieldErrors.host ? 'border-destructive' : ''}
                    />
                    {hostError && (
                      <div className="flex items-center gap-1 text-sm text-destructive">
                        <AlertCircle className="h-3 w-3" />
                        <span>{hostError}</span>
                      </div>
                    )}
                    {!hostError && fieldErrors.host && (
                      <div className="flex items-center gap-1 text-sm text-destructive">
                        <AlertCircle className="h-3 w-3" />
                        <span>{fieldErrors.host}</span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="port">
                      Port <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="port"
                      type="number"
                      value={port}
                      onChange={(e) => {
                        updateConfig({ port: parseInt(e.target.value) || 5432 });
                        if (fieldErrors.port) {
                          validateConnectionFields();
                        }
                      }}
                      onBlur={validateConnectionFields}
                      placeholder="5432"
                      className={portError || portConflict.hasConflict || fieldErrors.port ? 'border-destructive' : ''}
                    />
                    {portError && (
                      <div className="flex items-center gap-1 text-sm text-destructive">
                        <AlertCircle className="h-3 w-3" />
                        <span>{portError}</span>
                      </div>
                    )}
                    {!portError && fieldErrors.port && (
                      <div className="flex items-center gap-1 text-sm text-destructive">
                        <AlertCircle className="h-3 w-3" />
                        <span>{fieldErrors.port}</span>
                      </div>
                    )}
                    {!portError && !fieldErrors.port && portConflict.hasConflict && portConflict.conflictingNode && (
                      <div className="flex items-center gap-1 text-sm text-amber-600 dark:text-amber-400">
                        <AlertCircle className="h-3 w-3" />
                        <span>
                          Конфликт порта: компонент "{portConflict.conflictingNode.data.label || portConflict.conflictingNode.type}" 
                          уже использует {host}:{port}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="database">
                    Database <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="database"
                    value={database}
                    onChange={(e) => {
                      updateConfig({ database: e.target.value });
                      if (fieldErrors.database) {
                        validateConnectionFields();
                      }
                    }}
                    onBlur={validateConnectionFields}
                    placeholder="postgres"
                    className={fieldErrors.database ? 'border-destructive' : ''}
                  />
                  {fieldErrors.database && (
                    <div className="flex items-center gap-1 text-sm text-destructive">
                      <AlertCircle className="h-3 w-3" />
                      <span>{fieldErrors.database}</span>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">
                      Username <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="username"
                      value={username}
                      onChange={(e) => {
                        updateConfig({ username: e.target.value });
                        if (fieldErrors.username) {
                          validateConnectionFields();
                        }
                      }}
                      onBlur={validateConnectionFields}
                      placeholder="postgres"
                      className={fieldErrors.username ? 'border-destructive' : ''}
                    />
                    {fieldErrors.username && (
                      <div className="flex items-center gap-1 text-sm text-destructive">
                        <AlertCircle className="h-3 w-3" />
                        <span>{fieldErrors.username}</span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => updateConfig({ password: e.target.value })}
                      placeholder="password"
                    />
                  </div>
                </div>
                <div className="flex gap-2 pt-4 border-t">
                  <Button
                    onClick={() => {
                      if (validateConnectionFields()) {
                        showSuccess('Параметры подключения сохранены');
                      } else {
                        showError('Пожалуйста, заполните все обязательные поля');
                      }
                    }}
                  >
                    Сохранить настройки
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (validateConnectionFields()) {
                        showSuccess('Параметры подключения валидны');
                      } else {
                        showError('Пожалуйста, заполните все обязательные поля');
                      }
                    }}
                  >
                    Проверить подключение
                  </Button>
                </div>
                <Separator />
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">Connection Pool Settings</h3>
                    <p className="text-sm text-muted-foreground mb-4">Configure connection pooling behavior</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="maxConnections">Max Connections</Label>
                      <Input
                        id="maxConnections"
                        type="number"
                        min="1"
                        max="10000"
                        value={config.maxConnections || 100}
                        onChange={(e) => updateConfig({ maxConnections: parseInt(e.target.value) || 100 })}
                        placeholder="100"
                      />
                      <p className="text-xs text-muted-foreground">Maximum number of concurrent connections</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="minConnections">Min Connections</Label>
                      <Input
                        id="minConnections"
                        type="number"
                        min="0"
                        value={config.minConnections || 0}
                        onChange={(e) => updateConfig({ minConnections: parseInt(e.target.value) || 0 })}
                        placeholder="0"
                      />
                      <p className="text-xs text-muted-foreground">Minimum number of idle connections</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="idleTimeout">Idle Timeout (ms)</Label>
                      <Input
                        id="idleTimeout"
                        type="number"
                        min="1000"
                        value={config.idleTimeout || 300000}
                        onChange={(e) => updateConfig({ idleTimeout: parseInt(e.target.value) || 300000 })}
                        placeholder="300000"
                      />
                      <p className="text-xs text-muted-foreground">Time before idle connection is closed (default: 5 min)</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="maxLifetime">Max Connection Lifetime (ms)</Label>
                      <Input
                        id="maxLifetime"
                        type="number"
                        min="60000"
                        value={config.maxLifetime || 3600000}
                        onChange={(e) => updateConfig({ maxLifetime: parseInt(e.target.value) || 3600000 })}
                        placeholder="3600000"
                      />
                      <p className="text-xs text-muted-foreground">Maximum time a connection can live (default: 1 hour)</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="queryLatency">Query Latency (ms)</Label>
                      <Input
                        id="queryLatency"
                        type="number"
                        min="1"
                        value={config.queryLatency || 10}
                        onChange={(e) => updateConfig({ queryLatency: parseInt(e.target.value) || 10 })}
                        placeholder="10"
                      />
                      <p className="text-xs text-muted-foreground">Base query execution time for simulation</p>
                    </div>
                  </div>
                </div>
                <Separator />
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Enable Metrics Export (postgres_exporter)</Label>
                      <p className="text-xs text-muted-foreground mt-1">Export PostgreSQL metrics for Prometheus scraping</p>
                    </div>
                    <Switch 
                      checked={config.metrics?.enabled ?? true}
                      onCheckedChange={(checked) => updateConfig({ 
                        metrics: { 
                          ...config.metrics, 
                          enabled: checked,
                          port: config.metrics?.port || 9187,
                          path: config.metrics?.path || '/metrics'
                        } 
                      })}
                    />
                  </div>
                  {config.metrics?.enabled !== false && (
                    <>
                      <div className="space-y-2">
                        <Label>Metrics Port (postgres_exporter)</Label>
                        <Input 
                          type="number" 
                          value={config.metrics?.port ?? 9187}
                          onChange={(e) => updateConfig({ 
                            metrics: { 
                              ...config.metrics, 
                              port: parseInt(e.target.value) || 9187,
                              path: config.metrics?.path || '/metrics'
                            } 
                          })}
                          min={1024} 
                          max={65535} 
                        />
                        <p className="text-xs text-muted-foreground">Default port for postgres_exporter: 9187</p>
                      </div>
                      <div className="space-y-2">
                        <Label>Metrics Path</Label>
                        <Input 
                          type="text" 
                          value={config.metrics?.path ?? '/metrics'}
                          onChange={(e) => updateConfig({ 
                            metrics: { 
                              ...config.metrics, 
                              path: e.target.value || '/metrics',
                              port: config.metrics?.port || 9187
                            } 
                          })}
                          placeholder="/metrics"
                        />
                      </div>
                    </>
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


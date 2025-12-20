import { useState } from 'react';
import { useCanvasStore } from '@/store/useCanvasStore';
import { CanvasNode } from '@/types';
import { PostgreSQLQueryEngine } from '@/core/postgresql/QueryEngine';
import { PostgreSQLTable, PostgreSQLIndex } from '@/core/postgresql/types';
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
import { AlertCircle } from 'lucide-react';
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
  FolderTree
} from 'lucide-react';

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
}

export function PostgreSQLConfigAdvanced({ componentId }: PostgreSQLConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

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

  const addSchema = () => {
    updateConfig({
      schemas: [...schemas, { name: 'new_schema', owner: username }],
    });
    showSuccess('Схема успешно создана');
  };

  const addView = () => {
    updateConfig({
      views: [...views, {
        name: 'new_view',
        schema: currentSchema,
        definition: 'SELECT * FROM table_name',
      }],
    });
    showSuccess('Представление успешно создано');
  };

  const addRole = () => {
    updateConfig({
      roles: [...roles, { name: 'new_role', login: false, superuser: false }],
    });
    showSuccess('Роль успешно создана');
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
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              Connected
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
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="schemas" className="gap-2">
              <FolderTree className="h-4 w-4" />
              Schemas
            </TabsTrigger>
            <TabsTrigger value="tables" className="gap-2">
              <Table className="h-4 w-4" />
              Tables
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
                  <Button size="sm" onClick={addSchema} variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Schema
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {schemas.map((schema, index) => (
                    <Card key={index} className="border-border">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded bg-primary/10">
                              <FolderTree className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <CardTitle className="text-lg">{schema.name}</CardTitle>
                              <CardDescription className="text-xs mt-1">
                                Owner: {schema.owner}
                              </CardDescription>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {schema.name === currentSchema && (
                              <Badge variant="default">Current</Badge>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => updateConfig({ currentSchema: schema.name })}
                            >
                              Use
                            </Button>
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
                                <div key={constIndex} className="p-2 border rounded text-sm font-mono text-muted-foreground">
                                  {constraint}
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

                        // Execute query using Query Engine (with views support)
                        const result = queryEngine.execute(sqlQuery, pgTables, indexes, views);

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
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded bg-primary/10">
                              <Eye className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <CardTitle className="text-lg">{view.name}</CardTitle>
                              <CardDescription className="text-xs mt-1">
                                Schema: {view.schema}
                              </CardDescription>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <Label>Definition</Label>
                          <Textarea
                            value={view.definition}
                            readOnly
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
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded bg-primary/10">
                              <Users className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <CardTitle className="text-lg">{role.name}</CardTitle>
                              <CardDescription className="text-xs mt-1">
                                {role.login && <Badge variant="outline" className="mr-1">LOGIN</Badge>}
                                {role.superuser && <Badge variant="destructive" className="mr-1">SUPERUSER</Badge>}
                              </CardDescription>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
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


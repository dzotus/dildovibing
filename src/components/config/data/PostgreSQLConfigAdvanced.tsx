import { useState } from 'react';
import { useCanvasStore } from '@/store/useCanvasStore';
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

  const updateConfig = (updates: Partial<PostgreSQLConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  const [editingTable, setEditingTable] = useState<string | null>(null);
  const [newTableName, setNewTableName] = useState('');
  const [showCreateTable, setShowCreateTable] = useState(false);
  const [newTableColumns, setNewTableColumns] = useState<Column[]>([
    { name: 'id', type: 'SERIAL', nullable: false, primaryKey: true },
  ]);
  const [selectedTableForData, setSelectedTableForData] = useState<string>('');

  const addTable = () => {
    if (newTableName && newTableName.trim()) {
      // Get current tables from config, fallback to default
      const currentTables = config.tables || tables;
      
      // Check if table with same name already exists
      const tableExists = currentTables.some(
        t => t.name === newTableName.trim() && t.schema === currentSchema
      );
      
      if (tableExists) {
        alert(`Table "${newTableName.trim()}" already exists in schema "${currentSchema}"`);
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
    }
  };

  const removeColumnFromTable = (tableName: string, columnIndex: number) => {
    const newTables = [...tables];
    const tableIndex = newTables.findIndex(t => t.name === tableName && t.schema === currentSchema);
    if (tableIndex >= 0 && newTables[tableIndex].columns.length > 1) {
      newTables[tableIndex].columns = newTables[tableIndex].columns.filter((_, i) => i !== columnIndex);
      updateConfig({ tables: newTables });
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
  };

  const addView = () => {
    updateConfig({
      views: [...views, {
        name: 'new_view',
        schema: currentSchema,
        definition: 'SELECT * FROM table_name',
      }],
    });
  };

  const addRole = () => {
    updateConfig({
      roles: [...roles, { name: 'new_role', login: false, superuser: false }],
    });
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
              <h2 className="text-2xl font-bold text-foreground">PostgreSQL</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Database: {database} @ {host}:{port}
              </p>
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
          <TabsList className="grid w-full grid-cols-6">
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
                                    {newTableColumns.length > 1 && (
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        onClick={() => setNewTableColumns(newTableColumns.filter((_, i) => i !== colIndex))}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    )}
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
                                updateConfig({ tables: tables.filter((_, i) => {
                                  const t = tables[i];
                                  return !(t.name === table.name && t.schema === currentSchema);
                                })});
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
                                        {table.columns.length > 1 && (
                                          <Button
                                            size="icon"
                                            variant="ghost"
                                            onClick={() => removeColumnFromTable(table.name, colIndex)}
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        )}
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
                      // Simulate query execution
                      if (sqlQuery.toLowerCase().includes('select')) {
                        const tableName = sqlQuery.match(/from\s+(\w+)/i)?.[1];
                        const table = tables.find(t => t.name === tableName);
                        if (table && table.data) {
                          updateConfig({ queryResults: table.data });
                        } else {
                          updateConfig({ queryResults: [] });
                        }
                      } else if (sqlQuery.toLowerCase().includes('insert')) {
                        // Simulate INSERT
                        const match = sqlQuery.match(/insert\s+into\s+(\w+)\s*\(([^)]+)\)\s*values\s*\(([^)]+)\)/i);
                        if (match) {
                          const tableName = match[1];
                          const columns = match[2].split(',').map(c => c.trim());
                          const values = match[3].split(',').map(v => v.trim().replace(/['"]/g, ''));
                          const newTables = [...tables];
                          const tableIndex = newTables.findIndex(t => t.name === tableName);
                          if (tableIndex >= 0) {
                            const newRow: TableRow = {};
                            columns.forEach((col, idx) => {
                              newRow[col] = values[idx];
                            });
                            if (!newTables[tableIndex].data) {
                              newTables[tableIndex].data = [];
                            }
                            newTables[tableIndex].data!.push(newRow);
                            updateConfig({ tables: newTables, queryResults: [{ message: `INSERT executed: 1 row affected` }] });
                          }
                        }
                      } else if (sqlQuery.toLowerCase().includes('update')) {
                        updateConfig({ queryResults: [{ message: 'UPDATE executed successfully' }] });
                      } else if (sqlQuery.toLowerCase().includes('delete')) {
                        updateConfig({ queryResults: [{ message: 'DELETE executed successfully' }] });
                      } else {
                        updateConfig({ queryResults: [{ message: 'Query executed' }] });
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
                      {queryResults[0]?.message ? (
                        <div className="p-4 text-sm text-muted-foreground">
                          {queryResults[0].message}
                        </div>
                      ) : (
                        <table className="w-full text-sm">
                          <thead className="bg-muted">
                            <tr>
                              {Object.keys(queryResults[0] || {}).map((key) => (
                                <th key={key} className="text-left p-2 font-medium border-r">
                                  {key}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {queryResults.map((row, index) => (
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
                      )}
                    </div>
                  </div>
                )}
                <div className="text-xs text-muted-foreground space-y-1 p-3 bg-muted/50 rounded-lg">
                  <p className="font-semibold mb-2">💡 Example queries:</p>
                  <p className="font-mono text-xs">SELECT * FROM users;</p>
                  <p className="font-mono text-xs">INSERT INTO users (username, email) VALUES ('new_user', 'user@example.com');</p>
                  <p className="font-mono text-xs">UPDATE users SET email = 'updated@example.com' WHERE id = 1;</p>
                  <p className="font-mono text-xs">DELETE FROM users WHERE id = 2;</p>
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
                    <Label htmlFor="host">Host</Label>
                    <Input
                      id="host"
                      value={host}
                      onChange={(e) => updateConfig({ host: e.target.value })}
                      placeholder="localhost"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="port">Port</Label>
                    <Input
                      id="port"
                      type="number"
                      value={port}
                      onChange={(e) => updateConfig({ port: parseInt(e.target.value) || 5432 })}
                      placeholder="5432"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="database">Database</Label>
                  <Input
                    id="database"
                    value={database}
                    onChange={(e) => updateConfig({ database: e.target.value })}
                    placeholder="postgres"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      value={username}
                      onChange={(e) => updateConfig({ username: e.target.value })}
                      placeholder="postgres"
                    />
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
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}


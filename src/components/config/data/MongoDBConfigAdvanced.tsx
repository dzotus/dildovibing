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
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { usePortValidation } from '@/hooks/usePortValidation';
import { AlertCircle } from 'lucide-react';
import { showError, showSuccess, showInfo, showWarning } from '@/utils/toast';
import { validateRequiredFields, type RequiredField } from '@/utils/requiredFields';
import {
  Database,
  FileText,
  Search,
  Settings,
  Plus,
  Trash2,
  Edit,
  Network,
  Copy,
  Filter
} from 'lucide-react';

interface MongoDBConfigProps {
  componentId: string;
}

interface Collection {
  name: string;
  database: string;
  documentCount?: number;
  size?: number;
  indexes?: Index[];
  validation?: SchemaValidation;
  documents?: Document[]; // Документы коллекции
}

interface Index {
  name: string;
  keys: Record<string, 1 | -1 | 'text' | '2dsphere' | 'hashed'>;
  unique?: boolean;
  sparse?: boolean;
  background?: boolean;
}

interface SchemaValidation {
  validator: Record<string, any>;
  validationLevel?: 'off' | 'strict' | 'moderate';
  validationAction?: 'error' | 'warn';
}

interface Document {
  _id: string;
  [key: string]: any;
}

interface AggregationStage {
  stage: string;
  expression: string;
}

interface ShardConfig {
  shardKey: Record<string, 1 | -1 | 'hashed'>;
  shards: string[];
}

interface ReplicaSetMember {
  host: string;
  port: number;
  priority?: number;
  votes?: number;
  arbiterOnly?: boolean;
}

interface MongoDBConfig {
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  authSource?: string;
  enableReplicaSet?: boolean;
  replicaSetName?: string;
  replicaSetMembers?: ReplicaSetMember[];
  enableSharding?: boolean;
  shardConfig?: ShardConfig;
  collections?: Collection[];
  selectedCollection?: string;
  selectedDatabase?: string;
  documents?: Document[];
  aggregationPipeline?: AggregationStage[];
}

export function MongoDBConfigAdvanced({ componentId }: MongoDBConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as MongoDBConfig;
  const host = config.host || 'localhost';
  const port = config.port || 27017;
  const database = config.database || 'test';
  const username = config.username || 'admin';
  const password = config.password || '';
  const authSource = config.authSource || 'admin';
  const enableReplicaSet = config.enableReplicaSet ?? false;
  const replicaSetName = config.replicaSetName || 'rs0';
  const replicaSetMembers = config.replicaSetMembers || [
    { host: 'localhost', port: 27017, priority: 1, votes: 1 },
    { host: 'localhost', port: 27018, priority: 1, votes: 1 },
    { host: 'localhost', port: 27019, priority: 0, votes: 0, arbiterOnly: true }
  ];
  const enableSharding = config.enableSharding ?? false;
  const shardConfig = config.shardConfig || { shardKey: { _id: 'hashed' }, shards: ['shard1', 'shard2'] };
  const collections = config.collections || [];
  const selectedDatabase = config.selectedDatabase || database;
  const selectedCollection = config.selectedCollection || '';
  const documents = config.documents || [];
  const aggregationPipeline = config.aggregationPipeline || [];

  const [showCreateCollection, setShowCreateCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState<string>('');
  const [editingCollectionIndex, setEditingCollectionIndex] = useState<number | null>(null);
  const [showCreateIndex, setShowCreateIndex] = useState(false);
  const [selectedCollectionForIndex, setSelectedCollectionForIndex] = useState<string | null>(null);
  const [editingIndexName, setEditingIndexName] = useState<string | null>(null); // Имя редактируемого индекса
  const [newIndexName, setNewIndexName] = useState<string>('');
  const [newIndexKeys, setNewIndexKeys] = useState<string>('{}');
  const [newIndexUnique, setNewIndexUnique] = useState<boolean>(false);
  const [newIndexSparse, setNewIndexSparse] = useState<boolean>(false);
  const [newIndexBackground, setNewIndexBackground] = useState<boolean>(false);
  const [showCreateDocument, setShowCreateDocument] = useState(false);
  const [newDocument, setNewDocument] = useState<string>('{}');
  const [queryFilter, setQueryFilter] = useState<string>('{}');
  const [showAggregationBuilder, setShowAggregationBuilder] = useState(false);
  const [aggregationCollection, setAggregationCollection] = useState<string>('');
  const [aggregationResults, setAggregationResults] = useState<any[]>([]);

  // Валидация портов и хостов
  const { portError, hostError, portConflict } = usePortValidation(nodes, componentId, host, port);
  
  // Валидация обязательных полей
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  
  const requiredFields: RequiredField[] = [
    { field: 'host', label: 'Host' },
    { field: 'port', label: 'Port', validator: (v) => typeof v === 'number' && v > 0 && v <= 65535 },
    { field: 'database', label: 'Database' },
  ];
  
  const validateConnectionFields = () => {
    const result = validateRequiredFields(
      { host, port, database },
      requiredFields
    );
    setFieldErrors(result.errors);
    return result.isValid;
  };

  const updateConfig = (updates: Partial<MongoDBConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
    // Очистка ошибок валидации при успешном обновлении
    if (Object.keys(updates).some(key => ['host', 'port', 'database'].includes(key))) {
      const newErrors = { ...fieldErrors };
      Object.keys(updates).forEach(key => {
        if (newErrors[key]) delete newErrors[key];
      });
      setFieldErrors(newErrors);
    }
  };

  const addCollection = () => {
    // Валидация имени коллекции
    if (!newCollectionName || newCollectionName.trim() === '') {
      showError('Имя коллекции не может быть пустым');
      return;
    }

    const collectionName = newCollectionName.trim();
    
    // Проверка на дубликаты
    const collectionExists = collections.some(c => c.name === collectionName && c.database === selectedDatabase);
    if (collectionExists) {
      showError(`Коллекция "${collectionName}" уже существует в базе "${selectedDatabase}"`);
      return;
    }

    const newCollection: Collection = {
      name: collectionName,
      database: selectedDatabase,
      documentCount: 0,
      size: 0,
      indexes: [{ name: '_id_', keys: { _id: 1 }, unique: true }],
    };
    updateConfig({ collections: [...collections, newCollection] });
    
    // Сброс формы
    setShowCreateCollection(false);
    setNewCollectionName('');
    showSuccess(`Коллекция "${collectionName}" успешно создана`);
  };

  const removeCollection = (index: number) => {
    updateConfig({ collections: collections.filter((_, i) => i !== index) });
  };

  const updateCollection = (index: number, field: keyof Collection, value: any) => {
    const updated = [...collections];
    updated[index] = { ...updated[index], [field]: value };
    updateConfig({ collections: updated });
  };

  const addIndex = (collectionName: string) => {
    const collectionIndex = collections.findIndex(c => c.name === collectionName);
    if (collectionIndex === -1) {
      showError(`Коллекция "${collectionName}" не найдена`);
      return;
    }

    // Валидация имени индекса
    if (!newIndexName || newIndexName.trim() === '') {
      showError('Имя индекса не может быть пустым');
      return;
    }

    const trimmedIndexName = newIndexName.trim();
    const existingIndexes = collections[collectionIndex].indexes || [];
    const isEditing = editingIndexName !== null;

    // Проверка на дубликаты имени индекса (только если не редактируем или имя изменилось)
    if (!isEditing || editingIndexName !== trimmedIndexName) {
      if (existingIndexes.some(idx => idx.name === trimmedIndexName)) {
        showError(`Индекс с именем "${trimmedIndexName}" уже существует`);
        return;
      }
    }

    // Парсинг ключей индекса
    let indexKeys: Record<string, 1 | -1 | 'text' | '2dsphere' | 'hashed'>;
    try {
      const parsed = JSON.parse(newIndexKeys);
      if (typeof parsed !== 'object' || Array.isArray(parsed) || Object.keys(parsed).length === 0) {
        showError('Ключи индекса должны быть объектом с хотя бы одним полем');
        return;
      }
      // Валидация значений ключей
      for (const [key, value] of Object.entries(parsed)) {
        if (value !== 1 && value !== -1 && value !== 'text' && value !== '2dsphere' && value !== 'hashed') {
          showError(`Неверное значение для поля "${key}": должно быть 1, -1, "text", "2dsphere" или "hashed"`);
          return;
        }
      }
      indexKeys = parsed as Record<string, 1 | -1 | 'text' | '2dsphere' | 'hashed'>;
    } catch (error) {
      showError(`Неверный формат JSON для ключей индекса: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
      return;
    }

    const updatedIndex: Index = {
      name: trimmedIndexName,
      keys: indexKeys,
      unique: newIndexUnique,
      sparse: newIndexSparse,
      background: newIndexBackground
    };

    const updated = [...collections];
    if (!updated[collectionIndex].indexes) {
      updated[collectionIndex].indexes = [];
    }

    if (isEditing) {
      // Редактирование существующего индекса
      const indexToUpdate = updated[collectionIndex].indexes!.findIndex(idx => idx.name === editingIndexName);
      if (indexToUpdate !== -1) {
        updated[collectionIndex].indexes![indexToUpdate] = updatedIndex;
        showSuccess(`Индекс "${updatedIndex.name}" успешно обновлен`);
      } else {
        showError(`Индекс "${editingIndexName}" не найден для обновления`);
        return;
      }
    } else {
      // Создание нового индекса
      updated[collectionIndex].indexes = [...updated[collectionIndex].indexes!, updatedIndex];
      showSuccess(`Индекс "${updatedIndex.name}" успешно создан`);
    }

    updateConfig({ collections: updated });
    
    // Сброс формы
    setShowCreateIndex(false);
    setSelectedCollectionForIndex(null);
    setEditingIndexName(null);
    setNewIndexName('');
    setNewIndexKeys('{}');
    setNewIndexUnique(false);
    setNewIndexSparse(false);
    setNewIndexBackground(false);
  };

  const startEditIndex = (collectionName: string, indexName: string) => {
    const collection = collections.find(c => c.name === collectionName);
    if (!collection) {
      showError(`Коллекция "${collectionName}" не найдена`);
      return;
    }

    const index = collection.indexes?.find(idx => idx.name === indexName);
    if (!index) {
      showError(`Индекс "${indexName}" не найден`);
      return;
    }

    // Заполняем форму данными индекса
    setSelectedCollectionForIndex(collectionName);
    setEditingIndexName(indexName);
    setNewIndexName(index.name);
    setNewIndexKeys(JSON.stringify(index.keys, null, 2));
    setNewIndexUnique(index.unique || false);
    setNewIndexSparse(index.sparse || false);
    setNewIndexBackground(index.background || false);
    setShowCreateIndex(true);
  };

  const removeIndex = (collectionName: string, indexName: string) => {
    const collectionIndex = collections.findIndex(c => c.name === collectionName);
    if (collectionIndex === -1) return;

    const updated = [...collections];
    updated[collectionIndex].indexes = updated[collectionIndex].indexes?.filter(idx => idx.name !== indexName);
    updateConfig({ collections: updated });
    showSuccess(`Индекс "${indexName}" удален`);
  };

  const addDocumentToCollection = () => {
    if (!selectedCollection) {
      showError('Выберите коллекцию для добавления документа');
      return;
    }

    const collectionIndex = collections.findIndex(c => c.name === selectedCollection);
    if (collectionIndex === -1) {
      showError(`Коллекция "${selectedCollection}" не найдена`);
      return;
    }

    try {
      const parsed = JSON.parse(newDocument);
      const doc: Document = { 
        _id: parsed._id || `doc_${Date.now()}`,
        ...parsed 
      };

      // Валидация схемы, если включена
      const collection = collections[collectionIndex];
      if (collection.validation && collection.validation.validationLevel !== 'off') {
        const validationResult = validateMongoDBSchema(doc, collection.validation.validator);
        if (!validationResult.valid && collection.validation.validationAction === 'error') {
          showError(`Валидация не пройдена: ${validationResult.error}`);
          return;
        }
      }

      const updated = [...collections];
      if (!updated[collectionIndex].documents) {
        updated[collectionIndex].documents = [];
      }
      updated[collectionIndex].documents = [...updated[collectionIndex].documents!, doc];
      updated[collectionIndex].documentCount = (updated[collectionIndex].documentCount || 0) + 1;
      
      // Примерный расчет размера (в байтах, потом конвертируем в MB)
      const docSize = JSON.stringify(doc).length;
      updated[collectionIndex].size = ((updated[collectionIndex].size || 0) * 1024 * 1024 + docSize) / (1024 * 1024);

      updateConfig({ collections: updated });
      setNewDocument('{}');
      setShowCreateDocument(false);
      showSuccess(`Документ добавлен в коллекцию "${selectedCollection}"`);
    } catch (error) {
      showError(`Неверный формат JSON: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
    }
  };

  const removeDocumentFromCollection = (collectionName: string, docId: string) => {
    const collectionIndex = collections.findIndex(c => c.name === collectionName);
    if (collectionIndex === -1) return;

    const updated = [...collections];
    if (updated[collectionIndex].documents) {
      const doc = updated[collectionIndex].documents!.find(d => d._id === docId);
      if (doc) {
        const docSize = JSON.stringify(doc).length;
        updated[collectionIndex].documents = updated[collectionIndex].documents!.filter(d => d._id !== docId);
        updated[collectionIndex].documentCount = Math.max(0, (updated[collectionIndex].documentCount || 0) - 1);
        updated[collectionIndex].size = Math.max(0, ((updated[collectionIndex].size || 0) * 1024 * 1024 - docSize) / (1024 * 1024));
        updateConfig({ collections: updated });
        showSuccess('Документ удален');
      }
    }
  };

  const findDocuments = () => {
    if (!selectedCollection) {
      showError('Выберите коллекцию для поиска');
      return;
    }

    const collection = collections.find(c => c.name === selectedCollection);
    if (!collection || !collection.documents || collection.documents.length === 0) {
      showError('В коллекции нет документов');
      return;
    }

    try {
      const filter = queryFilter.trim() ? JSON.parse(queryFilter) : {};
      const filtered = collection.documents.filter((doc: Document) => {
        for (const [key, value] of Object.entries(filter)) {
          if (doc[key] !== value) return false;
        }
        return true;
      });

      if (filtered.length === 0) {
        showInfo(`Найдено документов: 0`);
      } else {
        showSuccess(`Найдено документов: ${filtered.length}`);
      }
    } catch (error) {
      showError(`Неверный формат фильтра JSON: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
    }
  };

  // Простая функция валидации (упрощенная версия из DataFlowEngine)
  const validateMongoDBSchema = (document: any, schema: any): { valid: boolean; error?: string } => {
    if (!schema || !schema.$jsonSchema) {
      return { valid: true };
    }

    const jsonSchema = schema.$jsonSchema;

    // Check required fields
    if (jsonSchema.required && Array.isArray(jsonSchema.required)) {
      for (const field of jsonSchema.required) {
        if (!(field in document) || document[field] === undefined || document[field] === null) {
          return { valid: false, error: `Required field "${field}" is missing` };
        }
      }
    }

    // Check properties types
    if (jsonSchema.properties) {
      for (const [field, fieldSchema] of Object.entries(jsonSchema.properties)) {
        if (field in document) {
          const value = document[field];
          const propSchema = fieldSchema as any;

          if (propSchema.type) {
            const expectedType = propSchema.type;
            const actualType = Array.isArray(value) ? 'array' : typeof value;

            if (expectedType === 'string' && actualType !== 'string') {
              return { valid: false, error: `Field "${field}" must be of type string` };
            }
            if (expectedType === 'number' && actualType !== 'number') {
              return { valid: false, error: `Field "${field}" must be of type number` };
            }
            if (expectedType === 'boolean' && actualType !== 'boolean') {
              return { valid: false, error: `Field "${field}" must be of type boolean` };
            }
            if (expectedType === 'array' && actualType !== 'array') {
              return { valid: false, error: `Field "${field}" must be of type array` };
            }
            if (expectedType === 'object' && (actualType !== 'object' || Array.isArray(value))) {
              return { valid: false, error: `Field "${field}" must be of type object` };
            }
          }
        }
      }
    }

    return { valid: true };
  };

  const addReplicaSetMember = () => {
    updateConfig({
      replicaSetMembers: [...replicaSetMembers, { host: 'localhost', port: 27020, priority: 1, votes: 1 }]
    });
  };

  const removeReplicaSetMember = (index: number) => {
    updateConfig({ replicaSetMembers: replicaSetMembers.filter((_, i) => i !== index) });
  };

  const addShard = () => {
    updateConfig({
      shardConfig: {
        ...shardConfig,
        shards: [...shardConfig.shards, `shard${shardConfig.shards.length + 1}`]
      }
    });
  };

  const addAggregationStage = () => {
    const newStage: AggregationStage = {
      stage: '$match',
      expression: '{}'
    };
    updateConfig({ aggregationPipeline: [...aggregationPipeline, newStage] });
  };

  const removeAggregationStage = (index: number) => {
    updateConfig({ aggregationPipeline: aggregationPipeline.filter((_, i) => i !== index) });
  };

  const updateAggregationStage = (index: number, field: keyof AggregationStage, value: string) => {
    const updated = [...aggregationPipeline];
    updated[index] = { ...updated[index], [field]: value };
    updateConfig({ aggregationPipeline: updated });
  };

  const executeAggregation = () => {
    if (!aggregationCollection) {
      showError('Выберите коллекцию для агрегации');
      return;
    }

    const collection = collections.find(c => c.name === aggregationCollection);
    if (!collection || !collection.documents || collection.documents.length === 0) {
      showError('В коллекции нет документов для агрегации');
      return;
    }

    if (aggregationPipeline.length === 0) {
      showError('Добавьте хотя бы одну стадию в pipeline');
      return;
    }

    try {
      let results: any[] = [...collection.documents];

      // Выполняем каждую стадию pipeline
      for (const stage of aggregationPipeline) {
        try {
          const expression = JSON.parse(stage.expression || '{}');
          
          switch (stage.stage) {
            case '$match':
              results = results.filter((doc: any) => {
                for (const [key, value] of Object.entries(expression)) {
                  if (doc[key] !== value) return false;
                }
                return true;
              });
              break;
            
            case '$group':
              // Упрощенная группировка
              const grouped: Record<string, any> = {};
              const groupBy = expression._id;
              if (groupBy) {
                results.forEach((doc: any) => {
                  const key = typeof groupBy === 'string' ? doc[groupBy] : JSON.stringify(groupBy);
                  if (!grouped[key]) {
                    grouped[key] = { _id: key };
                  }
                  // Применяем агрегационные функции
                  Object.entries(expression).forEach(([field, expr]: [string, any]) => {
                    if (field !== '_id' && typeof expr === 'object') {
                      if (expr.$sum) {
                        grouped[key][field] = (grouped[key][field] || 0) + (doc[expr.$sum] || 0);
                      } else if (expr.$avg) {
                        // Упрощенный расчет среднего
                        if (!grouped[key][`${field}_count`]) grouped[key][`${field}_count`] = 0;
                        if (!grouped[key][`${field}_sum`]) grouped[key][`${field}_sum`] = 0;
                        grouped[key][`${field}_count`]++;
                        grouped[key][`${field}_sum`] += doc[expr.$avg] || 0;
                        grouped[key][field] = grouped[key][`${field}_sum`] / grouped[key][`${field}_count`];
                      } else if (expr.$count) {
                        grouped[key][field] = (grouped[key][field] || 0) + 1;
                      }
                    }
                  });
                });
                results = Object.values(grouped);
              }
              break;
            
            case '$project':
              // Проекция полей
              results = results.map((doc: any) => {
                const projected: any = {};
                Object.entries(expression).forEach(([key, value]: [string, any]) => {
                  if (value === 1 || value === true) {
                    projected[key] = doc[key];
                  }
                });
                return projected;
              });
              break;
            
            case '$sort':
              const sortKey = Object.keys(expression)[0];
              const sortOrder = expression[sortKey] || 1;
              results.sort((a: any, b: any) => {
                if (a[sortKey] < b[sortKey]) return -sortOrder;
                if (a[sortKey] > b[sortKey]) return sortOrder;
                return 0;
              });
              break;
            
            case '$limit':
              const limit = parseInt(expression) || expression.$limit || 10;
              results = results.slice(0, limit);
              break;
            
            case '$skip':
              const skip = parseInt(expression) || expression.$skip || 0;
              results = results.slice(skip);
              break;
            
            case '$unwind':
              const unwindField = expression || '$unwind';
              const fieldName = typeof unwindField === 'string' ? unwindField.replace('$', '') : unwindField;
              const unwound: any[] = [];
              results.forEach((doc: any) => {
                const array = doc[fieldName];
                if (Array.isArray(array)) {
                  array.forEach((item: any) => {
                    unwound.push({ ...doc, [fieldName]: item });
                  });
                } else {
                  unwound.push(doc);
                }
              });
              results = unwound;
              break;
          }
        } catch (e) {
          showError(`Ошибка в стадии ${stage.stage}: ${e instanceof Error ? e.message : 'Неверный формат JSON'}`);
          return;
        }
      }

      setAggregationResults(results);
      showSuccess(`Агрегация выполнена. Результатов: ${results.length}`);
    } catch (error) {
      showError(`Ошибка выполнения агрегации: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Database className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">MongoDB</h2>
              <p className="text-sm text-muted-foreground mt-1">Document database management</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">v7.0</Badge>
            <Badge variant="secondary" className="gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              Connected
            </Badge>
          </div>
        </div>

        <Separator />

        {/* Connection Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Connection Settings</CardTitle>
            <CardDescription>Configure MongoDB connection parameters</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>
                Host <span className="text-destructive">*</span>
              </Label>
              <Input
                value={host}
                onChange={(e) => {
                  updateConfig({ host: e.target.value });
                  if (fieldErrors.host) {
                    validateConnectionFields();
                  }
                }}
                onBlur={validateConnectionFields}
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
              <Label>
                Port <span className="text-destructive">*</span>
              </Label>
              <Input
                type="number"
                value={port}
                onChange={(e) => {
                  updateConfig({ port: parseInt(e.target.value) || 27017 });
                  if (fieldErrors.port) {
                    validateConnectionFields();
                  }
                }}
                onBlur={validateConnectionFields}
                className={portError || portConflict.hasConflict || fieldErrors.port ? 'border-destructive' : ''}
              />
              {portError && (
                <div className="flex items-center gap-1 text-sm text-destructive">
                  <AlertCircle className="h-3 w-3" />
                  <span>{portError}</span>
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
                    {!portError && fieldErrors.port && (
                      <div className="flex items-center gap-1 text-sm text-destructive">
                        <AlertCircle className="h-3 w-3" />
                        <span>{fieldErrors.port}</span>
                      </div>
                    )}
            </div>
            <div className="space-y-2">
              <Label>
                Database <span className="text-destructive">*</span>
              </Label>
              <Input
                value={database}
                onChange={(e) => {
                  updateConfig({ database: e.target.value });
                  if (fieldErrors.database) {
                    validateConnectionFields();
                  }
                }}
                onBlur={validateConnectionFields}
                className={fieldErrors.database ? 'border-destructive' : ''}
              />
              {fieldErrors.database && (
                <div className="flex items-center gap-1 text-sm text-destructive">
                  <AlertCircle className="h-3 w-3" />
                  <span>{fieldErrors.database}</span>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Username</Label>
              <Input
                value={username}
                onChange={(e) => updateConfig({ username: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => updateConfig({ password: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Auth Source</Label>
              <Input
                value={authSource}
                onChange={(e) => updateConfig({ authSource: e.target.value })}
              />
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
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="collections" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="collections" className="gap-2">
              <FileText className="h-4 w-4" />
              Collections
            </TabsTrigger>
            <TabsTrigger value="documents" className="gap-2">
              <Database className="h-4 w-4" />
              Documents
            </TabsTrigger>
            <TabsTrigger value="aggregations" className="gap-2">
              <Filter className="h-4 w-4" />
              Aggregations
            </TabsTrigger>
            <TabsTrigger value="replication" className="gap-2">
              <Copy className="h-4 w-4" />
              Replication
            </TabsTrigger>
            <TabsTrigger value="sharding" className="gap-2">
              <Network className="h-4 w-4" />
              Sharding
            </TabsTrigger>
          </TabsList>

          {/* Collections Tab */}
          <TabsContent value="collections" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="flex items-center justify-between">
                <div>
                  <CardTitle>Collections</CardTitle>
                  <CardDescription>Manage database collections and indexes</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowCreateCollection(true);
                    setNewCollectionName(''); // Сброс при открытии
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Collection
                </Button>
              </CardHeader>
              {showCreateCollection && (
                <CardContent className="border-b pb-4 mb-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>
                        Collection Name <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        value={newCollectionName}
                        onChange={(e) => setNewCollectionName(e.target.value)}
                        placeholder="my_collection"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            addCollection();
                          }
                        }}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={addCollection}>Create Collection</Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowCreateCollection(false);
                          setNewCollectionName('');
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </CardContent>
              )}
              <CardContent className="space-y-3">
                {collections.map((collection, index) => (
                  <div key={index} className="p-4 border border-border rounded-lg bg-card space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="font-semibold">{collection.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {collection.documentCount || 0} documents • {collection.size || 0} MB
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingCollectionIndex(editingCollectionIndex === index ? null : index)}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          {editingCollectionIndex === index ? 'Hide' : 'Edit'}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => removeCollection(index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {editingCollectionIndex === index && (
                      <div className="space-y-4 pt-3 border-t">
                        {/* Indexes */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label>Indexes</Label>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedCollectionForIndex(collection.name);
                                setEditingIndexName(null); // Режим создания
                                setShowCreateIndex(true);
                                // Сброс формы при открытии
                                setNewIndexName('');
                                setNewIndexKeys('{}');
                                setNewIndexUnique(false);
                                setNewIndexSparse(false);
                                setNewIndexBackground(false);
                              }}
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Add Index
                            </Button>
                          </div>
                          
                          {/* Форма создания/редактирования индекса */}
                          {showCreateIndex && selectedCollectionForIndex === collection.name && (
                            <div className="p-4 border rounded-lg bg-muted/30 space-y-3">
                              <div className="flex items-center justify-between">
                                <h4 className="font-semibold text-sm">
                                  {editingIndexName ? 'Edit Index' : 'Create Index'}
                                </h4>
                                {editingIndexName && (
                                  <Badge variant="secondary">Editing: {editingIndexName}</Badge>
                                )}
                              </div>
                              <div className="space-y-2">
                                <Label>
                                  Index Name <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                  value={newIndexName}
                                  onChange={(e) => setNewIndexName(e.target.value)}
                                  placeholder="my_index"
                                  className="font-mono text-sm"
                                  disabled={editingIndexName !== null && editingIndexName === '_id_'} // Нельзя редактировать системный индекс _id_
                                />
                                {editingIndexName === '_id_' && (
                                  <p className="text-xs text-muted-foreground">
                                    Системный индекс _id_ нельзя переименовать
                                  </p>
                                )}
                              </div>
                              <div className="space-y-2">
                                <Label>
                                  Index Keys (JSON) <span className="text-destructive">*</span>
                                </Label>
                                <Textarea
                                  className="font-mono text-xs"
                                  rows={3}
                                  value={newIndexKeys}
                                  onChange={(e) => setNewIndexKeys(e.target.value)}
                                  placeholder='{"field1": 1, "field2": -1}'
                                />
                                <p className="text-xs text-muted-foreground">
                                  Значения: 1 (ascending), -1 (descending), "text", "2dsphere", "hashed"
                                </p>
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                  <Switch
                                    checked={newIndexUnique}
                                    onCheckedChange={setNewIndexUnique}
                                  />
                                  <Label className="text-sm">Unique</Label>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Switch
                                    checked={newIndexSparse}
                                    onCheckedChange={setNewIndexSparse}
                                  />
                                  <Label className="text-sm">Sparse</Label>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Switch
                                    checked={newIndexBackground}
                                    onCheckedChange={setNewIndexBackground}
                                  />
                                  <Label className="text-sm">Background</Label>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => addIndex(collection.name)}
                                >
                                  {editingIndexName ? 'Save Changes' : 'Create Index'}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setShowCreateIndex(false);
                                    setSelectedCollectionForIndex(null);
                                    setEditingIndexName(null);
                                    setNewIndexName('');
                                    setNewIndexKeys('{}');
                                    setNewIndexUnique(false);
                                    setNewIndexSparse(false);
                                    setNewIndexBackground(false);
                                  }}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          )}
                          
                          {collection.indexes && collection.indexes.length > 0 && (
                            <div className="space-y-2">
                              {collection.indexes.map((idx, idxIndex) => (
                                <div key={idxIndex} className="p-2 border rounded bg-muted/50 flex items-center justify-between">
                                  <div className="space-y-1 flex-1">
                                    <div className="font-mono text-sm">{idx.name}</div>
                                    <div className="text-xs text-muted-foreground">
                                      {Object.entries(idx.keys).map(([key, value]) => `${key}: ${value}`).join(', ')}
                                      {idx.unique && ' • unique'}
                                      {idx.sparse && ' • sparse'}
                                      {idx.background && ' • background'}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => startEditIndex(collection.name, idx.name)}
                                      title="Edit index"
                                    >
                                      <Edit className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => removeIndex(collection.name, idx.name)}
                                      title="Delete index"
                                      disabled={idx.name === '_id_'} // Нельзя удалить системный индекс
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Schema Validation */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <Label>Schema Validation</Label>
                            <Switch
                              checked={collection.validation !== undefined && collection.validation !== null}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  updateCollection(index, 'validation', {
                                    validator: {},
                                    validationLevel: 'strict',
                                    validationAction: 'error'
                                  });
                                } else {
                                  updateCollection(index, 'validation', undefined);
                                }
                              }}
                            />
                          </div>
                          {collection.validation && (
                            <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
                              <div className="space-y-2">
                                <Label>
                                  Validation Schema (JSON) <span className="text-destructive">*</span>
                                </Label>
                                <Textarea
                                  className="font-mono text-xs"
                                  rows={4}
                                  value={JSON.stringify(collection.validation.validator, null, 2)}
                                  onChange={(e) => {
                                    try {
                                      const parsed = JSON.parse(e.target.value);
                                      updateCollection(index, 'validation', {
                                        ...collection.validation,
                                        validator: parsed
                                      });
                                    } catch (error) {
                                      showError(`Неверный формат JSON: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
                                    }
                                  }}
                                  placeholder='{"$jsonSchema": {"required": ["name", "email"], "properties": {"name": {"type": "string"}, "email": {"type": "string"}}}}'
                                />
                                <p className="text-xs text-muted-foreground">
                                  Используйте MongoDB JSON Schema для валидации документов
                                </p>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label>Validation Level</Label>
                                  <Select
                                    value={collection.validation.validationLevel || 'strict'}
                                    onValueChange={(value: 'off' | 'strict' | 'moderate') => {
                                      updateCollection(index, 'validation', {
                                        ...collection.validation,
                                        validationLevel: value
                                      });
                                    }}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="off">Off</SelectItem>
                                      <SelectItem value="moderate">Moderate</SelectItem>
                                      <SelectItem value="strict">Strict</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <p className="text-xs text-muted-foreground">
                                    {collection.validation.validationLevel === 'off' && 'Валидация отключена'}
                                    {collection.validation.validationLevel === 'moderate' && 'Валидация только для новых и измененных документов'}
                                    {collection.validation.validationLevel === 'strict' && 'Валидация для всех документов'}
                                  </p>
                                </div>
                                <div className="space-y-2">
                                  <Label>Validation Action</Label>
                                  <Select
                                    value={collection.validation.validationAction || 'error'}
                                    onValueChange={(value: 'error' | 'warn') => {
                                      updateCollection(index, 'validation', {
                                        ...collection.validation,
                                        validationAction: value
                                      });
                                    }}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="error">Error (Reject)</SelectItem>
                                      <SelectItem value="warn">Warn (Log only)</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <p className="text-xs text-muted-foreground">
                                    {collection.validation.validationAction === 'error' && 'Отклонять невалидные документы'}
                                    {collection.validation.validationAction === 'warn' && 'Только предупреждать о невалидных документах'}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="flex items-center justify-between">
                <div>
                  <CardTitle>Documents</CardTitle>
                  <CardDescription>View and manage collection documents</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Select value={selectedCollection} onValueChange={(value) => updateConfig({ selectedCollection: value })}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Select collection" />
                    </SelectTrigger>
                    <SelectContent>
                      {collections.map((col, idx) => (
                        <SelectItem key={idx} value={col.name}>{col.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" onClick={() => setShowCreateDocument(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Insert Document
                  </Button>
                </div>
              </CardHeader>
              {showCreateDocument && (
                <CardContent className="border-b pb-4 mb-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Document (JSON)</Label>
                      <Textarea
                        className="font-mono text-sm"
                        rows={6}
                        value={newDocument}
                        onChange={(e) => setNewDocument(e.target.value)}
                        placeholder='{"name": "John", "email": "john@example.com"}'
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={addDocumentToCollection}>Insert Document</Button>
                      <Button variant="outline" onClick={() => {
                        setShowCreateDocument(false);
                        setNewDocument('{}');
                      }}>Cancel</Button>
                    </div>
                  </div>
                </CardContent>
              )}
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Query Filter (JSON)</Label>
                  <div className="flex gap-2">
                    <Input
                      className="font-mono text-sm"
                      value={queryFilter}
                      onChange={(e) => setQueryFilter(e.target.value)}
                      placeholder='{"status": "active"}'
                    />
                    <Button variant="outline" size="sm" onClick={findDocuments}>
                      <Search className="h-4 w-4 mr-2" />
                      Find
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  {selectedCollection ? (
                    (() => {
                      const collection = collections.find(c => c.name === selectedCollection);
                      const collectionDocs = collection?.documents || [];
                      
                      // Применяем фильтр если есть
                      let filteredDocs = collectionDocs;
                      if (queryFilter.trim()) {
                        try {
                          const filter = JSON.parse(queryFilter);
                          filteredDocs = collectionDocs.filter((doc: Document) => {
                            for (const [key, value] of Object.entries(filter)) {
                              if (doc[key] !== value) return false;
                            }
                            return true;
                          });
                        } catch (e) {
                          // Invalid filter, show all
                        }
                      }

                      return filteredDocs.length > 0 ? (
                        filteredDocs.map((doc: Document, idx: number) => (
                          <div key={doc._id || idx} className="p-3 border rounded bg-muted/50 font-mono text-xs flex items-start justify-between">
                            <pre className="flex-1">{JSON.stringify(doc, null, 2)}</pre>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="ml-2 h-6 w-6"
                              onClick={() => removeDocumentFromCollection(selectedCollection, doc._id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))
                      ) : (
                        <div className="text-center text-muted-foreground py-8">
                          {queryFilter.trim() ? 'No documents match the filter' : 'No documents in this collection. Insert a document to get started.'}
                        </div>
                      );
                    })()
                  ) : (
                    <div className="text-center text-muted-foreground py-8">
                      Select a collection to view documents
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aggregations Tab */}
          <TabsContent value="aggregations" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="flex items-center justify-between">
                <div>
                  <CardTitle>Aggregation Pipeline</CardTitle>
                  <CardDescription>Build MongoDB aggregation pipelines</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Select 
                    value={aggregationCollection} 
                    onValueChange={setAggregationCollection}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Select collection" />
                    </SelectTrigger>
                    <SelectContent>
                      {collections.map((col, idx) => (
                        <SelectItem key={idx} value={col.name}>{col.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" onClick={addAggregationStage}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Stage
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={executeAggregation}
                    disabled={!aggregationCollection || aggregationPipeline.length === 0}
                  >
                    <Search className="h-4 w-4 mr-2" />
                    Execute
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {aggregationPipeline.map((stage, index) => (
                  <div key={index} className="p-4 border border-border rounded-lg bg-card space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Select
                          value={stage.stage}
                          onValueChange={(value) => updateAggregationStage(index, 'stage', value)}
                        >
                          <SelectTrigger className="w-48">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="$match">$match</SelectItem>
                            <SelectItem value="$group">$group</SelectItem>
                            <SelectItem value="$project">$project</SelectItem>
                            <SelectItem value="$sort">$sort</SelectItem>
                            <SelectItem value="$limit">$limit</SelectItem>
                            <SelectItem value="$skip">$skip</SelectItem>
                            <SelectItem value="$unwind">$unwind</SelectItem>
                            <SelectItem value="$lookup">$lookup</SelectItem>
                          </SelectContent>
                        </Select>
                        <div className="text-xs text-muted-foreground">Stage Type</div>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => removeAggregationStage(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="space-y-2">
                      <Label>Expression (JSON)</Label>
                      <Textarea
                        className="font-mono text-xs"
                        rows={3}
                        value={stage.expression}
                        onChange={(e) => updateAggregationStage(index, 'expression', e.target.value)}
                        placeholder='{"status": "active"}'
                      />
                    </div>
                  </div>
                ))}
                {aggregationPipeline.length === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    No aggregation stages. Add a stage to build your pipeline.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Aggregation Results */}
            {aggregationResults.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Aggregation Results</CardTitle>
                  <CardDescription>
                    {aggregationResults.length} document(s) returned
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 max-h-96 overflow-y-auto">
                  {aggregationResults.map((result, idx) => (
                    <div key={idx} className="p-3 border rounded bg-muted/50 font-mono text-xs">
                      <pre>{JSON.stringify(result, null, 2)}</pre>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Replication Tab */}
          <TabsContent value="replication" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Replica Set Configuration</CardTitle>
                <CardDescription>Configure MongoDB replica set members</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Enable Replica Set</Label>
                    <p className="text-sm text-muted-foreground">Enable MongoDB replica set for high availability</p>
                  </div>
                  <Switch
                    checked={enableReplicaSet}
                    onCheckedChange={(checked) => updateConfig({ enableReplicaSet: checked })}
                  />
                </div>
                {enableReplicaSet && (
                  <>
                    <div className="space-y-2">
                      <Label>Replica Set Name</Label>
                      <Input
                        value={replicaSetName}
                        onChange={(e) => updateConfig({ replicaSetName: e.target.value })}
                      />
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Replica Set Members</Label>
                        <Button variant="outline" size="sm" onClick={addReplicaSetMember}>
                          <Plus className="h-4 w-4 mr-2" />
                          Add Member
                        </Button>
                      </div>
                      {replicaSetMembers.map((member, index) => (
                        <div key={index} className="p-4 border border-border rounded-lg bg-card space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="grid grid-cols-4 gap-4 flex-1">
                              <div className="space-y-2">
                                <Label>Host</Label>
                                <Input
                                  value={member.host}
                                  onChange={(e) => {
                                    const updated = [...replicaSetMembers];
                                    updated[index] = { ...updated[index], host: e.target.value };
                                    updateConfig({ replicaSetMembers: updated });
                                  }}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Port</Label>
                                <Input
                                  type="number"
                                  value={member.port}
                                  onChange={(e) => {
                                    const updated = [...replicaSetMembers];
                                    updated[index] = { ...updated[index], port: parseInt(e.target.value) || 27017 };
                                    updateConfig({ replicaSetMembers: updated });
                                  }}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Priority</Label>
                                <Input
                                  type="number"
                                  value={member.priority || 1}
                                  onChange={(e) => {
                                    const updated = [...replicaSetMembers];
                                    updated[index] = { ...updated[index], priority: parseInt(e.target.value) || 1 };
                                    updateConfig({ replicaSetMembers: updated });
                                  }}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Votes</Label>
                                <Input
                                  type="number"
                                  value={member.votes || 1}
                                  onChange={(e) => {
                                    const updated = [...replicaSetMembers];
                                    updated[index] = { ...updated[index], votes: parseInt(e.target.value) || 1 };
                                    updateConfig({ replicaSetMembers: updated });
                                  }}
                                />
                              </div>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => removeReplicaSetMember(index)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={member.arbiterOnly || false}
                              onCheckedChange={(checked) => {
                                const updated = [...replicaSetMembers];
                                updated[index] = { ...updated[index], arbiterOnly: checked };
                                updateConfig({ replicaSetMembers: updated });
                              }}
                            />
                            <Label>Arbiter Only</Label>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Sharding Tab */}
          <TabsContent value="sharding" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Sharding Configuration</CardTitle>
                <CardDescription>Configure MongoDB sharding for horizontal scaling</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Enable Sharding</Label>
                    <p className="text-sm text-muted-foreground">Enable sharding for distributed data storage</p>
                  </div>
                  <Switch
                    checked={enableSharding}
                    onCheckedChange={(checked) => updateConfig({ enableSharding: checked })}
                  />
                </div>
                {enableSharding && (
                  <>
                    <div className="space-y-2">
                      <Label>Shard Key (JSON)</Label>
                      <Textarea
                        className="font-mono text-xs"
                        rows={3}
                        value={JSON.stringify(shardConfig.shardKey, null, 2)}
                        onChange={(e) => {
                          try {
                            const parsed = JSON.parse(e.target.value);
                            updateConfig({ shardConfig: { ...shardConfig, shardKey: parsed } });
                          } catch (error) {
                            showError(`Неверный формат JSON: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
                          }
                        }}
                        placeholder='{"_id": "hashed"}'
                      />
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Shards</Label>
                        <Button variant="outline" size="sm" onClick={addShard}>
                          <Plus className="h-4 w-4 mr-2" />
                          Add Shard
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {shardConfig.shards.map((shard, index) => (
                          <div key={index} className="p-3 border rounded bg-muted/50 flex items-center justify-between">
                            <span className="font-mono">{shard}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                updateConfig({
                                  shardConfig: {
                                    ...shardConfig,
                                    shards: shardConfig.shards.filter((_, i) => i !== index)
                                  }
                                });
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}


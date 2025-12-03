import { useMemo } from 'react';
import { useCanvasStore } from '@/store/useCanvasStore';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, ExternalLink } from 'lucide-react';
import { ComponentProfile, ConfigField, ConfigFieldValue } from './types';
import { deepClone } from '@/lib/deepClone';

interface ProfileConfigRendererProps {
  componentId: string;
  componentType: string;
  profiles: Record<string, ComponentProfile>;
  emptyState?: React.ReactNode;
}

export function ProfileConfigRenderer({
  componentId,
  componentType,
  profiles,
  emptyState,
}: ProfileConfigRendererProps) {
  const profile = profiles[componentType];
  const { nodes, updateNode } = useCanvasStore();
  const node = nodes.find((n) => n.id === componentId);

  const config = useMemo(() => {
    if (!node?.data.config) return {};
    return node.data.config as Record<string, ConfigFieldValue>;
  }, [node]);

  if (!profile) {
    return (
      <div className="p-6 text-muted-foreground">
        {emptyState || `Конфигурация для компонента ${componentType} пока не реализована.`}
      </div>
    );
  }

  if (!node) {
    return <div className="p-6 text-muted-foreground">Компонент не найден</div>;
  }

  const persistConfig = (nextConfig: Record<string, ConfigFieldValue>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: nextConfig,
      },
    });
  };

  const getFieldValue = (fieldId: string): ConfigFieldValue => {
    const value = config[fieldId];
    if (value === undefined) {
      return deepClone(profile.defaults[fieldId]);
    }
    return value;
  };

  const handleFieldChange = (fieldId: string, value: ConfigFieldValue) => {
    persistConfig({
      ...config,
      [fieldId]: value,
    });
  };

  const renderFieldControl = (field: ConfigField) => {
    const value = getFieldValue(field.id);

    switch (field.type) {
      case 'text':
        return (
          <Input
            value={typeof value === 'string' ? value : ''}
            placeholder={field.placeholder}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
          />
        );
      case 'textarea':
        return (
          <Textarea
            value={typeof value === 'string' ? value : ''}
            placeholder={field.placeholder}
            rows={4}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
          />
        );
      case 'number':
        return (
          <Input
            type="number"
            value={typeof value === 'number' ? value : Number(value) || 0}
            min={field.min}
            max={field.max}
            step={field.step}
            onChange={(e) => handleFieldChange(field.id, Number(e.target.value))}
          />
        );
      case 'select':
        return (
          <select
            className="h-9 rounded-md border border-border bg-transparent px-3 text-sm"
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
          >
            {(field.options || []).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );
      case 'toggle':
        return (
          <div className="flex items-center gap-2">
            <Switch
              checked={Boolean(value)}
              onCheckedChange={(checked) => handleFieldChange(field.id, checked)}
            />
            <span className="text-sm text-muted-foreground">{Boolean(value) ? 'Вкл.' : 'Выкл.'}</span>
          </div>
        );
      case 'list': {
        const listValue = Array.isArray(value) ? value : [];
        const canRemove = listValue.length > 1;

        const updateItem = (index: number, next: string) => {
          const updated = [...listValue];
          updated[index] = next;
          handleFieldChange(field.id, updated);
        };

        const removeItem = (index: number) => {
          if (!canRemove) return;
          handleFieldChange(
            field.id,
            listValue.filter((_, i) => i !== index)
          );
        };

        const addItem = () => {
          handleFieldChange(field.id, [...listValue, field.defaultListItem || 'new-item']);
        };

        return (
          <div className="space-y-2">
            {listValue.map((item, index) => (
              <div key={`${field.id}-${index}`} className="flex gap-2">
                <Input
                  className="flex-1"
                  value={item}
                  onChange={(e) => updateItem(index, e.target.value)}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={!canRemove}
                  onClick={() => removeItem(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}

            <Button variant="outline" size="sm" onClick={addItem}>
              <Plus className="h-4 w-4 mr-2" />
              Добавить
            </Button>
          </div>
        );
      }
      default:
        return null;
    }
  };

  const renderField = (field: ConfigField) => (
    <div key={field.id} className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={field.id}>{field.label}</Label>
        {field.suffix && <Badge variant="outline">{field.suffix}</Badge>}
      </div>
      {field.description && <p className="text-xs text-muted-foreground">{field.description}</p>}
      {renderFieldControl(field)}
    </div>
  );

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase text-muted-foreground tracking-wide">
              {profile.badge || 'Component'}
            </p>
            <h2 className="text-2xl font-bold text-foreground">{profile.title}</h2>
            <p className="text-sm text-muted-foreground mt-1">{profile.description}</p>
          </div>
          {profile.docsUrl && (
            <Button variant="ghost" size="sm" asChild>
              <a href={profile.docsUrl} target="_blank" rel="noreferrer">
                Документация
                <ExternalLink className="h-4 w-4 ml-2" />
              </a>
            </Button>
          )}
        </div>

        <Separator />

        {profile.sections.map((section, sectionIndex) => (
          <div key={section.id} className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-foreground">{section.title}</h3>
              {section.description && (
                <p className="text-sm text-muted-foreground">{section.description}</p>
              )}
            </div>
            <div className="grid gap-4">
              {section.fields.map((field) => renderField(field))}
            </div>
            {sectionIndex < profile.sections.length - 1 && <Separator />}
          </div>
        ))}
      </div>
    </div>
  );
}


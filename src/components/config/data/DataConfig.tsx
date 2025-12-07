import { ComponentType } from '@/types';
import { ProfileConfigRenderer } from '../shared/ProfileConfigRenderer';
import { DATA_PROFILES } from './profiles';

interface DataConfigProps {
  componentId: string;
  componentType: ComponentType['type'];
}

export function DataConfig({ componentId, componentType }: DataConfigProps) {
  return (
    <ProfileConfigRenderer
      componentId={componentId}
      componentType={componentType}
      profiles={DATA_PROFILES}
      emptyState="Конфигурация для компонента данных пока недоступна."
    />
  );
}


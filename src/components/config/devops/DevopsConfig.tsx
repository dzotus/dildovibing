import { ComponentType } from '@/types';
import { ProfileConfigRenderer } from '../shared/ProfileConfigRenderer';
import { DEVOPS_PROFILES } from './profiles';

interface DevopsConfigProps {
  componentId: string;
  componentType: ComponentType['type'];
}

export function DevopsConfig({ componentId, componentType }: DevopsConfigProps) {
  return (
    <ProfileConfigRenderer
      componentId={componentId}
      componentType={componentType}
      profiles={DEVOPS_PROFILES}
      emptyState="Конфигурация для DevOps компонента пока недоступна."
    />
  );
}


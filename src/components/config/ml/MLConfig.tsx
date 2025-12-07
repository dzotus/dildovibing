import { ComponentType } from '@/types';
import { ProfileConfigRenderer } from '../shared/ProfileConfigRenderer';
import { ML_PROFILES } from './profiles';

interface MLConfigProps {
  componentId: string;
  componentType: ComponentType['type'];
}

export function MLConfig({ componentId, componentType }: MLConfigProps) {
  return (
    <ProfileConfigRenderer
      componentId={componentId}
      componentType={componentType}
      profiles={ML_PROFILES}
      emptyState="Конфигурация для ML компонента пока недоступна."
    />
  );
}


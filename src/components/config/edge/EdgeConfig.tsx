import { ComponentType } from '@/types';
import { ProfileConfigRenderer } from '../shared/ProfileConfigRenderer';
import { EDGE_PROFILES } from './profiles';

interface EdgeConfigProps {
  componentId: string;
  componentType: ComponentType['type'];
}

export function EdgeConfig({ componentId, componentType }: EdgeConfigProps) {
  return (
    <ProfileConfigRenderer
      componentId={componentId}
      componentType={componentType}
      profiles={EDGE_PROFILES}
      emptyState="Конфигурация для edge компонента пока недоступна."
    />
  );
}


import { ComponentType } from '@/types';
import { ProfileConfigRenderer } from '../shared/ProfileConfigRenderer';
import { OBSERVABILITY_PROFILES } from './profiles';

interface ObservabilityConfigProps {
  componentId: string;
  componentType: ComponentType['type'];
}

export function ObservabilityConfig({ componentId, componentType }: ObservabilityConfigProps) {
  return (
    <ProfileConfigRenderer
      componentId={componentId}
      componentType={componentType}
      profiles={OBSERVABILITY_PROFILES}
      emptyState="Конфигурация для компонента observability пока недоступна."
    />
  );
}


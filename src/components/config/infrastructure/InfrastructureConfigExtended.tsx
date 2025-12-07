import { ComponentType } from '@/types';
import { ProfileConfigRenderer } from '../shared/ProfileConfigRenderer';
import { INFRASTRUCTURE_PROFILES } from './profiles';

interface InfrastructureConfigExtendedProps {
  componentId: string;
  componentType: ComponentType['type'];
}

export function InfrastructureConfigExtended({ componentId, componentType }: InfrastructureConfigExtendedProps) {
  return (
    <ProfileConfigRenderer
      componentId={componentId}
      componentType={componentType}
      profiles={INFRASTRUCTURE_PROFILES}
      emptyState="Конфигурация для инфраструктурного компонента пока недоступна."
    />
  );
}


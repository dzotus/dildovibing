import { ComponentType } from '@/types';
import { ProfileConfigRenderer } from '../shared/ProfileConfigRenderer';
import { INTEGRATION_PROFILES } from './profiles';

interface IntegrationConfigProps {
  componentId: string;
  componentType: ComponentType['type'];
}

export function IntegrationConfig({ componentId, componentType }: IntegrationConfigProps) {
  return (
    <ProfileConfigRenderer
      componentId={componentId}
      componentType={componentType}
      profiles={INTEGRATION_PROFILES}
      emptyState="Конфигурация для интеграционного компонента пока недоступна."
    />
  );
}


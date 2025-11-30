import { ComponentType } from '@/types';
import { ProfileConfigRenderer } from '../shared/ProfileConfigRenderer';
import { KongConfig } from './KongConfig';
import { INTEGRATION_PROFILES } from './profiles';

interface IntegrationConfigProps {
  componentId: string;
  componentType: ComponentType['type'];
}

export function IntegrationConfig({ componentId, componentType }: IntegrationConfigProps) {
  // Use special GUI component for Kong
  if (componentType === 'kong') {
    return <KongConfig componentId={componentId} />;
  }

  // Use profile-based config for other integration components
  return (
    <ProfileConfigRenderer
      componentId={componentId}
      componentType={componentType}
      profiles={INTEGRATION_PROFILES}
      emptyState="Конфигурация для интеграционного компонента пока недоступна."
    />
  );
}


import { ProfileConfigRenderer } from '@/components/config/shared/ProfileConfigRenderer';
import { NginxConfig } from './NginxConfig';
import { INFRASTRUCTURE_PROFILES } from './profiles';
import type { ComponentType } from '@/types';

interface InfrastructureConfigProps {
  componentId: string;
  componentType: ComponentType['type'];
}

export function InfrastructureConfig({ componentId, componentType }: InfrastructureConfigProps) {
  // Use special GUI component for NGINX
  if (componentType === 'nginx') {
    return <NginxConfig componentId={componentId} />;
  }

  // Use profile-based config for other infrastructure components
  return (
    <ProfileConfigRenderer
      componentId={componentId}
      componentType={componentType}
      profiles={INFRASTRUCTURE_PROFILES}
      emptyState={{
        title: 'Infrastructure Component Configuration',
        description: 'Configuration panel not available for this infrastructure component type',
      }}
    />
  );
}


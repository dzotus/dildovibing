import { ProfileConfigRenderer } from '@/components/config/shared/ProfileConfigRenderer';
import { RestApiConfig } from './RestApiConfig';
import { API_PROFILES } from './profiles';
import type { ComponentType } from '@/types';

interface ApiConfigProps {
  componentId: string;
  componentType: ComponentType['type'];
}

export function ApiConfig({ componentId, componentType }: ApiConfigProps) {
  // Use special GUI component for REST API
  if (componentType === 'rest') {
    return <RestApiConfig componentId={componentId} />;
  }

  // Use profile-based config for other API components
  return (
    <ProfileConfigRenderer
      componentId={componentId}
      componentType={componentType}
      profiles={API_PROFILES}
      emptyState={{
        title: 'API Component Configuration',
        description: 'Configuration panel not available for this API component type',
      }}
    />
  );
}


import { ProfileConfigRenderer } from '@/components/config/shared/ProfileConfigRenderer';
import { KeycloakConfig } from './KeycloakConfig';
import { SECURITY_PROFILES } from './profiles';
import type { ComponentType } from '@/types';

interface SecurityConfigProps {
  componentId: string;
  componentType: ComponentType['type'];
}

export function SecurityConfig({ componentId, componentType }: SecurityConfigProps) {
  // Use special GUI component for Keycloak
  if (componentType === 'keycloak') {
    return <KeycloakConfig componentId={componentId} />;
  }

  // Use profile-based config for other security components
  return (
    <ProfileConfigRenderer
      componentId={componentId}
      componentType={componentType}
      profiles={SECURITY_PROFILES}
      emptyState={{
        title: 'Security Component Configuration',
        description: 'Configuration panel not available for this security component type',
      }}
    />
  );
}


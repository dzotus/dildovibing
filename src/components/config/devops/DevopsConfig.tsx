import { ProfileConfigRenderer } from '@/components/config/shared/ProfileConfigRenderer';
import { JenkinsConfig } from './JenkinsConfig';
import { DEVOPS_PROFILES } from './profiles';
import type { ComponentType } from '@/types';

interface DevopsConfigProps {
  componentId: string;
  componentType: ComponentType['type'];
}

export function DevopsConfig({ componentId, componentType }: DevopsConfigProps) {
  // Use special GUI component for Jenkins
  if (componentType === 'jenkins') {
    return <JenkinsConfig componentId={componentId} />;
  }

  // Use profile-based config for other DevOps components
  return (
    <ProfileConfigRenderer
      componentId={componentId}
      componentType={componentType}
      profiles={DEVOPS_PROFILES}
      emptyState={{
        title: 'DevOps Component Configuration',
        description: 'Configuration panel not available for this DevOps component type',
      }}
    />
  );
}


import { ProfileConfigRenderer } from '@/components/config/shared/ProfileConfigRenderer';
import { EDGE_PROFILES } from './profiles';
import type { ComponentType } from '@/types';

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
      emptyState={{
        title: 'Edge Component Configuration',
        description: 'Configuration panel not available for this edge component type',
      }}
    />
  );
}


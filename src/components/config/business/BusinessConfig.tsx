import { ProfileConfigRenderer } from '@/components/config/shared/ProfileConfigRenderer';
import { BUSINESS_PROFILES } from './profiles';
import type { ComponentType } from '@/types';

interface BusinessConfigProps {
  componentId: string;
  componentType: ComponentType['type'];
}

export function BusinessConfig({ componentId, componentType }: BusinessConfigProps) {
  return (
    <ProfileConfigRenderer
      componentId={componentId}
      componentType={componentType}
      profiles={BUSINESS_PROFILES}
      emptyState={{
        title: 'Business Component Configuration',
        description: 'Configuration panel not available for this business component type',
      }}
    />
  );
}


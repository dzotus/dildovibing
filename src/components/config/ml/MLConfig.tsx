import { ProfileConfigRenderer } from '@/components/config/shared/ProfileConfigRenderer';
import { ML_PROFILES } from './profiles';
import type { ComponentType } from '@/types';

interface MLConfigProps {
  componentId: string;
  componentType: ComponentType['type'];
}

export function MLConfig({ componentId, componentType }: MLConfigProps) {
  return (
    <ProfileConfigRenderer
      componentId={componentId}
      componentType={componentType}
      profiles={ML_PROFILES}
      emptyState={{
        title: 'ML Component Configuration',
        description: 'Configuration panel not available for this ML component type',
      }}
    />
  );
}


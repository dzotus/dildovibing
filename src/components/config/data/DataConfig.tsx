import { ProfileConfigRenderer } from '@/components/config/shared/ProfileConfigRenderer';
import { PostgreSQLConfig } from './PostgreSQLConfig';
import { DATA_PROFILES } from './profiles';
import type { ComponentType } from '@/types';

interface DataConfigProps {
  componentId: string;
  componentType: ComponentType['type'];
}

export function DataConfig({ componentId, componentType }: DataConfigProps) {
  // Use special GUI component for PostgreSQL
  if (componentType === 'postgres') {
    return <PostgreSQLConfig componentId={componentId} />;
  }

  // Use profile-based config for other data components
  return (
    <ProfileConfigRenderer
      componentId={componentId}
      componentType={componentType}
      profiles={DATA_PROFILES}
      emptyState={{
        title: 'Data Component Configuration',
        description: 'Configuration panel not available for this data component type',
      }}
    />
  );
}


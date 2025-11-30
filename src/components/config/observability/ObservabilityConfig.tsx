import { ProfileConfigRenderer } from '@/components/config/shared/ProfileConfigRenderer';
import { PrometheusConfig } from './PrometheusConfig';
import { GrafanaConfig } from './GrafanaConfig';
import { OBSERVABILITY_PROFILES } from './profiles';
import type { ComponentType } from '@/types';

interface ObservabilityConfigProps {
  componentId: string;
  componentType: ComponentType['type'];
}

export function ObservabilityConfig({ componentId, componentType }: ObservabilityConfigProps) {
  // Use special GUI components for Prometheus and Grafana
  if (componentType === 'prometheus') {
    return <PrometheusConfig componentId={componentId} />;
  }

  if (componentType === 'grafana') {
    return <GrafanaConfig componentId={componentId} />;
  }

  // Use profile-based config for other observability components
  return (
    <ProfileConfigRenderer
      componentId={componentId}
      componentType={componentType}
      profiles={OBSERVABILITY_PROFILES}
      emptyState={{
        title: 'Observability Component Configuration',
        description: 'Configuration panel not available for this observability component type',
      }}
    />
  );
}


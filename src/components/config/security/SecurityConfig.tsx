import { ComponentType } from '@/types';
import { ProfileConfigRenderer } from '../shared/ProfileConfigRenderer';
import { SECURITY_PROFILES } from './profiles';

interface SecurityConfigProps {
  componentId: string;
  componentType: ComponentType['type'];
}

export function SecurityConfig({ componentId, componentType }: SecurityConfigProps) {
  return (
    <ProfileConfigRenderer
      componentId={componentId}
      componentType={componentType}
      profiles={SECURITY_PROFILES}
      emptyState="Конфигурация для компонента безопасности пока недоступна."
    />
  );
}


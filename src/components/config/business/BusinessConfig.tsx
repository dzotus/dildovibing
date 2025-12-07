import { ComponentType } from '@/types';
import { ProfileConfigRenderer } from '../shared/ProfileConfigRenderer';
import { BUSINESS_PROFILES } from './profiles';

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
      emptyState="Конфигурация для бизнес-компонента пока недоступна."
    />
  );
}


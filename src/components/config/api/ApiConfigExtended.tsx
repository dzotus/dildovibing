import { ComponentType } from '@/types';
import { ProfileConfigRenderer } from '../shared/ProfileConfigRenderer';
import { API_PROFILES } from './profiles';

interface ApiConfigExtendedProps {
  componentId: string;
  componentType: ComponentType['type'];
}

export function ApiConfigExtended({ componentId, componentType }: ApiConfigExtendedProps) {
  return (
    <ProfileConfigRenderer
      componentId={componentId}
      componentType={componentType}
      profiles={API_PROFILES}
      emptyState="Конфигурация для API компонента пока недоступна."
    />
  );
}


import { MESSAGING_PROFILES } from './profiles';
import { ComponentType } from '@/types';
import { ProfileConfigRenderer } from '../shared/ProfileConfigRenderer';

interface MessagingConfigProps {
  componentId: string;
  componentType: ComponentType['type'];
}

export function MessagingConfig({ componentId, componentType }: MessagingConfigProps) {
  return (
    <ProfileConfigRenderer
      componentId={componentId}
      componentType={componentType}
      profiles={MESSAGING_PROFILES}
    />
  );
}


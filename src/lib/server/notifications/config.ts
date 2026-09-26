import { loadConfig } from '$lib/server/config/app-config';
import type {
  NotificationProviderConfig,
  NotificationProviderId
} from './types';

export function mergeNotificationConfig(
  provider: NotificationProviderId,
  stored: NotificationProviderConfig
): NotificationProviderConfig {
  const fileConfig = loadConfig().notifications[provider];
  return Object.fromEntries(
    Object.entries({ ...stored, ...fileConfig }).filter(
      ([, value]) => value !== undefined && value !== ''
    )
  );
}

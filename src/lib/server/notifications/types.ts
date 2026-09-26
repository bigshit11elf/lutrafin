export type NotificationEventType = 'season_announced' | 'season_released';
export type NotificationProviderId = 'ntfy' | 'gotify' | 'pushover' | 'webhook';

export type NotificationEvent = {
  id: string;
  eventKey: string;
  eventType: NotificationEventType;
  mediaEntityId: string;
  seriesName: string;
  seasonNumber: number;
  airDate: string | null;
  metadataRunId: string | null;
  createdAt: string;
};

export type NotificationPayload = {
  notificationId: string;
  summary: string;
  events: Array<{
    eventKey: string;
    eventType: NotificationEventType;
    seriesName: string;
    seasonNumber: number;
    airDate: string | null;
  }>;
};

export type NotificationProviderConfig = Record<string, unknown>;

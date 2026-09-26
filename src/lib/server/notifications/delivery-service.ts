import { getDatabase } from '$lib/server/infrastructure/database/client';
import {
  notificationProviders,
  SettingsRepository,
  type NotificationProviderId
} from '$lib/server/infrastructure/database/repositories/settings-repository';
import { NotificationRepository } from '$lib/server/infrastructure/database/repositories/notification-repository';
import { mergeNotificationConfig } from './config';
import {
  PermanentNotificationError,
  providerConfigured,
  sendNotification
} from './providers';
import type { NotificationEvent, NotificationPayload } from './types';

const retryDelaysMinutes = [5, 15, 60, 360, 1440];

function summaryFor(events: NotificationEvent[]): string {
  const released = events.filter(
    (event) => event.eventType === 'season_released'
  ).length;
  const announced = events.filter(
    (event) => event.eventType === 'season_announced'
  ).length;
  const parts = [];
  if (released)
    parts.push(`${released} released season${released === 1 ? '' : 's'}`);
  if (announced)
    parts.push(`${announced} announced season${announced === 1 ? '' : 's'}`);
  return `Lutrafin: ${parts.join(', ')}`;
}

function payload(
  notificationId: string,
  summary: string,
  events: NotificationEvent[]
): NotificationPayload {
  return {
    notificationId,
    summary,
    events: events.map((event) => ({
      eventKey: event.eventKey,
      eventType: event.eventType,
      seriesName: event.seriesName,
      seasonNumber: event.seasonNumber,
      airDate: event.airDate
    }))
  };
}

function nextAttempt(now: string, attemptCount: number): string | null {
  if (attemptCount + 1 >= retryDelaysMinutes.length) return null;
  const date = new Date(now);
  date.setUTCMinutes(date.getUTCMinutes() + retryDelaysMinutes[attemptCount]);
  return date.toISOString();
}

export class NotificationDeliveryService {
  constructor(
    private readonly repository = new NotificationRepository(getDatabase()),
    private readonly settings = new SettingsRepository(getDatabase())
  ) {}

  async enqueueAndSendRun(metadataRunId: string): Promise<void> {
    const events = this.repository.eventsForRun(metadataRunId);
    if (events.length === 0) return;

    const summary = summaryFor(events);
    const now = new Date().toISOString();
    for (const provider of notificationProviders) {
      const config = mergeNotificationConfig(
        provider.id,
        this.settings.getNotificationProviderConfig(provider.id)
      );
      if (config.enabled !== true || !providerConfigured(provider.id, config))
        continue;
      const notificationId = crypto.randomUUID();
      this.repository.createDelivery({
        notificationId,
        provider: provider.id,
        summary,
        payloadJson: JSON.stringify(payload(notificationId, summary, events)),
        createdAt: now
      });
    }

    await this.sendDue();
  }

  async sendTest(): Promise<number> {
    const now = new Date().toISOString();
    let queuedCount = 0;
    for (const provider of notificationProviders) {
      const config = mergeNotificationConfig(
        provider.id,
        this.settings.getNotificationProviderConfig(provider.id)
      );
      if (config.enabled !== true || !providerConfigured(provider.id, config))
        continue;
      const notificationId = crypto.randomUUID();
      const summary = 'Lutrafin test notification';
      this.repository.createDelivery({
        notificationId,
        provider: provider.id,
        summary,
        payloadJson: JSON.stringify({ notificationId, summary, events: [] }),
        createdAt: now
      });
      queuedCount += 1;
    }
    await this.sendDue();
    return queuedCount;
  }

  async sendDue(limit = 25): Promise<void> {
    const now = new Date().toISOString();
    for (const delivery of this.repository.claimDueDeliveries(now, limit)) {
      try {
        const provider = delivery.provider as NotificationProviderId;
        const config = mergeNotificationConfig(
          provider,
          this.settings.getNotificationProviderConfig(provider)
        );
        await sendNotification(
          provider,
          config,
          JSON.parse(delivery.payloadJson)
        );
        this.repository.markSent(delivery.id, new Date().toISOString());
      } catch (error) {
        const failedAt = new Date().toISOString();
        const message =
          error instanceof Error ? error.message : 'Notification failed';
        this.repository.markFailed(delivery.id, {
          now: failedAt,
          error: message,
          nextAttemptAt:
            error instanceof PermanentNotificationError
              ? null
              : nextAttempt(failedAt, delivery.attemptCount)
        });
      }
    }
  }
}

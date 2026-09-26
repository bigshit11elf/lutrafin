import { createRefreshSeriesMetadata } from '$lib/server/application/factories/refresh-metadata';
import { createSyncJellyfinLibrary } from '$lib/server/application/factories/sync-jellyfin';
import { durationToMs, loadConfig } from '$lib/server/config/app-config';
import { getDatabase } from '$lib/server/infrastructure/database/client';
import { SettingsRepository } from '$lib/server/infrastructure/database/repositories/settings-repository';
import { NotificationDeliveryService } from '$lib/server/notifications/delivery-service';

let schedulerStarted = false;
const runningJobs = new Set<string>();
let lastMetadataDueRunAt = 0;
let lastJellyfinSyncRunAt = 0;

async function runSafely(
  name: string,
  task: () => Promise<unknown>
): Promise<void> {
  if (runningJobs.has(name)) {
    console.warn(
      JSON.stringify({ level: 'warn', job: name, message: 'already running' })
    );
    return;
  }
  runningJobs.add(name);
  try {
    await task();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    console.warn(JSON.stringify({ level: 'warn', job: name, message }));
  } finally {
    runningJobs.delete(name);
  }
}

function scheduleTick(
  name: string,
  intervalMs: number,
  task: () => Promise<unknown>
): void {
  setTimeout(() => void runSafely(name, task), 1_000);
  setInterval(() => void runSafely(name, task), intervalMs).unref();
}

function fullRefreshDue(
  lastRunAt: string | undefined,
  interval: string,
  now: Date
): boolean {
  if (interval === 'off') return false;
  if (!lastRunAt) return true;
  return (
    now.getTime() - new Date(lastRunAt).getTime() >= durationToMs(interval)
  );
}

export function startBackgroundJobs(): void {
  if (schedulerStarted) {
    return;
  }
  schedulerStarted = true;

  const config = loadConfig();

  if (config.jellyfin?.token) {
    scheduleTick('jellyfin-sync', 60_000, async () => {
      const settings = new SettingsRepository(getDatabase());
      const interval = settings.getJellyfinSyncInterval(config.syncInterval);
      const now = Date.now();
      const intervalMs =
        interval === 'off' ? Number.POSITIVE_INFINITY : durationToMs(interval);
      if (now - lastJellyfinSyncRunAt >= intervalMs) {
        lastJellyfinSyncRunAt = now;
        await createSyncJellyfinLibrary().execute();
      }
    });
  }

  if (config.providers.tmdbApiToken || config.providers.tvmazeEnabled) {
    scheduleTick('metadata-refresh', 60_000, async () => {
      const settings = new SettingsRepository(getDatabase());
      const interval = settings.getMetadataRefreshInterval();
      const now = Date.now();
      const intervalMs =
        interval === 'off' ? Number.POSITIVE_INFINITY : durationToMs(interval);
      if (now - lastMetadataDueRunAt >= intervalMs) {
        lastMetadataDueRunAt = now;
        await createRefreshSeriesMetadata().refreshDue(50);
      }

      const fullInterval = settings.getMetadataFullRefreshInterval();
      const nowDate = new Date();
      if (
        fullRefreshDue(
          settings.getMetadataFullRefreshLastRunAt(),
          fullInterval,
          nowDate
        )
      ) {
        settings.setMetadataFullRefreshLastRunAt(nowDate.toISOString());
        await createRefreshSeriesMetadata().refreshAll(250);
      }
    });
  }

  scheduleTick('notification-retry', 60_000, async () => {
    await new NotificationDeliveryService().sendDue(25);
  });
}

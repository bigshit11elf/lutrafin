import type {
  NotificationPayload,
  NotificationProviderConfig,
  NotificationProviderId
} from './types';

function stringValue(config: NotificationProviderConfig, key: string): string {
  const value = config[key];
  return typeof value === 'string' ? value.trim() : '';
}

export class PermanentNotificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermanentNotificationError';
  }
}

export class RetryableNotificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RetryableNotificationError';
  }
}

function httpUrl(value: string): string {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new PermanentNotificationError(
        'Notification URL must use http or https'
      );
    }
    return url.toString().replace(/\/+$/, '');
  } catch (error) {
    if (error instanceof PermanentNotificationError) throw error;
    throw new PermanentNotificationError('Notification URL is invalid');
  }
}

function errorForStatus(status: number): Error {
  if (status === 408 || status === 429 || status >= 500) {
    return new RetryableNotificationError(`HTTP ${status}`);
  }
  return new PermanentNotificationError(`HTTP ${status}`);
}

function normalizeFetchError(error: unknown): Error {
  if (
    error instanceof PermanentNotificationError ||
    error instanceof RetryableNotificationError
  ) {
    return error;
  }
  if (error instanceof Error && error.name === 'AbortError') {
    return new RetryableNotificationError('Notification request timed out');
  }
  if (error instanceof Error && error.name === 'TimeoutError') {
    return new RetryableNotificationError('Notification request timed out');
  }
  return new RetryableNotificationError('Notification network error');
}

async function fetchNotification(
  url: string,
  init: RequestInit
): Promise<Response> {
  try {
    const response = await fetch(url, {
      ...init,
      redirect: 'error',
      signal: AbortSignal.timeout(10_000)
    });
    if (!response.ok) throw errorForStatus(response.status);
    return response;
  } catch (error) {
    throw normalizeFetchError(error);
  }
}

async function postJson(url: string, body: unknown, headers: HeadersInit = {}) {
  await fetchNotification(httpUrl(url), {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body)
  });
}

export function providerConfigured(
  provider: NotificationProviderId,
  config: NotificationProviderConfig
): boolean {
  if (provider === 'ntfy') {
    return Boolean(
      stringValue(config, 'serverUrl') && stringValue(config, 'topic')
    );
  }
  if (provider === 'gotify') {
    return Boolean(
      stringValue(config, 'serverUrl') && stringValue(config, 'token')
    );
  }
  if (provider === 'pushover') {
    return Boolean(
      stringValue(config, 'userKey') && stringValue(config, 'applicationToken')
    );
  }
  return Boolean(stringValue(config, 'webhookUrl'));
}

export async function sendNotification(
  provider: NotificationProviderId,
  config: NotificationProviderConfig,
  payload: NotificationPayload
): Promise<void> {
  if (!providerConfigured(provider, config)) {
    throw new PermanentNotificationError(`${provider} is not configured`);
  }

  if (provider === 'ntfy') {
    const serverUrl = httpUrl(stringValue(config, 'serverUrl'));
    const topic = encodeURIComponent(stringValue(config, 'topic'));
    const token = stringValue(config, 'token');
    await fetchNotification(`${serverUrl}/${topic}`, {
      method: 'POST',
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        ...(token ? { authorization: `Bearer ${token}` } : {})
      },
      body: payload.summary
    });
    return;
  }

  if (provider === 'gotify') {
    const serverUrl = httpUrl(stringValue(config, 'serverUrl'));
    await postJson(
      `${serverUrl}/message?token=${encodeURIComponent(stringValue(config, 'token'))}`,
      {
        title: 'Lutrafin',
        message: payload.summary,
        priority: Number(config.priority ?? 5),
        extras: { lutrafin: payload }
      }
    );
    return;
  }

  if (provider === 'pushover') {
    const body: Record<string, string> = {
      token: stringValue(config, 'applicationToken'),
      user: stringValue(config, 'userKey'),
      title: 'Lutrafin',
      message: payload.summary,
      priority: String(Number(config.priority ?? 0))
    };
    const device = stringValue(config, 'device');
    if (device) body.device = device;
    const response = await fetchNotification(
      'https://api.pushover.net/1/messages.json',
      {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(body).toString()
      }
    );
    const result = (await response.json().catch(() => ({}))) as {
      status?: number;
      errors?: string[];
    };
    if (result.status === 0) {
      throw new PermanentNotificationError(
        result.errors?.[0] ?? 'Pushover rejected the notification'
      );
    }
    return;
  }

  await postJson(httpUrl(stringValue(config, 'webhookUrl')), payload);
}

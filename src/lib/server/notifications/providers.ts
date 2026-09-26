import type {
  NotificationPayload,
  NotificationProviderConfig,
  NotificationProviderId
} from './types';

function stringValue(config: NotificationProviderConfig, key: string): string {
  const value = config[key];
  return typeof value === 'string' ? value.trim() : '';
}

async function postJson(url: string, body: unknown, headers: HeadersInit = {}) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
    redirect: 'error'
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
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
    throw new Error(`${provider} is not configured`);
  }

  if (provider === 'ntfy') {
    const serverUrl = stringValue(config, 'serverUrl').replace(/\/+$/, '');
    const topic = encodeURIComponent(stringValue(config, 'topic'));
    const token = stringValue(config, 'token');
    const response = await fetch(`${serverUrl}/${topic}`, {
      method: 'POST',
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        ...(token ? { authorization: `Bearer ${token}` } : {})
      },
      body: payload.summary
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return;
  }

  if (provider === 'gotify') {
    const serverUrl = stringValue(config, 'serverUrl').replace(/\/+$/, '');
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
    const body: Record<string, string | number> = {
      token: stringValue(config, 'applicationToken'),
      user: stringValue(config, 'userKey'),
      title: 'Lutrafin',
      message: payload.summary,
      priority: Number(config.priority ?? 0)
    };
    const device = stringValue(config, 'device');
    if (device) body.device = device;
    await postJson('https://api.pushover.net/1/messages.json', body);
    return;
  }

  await postJson(stringValue(config, 'webhookUrl'), payload);
}

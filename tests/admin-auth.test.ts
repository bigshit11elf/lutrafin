import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from '../src/lib/server/config/app-config';
import { _loginClientKey } from '../src/routes/login/session/+server';

describe('admin auth configuration', () => {
  const baseEnv = {
    APP_BASE_URL: 'http://localhost:3000',
    APP_PORT: '3000',
    DATABASE_PATH: './data/test.db',
    SYNC_INTERVAL: '6h',
    METADATA_REFRESH_INTERVAL: '24h',
    LOG_LEVEL: 'info'
  };

  it('rejects an empty admin username when configured', () => {
    expect(() =>
      loadConfig({
        ...baseEnv,
        ADMIN_USERNAME: '',
        ADMIN_PASSWORD: 'secret'
      })
    ).toThrow('ADMIN_USERNAME must not be empty');
  });

  it('rejects a whitespace-only admin username when configured', () => {
    expect(() =>
      loadConfig({
        ...baseEnv,
        ADMIN_USERNAME: '   ',
        ADMIN_PASSWORD: 'secret'
      })
    ).toThrow('ADMIN_USERNAME must not be empty');
  });

  it('trims the configured admin username', () => {
    expect(
      loadConfig({
        ...baseEnv,
        ADMIN_USERNAME: ' admin ',
        ADMIN_PASSWORD: 'secret'
      }).admin
    ).toEqual({ username: 'admin', password: 'secret' });
  });

  it.each([
    ['true', true],
    ['false', false],
    ['1', true],
    ['0', false],
    ['yes', true],
    ['no', false],
    ['on', true],
    ['off', false]
  ])('parses boolean environment value %s', (value, expected) => {
    expect(
      loadConfig({
        ...baseEnv,
        TVMAZE_ENABLED: value,
        TVDB_ENABLED: value
      }).providers
    ).toMatchObject({ tvmazeEnabled: expected, tvdbEnabled: expected });
  });

  it('keeps optional HSTS disabled by default for HTTP home lab deployments', () => {
    expect(loadConfig(baseEnv).security.hstsEnabled).toBe(false);
  });

  it('allows optional HSTS to be enabled explicitly', () => {
    expect(
      loadConfig({ ...baseEnv, SECURITY_HSTS_ENABLED: 'true' }).security
        .hstsEnabled
    ).toBe(true);
  });

  it('uses getClientAddress instead of spoofable X-Forwarded-For', () => {
    expect(_loginClientKey(() => '10.0.0.5')).toBe('10.0.0.5');
  });

  it('loads notification secrets from file variables', () => {
    const directory = mkdtempSync(join(tmpdir(), 'lutrafin-secrets-'));
    try {
      const ntfy = join(directory, 'ntfy.txt');
      const gotify = join(directory, 'gotify.txt');
      const pushoverUser = join(directory, 'pushover-user.txt');
      const pushoverToken = join(directory, 'pushover-token.txt');
      const webhook = join(directory, 'webhook.txt');
      writeFileSync(ntfy, 'ntfy-secret');
      writeFileSync(gotify, 'gotify-secret');
      writeFileSync(pushoverUser, 'pushover-user');
      writeFileSync(pushoverToken, 'pushover-token');
      writeFileSync(webhook, 'http://127.0.0.1:9000/hook');

      expect(
        loadConfig({
          ...baseEnv,
          NTFY_TOKEN_FILE: ntfy,
          GOTIFY_TOKEN_FILE: gotify,
          PUSHOVER_USER_KEY_FILE: pushoverUser,
          PUSHOVER_APPLICATION_TOKEN_FILE: pushoverToken,
          WEBHOOK_URL_FILE: webhook
        }).notifications
      ).toEqual({
        ntfy: { token: 'ntfy-secret' },
        gotify: { token: 'gotify-secret' },
        pushover: {
          userKey: 'pushover-user',
          applicationToken: 'pushover-token'
        },
        webhook: { webhookUrl: 'http://127.0.0.1:9000/hook' }
      });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
